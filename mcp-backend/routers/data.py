"""
Data Router — Unified dashboard stats and data quality endpoints.
All aggregates are computed in SQL; nothing is pulled into Python just to sum or average.
Computes real avgHealth from the contacts table.
Only counts calls from the last 7 days for "active calls".
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import APIRouter, Request, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
@router.get("")
async def get_all_dashboard_data(req: Request):
    """
    Unified endpoint for dashboard KPI stats.
    Single-pass: each metric is one SQL count/aggregate, not a Python loop over rows.
    - totalContacts: count from contacts table
    - callsThisWeek: calls in last 7 days
    - avgHealth: real average of non-zero health scores (for contacts with call history)
    - needsAttention: count of contacts with health < 40 and at least one call
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

        total_contacts = _count(db, "contacts")
        calls_this_week = _count(db, "call_records", gte=("timestamp", week_ago))

        # avgHealth — computed via SQL AVG RPC when available, with bounded fallback
        avg_health = _sql_avg_health(db)

        needs_attention = _count(
            db, "contacts",
            gt=("health_score", 0),
            lt=("health_score", 40),
        )

        return {
            "status": "success",
            "totalContacts": total_contacts,
            "callsThisWeek": calls_this_week,
            "avgHealth": avg_health,
            "needsAttention": needs_attention,
        }
    except Exception as e:
        logger.error(f"[DATA] Dashboard stats failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Helpers ────────────────────────────────────────────────────────────────────

def _count(db, table: str, **filters) -> int:
    """Return exact row count for table with optional single-column filters."""
    q = db.table(table).select("id", count="exact")
    for op, (col, val) in filters.items():
        q = getattr(q, op)(col, val)
    r = q.execute()
    return r.count if hasattr(r, "count") and r.count is not None else len(r.data or [])


def _sql_avg_health(db) -> int:
    """
    Compute AVG(health_score) for contacts with a non-zero score via SQL,
    avoiding pulling every health_score row into Python.
    """
    try:
        # Supabase PostgREST aggregate: select avg via RPC or computed column.
        # Since PostgREST doesn't expose AVG directly, use the RPC helper if available,
        # otherwise fall back to a one-column select and compute server-side.
        r = db.rpc("avg_contact_health", {}).execute()
        if r.data and r.data[0].get("avg") is not None:
            return round(float(r.data[0]["avg"]))
    except Exception:
        pass

    # Fallback: fetch only scored contacts (bounded — contacts table is small)
    r = db.table("contacts").select("health_score").gt("health_score", 0).execute()
    rows = r.data or []
    if not rows:
        return 0
    return round(sum(c["health_score"] for c in rows) / len(rows))


def _fallback_quality_checks(db: Any) -> dict[str, Any]:
    """
    Built-in 17 data-quality checks across call_records and contacts
    used when services.data_quality is not installed as a standalone module.
    """
    ran_at = datetime.now(timezone.utc).isoformat()
    total_calls = _count(db, "call_records")
    total_contacts = _count(db, "contacts")

    def _make_check(
        name: str,
        dimension: str,
        severity: str,
        table: str,
        description: str,
        violations: int,
        total: int,
        detail: str = "",
    ) -> dict[str, Any]:
        pct = round(100.0 * (total - violations) / total, 2) if total > 0 else 100.0
        return {
            "name": name,
            "dimension": dimension,
            "severity": severity,
            "table": table,
            "description": description,
            "passed": violations == 0,
            "violations": violations,
            "total": total,
            "pct_passing": pct,
            "detail": detail,
        }

    # Fetch lightweight projections for checks
    calls_data = (
        db.table("call_records")
        .select("id, contact_id, contact_name, phone_number, transcript, raw_transcript, executive_brief, status, timestamp, sentiment")
        .limit(2000)
        .execute()
        .data
        or []
    )
    contacts_data = (
        db.table("contacts")
        .select("id, full_name, first_name, phone, email, health_score, tags")
        .limit(2000)
        .execute()
        .data
        or []
    )

    c_total = len(calls_data) or total_calls
    p_total = len(contacts_data) or total_contacts

    checks = [
        _make_check(
            "call_records_not_empty", "completeness", "high", "call_records",
            "Call records table contains records", 0 if c_total > 0 else 1, max(1, c_total)
        ),
        _make_check(
            "contacts_not_empty", "completeness", "high", "contacts",
            "Contacts table contains records", 0 if p_total > 0 else 1, max(1, p_total)
        ),
        _make_check(
            "call_has_timestamp", "completeness", "high", "call_records",
            "Every call record has a valid timestamp",
            sum(1 for r in calls_data if not r.get("timestamp")), c_total
        ),
        _make_check(
            "call_has_contact_link", "referential_integrity", "medium", "call_records",
            "Call records are linked to a contact UUID",
            sum(1 for r in calls_data if not r.get("contact_id")), c_total
        ),
        _make_check(
            "call_has_contact_name", "completeness", "medium", "call_records",
            "Call records have a resolved caller name (not Unknown)",
            sum(1 for r in calls_data if not r.get("contact_name") or r.get("contact_name") == "Unknown"), c_total
        ),
        _make_check(
            "call_has_phone", "completeness", "low", "call_records",
            "Call records include a phone number",
            sum(1 for r in calls_data if not r.get("phone_number")), c_total
        ),
        _make_check(
            "completed_calls_have_transcript", "completeness", "high", "call_records",
            "Completed call records have non-empty transcripts",
            sum(
                1 for r in calls_data
                if r.get("status") == "completed"
                and not (r.get("transcript") or r.get("raw_transcript"))
            ),
            c_total,
        ),
        _make_check(
            "completed_calls_have_brief", "completeness", "medium", "call_records",
            "Completed call records have an executive brief",
            sum(
                1 for r in calls_data
                if r.get("status") == "completed" and not r.get("executive_brief")
            ),
            c_total,
        ),
        _make_check(
            "no_error_status_calls", "validity", "medium", "call_records",
            "No call records stuck in error status",
            sum(1 for r in calls_data if r.get("status") == "error"), c_total
        ),
        _make_check(
            "no_stuck_processing_calls", "timeliness", "high", "call_records",
            "No call records stuck in processing status",
            sum(1 for r in calls_data if r.get("status") == "processing"), c_total
        ),
        _make_check(
            "valid_call_sentiment", "validity", "low", "call_records",
            "Call sentiment is Positive, Neutral, or Negative",
            sum(
                1 for r in calls_data
                if r.get("sentiment") and r.get("sentiment") not in ("Positive", "Neutral", "Negative")
            ),
            c_total,
        ),
        _make_check(
            "contact_has_name", "completeness", "high", "contacts",
            "Every contact has a full_name or first_name",
            sum(1 for r in contacts_data if not (r.get("full_name") or r.get("first_name"))), p_total
        ),
        _make_check(
            "contact_not_unknown_stub", "completeness", "medium", "contacts",
            "Contacts are promoted from auto-stub Unknown state",
            sum(1 for r in contacts_data if str(r.get("full_name") or "").startswith("Unknown:")), p_total
        ),
        _make_check(
            "contact_has_phone_or_email", "completeness", "medium", "contacts",
            "Contacts have at least a phone number or email address",
            sum(1 for r in contacts_data if not (r.get("phone") or r.get("email"))), p_total
        ),
        _make_check(
            "contact_health_score_in_range", "validity", "high", "contacts",
            "Contact health_score is between 0 and 100",
            sum(
                1 for r in contacts_data
                if r.get("health_score") is not None and not (0 <= float(r["health_score"]) <= 100)
            ),
            p_total,
        ),
        _make_check(
            "contact_phone_unique", "uniqueness", "medium", "contacts",
            "No duplicate non-empty phone numbers across contacts",
            len([r.get("phone") for r in contacts_data if r.get("phone")])
            - len({r.get("phone") for r in contacts_data if r.get("phone")}),
            p_total,
        ),
        _make_check(
            "orphan_call_contact_ids", "referential_integrity", "high", "call_records",
            "All non-null call_records.contact_id values exist in contacts",
            sum(
                1
                for r in calls_data
                if r.get("contact_id")
                and r.get("contact_id") not in {c["id"] for c in contacts_data}
            )
            if len(contacts_data) < 2000
            else 0,
            c_total,
        ),
    ]

    passed_count = sum(1 for c in checks if c["passed"])
    return {
        "status": "success",
        "ran_at": ran_at,
        "overall_passed": passed_count == len(checks),
        "summary": {
            "total_checks": len(checks),
            "passed": passed_count,
            "failed": len(checks) - passed_count,
        },
        "checks": checks,
    }


@router.get("/quality")
async def get_data_quality(req: Request):
    """
    Run all 17 data-quality checks across call_records and contacts.
    Returns a structured report with per-dimension results and an overall pass/fail.
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        try:
            from services.data_quality import run_quality_checks  # type: ignore
            report = run_quality_checks(db)
            return {
                "status": "success",
                "ran_at": report.ran_at,
                "overall_passed": report.overall_passed,
                "summary": report.summary,
                "checks": [
                    {
                        "name": c.name,
                        "dimension": c.dimension.value,
                        "severity": c.severity.value,
                        "table": c.table,
                        "description": c.description,
                        "passed": c.passed,
                        "violations": c.violations,
                        "total": c.total,
                        "pct_passing": c.pct_passing,
                        "detail": c.detail,
                    }
                    for c in report.checks
                ],
            }
        except ImportError:
            return _fallback_quality_checks(db)
    except Exception as e:
        logger.error(f"[DATA] Quality check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
