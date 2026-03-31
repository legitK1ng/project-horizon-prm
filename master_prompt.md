# HORIZON PRM — MASTER ORCHESTRATION PROMPT

**SYSTEM ROLE:** You are a deterministic Multi-Agent Orchestration Engine for an elite software engineering team. You will ingest the full requirements specification below and execute a series of specialized agents in strict sequential order. No step may proceed until the prior step returns `STATUS: COMPLETE` with all required artifacts. No placeholders, no assumptions, no partial completions are permitted. Every atomic requirement must be traced to an implementation artifact and a validation test.

---

```
PROJECT:  HORIZON PRM — Relationship Intelligence Platform
REVISION: 2026-03-25
POLICY:   SINGLE-PASS · DETERMINISTIC · NON-ITERATIVE
```

---

## SECTION 0 — REQUIREMENT EXTRACTION MANIFEST

The following 40 atomic requirements are the binding ground truth for all agents.

| REQ | Domain | Description |
|-----|--------|-------------|
| REQ-001 | UX | Implement a **design token layer** (spacing, color, typography, border-radius, shadows) as CSS custom properties, consumable by Tailwind config and component stylesheets. Must eliminate all hardcoded color values. |
| REQ-002 | UX | Integrate a headless component library (shadcn/ui or Radix UI) for ContactDrawer, EditModal, HoverCard, and all primary views. All components must derive styles from REQ-001 tokens. |
| REQ-003 | UX | Implement dark/light mode via CSS custom properties managed by the existing `useTheme` hook. No hardcoded `dark:` or `light:` class variants permitted outside the token system. |
| REQ-004 | UX | Upgrade Dashboard to a "Relationship Command Center" with dynamic **Relationship Health Scores** per contact (composite: recency + frequency + sentiment trend, range 0–100). |
| REQ-005 | UX | Add a **"Needs Attention" panel** to Dashboard: contacts with zero interactions in 14, 30, or 60 days, surfaced proactively and sorted by staleness. |
| REQ-006 | UX | Generate an AI **"Weekly Digest"** paragraph summarizing all relationship activity in the past 7 days via a Gemini **backend** call (never frontend-side). |
| REQ-007 | UX | Add **sparkline charts** to Dashboard for: call volume, sentiment trend (per-week average), and tag frequency. Use lightweight SVG or recharts micro-charts. |
| REQ-008 | UX | Consolidate ContactDrawer and ContactDetailDrawer into a single **tabbed full-panel view** with five tabs: Overview, Timeline, Enrichment, Notes, Actions. |
| REQ-009 | UX | Implement **Timeline tab** as a chronological, scrollable feed of calls, calendar events, and social signals — rendered Linear/Notion-style with date anchors. |
| REQ-010 | UX | Implement **Enrichment tab** displaying OSINT-derived structured cards: Person Card, Phone Card, Email Card, Organization Card, Location Card — each with a staleness badge and data-source label. |
| REQ-011 | UX | Extend CommandPalette with **semantic natural-language search**. Example: "Find everyone at Acme I spoke to last month". Must query backend, not in-memory array. |
| REQ-012 | UX | Add CommandPalette **quick actions**: "Log a call", "Tag contact", "Schedule follow-up", "Run enrichment on [contact]" — all executable in ≤ 3 keystrokes. |
| REQ-013 | UX | Persist CommandPalette **recent searches and command history** in a `HistoryContext` backed by localStorage. |
| REQ-014 | ARCH | Migrate backend off Google Apps Script. Deploy a **Python (FastAPI)** service on **Google Cloud Run** exposing RESTful endpoints: `/api/v1/contacts`, `/api/v1/calls`, `/api/v1/jobs`, `/api/v1/enrichments`. |
| REQ-015 | ARCH | Replace Google Sheets with **PostgreSQL via Supabase**. Schema must include: `contacts`, `call_records`, `enrichment_jobs`, `organizations`, `entities`, `relationships`, `touchpoints` tables. |
| REQ-016 | ARCH | Replace single doGet/doPost handler with **resource-based RESTful routing**. All endpoints versioned under `/api/v1/`. |
| REQ-017 | ARCH | Inject all secrets (Gemini API key, enrichment API keys) as **environment variables** at Cloud Run deploy time. No per-call Secret Manager fetches. |
| REQ-018 | ARCH | Define an **Entity model**: unified identity record linking contact → email addresses, phone numbers, social handles, org affiliations — each with a confidence score (0.0–1.0). |
| REQ-019 | ARCH | Define a **Relationship Graph model**: junction table connecting `entity_id_a` and `entity_id_b` through a typed relationship (colleague, client, referral, family) with a `weight` field from interaction frequency. |
| REQ-020 | ARCH | Promote **Organization** to a top-level PostgreSQL model with: name, industry, headcount_range, funding_stage, website, enrichment_record_id, associated contact IDs. |
| REQ-021 | ARCH | Define a **Touchpoint model** normalizing interactions across channels: call, email, calendar_event, social_dm — enabling cross-channel timeline construction. |
| REQ-022 | ARCH | Decompose backend into discrete service modules: IngestService, EnrichmentService, AIBriefingService, SyncService, QueryAPI. |
| REQ-023 | ARCH | Implement an **async job queue** (Cloud Tasks or BullMQ) for enrichment jobs with: exponential backoff retry (max 3), dead-letter queue on 3rd failure, status tracking (PENDING → IN_PROGRESS → COMPLETE → FAILED). |
| REQ-024 | ARCH | Replace `useData` monolithic hook with **TanStack Query v5**. Each resource must have its own query key with `staleTime` and `gcTime` configured. |
| REQ-025 | ARCH | Implement a typed **API client layer with Zod schema validation** at all response boundaries. Runtime type errors must throw a typed `ZodError`. |
| REQ-026 | ARCH | Migrate all `mockData` out of `apiService.ts` into an **MSW (Mock Service Worker)** fixture layer. MSW handlers must not be imported in production builds. |
| REQ-027 | ARCH | Move all Gemini API calls from the frontend `geminiService` to the **FastAPI backend**. The frontend must never hold or transmit the Gemini API key. |
| REQ-028 | ENRICH | Implement a **6-stage enrichment pipeline** per contact trigger event: (1) Entity Detection, (2) Phone lookup via NumVerify, (3) Email enrichment via Hunter.io, (4) Org enrichment via Clearbit, (5) Social discovery, (6) AI synthesis via Gemini. Each stage stores: result_json, source_name, fetched_at, confidence (HIGH/MEDIUM/LOW). |
| REQ-029 | ENRICH | Each enriched field must be **individually overridable** by the user. User overrides persist with `override_by=user`, `override_at` timestamp. |
| REQ-030 | ENRICH | Frontend Enrichment card must display: **confidence badge** (HIGH=green, MEDIUM=amber, LOW=red), **staleness indicator** (hours since fetched_at), and a "Refresh" action per card. |
| REQ-031 | SOCIAL | Implement **bidirectional sync with Google People API**: import photo, birthday, notes, and all custom fields. Sync runs on contact update and on a scheduled 24-hour background job. |
| REQ-032 | SOCIAL | Implement **read-only X/Twitter profile monitoring** for contacts with a known X handle. Surface public posts and bio changes as lightweight signals in the Timeline tab. |
| REQ-033 | SOCIAL | Implement a **Gemini-powered social signal classifier**. For each captured signal, produce: role_change, product_launch, life_event, thought_leadership, or other — stored alongside the signal. |
| REQ-034 | SOCIAL | Implement **"Reply with Context"** feature: when a contact posts about a classified topic, Gemini generates a personalized reply suggestion referencing shared call history. |
| REQ-035 | AI | Shift Gemini from reactive to **proactive mode**. After each call brief, automatically produce: `recommended_followup_date`, `draft_followup_message` (≤150 words), `open_commitments[]`, `commitment_deadline_alerts[]` (triggers when deadline < 48 hours). |
| REQ-036 | AI | Implement a **Relationship Strength Score** per contact: composite of interaction_recency, call_frequency, sentiment_trend, response_latency. Score range: 0–100, recalculated on each new touchpoint. |
| REQ-037 | AI | Implement a **Relationship Graph visualization** on Dashboard: nodes = contacts, edges = relationships, edge weight = Relationship Strength Score. Render using D3.js or react-force-graph. |
| REQ-038 | AI | Evolve the Lab view into an **Intelligence Workbench**: sandbox for testing Gemini prompts against real contacts, previewing enrichment before commit, and experimenting with scoring model parameters. |
| REQ-039 | SECURITY | Implement **field-level encryption** (AES-256-GCM) for: `call_records.transcript`, all enrichment data, contact `strategic_notes`. Keys managed per-user server-side. |
| REQ-040 | SECURITY | Field-level **decryption must occur server-side only**. The frontend must never receive raw encryption keys. |

---

## SECTION 1 — AGENT REGISTRY

### AGENT-1: RequirementsAnalysisAgent
- **Input:** This document
- **Output:** `requirements_manifest.json`
- **Halt:** Any REQ is ambiguous AND cannot be resolved by domain inference

### AGENT-2: SystemArchitectureAgent
- **Input:** `requirements_manifest.json`
- **Output:** `architecture_artifacts/` (DDL, Dockerfile, diagrams, API routes)
- **Checkpoint:** Must be reviewed by AGENT-1 before AGENT-3 starts

### AGENT-3a: BackendImplementationAgent *(parallel)*
- **Input:** `architecture_artifacts/`
- **Output:** `/mcp-backend/` complete Python FastAPI package
- **Handoff Schema:** `{ "agent": "BackendImplementationAgent", "req_id": "REQ-014", "artifact": "mcp-backend/main.py", "status": "complete" }`

### AGENT-3b: FrontendImplementationAgent *(parallel)*
- **Input:** `architecture_artifacts/` + SHARED_STATE.api_base_url (from AGENT-3a)
- **Output:** `/src/` complete with all modified and new files
- **Dependency:** Must not start data-layer implementation until AGENT-3a emits `api_base_url` into SHARED_STATE

### AGENT-4: ValidationAndTestingAgent
- **Input:** All artifacts from AGENT-3a and AGENT-3b
- **Output:** `test_results.json` with per-REQ pass/fail
- **Halt:** Any REQ marked FAIL → isolate → re-invoke implementing agent for that REQ only

### AGENT-5: IntegrationAndDeploymentAgent
- **Input:** `test_results.json` + all artifacts
- **Output:** `deployment_manifest.json`
- **Checkpoint:** `GET /api/v1/health` returns HTTP 200 with `{ "status": "ok" }`

---

## SECTION 2 — TRACEABILITY MAP

```json
{
  "REQ-001": { "module": "src/index.css + tailwind.config.ts", "test": "test_design_tokens.spec.ts" },
  "REQ-004": { "module": "src/components/Dashboard.tsx + api/v1/contacts/health-scores", "test": "test_health_score.spec.ts" },
  "REQ-014": { "module": "mcp-backend/main.py + Dockerfile", "test": "test_api_endpoints.py" },
  "REQ-015": { "module": "mcp-backend/db/schema.sql + alembic/", "test": "test_db_schema.py" },
  "REQ-028": { "module": "mcp-backend/services/enrichment_service.py", "test": "test_enrichment_pipeline.py" },
  "REQ-035": { "module": "mcp-backend/services/ai_briefing_service.py", "test": "test_proactive_ai.py" },
  "REQ-039": { "module": "mcp-backend/security/field_encryption.py", "test": "test_field_encryption.py" }
}
```

---

## SECTION 3 — EXECUTION PIPELINE

```
STEP 1 › AGENT-1  Requirements extraction → requirements_manifest.json
         CHECKPOINT: All 40 REQs covered. Gap = HALT.

STEP 2 › AGENT-2  Architecture design → architecture_artifacts/
         CHECKPOINT: DDL covers all 8 tables. Dockerfile compiles.

STEP 3 › AGENT-3a + AGENT-3b (parallel)
         SYNC POINT: AGENT-3a emits api_base_url before AGENT-3b data layer starts.
         CHECKPOINT: All 40 REQUIREMENT_MAP entries populated.

STEP 4 › AGENT-4  Validation → test_results.json
         CHECKPOINT: All 40 REQs STATUS=PASS.
         FAIL: Isolate REQ → re-invoke agent → re-run AGENT-4 for that REQ only.

STEP 5 › AGENT-5  Deploy → deployment_manifest.json
         CHECKPOINT: GET /api/v1/health = HTTP 200.
```

---

## SECTION 4 — CODE REFERENCE PATTERNS

```python
# Enrichment stage output validator (REQ-028)
def validate_stage_output(stage: int, result: dict) -> bool:
    required = {
        1: ["job_id", "status"],
        2: ["carrier", "line_type", "geo_region", "validity"],
        3: ["name", "title", "employer", "social_handles", "confidence"],
        4: ["industry", "size", "funding", "website"],
        5: ["linkedin_url", "x_handle", "photo_url", "bio"],
        6: ["narrative"]
    }
    return all(k in result for k in required[stage])

# Field-level encryption usage (REQ-039)
encrypted = encrypt_field(user_id=user.id, plaintext=transcript)
plaintext = decrypt_field(user_id=user.id, ciphertext=row.transcript)
```

```sql
-- Entity model DDL (REQ-018)
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence NUMERIC(3,2) CHECK (confidence BETWEEN 0.00 AND 1.00),
  source TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  override_by TEXT,
  override_at TIMESTAMPTZ
);
```

```typescript
// Zod API boundary schema (REQ-025)
export const ContactSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  health_score: z.number().min(0).max(100),
  last_contact_at: z.string().datetime({ offset: true }).nullable(),
});
export type Contact = z.infer<typeof ContactSchema>;
```

---

## SECTION 5 — EXTERNAL KEYS REQUIRED BEFORE AGENT-5

| ID | Key | Used In |
|----|-----|---------|
| E-001 | GCP Project ID | Cloud Run deploy |
| E-002 | Supabase URL + service_role key | DB connection |
| E-003 | NumVerify API key | REQ-028 Stage 2 |
| E-004 | Hunter.io API key | REQ-028 Stage 3 |
| E-005 | Clearbit Company API key | REQ-028 Stage 4 |
| E-006 | X/Twitter Bearer Token | REQ-032 |
| E-007 | Gemini API key | Server-side only — never to frontend |

Agents 1–4 may proceed without E-001 through E-007. Live enrichment testing in AGENT-4 requires E-003 through E-007.

---

> **BEGIN EXECUTION. INVOKE AGENT-1 NOW.**
