# Subagent 3 Synthesis Report: Frontend React/TypeScript, UI/UX, Hooks & Mobile Pearls

**Prepared by:** Subagent 3 (Frontend React/TypeScript, UI/UX, Hooks & Mobile Pearls Auditor)  
**Target Canonical Repository:** `Desktop_horizon` (`c:\Users\legitk1ng\Horizon`)  
**Scope:** Exhaustive file-by-file, line-normalized code comparison of all `.tsx`, `.ts`, `.jsx`, `.js`, `.css`, and `.html` files across all 9 corpus directories against `Desktop_horizon\src\...` and `Desktop_horizon\tests\...`, aligned with `CONSTITUTION.md` (§14 & §16) and `docs/DESIGN_TOKENS.md` v4.0.

---

## Executive Summary of Critical Findings

1. **Missing ACR Webhook Monitor Suite (`Imports_Surface3_WP`)**: Three production-ready TypeScript files (`src/components/WebhookMonitor.tsx`, `src/hooks/useWebhookJobs.ts`, `src/services/webhookService.ts`) exist **only** in `Imports_Surface3_WP` and are completely absent from `Desktop_horizon`. They provide a real-time 5-second auto-polling ACR Transcription Gateway dashboard, gateway health check badge, status KPI counters, speaker-diarized transcript slide-over drawer (`DiarizedSegment`), one-click clipboard copy, and ACR Phone setup instructions.
2. **Critical Hardcoded Path Bug in `Desktop_horizon` Build Configs**: `Desktop_horizon/tailwind.config.js` and `Desktop_horizon/postcss.config.js` hardcode absolute paths to `'C:/Users/owner/Desktop/horizon/...'` (a different Windows user profile), which breaks Tailwind CSS content scanning and PostCSS compilation on `C:\Users\legitk1ng\Horizon`. `Imports_Surface3_WP` preserves the clean portable relative paths (`'./index.html'`, `'./src/**/*.{js,ts,jsx,tsx}'`).
3. **Missing Ollama & ACR Portal Sync Methods in `Desktop_horizon/src/services/apiClient.ts`**: Both `Imports_Surface3_OD/src/services/apiClient.ts` and `Imports_legitk1ng/src_eclipse_backup/services/apiClient.ts` contain 6 API client methods (`ollamaGenerate`, `ollamaModels`, `ollamaHealth`, `startPortalSync`, `getPortalSyncHistory`, `getPortalSyncStatus`) that were dropped in `Desktop_horizon/src/services/apiClient.ts`.
4. **Why Many `Imports_Surface3_WP` Files Looked Larger by Byte Size**: Line-ending-normalized comparison (`\r\n` vs `\n`) proved that 10 core hooks/services (`usePipelineEvents.ts`, `useSupabaseData.ts`, `transcriptionClient.ts`, `appStore.ts`, `types/index.ts`, `utils/helpers.ts`, `lib/client.ts`, `lib/server.ts`, `lib/utils.ts`, `utils/ui.ts`) are **100% identical in code content** to `Desktop_horizon`—differing only by CRLF vs LF line endings.
5. **Orphaned High-Value Components inside `Desktop_horizon/src/components/`**: `Lab.tsx` (`Intelligence.Lab` with drag-and-drop transcript analysis, persona selector, and WebNative/Gemini diagnostics), `ActionsLog.tsx` (`Action.Protocol` with Google Calendar event builder and clipboard copy), and `IntelligenceDossier.tsx` (`Executive Intelligence Dossier` OSINT modal) exist in `Desktop_horizon/src/components/` but are currently unreachable from `App.tsx` (`/lab` redirects to `/console`; `/actions` mounts `Actions.tsx` without `ActionsLog.tsx`).
6. **Four Distinct Theme Generations Across the Corpus**:
   - **Canonical Token Spec (`docs/DESIGN_TOKENS.md` v4.0 + `CONSTITUTION.md` §14 + `SystemSettingsIngestion.jsx`)**: "Refined Operations" Warm Paper (`#F7F4ED`) / Deep Ink (`#0E0D0B`) with **Ochre** (`#B8722E` light / `#E8A656` dark) as canonical brand accent.
   - **`Desktop_horizon/src/index.css` (Design System v8 · Dusk Horizon)**: Sunset Rose (`#C6586E`), Soft Teal (`#64C0CC`), Warm Amber (`#D4A460`) over a 12-stop fixed twilight sky gradient.
   - **`Imports_Surface3_WP/src/index.css` (Design System v7 · Futuristic Command Center)**: Deep Charcoal (`#12161A`), Electric Cyan (`#00F0FF`), Coral Alert (`#E07A5F`).
   - **`Imports_legitk1ng/src_eclipse_backup/index.css` (Horizon Eclipse · Cyber-Noir Synthwave)**: Neon Pink (`#ff00ff`), Cyan (`#00ffff`), Void (`#020108`) — already harvested into `Desktop_horizon/src/themes/cyber-noir.css` + `cyberNoirTheme.ts` as an opt-in skin (`toggleCyberNoir()`), though no UI button currently triggers `toggleCyberNoir()`.

---

## Section 1: Unique Frontend Components, Hooks, Services & Scripts Outside `Desktop_horizon/src`

### 1.1 Complete Inventory of Unique Files

| File Path in Corpus | Lines | Status in `Desktop_horizon` | Purpose & Key Capabilities |
|---|---:|---|---|
| `Imports_Surface3_WP\src\components\WebhookMonitor.tsx` | 410 | **MISSING** | Complete ACR Transcription Gateway Monitor UI: live status indicator (`Online`/`Offline`), 4 KPI summary cards (`Total Calls`, `Queued`/`Processing`, `Transcribed`, `Errors`), status filter pills, 5-second auto-polling jobs table (`JobRow`), slide-over/modal `TranscriptDrawer` with speaker-diarized segments (`Speaker 1`, `Speaker 2`, etc. with color-coded badges and `MM:SS` timestamps), one-click copy-to-clipboard, and expandable ACR Phone webhook setup guide. |
| `Imports_Surface3_WP\src\hooks\useWebhookJobs.ts` | 70 | **MISSING** | Custom React hook managing `jobs`, `statusFilter`, `selectedJob`, `gatewayOnline`, `loading`, `error`, and a 5-second `setInterval` poll (`POLL_INTERVAL_MS = 5000`) against `webhookService`. |
| `Imports_Surface3_WP\src\services\webhookService.ts` | 84 | **MISSING** | Typed API client for the FastAPI ACR Webhook Gateway (`VITE_GATEWAY_URL`, default `http://localhost:8000`). Exports `JobStatus`, `DiarizedSegment`, `TranscriptionJob`, `JobListResponse`, `fetchJobs()`, `fetchJob(jobId)`, and `checkGatewayHealth()` (`GET /webhook/health` with 3s `AbortSignal.timeout`). |
| `Imports_Surface3_WP\SystemSettingsIngestion.jsx` *(also in `Desktop_unsorted\SystemSettingsIngestion.jsx`, 100% identical ignoring CRLF)* | 614 | Evolved into `src/components/IngestionSettings.tsx` | Original standalone JSX design reference implementing the **Refined Operations** (`#0E0D0B` + `#E8A656` Ochre token object `T`) System Settings -> Call Recording Ingestion page. Contains two interactive simulation harnesses (`simulateWifiSync` and `simulateFolderScan`) that animate step-by-step progress when backend endpoints aren't running. |
| `Imports_Surface3_WP\scripts\test_connect.js` | 17 | **MISSING** | Node ESM diagnostic script using `@supabase/supabase-js` and `dotenv` to test connectivity to Supabase `contacts` table (`select('count', { count: 'exact', head: true })`). |
| `Imports_legitk1ng\horizon_kanban.html` | 187 | **MISSING** | Standalone zero-dependency interactive HTML5 drag-and-drop Kanban board (`Horizon PRM — Kanban`) pre-seeded with 56 engineering/OpenClaw tasks across 5 columns (`Backlog`, `To Do`, `In Progress`, `Blocked`, `Done`), category filter, search bar, modal card editor, and `localStorage` persistence (`horizon_kanban_v1`). |
| `Desktop_unsorted\horizon-changed-files\Claud_Rescue_summary.md` | 133 | Reference Doc | Documents 7 critical frontend rescue fixes (Zod schema `transcript` + `.passthrough()`, `useCalls`/`useNudges` error resilience, `RelationshipGraph` bounds clamping, `NudgeShelf` horizontal scroll, `apiClient` 10s `AbortController` timeout). |

### 1.2 Verification of `ActionsLog.tsx`, `LoadingScreen.tsx`, `IntelligenceDossier.tsx`, and `Lab.tsx`

A critical audit question was whether `ActionsLog.tsx` and `LoadingScreen.tsx` in `Imports_Surface3_OD` and `src_eclipse_backup` were missing from `Desktop_horizon`. **Verification result:**
- **`LoadingScreen.tsx` (85 lines)**: **Already present** in `Desktop_horizon/src/components/LoadingScreen.tsx` and actively used in `App.tsx` (lines 14, 57, 125). It is 100% identical across `Desktop_horizon`, `Imports_Surface3_WP`, `Imports_Surface3_OD`, and `src_eclipse_backup`. It renders both a neural core spinner and a full dashboard skeleton layout (`Skeleton` cards + shimmer).
- **`ActionsLog.tsx` (178 lines)**: **Already present** in `Desktop_horizon/src/components/ActionsLog.tsx` and 100% identical across all 4 copies (`Desktop_horizon`, `Surface3_WP`, `Surface3_OD`, `src_eclipse_backup`). **However, it is NOT mounted in `App.tsx`!** When `Actions.tsx` (Tasks / Projects / Canvas) was introduced at `/actions`, `ActionsLog.tsx` (which groups AI-extracted `executive_brief.action_items` by call and provides one-click **Add to Google Calendar** + **Copy to Clipboard**) was left unmounted.
- **`IntelligenceDossier.tsx` (206 lines)**: **Already present** in `Desktop_horizon/src/components/IntelligenceDossier.tsx` (identical across all 4 copies). Renders the full-screen `Executive Intelligence Dossier` modal with OSINT metadata, `Relationship_Vitality` progress bar, `Strategic_Directives`, and `Communication_Logs`, plus `window.print()` export. Currently not wired into `UnifiedContactDrawer.tsx` or `ContactList.tsx`.
- **`Lab.tsx` (686 lines)**: **Already present** in `Desktop_horizon/src/components/Lab.tsx`. However, `App.tsx` line 65 currently has `<Route path="/lab" element={<Navigate to="/console" replace />} />`, which prevents users from accessing `Intelligence.Lab` (manual transcript drag-and-drop analysis, AI persona selector, and WebNative/Gemini diagnostics).

### 1.3 Concrete Integration Plan for Unique & Orphaned Components

1. **Integrate the ACR Webhook Monitor Suite (`WebhookMonitor.tsx`, `useWebhookJobs.ts`, `webhookService.ts`)**:
   - Copy `Imports_Surface3_WP/src/services/webhookService.ts` -> `Desktop_horizon/src/services/webhookService.ts` (update `GATEWAY_BASE` fallback to `import.meta.env.VITE_GATEWAY_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000'`).
   - Copy `Imports_Surface3_WP/src/hooks/useWebhookJobs.ts` -> `Desktop_horizon/src/hooks/useWebhookJobs.ts`.
   - Copy `Imports_Surface3_WP/src/components/WebhookMonitor.tsx` -> `Desktop_horizon/src/components/WebhookMonitor.tsx`.
   - Mount `<WebhookMonitor />` inside `IngestionSettings.tsx` (either as a 3rd tab `"Live Webhook Monitor"` alongside `"WiFi ADB Sync"` and `"Folder Scan / Upload"`, or directly below the ingestion cards on `/settings`).
2. **Re-expose `Lab.tsx`, `ActionsLog.tsx`, and `IntelligenceDossier.tsx`**:
   - In `App.tsx`: Restore `<Route path="/lab" element={<Lab />} />` OR embed `<Lab />` / `<Console />` as switchable views on `/console`.
   - In `Actions.tsx`: Add a 4th tab `{ id: 'call_actions', label: 'Call Action Log', icon: Sparkles }` to `TABS` that renders `<ActionsLog calls={calls} />` so AI-extracted call action items and Google Calendar export are preserved alongside Tasks, Projects, and Canvas.
   - In `UnifiedContactDrawer.tsx`: Add an `"Open Executive Dossier"` button that opens `<IntelligenceDossier contact={contact} calls={contactCalls} onClose={...} />`.
3. **Preserve `scripts/test_connect.js` and `horizon_kanban.html`**:
   - Copy `Imports_Surface3_WP/scripts/test_connect.js` -> `Desktop_horizon/scripts/test_connect.js`.
   - Copy `Imports_legitk1ng/horizon_kanban.html` -> `Desktop_horizon/docs/tools/horizon_kanban.html` as a standalone project-management artifact.

---

## Section 2: Code Diff Analysis of Shared Frontend Files Across All Corpus Directories

Every shared file across `Imports_Surface3_WP`, `Imports_Surface3_OD`, `Desktop_unsorted\horizon-changed-files`, and `Imports_legitk1ng\src_eclipse_backup` was compared line-by-line (normalizing CRLF vs LF) against `Desktop_horizon`.

### 2.1 `Imports_Surface3_WP` vs `Desktop_horizon`

#### A. Files 100% Identical in Content (Byte Size Difference Caused Only by CRLF `\r\n` vs LF `\n`)
- `src/hooks/usePipelineEvents.ts` (242 lines)
- `src/hooks/useSupabaseData.ts` (175 lines)
- `src/services/transcriptionClient.ts` (327 lines)
- `src/store/appStore.ts` (230 lines)
- `src/types/index.ts` (405 lines)
- `src/utils/helpers.ts` (124 lines)
- `src/utils/ui.ts` (16 lines)
- `src/lib/client.ts`, `src/lib/server.ts`, `src/lib/utils.ts`
- `src/components/Actions.tsx`, `src/components/ActionsLog.tsx`, `src/components/CallLog.tsx`, `src/components/Console.tsx`, `src/components/ContactList.tsx`, `src/components/IntelligenceDossier.tsx`, `src/components/Lab.tsx`, `src/components/LoadingScreen.tsx`, `src/components/RelationshipHealthRing.tsx`, `src/components/Sentinel.tsx`, `src/components/SystemBots.tsx`, `src/components/SystemStatusBar.tsx`

#### B. Files with Real Code Differences (`Imports_Surface3_WP` vs `Desktop_horizon`)

| File | Winner / Direction | Detailed Diff & Pearl Analysis |
|---|---|---|
| `tailwind.config.js` | **MERGE (Critical Bugfix from `Surface3_WP`)** | `Desktop_horizon` has a **critical hardcoded path bug** on lines 5–8: `content: ['C:/Users/owner/Desktop/horizon/index.html', 'C:/Users/owner/Desktop/horizon/src/**/*.{js,ts,jsx,tsx}']`. `Imports_Surface3_WP` has portable relative paths: `content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}']`. Meanwhile, `Desktop_horizon` updated the `horizon` color palette from v7 cyan (`#00F0FF`) to v8 Dusk Rose (`#C6586E`). **Action:** Replace hardcoded `C:/Users/owner/...` paths in `Desktop_horizon/tailwind.config.js` with `./index.html` and `./src/**/*.{js,ts,jsx,tsx}`, and add `hzn-*` ochre tokens from `docs/DESIGN_TOKENS.md`. |
| `postcss.config.js` | **`Imports_Surface3_WP` (Critical Bugfix)** | `Desktop_horizon/postcss.config.js` hardcodes `tailwindcss: { config: 'C:/Users/owner/Desktop/horizon/tailwind.config.js' }`. `Imports_Surface3_WP` uses `tailwindcss: {}`. **Action:** Use `Imports_Surface3_WP/postcss.config.js`. |
| `src/components/IngestionSettings.tsx` | **`Desktop_horizon` + 1 Pearl from `Surface3_WP`** | `Desktop_horizon` (743 lines) is significantly ahead of `Surface3_WP` (658 lines): it adds Capacitor `API_BASE` URL resolution, `fetchWithTimeout` (10 min for batch audio, 15s for status), granular HTTP 502/503/404/422 error parsing (`errJson.detail`), `found === 0` warning state, and `transcribed`/`errors` counters. **Pearl in `Surface3_WP` (line 206):** In `runFolderScan`, `Surface3_WP` reads `const queued = data.queued ?? 0;` whereas `Desktop_horizon` changed it to `const downloaded = data.downloaded ?? 0;`. **Action:** In `Desktop_horizon/src/components/IngestionSettings.tsx` line 255, use `const downloaded = data.downloaded ?? data.queued ?? 0;` so both backend response shapes are supported. |
| `src/index.css` | **`Desktop_horizon` (v8 Dusk) + Preserve `Surface3_WP` (v7 Command Center)** | `Desktop_horizon/src/index.css` implements **Design System v8 · Dusk Horizon** (12-stop twilight sky gradient `#060410 -> #C46840`, Sunset Rose `#C6586E`, Soft Teal `#64C0CC`). `Imports_Surface3_WP/src/index.css` implements **Design System v7 · Futuristic Command Center** (`#12161A` obsidian, `#00F0FF` electric cyan, `#E07A5F` coral). **Action:** Keep `Desktop_horizon/src/index.css` as default (or align with `DESIGN_TOKENS.md` v4.0) and save `Surface3_WP`'s v7 variables as an optional `.theme-command-center` preset alongside `.theme-cyber-noir`. |
| `src/components/Dashboard.tsx` | **`Desktop_horizon`** | Only 1 line differs out of 717 lines (line 138): `Surface3_WP` renders `<div className="fixed inset-0 bg-[rgb(6,4,12)] pointer-events-none -z-20" />` which blocks the dusk sky gradient; `Desktop_horizon` replaces it with `{/* Sunset sky bleeds through — no opaque overlay */}`. |
| `src/components/Navigation.tsx` | **`Desktop_horizon`** | Only 1 word differs out of 310 lines (line 34): `Surface3_WP` labels `/settings` as `'Ingest'`; `Desktop_horizon` labels it `'Settings'`. |
| `src/services/GuardianService.ts` | **`Desktop_horizon`** | `Desktop_horizon` adds `private intervalIds: ReturnType<typeof setInterval>[] = []` and a `dispose()` method to prevent timer leaks on HMR/unmount, plus fixes TypeScript return types. |
| `src/services/syncService.ts` | **`Desktop_horizon`** | `Desktop_horizon` replaces `console.log`/`console.error` with structured `connectionLogger.info`/`success`/`error` calls so sync activity appears in the in-app Mission Control `Console`. |
| `src/services/WebNative.ts` | **`Desktop_horizon`** | `Desktop_horizon` adds `Capacitor.isPluginAvailable('CapacitorHorizon')` guards before invoking native Android methods, preventing crashes when running in web/unbridged mode. |
| `src/utils/testUtils.ts` | **`Desktop_horizon`** | `Desktop_horizon` adds mock responses for `/api/v1/calls`, `/api/v1/contacts`, `/api/v1/nudges`, `/api/v1/tasks`, and `/api/v1/projects`. |
| `src/main.tsx` | **`Desktop_horizon`** | `Desktop_horizon` imports `./themes/cyber-noir.css` and calls `initCyberNoirFromStorage()` at boot. |
| `capacitor.config.ts` & `vite.config.ts` | **`Desktop_horizon`** | `Desktop_horizon` adds `HORIZON_LIVE_URL` support for instant Tailscale live-reload HMR on the Android device without rebuilding the APK. |

---

### 2.2 `Imports_Surface3_OD` & `Imports_legitk1ng\src_eclipse_backup` vs `Desktop_horizon`

`Imports_Surface3_OD` (16 frontend files) and `Imports_legitk1ng\src_eclipse_backup` (26 frontend files) represent the **Horizon Eclipse** branch. Comparing every file against `Desktop_horizon` revealed **4 high-value code pearls** that were left behind when `Desktop_horizon` diverged:

| File | Pearl Found in `Surface3_OD` / `src_eclipse_backup` | Exact Code to Harvest into `Desktop_horizon` |
|---|---|---|
| `src/services/apiClient.ts` | **Pearl 1: Missing Ollama Cloud LLM & ACR Portal Sync API methods.** Both `Imports_Surface3_OD/src/services/apiClient.ts` (lines 146–164) and `src_eclipse_backup/services/apiClient.ts` (lines 146–160) define 6 methods for the backend Ollama (`kimi-k2:1t-cloud` / `minimax-m2.7:cloud`) and ACR Portal Sync routers that are completely missing from `Desktop_horizon/src/services/apiClient.ts`. | Add to `api` object in `Desktop_horizon/src/services/apiClient.ts`:<br>```ts<br>// Ollama LLM (Cloud Models)<br>ollamaGenerate: (prompt: string, model = 'minimax-m2.7:cloud') =><br>  request<any>('/api/v1/ollama/generate', { method: 'POST', body: JSON.stringify({ prompt, model }) }),<br>ollamaModels: () => request<{ models: any[] }>('/api/v1/ollama/models'),<br>ollamaHealth: () => request<{ status: string; models?: string[] }>('/api/v1/ollama/health'),<br><br>// ACR Portal Sync<br>startPortalSync: () => request<any>('/api/v1/portal-sync/start', { method: 'POST' }),<br>getPortalSyncHistory: () => request<any>('/api/v1/portal-sync/status'),<br>getPortalSyncStatus: () => request<any>('/api/v1/portal-sync/current'),<br>``` |
| `src/components/Lab.tsx` | **Pearl 2: 3rd `'ingestion'` Tab in `Lab.tsx` (`src_eclipse_backup/components/Lab.tsx` lines 25, 224–229, 250–266).** In `src_eclipse_backup`, `Lab.tsx` has a 3rd tab (`'analysis' \| 'diagnostics' \| 'ingestion'`) with a **"Launch Headless Sync"** card that calls `api.startPortalSync()` and logs progress to the live Console. | Either add the `'ingestion'` / Portal Sync trigger card to `IngestionSettings.tsx` or restore the 3rd tab in `Lab.tsx`. |
| `src/hooks/useHorizonData.ts` | **Pearl 3: `useUpdateCall` stats invalidation (`src_eclipse_backup/hooks/useHorizonData.ts` line 183).** When a call is updated via `useUpdateCall`, `src_eclipse_backup` also invalidates `queryKeys.stats.all` so dashboard KPIs stay in sync. | Add `queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });` inside `useUpdateCall`'s `onSuccess` in `Desktop_horizon/src/hooks/useHorizonData.ts`. |
| `src/components/common/RelationshipGraph.tsx` | **Pearl 4: D3 Force Simulation Viewport Bounds Clamping & Node `<title>` Tooltips (`Imports_Surface3_OD` & `horizon-changed-files`).** `Desktop_horizon` upgraded the D3 graph with SVG glow filters, a top-75 contact cap (fixing O(N²) freeze on 592 contacts), and `alphaDecay(0.05)`, **but dropped the tick coordinate clamping**, allowing nodes to drift outside the SVG box. | In `Desktop_horizon/src/components/common/RelationshipGraph.tsx` inside `simulation.on("tick")` (lines 150–159), clamp coordinates:<br>```ts<br>const clampX = (x: number) => Math.max(24, Math.min(width - 24, x));<br>const clampY = (y: number) => Math.max(24, Math.min(height - 24, y));<br>```<br>and append `<title>` tooltip (`node.append("title").text((d: any) => `${d.name} (Health: ${d.health}%)`)`). |

*(Note on `FloatingChat.tsx` in `Imports_Surface3_OD`: `Desktop_horizon/src/components/common/FloatingChat.tsx` is **strictly superior** to `Imports_Surface3_OD`—as documented in `docs/plans/2026-04-13-ai-chat-stabilization-design.md`, `Desktop_horizon` rewrote `FloatingChat.tsx` to route through backend `/api/v1/chat` with Ollama fallback instead of exposing browser-side `VITE_GEMINI_API_KEY`, and added `ReactMarkdown` + `remarkGfm` rendering.)*

---

### 2.3 `Desktop_unsorted\horizon-changed-files` (`Claud_Rescue_summary.md`) vs `Desktop_horizon`

We audited all 7 fixes described in `Claud_Rescue_summary.md` against `Desktop_horizon`:

| Fix in `horizon-changed-files` | Status in `Desktop_horizon` | Action Needed |
|---|---|---|
| **1. `src/schemas/api.ts`**: Add `transcript: z.string().nullable().optional()` and `.passthrough()` to `CallRecordSchema`, plus `action_items` object-to-string transform in `ExecutiveBriefSchema`. | ✅ **Already integrated** in `Desktop_horizon/src/schemas/api.ts` (lines 28–55). | None — `Desktop_horizon` has the complete fix. |
| **2. `src/services/apiClient.ts`**: Add 10s `AbortController` timeout (`DEFAULT_TIMEOUT_MS = 10_000`) to `request()`. | ✅ **Already integrated** in `Desktop_horizon/src/services/apiClient.ts` (lines 7, 17–21, 56–59). | None — `Desktop_horizon` has the complete fix plus `connectionLogger`. |
| **3. `src/hooks/useHorizonData.ts`**: Add `.catch(() => [])` fallback to `useCalls()`, `useNudges()`, `useContacts()`, and `useStats()`. | ⚠️ **Partially integrated**: `Desktop_horizon` has `.catch(() => [])` on `useCalls()` and `useNudges()`, plus `useTasks()` and `useProjects()`, **but `useContacts()` (line 36) and `useStats()` (line 113) lack `.catch()` fallbacks**. | Add `.catch(() => [])` to `useContacts()` and `.catch(() => ({ totalContacts: 0, totalCalls: 0, avgHealthScore: 0, callsThisWeek: 0 }))` to `useStats()` in `Desktop_horizon/src/hooks/useHorizonData.ts`. |
| **4. `src/components/common/RelationshipGraph.tsx`**: Clamp D3 node/link positions inside SVG bounds + add `<title>` tooltip. | ⚠️ **Missing in `Desktop_horizon`** (`Desktop_horizon` has the 75-node cap & glow filters, but dropped the tick clamping). | Merge tick clamping + `<title>` into `Desktop_horizon/src/components/common/RelationshipGraph.tsx` (see Pearl 4 above). |
| **5. `src/components/common/NudgeShelf.tsx`**: Horizontal snap-carousel (`overflow-x-auto snap-x`) with Left/Right chevron buttons & health score `%`. | 🔄 **Different Design Choice**: `Desktop_horizon` uses a vertical stack inside the right-hand column of `Dashboard.tsx` with direct `mailto:` Email and `tel:` Call action buttons and `GlassCard`. | Keep `Desktop_horizon`'s `mailto:`/`tel:` action buttons, and optionally display `nudge.health_score` badge from `horizon-changed-files`. |

---

## Section 3: UI/UX Design System & Test Suite Status

### 3.1 UI/UX Design Documents & Theme Alignment (`CONSTITUTION.md` §14 vs `DESIGN_TOKENS.md` v4.0 vs `src/index.css`)

We reviewed all four UI/UX specification documents in the corpus:
1. **`Desktop_horizon/docs/DESIGN_TOKENS.md` (v4.0, dated 2026-06-13, Authoritative)**
2. **`CONSTITUTION.md` Section 14 (`Design.md — "Refined Operations"`)**
3. **`Desktop_horizon/docs/UI-UX-Design.md` (merged from `UIDesignPremiumUpgrade.md` + `UI-UX-Improvements.md`)**
4. **`Desktop_horizon/src/index.css` & `src/themes/cyberNoirTheme.ts`**

#### Key Architectural Findings on Design & Theme:
- **Authoritative Token Ruling (`DESIGN_TOKENS.md` v4.0)**: Explicitly supersedes Constitution v3.0's `#0066FF` blue migration and declares **Ochre (`#B8722E` light / `#E8A656` dark)** on **Warm Paper (`#F7F4ED`) / Deep Ink (`#0E0D0B`)** with **Bricolage Grotesque + Geist Sans + Instrument Serif + JetBrains Mono (`tnum`)** as the canonical Horizon PRM identity.
- **Current CSS State in `Desktop_horizon/src/index.css`**: Currently runs **Design System v8 · Dusk Horizon** (Sunset Rose `#C6586E`, Soft Teal `#64C0CC`, Warm Amber `#D4A460`, Inter + Outfit + JetBrains Mono), while `IngestionSettings.tsx` uses the `DESIGN_TOKENS.md` v4.0 Ochre palette (`#0E0D0B` + `#E8A656`), and `src/themes/cyber-noir.css` provides the opt-in **Cyber-Noir** skin (`toggleCyberNoir()`).
- **Missing Theme Switcher Control in UI**: `Desktop_horizon/src/main.tsx` calls `initCyberNoirFromStorage()`, and `src/themes/cyberNoirTheme.ts` exports `toggleCyberNoir()` / `isCyberNoir()`, **but no component in `src/components/` imports or calls `toggleCyberNoir()`!** Adding a theme preset selector (e.g., `Refined Operations (Ochre)` / `Dusk Horizon` / `Command Center v7` / `Cyber-Noir`) in `Navigation.tsx` or `IngestionSettings.tsx` will unify all 4 visual themes without losing any work.
- **Status of the 12 UX Improvements in `UI-UX-Design.md`**:
  - ✅ Implemented in `Desktop_horizon`: `GlassCard.tsx`, `PremiumButton.tsx`, `Skeleton.tsx` & `LoadingScreen.tsx`, `CommandPalette.tsx` (`⌘K`), `FloatingChat.tsx` markdown rendering, `ContactList.tsx` virtualization (`@tanstack/react-virtual`) + Dexie `useLiveQuery`, and `RelationshipGraph.tsx` top-75 node cap.
  - ⚠️ Still pending from `DESIGN_TOKENS.md` v4.0: Loading `Bricolage Grotesque`, `Geist Sans`, and `Instrument Serif` in `index.html`, and enforcing `font-feature-settings: "tnum" 1` on numeric KPI/timestamp surfaces.

### 3.2 Frontend Test Suite Audit (Vitest Unit Tests & Playwright E2E Tests)

We inspected all frontend test files in `Desktop_horizon`:
- **Unit Test (`src/services/api.test.ts` — 29 lines, Vitest)**:
  - Tests `api.getStats()`, `api.getModels()`, and `api.checkHealth()` using `mockFetch` from `src/utils/testUtils.ts`.
  - **Status**: Passes against `Desktop_horizon/src/utils/testUtils.ts`. Should be expanded to test the restored Ollama/Portal Sync methods and `webhookService.ts`.
- **Playwright E2E Tests (`tests/phase3.spec.ts`, `tests/sprint5.spec.ts`, `tests/ux-improvements.spec.ts`)**:
  - **CRITICAL DRIFT DETECTED**: All three Playwright E2E spec files were written against an earlier UI iteration and **will fail against the current `Desktop_horizon` UI** due to selector/route changes:
    1. **Loading Screen Text Drift**: `sprint5.spec.ts` line 8 waits for `text=Connecting to Horizon...` to hide, whereas `App.tsx` line 125 now renders `Horizon OS Core Initializing...`.
    2. **Navigation Button Label Drift**: All 3 specs click `button:has-text("Call Logs")` and `button:has-text("Processing Lab")`, whereas `Navigation.tsx` (lines 29–35) now renders `<NavLink>` (`<a>` elements, not `<button>`) with labels `'Calls'`, `'Contacts'`, `'Actions'`, `'Console'`, `'Settings'`.
    3. **Route Assertion Drift**: `ux-improvements.spec.ts` line 14 asserts `await expect(page).toHaveURL(/\/$/)` after clicking Call Logs (because the old app used in-memory tab state at `/`), whereas `App.tsx` now uses React Router (`/calls`, `/contacts`, `/actions`, `/console`, `/settings`).
    4. **Page Heading & Component Drift**: `phase3.spec.ts` and `sprint5.spec.ts` expect `h2:has-text("Actions Log")` on `/actions` (which was in `ActionsLog.tsx`), whereas `/actions` now renders `Actions.tsx` (`h1:has-text("Actions")`), and `/lab` redirects to `/console` (`Mission.Control`).

---

## Summary Checklist of Recommended Consolidation Actions for `Desktop_horizon`

1. **Fix `tailwind.config.js` and `postcss.config.js` (P0 Blocker)**: Replace hardcoded `C:/Users/owner/Desktop/horizon/...` paths with relative paths from `Imports_Surface3_WP`.
2. **Copy Unique ACR Webhook Monitor Suite from `Imports_Surface3_WP` (P1)**:
   - `src/services/webhookService.ts`
   - `src/hooks/useWebhookJobs.ts`
   - `src/components/WebhookMonitor.tsx` (mount in `IngestionSettings.tsx`)
   - `scripts/test_connect.js`
3. **Merge Missing API Methods & Resilience Pearls into `Desktop_horizon` (P1)**:
   - Add `ollamaGenerate`, `ollamaModels`, `ollamaHealth`, `startPortalSync`, `getPortalSyncHistory`, `getPortalSyncStatus` from `Imports_Surface3_OD/src/services/apiClient.ts` into `Desktop_horizon/src/services/apiClient.ts`.
   - Use `data.downloaded ?? data.queued ?? 0` in `Desktop_horizon/src/components/IngestionSettings.tsx`.
   - Add D3 tick viewport bounds clamping and `<title>` tooltips from `horizon-changed-files` into `Desktop_horizon/src/components/common/RelationshipGraph.tsx`.
   - Add `.catch()` fallbacks to `useContacts()` and `useStats()`, and `queryKeys.stats.all` invalidation to `useUpdateCall` in `Desktop_horizon/src/hooks/useHorizonData.ts`.
4. **Re-wire Orphaned Components in `Desktop_horizon/src/components/` (P2)**:
   - Mount `ActionsLog.tsx` as a `"Call Action Log"` tab inside `Actions.tsx`.
   - Mount `Lab.tsx` at `/lab` (or as a tab in `Console.tsx`).
   - Wire `IntelligenceDossier.tsx` into `UnifiedContactDrawer.tsx`.
   - Add a UI toggle button for `toggleCyberNoir()` in `Navigation.tsx` or `IngestionSettings.tsx`.
5. **Update Playwright E2E Specs (`tests/*.spec.ts`) (P2)**:
   - Update navigation selectors from `button:has-text("Call Logs")` to `a:has-text("Calls")`, loading screen selector to `Horizon OS Core Initializing...`, and URL expectations to match React Router paths (`/calls`, `/contacts`, `/actions`, `/console`, `/settings`).
