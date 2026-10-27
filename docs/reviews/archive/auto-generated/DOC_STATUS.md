# Documentation Status Index
**Last Updated:** 2026-06-18 20:45 UTC  
**Purpose:** Single reference to determine which documents are current, historical, or stale. Check this first.

---

## 🟢 CURRENT — Authoritative Living Docs

| File | Last Updated | Notes |
|------|-------------|-------|
| `DESIGN_TOKENS.md` | 2026-06-13 | Canonical UI token system v4.0. Authoritative. |
| `CONSTITUTION_PATCH.md` | 2026-06-13 | Authoritative corrections to CONSTITUTION.pdf v3.0 |
| `CONTACT_INTELLIGENCE_AND_OBSIDIAN_ARCHITECTURE.md` | 2026-06-13 | Obsidian + contact intel architecture |
| `INGESTION_RECONCILIATION_ARCHITECTURE.md` | 2026-06-13 | Ingestion pipeline architecture |
| `TECHNICAL_CORRECTIONS.md` | 2026-06-13 | Patch doc for known issues |
| `HORIZON_PIPELINE_NOTES.md` | 2026-05-27 | Ground-truth pipeline narrative |
| `.env` | 2026-06-18 | Live config — source of truth for all URLs/keys |
| `vite.config.ts` | Current | Build config |
| `src/services/apiClient.ts` | Current | Mobile + web API client |

---

## 🟡 HISTORICAL — Auto-Generated Review Logs (kept for audit trail)

These are point-in-time snapshots. **The most recent one is what matters.** Older ones are archive only.

| File | Date | Status |
|------|------|--------|
| `ENGINEERING_REVIEW_2026-06-18_AUTOMATED.md` | 2026-06-18 | ← **MOST RECENT** |
| `AUTOMATED_REVIEW_ACTIONS_LOG.md` | 2026-06-17 | Most recent actions log |
| `ENGINEERING_REVIEW_2026-06-17_AUTOMATED.md` | 2026-06-17 | Archive |
| `ENGINEERING_REVIEW_2026-06-16_COMPREHENSIVE.md` | 2026-06-16 | Archive |
| `ENGINEERING_REVIEW_2026-06-16_AUTOMATED.md` | 2026-06-16 | Archive |
| `ENGINEERING_REVIEW_2026-06-15_*.md` (4 files) | 2026-06-15 | Archive |
| `ENGINEERING_REVIEW_2026-06-14_AUTOMATED.md` | 2026-06-14 | Archive |
| `AUTOMATED_REVIEW_ACTIONS_LOG_2026-06-15.md` | 2026-06-15 | Archive |
| `REVIEW_CORRECTIONS_2026-06-15.md` | 2026-06-15 | Archive |
| `FINAL_REVIEW_SUMMARY_2026-06-15.md` | 2026-06-15 | Archive |
| `CODE_REVIEW_2026-06-14.md` | 2026-06-14 | Archive |
| `README_REVIEW_2026-06-15.md` | 2026-06-15 | Archive |

---

## 🟠 STALE — Needs Review or Update

These files have useful content but may no longer reflect current state.

| File | Last Updated | Issue |
|------|-------------|-------|
| `CRITICAL_ACTIONS_REQUIRED.md` | 2026-06-14 | Actions may already be resolved. Needs reconciliation against current code. |
| `CRITICAL_ACTIONS_REQUIRED_2026-06-15.md` | 2026-06-15 | Same — superseded by 06-18 review. |
| `QUICK_ACTION_CHECKLIST.md` | 2026-06-15 | Claims "29 vulnerabilities remaining" — run `npm audit` to get current count. |
| `DEPENDENCY_RESOLUTION_REQUIRED.md` | 2026-06-16 | Dependency conflicts listed — verify if still blocked. |
| `BACKEND_DEPENDENCIES_ADDENDUM.md` | 2026-06-16 | Supplement to 06-16 review — check if resolved. |
| `CODE_REVIEW.md` | 2026-06-01 | Undated June 1 review — 3 weeks behind current code. |
| `setup.md` | 2026-04-19 | Backend port scheme has changed. Use `.env` + `.env.example` instead. |
| `setup-apk.md` | 2026-05-11 | Tailscale URL outdated — now `:8443` for API. Updated with warning. |
| `horizon_prm_architecture_review.md` | 2026-04-15 | Old April architecture review, pre-Dexie and pre-SyncService. |
| `UI-UX-Improvements.md` | 2026-05-11 | Pre-theme suggestions. Futuristic Command Center theme applied 2026-06-18 — many items already done. |
| `UIDesignPremiumUpgrade.md` | 2026-05-11 | Duplicate/companion to above. Same status. |

---

## 🔴 VERY OLD — Likely Outdated Reference Material

Verify before acting on anything in these files.

| File | Last Updated | Issue |
|------|-------------|-------|
| `KNOWLEDGE1.md` | 2026-04-07 | Raw conversation notes on ACR/Whisper handshake. Conceptually still valid but details may have drifted. |
| `KNOWLEDGE2.md` | 2026-04-15 | ACRPhoneWebHook repo reference. Still valid as reference. |
| `KNOWLEDGE3.md` | 2026-04-07 | Entity graph model design. Verify against current DB schema. |
| `PROJECT_REQS.md` | 2026-04-07 | Master reqs list from April. Many may be implemented or changed. |
| `constitution.md` | 2026-04-19 | **Original audio pipeline field manual.** Use `CONSTITUTION_PATCH.md` (June 2026) for corrections. |

---

## ⚪ SYSTEM / TEMPLATE FILES — Not time-sensitive

| File | Notes |
|------|-------|
| `AGENTS.md` | Agent workspace config template |
| `IDENTITY.md` | Agent identity template (empty) |
| `USER.md` | User profile template (empty) |
| `HEARTBEAT.md` | Heartbeat config (empty = disabled) |
| `SOUL.md` | Agent persona definition (Rick Sanchez) |
| `README.md` | Project README — last updated May 11, may need refresh |

---

## Tailscale Funnel Map (as of 2026-06-18)

```
https://hp-z2g3-mini-workstation.tailb79f25.ts.net/        → Port 9000 (ACR ingest server)
https://hp-z2g3-mini-workstation.tailb79f25.ts.net:8443/   → Port 8000 (FastAPI dashboard / mobile APK)
```

`VITE_BACKEND_URL_MOBILE` in `.env` is now set to `:8443`.
