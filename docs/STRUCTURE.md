# Horizon PRM — Repository Structure

> Clean map of the project after the 2026-08-16 reorganization.
> Authoritative walkthrough for the app lives in `README.md`; this file maps the *filesystem* only.

Horizon PRM is a self-hosted Relationship Intelligence Platform: a React/TypeScript
frontend, a FastAPI/Python backend, a Supabase (Postgres + pgvector) database, and a
Capacitor mobile wrapper (Android/iOS).

## Top-level layout (what stays in the repo)

```
horizon/
├── README.md                 # Project overview + architecture + quick start
├── AGENTS.md / IDENTITY.md / SOUL.md / USER.md / TOOLS.md / HEARTBEAT.md
│                            # AI-agent workspace files (the agent's "home")
├── index.html               # Vite HTML entry
├── package.json             # Frontend deps + scripts (dev/build/test/lint)
├── package-lock.json        # Lockfile
├── tsconfig.json / tsconfig.node.json   # TypeScript config
├── vite.config.ts / vitest.config.ts    # Dev server + unit test runner
├── tailwind.config.js / postcss.config.js
├── playwright.config.ts     # E2E tests
├── eslint.config.js / components.json   # Lint + shadcn config
├── capacitor.config.ts      # Mobile app config
├── .env / .env.example / .env.local     # Secrets (gitignored; .example is tracked)
├── .cursorrules / .mcp.json / .nvmrc / .vscode/ / .github/
│                            # Editor / tooling config
│
├── src/                    # React frontend (TypeScript)
│   ├── App.tsx             # Router, query client, lazy routes
│   ├── components/         # UI: Dashboard, ContactList, CallLog, Actions, Console
│   ├── hooks/useHorizonData.ts
│   ├── services/apiClient.ts
│   ├── schemas/api.ts      # Zod schemas
│   ├── store/              # Zustand stores
│   ├── types/index.ts
│   └── (contexts, lib, utils, constants, main.tsx, index.css)
│
├── mcp-backend/            # FastAPI backend (Python)
│   ├── main.py             # App factory, CORS, router registration
│   ├── routers/            # One file per domain
│   ├── services/           # Transcription, enrichment, AI briefing
│   ├── core/               # Auth, Whisper/diarization engines
│   ├── db/supabase_client.py
│   ├── migrations/         # SQL migrations
│   └── requirements.txt
│
├── capacitor-horizon/      # Capacitor plugin package (npm workspace)
├── android/                # Native Android shell (Gradle build)
├── public/                 # Static assets (favicon, mock service worker)
├── tests/                  # Playwright/E2E specs
├── scripts/                # Helper scripts (ACR ingestion, etc.)
├── supabase/               # Supabase migrations
└── docs/                   # Consolidated documentation (see below)
```

## `docs/` — the documentation core

```
docs/
├── STRUCTURE.md            # THIS FILE — filesystem map
├── CONSTITUTION.md         # Engineering Constitution v3.0 (single source of truth)
├── CONSTITUTION_PATCHES.md # Merged from CONSTITUTION_PATCH.md + TECHNICAL_CORRECTIONS.md
├── PROJECT_REQS.md         # Master requirements list
├── KNOWLEDGE.md            # Merged from KNOWLEDGE1/2/3.md
├── setup.md                # Merged from setup.md + setup-apk.md (backend/frontend + APK)
├── DESIGN_TOKENS.md        # Canonical design token system v4.0
├── UI-UX-Design.md         # Merged from UIDesignPremiumUpgrade + UI-UX-Improvements
├── API_CONTRACT.md         # Authoritative backend↔frontend endpoint contract
├── database_schema_analysis.md
├── database-schema-reference.md
├── horizon_prm_architecture_review.md
├── architecture/           # Deep-dive architecture notes
│   ├── contact-intelligence-obsidian.md
│   ├── ingestion-reconciliation.md
│   ├── pipeline-notes.md   # (formerly HORIZON_PIPELINE_NOTES.md)
│   ├── architecture-review.md
│   └── architecture-review__root-copy.md
├── audio-pipeline-field-manual.md   # (formerly misnamed root constitution.md)
├── diagrams/
│   └── whiteboard-2026-06-15.excalidraw.md
├── plans/  superpowers/  audits/    # Design/plan/audit notes
└── reviews/
    ├── archive/
    │   └── auto-generated/  # 142 archived auto-generated ENGINEERING_REVIEW / AUDIT / QUICK_ACTION / REVIEW_* reports
    └── archive/              # (pre-existing legacy reviews)
└── _pre_merge_backup/        # ROLLBACK COPY of every doc before the merge (safe to delete after review)
```

## What was moved OUT of the project

Everything below lives in a sibling directory **`C:/Users/owner/Desktop/horizon-unsorted/`**
(outside the repo, fully reversible). These were clearly not part of Horizon PRM:

- **Vendor / personal AI-agent skill libraries:** `.agent/`, `.agents/`, `.claude/`,
  `.claude-launcher/`, `skills/`, `.cobridge/`, `.obsidian/`, `.omc/`, `.openclaw/`,
  `.ricochet/`, `.traerules` (auto-generated, already gitignored in most cases).
- **Side utilities / stray artifacts:** `tools/` (signal-cli), `auto_link.py`, `qr.png`,
  `ACR Phone_files/`, orphan `SystemSettingsIngestion.jsx`, stray `metadata.json`,
  `desktop.ini`, `tureautoacceptantigravity.agentclaw-3.5.0.vsix`.
- **Empty / scratch dirs:** `resources/`, `state/`, `horizon-prm-fixed/`, `agents/`,
  `horizon-changed-files/`, `New folder/` (duplicate of `docs/archive/` legacy set).
- **Logs:** `backend.log`, `*.tsc_errors*.log`, `hs_err_pid*.log`, `replay_pid*.log`,
  `ts_errors.txt`, `tsc_output.txt`, plus `synthesis_*.txt` scratch outputs.

## Reversibility

- **Nothing was deleted.** Relocated items are in `horizon-unsorted/`; the merge
  originals are in `docs/_pre_merge_backup/`.
- `REORG_MANIFEST.json` (repo root + inside `horizon-unsorted/`) records every move.
- To undo: move items back from those two locations.
