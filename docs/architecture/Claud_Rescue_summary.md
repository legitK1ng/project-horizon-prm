Now let's fix the `apiClient.ts` health schema to accept what the backend actually returns, and add a graceful fallback for when the backend is offline:Now add a `.env.example` file and fix the `RelationshipGraph` to show an empty-state message when no data exists yet:Now let's do a final diff to make sure all the right files are changed and do a TypeScript check:Zero TypeScript errors. Now package it up:Clean build. Let's copy to outputs:**✅ Build passes. 0 TypeScript errors. Here's the full breakdown of every fix:**

---

### 🔴 Bug Fixes (7 confirmed)

**1. `Dashboard.tsx` — `IntelligenceWorkbench` rendered twice**
Removed the second instance (line 221 in the old "Intelligence Grid" section). It was causing double API calls and layout collision.

**2. `Dashboard.tsx` — `RelationshipGraph` had no data**
Wired it to real `contacts` + `calls` data — builds nodes from contacts, org nodes from their `organization` field, and links them together. Shows an empty-state message when there's no data yet.

**3. `NudgeShelf.tsx` — `refreshHealth('all')` type mismatch**
`useRefreshHealth` mutation calls `/nudges/refresh/:id` which requires a real contact UUID. Calling it with the string `'all'` caused a 404 on every nudge shelf render. Fixed by using `refetch()` from the `useNudges` hook instead.

**4. `schemas/api.ts` — `transcript` field missing from `CallRecordSchema`**
Zod was stripping `transcript` at the parse boundary because it wasn't declared. Every `TranscriptView` was receiving an empty string. Added `transcript: z.string().optional().nullable()` and `.passthrough()` to both `CallRecordSchema` and `ContactSchema`.

**5. `IntelligenceWorkbench.tsx` — nested 3-col grid inside 3-col parent**
The component rendered a `grid grid-cols-1 lg:grid-cols-3` as its root. Placing it inside Dashboard's 3-col grid created a broken nested layout that caused the dashboard to overflow/hang during render. Refactored it into a flat column of two stacked cards.

**6. `GoogleSyncButton.tsx` — invisible in light mode**
Used `text-white bg-white/10` — white text on a near-transparent background is invisible in light mode. Replaced with proper light/dark responsive colors (`text-slate-700 dark:text-slate-200`, `bg-white dark:bg-slate-800`).

**7. `App.tsx` + `apiClient.ts` — `connectionStatus` always `'offline'`**
Health check was comparing `healthData?.status === 'online'` but FastAPI returns `'ok'` or `'healthy'`. Made the check accept any of the three. Also replaced `window.location.reload()` in `refreshData` with proper `queryClient.invalidateQueries()`.

---

### 🟡 Improvements Added
- **`useHorizonData.ts`** — all queries now have `.catch(() => [])` fallbacks so the app renders even when the backend is completely offline
- **`useHorizonData.ts`** — fixed query key mismatch (`calls.all` vs `calls.list`) that caused `useIngestCall` invalidation to silently miss
- **`apiClient.ts`** — added a 10-second `AbortController` timeout on every fetch to prevent indefinite hangs
- **`RelationshipGraph.tsx`** — added node collision force, bounds clamping (nodes stay inside the SVG), and a proper empty state
- **`types/index.ts`** — `transcript` type widened to `string | null` to match schema
- **`.env.example`** — added so the repo is self-documenting on what env vars are required