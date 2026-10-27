# Horizon PRM — Multi-Surface Pearl Ledger

> Status: **RECON ONLY — no files moved/merged yet.** This ledger is the source of truth
> for the harvest-and-federate protocol. Update it as pearls are verified and ported.

## The surfaces (what actually exists on this machine)

| Surface | Path | pkg name | Last code edit | Role |
|---|---|---|---|---|
| **horizon** | `Desktop/horizon` | `project-horizon-prm` | **2026-08-11** | **CANONICAL** — most evolved, already cleaned |
| **eclipse** | `My Drive/horizon` | `project-horizon-eclipse` | 2026-05-12 | Older sibling — **unique visual theme** |
| OneDrive copy | `OneDrive/Desktop/horizon` | — | — | **NOT a code repo** (no `src/`, only agent-workspace files). Sync shell — do not harvest. |
| Horizon_Data | `My Drive/Horizon_Data` | — | — | 10.7k **data** files (recordings/JSON). Not code. |
| 7.7Horizon Docs | `My Drive/7.7Horizon Docs` | — | — | Single Google Doc. Not code. |

**Key finding:** `eclipse` is NOT an independent fork with its own features — it is a
**timeline snapshot** ~3 months behind `horizon`. `horizon` is a strict superset:
82 vs 53 source files; whole feature areas (Pipeline, Sentinel, Guardian, Widgets,
IngestQueue, IntelligencePanel…) exist ONLY in `horizon`. So:
- The harvest is **one-directional: eclipse → horizon for the 2 pearls below.**
- The federation is **horizon → eclipse for hygiene + catch-up**, preserving eclipse's look.

## Pearls found in eclipse (to harvest INTO horizon)

| # | Pearl | Where | Why it's better | Action |
|---|---|---|---|---|
| P1 | **Cyber-Noir theme** | `eclipse/src/index.css` (neon-pink `#ff00ff`, synth-cyan, scanlines, synthwave dark utilities) + `tailwind.config.js` (3KB vs 7KB — different token set) | Distinct, polished visual identity `horizon` lost when it moved to glassmorphism. | Extract as **theme preset** `src/themes/cyber-noir.css` in `horizon` so BOTH looks are available, not overwritten. |
| P2 | **Robust WebNative fallback** | `eclipse/src/services/WebNative.ts` (81 lines vs 65) | Handles `CapacitorHorizon` plugin-not-detected + `getWebFallbackContext()` + deviceInfo/permissions fallback more completely. | Port the fallback branch into `horizon/src/services/WebNative.ts` (logic only; keep `horizon` look). |
| P3 | `IntelligenceDossier.tsx` extras | `eclipse/src/components/IntelligenceDossier.tsx` (280 vs 272 lines) | Mostly extra *styling* markup (cyber-noir classes) — ties to P1, not unique logic. | Fold into P1 theme; no separate logic port needed. |

## Pearls already in horizon (to FEDERATE to eclipse later, keeping eclipse's look)

- 21 horizon-unique components: PipelineHUD, Sentinel, Guardian*, Widgets (Stats/Contacts/
  Nudges/QuickActions/RecentCalls), IngestionSettings, NetworkTopology, ManualIngestForm,
  IngestQueueViewer, IntelligencePanel, SourceConfigPanel, SystemStatusBar, SystemBots, GlassCard…
- 29 horizon-only source files (hooks `usePipelineEvents`, `useSystemGuardian`; services
  `GuardianService`, `syncService`; stores `dataStore`, `guardianStore`; `utils/haptics.ts`…).

## Divergent shared files (horizon is the larger/more-evolved in 34 of 36)

`horizon`'s versions of `Dashboard.tsx` (+17.8KB), `ContactList.tsx` (+10.4KB),
`FloatingChat.tsx` (+8.9KB), `IntelligenceWorkbench.tsx`, `Navigation.tsx`, `CallLog.tsx`,
`Console.tsx`, `Lab.tsx`, `App.tsx`, `Actions.tsx`, etc. are all **ahead**. No pearls in
these for `horizon` to gain — eclipse should adopt them (look-preserving).

## Non-pearls / exclude from harvest

- `OneDrive/Desktop/horizon` — sync shell, not code. Leave alone.
- `Horizon_Data`, `7.7Horizon Docs` — data/docs, not code.
- `eclipse` `.venv-wsl/` etc. — virtualenv, never port.

## Next steps (pending your go)

1. **Harvest P1+P2 into `horizon`** as a theme preset + WebNative fallback (non-destructive;
   existing `horizon` code untouched, just additive).
2. **Hygiene pass on `eclipse`** — same playbook we ran on `horizon`: archive its 22 stray
   `ENGINEERING_REVIEW_*`/`*_AUDIT_*`/review `.md`/`.txt` files to `docs/reviews/archive/`,
   merge any dup docs, fix the (likely) misnamed `constitution.md`, evict cruft to a
   sibling `horizon-eclipse-unsorted/`. **Keep eclipse's src/ + Cyber-Noir look intact.**
3. **Federate** `horizon`'s superset components into `eclipse` as additive imports, so
   eclipse gains the advanced features without losing its identity.
4. Leave `OneDrive` copy and data folders untouched.
