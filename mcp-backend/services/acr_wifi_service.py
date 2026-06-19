"""
ACR WiFi Ingestion Service — NLLAPPS ACR Phone HTML Extraction
==============================================================
ACR Phone's WiFi Web Server at port 8000 serves a single ~4MB HTML page
containing ALL recordings AND their transcripts (where available).

Structure per recording entry:
  <li class="date-header">Jun 18, 2026</li>
  <li>
    <a href="/?job=db&id=10867">+1 612-888-3125 @ 6:19 PM</a>
    <p class="tab note">
      00:02\nNewport calling...\n\n00:10\nHow's it going?
    </p>
  </li>

Note: audio file downloads return Content-Length: 0 (server limitation).
All usable data is in the HTML: contact, date/time, transcript.

Flow:
  1. Download the ~4MB listing page once
  2. Parse ALL records with metadata + transcript text
  3. Dedup against call_records (by contact + timestamp)
  4. Bulk-insert new records into call_records
  5. Archive to call_recordings for tracking
  6. Optionally generate AI briefs for transcribed records
"""

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import unquote
from urllib.request import Request as UrlRequest, urlopen

logger = logging.getLogger(__name__)


# ── HTTP Helpers ──────────────────────────────────────────────────────────────

def _fetch_bytes(url: str, timeout: int = 60) -> bytes:
    req = UrlRequest(url, headers={"User-Agent": "HorizonPRM-WiFiSync/1.0", "Accept": "*/*"})
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


# ── HTML Parsing ───────────────────────────────────────────────────────────────

def _parse_listing_page(base_url: str) -> list[dict]:
    """
    Fetch and fully parse the ACR WiFi listing page.

    Returns list of records, each:
      {
        id: int,
        contact_raw: str,     # "Gabby Cajucom" or "+1 612-888-3125"
        phone_raw: str,       # raw phone if contact is a number, else ""
        time_raw: str,        # "5:56 PM"
        date_str: str | None, # "Jun 18, 2026"
        transcript: str,      # full transcript with timestamps (may be "")
        has_transcript: bool,
      }
    """
    listing_url = base_url.rstrip("/") + "/"
    try:
        html_bytes = _fetch_bytes(listing_url, timeout=60)
    except HTTPError as e:
        if e.code in (404, 405):
            html_bytes = _fetch_bytes(base_url.rstrip("/"), timeout=60)
        else:
            raise ConnectionError(f"ACR WiFi server returned HTTP {e.code}: {base_url}")
    except (URLError, OSError) as e:
        raise ConnectionError(f"Cannot reach ACR WiFi server at {base_url}: {e}")

    text = html_bytes.decode("utf-8", errors="replace")
    logger.info(f"[WIFI] Listing page: {len(text):,} bytes from {base_url}")

    # Combined pattern: date headers OR recording entries (with optional transcript)
    pattern = re.compile(
        r'<li[^>]*class="date-header"[^>]*>\s*([^<]+)\s*</li>'
        r'|<li><a\s+href="[^"]*job=db&(?:amp;)?id=(\d+)[^"]*">\s*([^<]+)\s*</a>'
        r'(?:<p[^>]*class="[^"]*note[^"]*"[^>]*>(.*?)</p>)?</li>',
        re.DOTALL | re.IGNORECASE,
    )

    records: list[dict] = []
    current_date: str | None = None
    seen_ids: set[int] = set()

    for m in pattern.finditer(text):
        if m.group(1):
            # Date header
            current_date = m.group(1).strip()
        elif m.group(2):
            record_id = int(m.group(2))
            if record_id in seen_ids:
                continue
            seen_ids.add(record_id)

            display = m.group(3).strip()
            transcript_raw = (m.group(4) or "").strip()

            # Split "Contact @ Time"
            if " @ " in display:
                contact_raw, time_raw = display.rsplit(" @ ", 1)
            else:
                contact_raw = display
                time_raw = ""

            contact_raw = contact_raw.strip()
            time_raw = time_raw.strip()

            # Determine if contact is actually a phone number
            phone_raw = ""
            phone_pattern = re.compile(r"^[\+\d\s\-\(\)]{7,}$")
            if phone_pattern.match(contact_raw):
                phone_raw = contact_raw
                contact_raw = ""  # no name, only number

            records.append({
                "id": record_id,
                "contact_raw": contact_raw,
                "phone_raw": phone_raw,
                "time_raw": time_raw,
                "date_str": current_date,
                "transcript": transcript_raw,
                "has_transcript": bool(transcript_raw),
            })

    transcribed = sum(1 for r in records if r["has_transcript"])
    logger.info(
        f"[WIFI] Parsed {len(records)} unique records "
        f"({transcribed} with transcripts, {len(records) - transcribed} without)"
    )
    return records


def _parse_timestamp(date_str: str | None, time_raw: str) -> str | None:
    """Convert 'Jun 18, 2026' + '5:56 PM' → ISO timestamp string."""
    if not date_str:
        return None
    combined = f"{date_str} {time_raw}".strip()
    for fmt in ("%b %d, %Y %I:%M %p", "%B %d, %Y %I:%M %p", "%b %d, %Y"):
        try:
            dt = datetime.strptime(combined, fmt)
            return dt.replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            pass
    return None


def _clean_transcript(raw: str) -> str:
    """
    Convert ACR's timestamped transcript to clean readable text.
    Input: '00:02\nHello world\n\n00:10\nHow are you?\n'
    Output: 'Hello world How are you?'
    We keep the timestamped format as the raw version but also build clean text.
    """
    # Remove timestamp lines (MM:SS format) and strip blank lines
    lines = []
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped and not re.match(r"^\d{2}:\d{2}$", stripped):
            lines.append(stripped)
    return " ".join(lines)


# ── Database Helpers ───────────────────────────────────────────────────────────

def _get_existing_acr_ids(db: Any) -> set[int]:
    """Return set of ACR record IDs already in call_recordings (fast dedup)."""
    try:
        # We store the ACR ID in parse_notes JSON as "acr_id"
        result = db.table("call_recordings").select("parse_notes").execute()
        ids: set[int] = set()
        for row in (result.data or []):
            try:
                notes = json.loads(row.get("parse_notes") or "{}")
                acr_id = notes.get("acr_id")
                if acr_id:
                    ids.add(int(acr_id))
            except Exception:
                pass
        return ids
    except Exception as e:
        logger.warning(f"[WIFI] Could not fetch existing ACR IDs from DB: {e}")
        return set()


def _link_contact(db: Any, phone: str, name: str) -> str | None:
    """Resolve contact UUID from phone or name."""
    try:
        if phone:
            digits = "".join(c for c in phone if c.isdigit())
            if len(digits) >= 10:
                res = (
                    db.table("contacts").select("id")
                    .ilike("phone", f"%{digits[-10:]}").limit(1).execute()
                )
                if res.data:
                    return res.data[0]["id"]
        if name and name not in ("Unknown", "unknown", ""):
            res = (
                db.table("contacts").select("id")
                .ilike("full_name", f"%{name}%").limit(1).execute()
            )
            if res.data:
                return res.data[0]["id"]
    except Exception as e:
        logger.debug(f"[WIFI] Contact lookup (non-fatal): {e}")
    return None


def _archive_record(db: Any, record: dict) -> bool:
    """Upsert a record into call_recordings for tracking."""
    try:
        record_id = record["id"]
        contact = record["contact_raw"] or record["phone_raw"] or "Unknown"
        db.table("call_recordings").upsert(
            {
                "canonical_name": f"acr_wifi_{record_id}",
                "original_name": f"acr_wifi_{record_id}",
                "status": "COMPLETED" if record["has_transcript"] else "SKIPPED_SHORT",
                "parse_notes": json.dumps({
                    "acr_id": record_id,
                    "source": "acr_wifi_html",
                    "contact": contact,
                    "date": record.get("date_str"),
                    "time": record.get("time_raw"),
                }),
            },
            on_conflict="canonical_name",
        ).execute()
        return True
    except Exception as e:
        logger.debug(f"[WIFI] call_recordings archive failed for id={record['id']}: {e}")
        return False


def _insert_call_record(db: Any, record: dict, contact_id: str | None) -> bool:
    """Insert a WiFi record into call_records."""
    try:
        contact_name = record["contact_raw"] or "Unknown"
        phone_number = record["phone_raw"] or ""
        transcript = record["transcript"]
        clean_text = _clean_transcript(transcript)
        ts = _parse_timestamp(record["date_str"], record["time_raw"])

        payload = {
            "contact_name": contact_name,
            "phone_number": phone_number,
            "acr_channel": "wifi_sync",
            "raw_transcript": transcript or None,
            "transcript": clean_text or None,
            "status": "completed" if transcript else "pending",
            "timestamp": ts or datetime.now(timezone.utc).isoformat(),
            "contact_id": contact_id,
            # Store ACR record ID and date string for reference
            "acr_pattern": f"wifi_{record['id']}",
        }
        db.table("call_records").insert(payload).execute()
        return True
    except Exception as e:
        logger.error(f"[WIFI] call_records insert failed for id={record['id']}: {e}")
        return False


def _generate_brief_for_record(db: Any, record: dict) -> None:
    """Generate and store an AI brief for a transcribed record (best-effort)."""
    if not record["has_transcript"]:
        return
    try:
        from services.ai_briefing_service import generate_call_brief

        contact = record["contact_raw"] or record["phone_raw"] or "Unknown"
        clean_text = _clean_transcript(record["transcript"])
        if len(clean_text) < 30:
            return

        brief = generate_call_brief(clean_text, contact)
        if not brief:
            return

        action_items = brief.get("action_items") or brief.get("actionItems", [])
        sentiment = brief.get("sentiment", "Neutral")
        tags = brief.get("tags", [])
        contact_id = _link_contact(db, record["phone_raw"], record["contact_raw"])

        # Update the call_records row we just inserted with brief data
        ts = _parse_timestamp(record["date_str"], record["time_raw"])
        try:
            (
                db.table("call_records")
                .update({
                    "executive_brief": brief,
                    "sentiment": sentiment,
                    "tags": tags,
                })
                .eq("acr_pattern", f"wifi_{record['id']}")
                .execute()
            )
        except Exception:
            pass

        # Insert action items into tasks
        if action_items:
            task_rows = [
                {
                    "title": item[:120],
                    "description": item,
                    "status": "pending",
                    "source": "ai_brief",
                    "contact_id": contact_id,
                    "contact_name": record["contact_raw"] or "Unknown",
                    "ai_confidence": 0.85,
                }
                for item in action_items
                if isinstance(item, str) and item
            ]
            if task_rows:
                db.table("tasks").insert(task_rows).execute()

        logger.info(f"[WIFI-BRIEF] Brief generated for ACR id={record['id']}")
    except Exception as e:
        logger.warning(f"[WIFI-BRIEF] Brief generation failed for id={record['id']}: {e}")


# ── Public API ──────────────────────────────────────────────────────────────────

def fetch_recording_list(base_url: str) -> list[dict]:
    """Return list of recording descriptors from ACR WiFi server HTML."""
    return _parse_listing_page(base_url)


def wifi_batch_ingest(base_url: str, db: Any) -> dict:
    """
    Full ACR WiFi ingestion pipeline.

    Parses the ~4MB HTML listing page which contains all call metadata and
    transcripts. Inserts new records directly into call_records. No audio
    download required (and audio downloads return empty files anyway).

    Returns: {found, downloaded, skipped, transcribed, errors, error_details}
    """
    base_url = base_url.rstrip("/")

    stats: dict = {
        "found": 0,
        "downloaded": 0,
        "skipped": 0,
        "transcribed": 0,
        "errors": 0,
        "error_details": [],
    }

    # ── Step 1: Parse HTML listing ────────────────────────────────────────────
    try:
        records = _parse_listing_page(base_url)
    except ConnectionError:
        raise
    except Exception as e:
        raise ConnectionError(f"Failed to parse ACR WiFi listing from {base_url}: {e}")

    stats["found"] = len(records)
    if not records:
        logger.warning(f"[WIFI] No records found at {base_url}")
        return stats

    # ── Step 2: Dedup — get existing ACR IDs ────────────────────────────────
    existing_ids = _get_existing_acr_ids(db)
    new_records = [r for r in records if r["id"] not in existing_ids]

    logger.info(
        f"[WIFI] {len(records)} on device | {len(existing_ids)} already archived | "
        f"{len(new_records)} new to ingest"
    )

    if not new_records:
        stats["skipped"] = len(records)
        return stats

    # ── Step 3: Build payloads ────────────────────────────────────────────────
    call_record_rows: list[dict] = []
    archive_rows: list[dict] = []

    for record in new_records:
        record_id = record["id"]
        contact_name = record["contact_raw"] or "Unknown"
        phone = record["phone_raw"]

        try:
            contact_id = _link_contact(db, phone, contact_name)
            transcript = record["transcript"]
            clean_text = _clean_transcript(transcript)
            ts = _parse_timestamp(record["date_str"], record["time_raw"])

            call_record_rows.append({
                "contact_name": contact_name,
                "phone_number": phone or None,
                "acr_channel": "wifi_sync",
                "raw_transcript": transcript or None,
                "transcript": clean_text or None,
                "status": "completed" if transcript else "pending",
                "timestamp": ts or datetime.now(timezone.utc).isoformat(),
                "contact_id": contact_id,
                "acr_pattern": f"wifi_{record_id}",
            })

            archive_rows.append({
                "canonical_name": f"acr_wifi_{record_id}",
                "original_name": f"acr_wifi_{record_id}",
                "status": "COMPLETED" if record["has_transcript"] else "SKIPPED_SHORT",
                "parse_notes": json.dumps({
                    "acr_id": record_id,
                    "source": "acr_wifi_html",
                    "contact": contact_name,
                    "date": record.get("date_str"),
                    "time": record.get("time_raw"),
                }),
            })

            if record["has_transcript"]:
                stats["transcribed"] += 1

        except Exception as e:
            stats["errors"] += 1
            if len(stats["error_details"]) < 30:
                stats["error_details"].append(f"ID {record_id}: {e}")
            logger.error(f"[WIFI] Payload build failed for id={record_id}: {e}")

    # ── Step 4: Bulk insert in batches of 500 ─────────────────────────────────
    BATCH = 500
    for batch_start in range(0, len(call_record_rows), BATCH):
        batch = call_record_rows[batch_start:batch_start + BATCH]
        try:
            db.table("call_records").insert(batch).execute()
            stats["downloaded"] += len(batch)
            logger.info(
                f"[WIFI] Inserted {stats['downloaded']}/{len(call_record_rows)} call_records"
            )
        except Exception as e:
            # Try one-by-one as fallback for failed batches
            logger.warning(f"[WIFI] Batch insert failed, retrying individually: {e}")
            for row in batch:
                try:
                    db.table("call_records").insert(row).execute()
                    stats["downloaded"] += 1
                except Exception as e2:
                    stats["errors"] += 1
                    if len(stats["error_details"]) < 30:
                        stats["error_details"].append(str(e2))

    # Archive rows (dedup tracking)
    for batch_start in range(0, len(archive_rows), BATCH):
        batch = archive_rows[batch_start:batch_start + BATCH]
        try:
            db.table("call_recordings").upsert(batch, on_conflict="canonical_name").execute()
        except Exception as e:
            logger.warning(f"[WIFI] Archive batch failed: {e}")

    stats["skipped"] = len(records) - len(new_records)

    # ── Step 4: Generate AI briefs for transcribed records ───────────────────
    transcribed_records = [r for r in new_records if r["has_transcript"]]
    if transcribed_records:
        logger.info(
            f"[WIFI] Generating AI briefs for {len(transcribed_records)} transcribed records "
            f"(best-effort, non-blocking)"
        )
        # Brief first 50 in-band; remaining handled by next sync or background job
        for rec in transcribed_records[:50]:
            try:
                _generate_brief_for_record(db, rec)
            except Exception as e:
                logger.warning(f"[WIFI-BRIEF] Skipping id={rec['id']}: {e}")

    logger.info(
        f"[WIFI] COMPLETE — {stats['found']} found | {stats['downloaded']} inserted | "
        f"{stats['skipped']} skipped | {stats['transcribed']} with transcripts | "
        f"{stats['errors']} errors"
    )
    return stats
