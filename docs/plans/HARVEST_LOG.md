# HARVEST LOG — Eclipse → Horizon Port (Non-Destructive)

**Step:** HARVEST (port, do not overwrite)
**Date:** 2026-08-22
**Operator:** Wheeljack — The Mad Tinkerer (Horizon PRM consolidation)
**Source (older sibling fork):** `C:/Users/owner/My Drive/horizon` (package `project-horizon-eclipse`)
**Target (canonical):** `C:/Users/owner/Desktop/horizon` (package `project-horizon-prm`)

## What was harvested
Two "pearls" from the Eclipse fork, ported **additively** so Horizon's default
"Futuristic Command Center" glassmorphism look and code are 100% untouched
unless the user explicitly toggles the new Cyber-Noir preset.

1. **Eclipse Cyber-Noir visual identity** (neon-pink `#ff00ff`, electric-cyan
   `#00ffff`, synthwave void, CRT scanlines, synth-sun + perspective grid).
2. **Eclipse's more-robust `WebNative` native-plugin fallback** (the
   `Capacitor.isPluginAvailable('CapacitorHorizon')` guard + a centralized
   `getWebFallbackContext()`).

## Files CREATED
| File | Purpose |
|------|---------|
| `src/themes/cyber-noir.css` | The Cyber-Noir preset skin. **100% gated behind the `.theme-cyber-noir` class** — every rule is scoped (`.theme-cyber-noir …`, `:root.theme-cyber-noir`, `html.theme-cyber-noir`). With the class absent it has zero effect. Remaps Horizon's `--hz-*`/`--syn-*`/`--horizon-*` tokens to neon, recolors the real component classes (`.intel-panel`, `.btn-primary`, `.intel-badge-*`, `.nav-pill`, `.hud-corners`, text/border/glow utilities), swaps the dusk-sky `body` gradient for a synthwave void, adds a global CRT scanline overlay, and provides opt-in Eclipse flavor utilities (`.synth-grid`, `.synth-sun`, `.eclipse-card`, `.glow-border-cyan/pink`, `.terminal-text`, `.neural-void`, `.glitch-hover`, and gives Horizon's existing no-op `.scanline` a real effect). |
| `src/themes/cyberNoirTheme.ts` | Additive toggle module. Exposes `enableCyberNoir()`, `disableCyberNoir()`, `toggleCyberNoir()` (returns new on/off), `isCyberNoir()`, and `initCyberNoirFromStorage()`. Persistence via `localStorage['horizon-theme']`. No DOM dependency beyond `document`. |

## Files MODIFIED (additive only)
| File | Change |
|------|--------|
| `src/services/WebNative.ts` | Merged Eclipse's robust fallback **additively & backward-compatibly**. Public API unchanged (`isNative()`, `getNativeContext(): Promise<NativeContext>`, `ping(): Promise<string>`, `export const WebNative`). Added: (a) a `getWebFallbackContext()` private method returning the centralized Web fallback; (b) an `if (!Capacitor.isPluginAvailable('CapacitorHorizon'))` guard at the top of `getNativeContext()` and `ping()` so web/non-native environments return a clean fallback/mock instead of attempting an unregistered-plugin call. The native (plugin-present) code path is byte-for-byte unchanged. |
| `src/main.tsx` | Two additive, inert-by-default lines: `import './themes/cyber-noir.css';` (after `import './index.css';`) and `initCyberNoirFromStorage();` (after the root-element guard). No render logic, providers, or existing imports changed. |

## How to toggle the Cyber-Noir preset
The preset is **OFF by default**. Enable it in one of three ways:

```ts
import { toggleCyberNoir, enableCyberNoir, disableCyberNoir, isCyberNoir }
  from './themes/cyberNoirTheme';

toggleCyberNoir();          // flip on/off; returns the new boolean state
enableCyberNoir();          // force on
disableCyberNoir();         // force off (back to default Horizon look)
isCyberNoir();              // read current state
```

At runtime this simply adds/removes the `theme-cyber-noir` class on
`<html>` (`document.documentElement`). The choice persists in
`localStorage['horizon-theme']` and is restored at boot by the
`additive initCyberNoirFromStorage()` call already wired into `main.tsx`
(no-op unless the user previously toggled it on).

To opt elements into Eclipse's signature flavor utilities, add the class when
the theme is active, e.g. `<div className="eclipse-card scanline">…</div>`.

## WebNative diff summary
| Concern | Before (Horizon) | After (merged) |
|---|---|---|
| Plugin detection | Called `CapacitorHorizon.*` directly inside try/catch | Guards with `Capacitor.isPluginAvailable('CapacitorHorizon')` first; returns Web fallback/mock immediately when absent |
| Fallback shape | Inline object in `getNativeContext` catch (`model: 'Unknown Browser'`) | Centralized `getWebFallbackContext()` (`model: 'Web Browser / Nexus'`), reused by both `getNativeContext()` (catch) and the availability guard |
| `ping()` web path | `try { echo } catch { return 'Failed' }` | Returns `'Mock Ping: Success (Web)'` when plugin absent; `'Failed'` only on a real echo error |
| Public API / types | unchanged | unchanged (fully backward-compatible) |

## Verification notes
- Every Cyber-Noir CSS rule is scoped under `.theme-cyber-noir`; the default
  Horizon stylesheet, Tailwind config, and component files were **not** edited,
  so the default appearance and code are unchanged.
- `WebNative` edits preserve the exported surface and types; only the
  failure/availability branches gained the Eclipse robustness.
- No `npm install` / full `npm run build` was run (per task constraints). All
  new imports resolve to files created in this step; the toggle module imports
  only `document`/`localStorage` (browser globals).
- Recommended sanity check (optional, when a build is permitted):
  `npx tsc --noEmit` and visually toggle `toggleCyberNoir()` in the browser.
