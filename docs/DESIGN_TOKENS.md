# Horizon PRM — Canonical Design Token System
**Version:** 4.0  
**Status:** Authoritative — Supersedes all prior token references  
**Supersedes:** CONSTITUTION.pdf §14 (v3.0 horizon-blue migration), constitution.md §14 design.md  
**Last Updated:** 2026-06-13  
**Maintained by:** Brandon

---

## Declaration of Authority

This document is the **single source of truth** for all visual tokens in Horizon PRM. It resolves the split identity introduced in Constitution v3.0, which incorrectly migrated the primary accent from ochre to horizon-blue (`#0066FF`).

**Ruling:** Ochre is the canonical accent. It is the brand's entire emotional premise — warmth, people, relationships. Generic SaaS blue is what this platform deliberately avoids. Any file still referencing `#0066FF` as a primary brand color should be corrected against this document.

The horizon-blue (`#0066FF`) is retained **only** as the interactive/link color and as a secondary functional accent within charts and topology diagrams. It is not the brand.

Every component, config file, and documentation section must consume tokens from this document. Direct hex codes in components are a bug.

---

## 1. Color System

### 1.1 Accent — Ochre (Brand Identity)

The signature color of Horizon PRM. Used on CTAs, active states, health ring accents (mid-band), focus rings, nav active indicators, and primary borders. Appears in both themes at calibrated brightness for legibility.

| Token | Light Value | Dark Value | Usage |
|---|---|---|---|
| `--accent` | `#B8722E` | `#E8A656` | Primary brand accent — the signature |
| `--accent-2` | `#9A5E22` | `#F0B96A` | Hover/emphasis state of accent |
| `--accent-soft` | `rgba(184,114,46,0.12)` | `rgba(232,166,86,0.14)` | Tinted backgrounds, focus halos |
| `--accent-fg` | `#FFFFFF` | `#0E0D0B` | Text on filled accent surfaces |
| `--accent-border` | `rgba(184,114,46,0.35)` | `rgba(232,166,86,0.30)` | Accent-tinted border/divider |

### 1.2 Background & Surface

The foundation of both themes. Light theme uses warm off-white; dark theme uses warm near-black. Neither is pure white or pure black — this is intentional and must not be overridden.

| Token | Light Value | Dark Value | Usage |
|---|---|---|---|
| `--bg` | `#F7F4ED` | `#0E0D0B` | Page/root background |
| `--bg-subtle` | `#EFECE4` | `#131210` | Subtle recessed areas, sidebar |
| `--surface` | `rgba(247,244,237,0.65)` | `rgba(22,21,18,0.60)` | Default card/panel — translucent |
| `--surface-2` | `rgba(239,236,228,0.70)` | `rgba(18,17,15,0.65)` | Recessed surface — inputs, sidebar cells |
| `--surface-3` | `rgba(230,227,218,0.75)` | `rgba(14,13,11,0.70)` | Hover/active surface state |
| `--surface-solid` | `#F7F4ED` | `#181714` | Solid fallback (toasts, no backdrop) |
| `--surface-overlay` | `rgba(247,244,237,0.90)` | `rgba(14,13,11,0.92)` | Modals, drawers — high opacity |

**Backdrop filter:** All translucent surfaces apply `backdrop-filter: blur(20px) saturate(140%)` unless explicitly overridden. The saturation lift counteracts desaturation from heavy blur.

**Surface opacity tiers by elevation:**
- Sidebar: `~85%` — highest legibility requirement
- Cards/panels: `~65%` — ambient background visible
- Modals/drawers: `~90%` — content focus moments
- Toasts: `~92%` with `shadow-xl`

### 1.3 Ink (Typography Colors)

Warm ink tones. Never pure black, never pure white.

| Token | Light Value | Dark Value | Usage |
|---|---|---|---|
| `--ink` | `#14110D` | `#F1ECDD` | Primary text — headings, labels |
| `--ink-2` | `#3D3830` | `#C8BFA8` | Secondary text — descriptions |
| `--ink-3` | `#7A7166` | `#857C6E` | Tertiary — metadata, timestamps |
| `--ink-4` | `#B3A99A` | `#4D4840` | Disabled / placeholder |

### 1.4 Semantic Colors

Functional status colors used for health scoring, alerts, sentiment indicators.

| Token | Value | Dark Value | Usage |
|---|---|---|---|
| `--success` | `#1A7F4E` | `#2DB87A` | Health ≥85, positive sentiment, active |
| `--success-soft` | `rgba(26,127,78,0.12)` | `rgba(45,184,122,0.14)` | Success tinted background |
| `--warning` | `#C47A0F` | `#F0A832` | Health 70–84, attention needed |
| `--warning-soft` | `rgba(196,122,15,0.12)` | `rgba(240,168,50,0.14)` | Warning tinted background |
| `--danger` | `#B83030` | `#E05252` | Health <70, error, failed state |
| `--danger-soft` | `rgba(184,48,48,0.12)` | `rgba(224,82,82,0.14)` | Error tinted background |
| `--info` | `#1A5FA8` | `#4A90E2` | Informational, neutral links |
| `--info-soft` | `rgba(26,95,168,0.10)` | `rgba(74,144,226,0.12)` | Info tinted background |

**Health Ring Color Bands:**
- Score ≥85 → `--success`
- Score 70–84 → `--warning` (accent-adjacent)
- Score <70 → `--danger`

### 1.5 Functional Blue (Non-Brand)

Retained for interactive links, topology diagram lines, chart series #2, and technical data surfaces only. Not the brand color. Not used on CTAs, buttons, or navigation.

| Token | Value | Usage |
|---|---|---|
| `--link` | `#1A5FA8` | Hyperlinks, inline text actions |
| `--link-hover` | `#0D4A8A` | Link hover state |
| `--chart-2` | `#4A7FC1` | Second series in multi-series charts |
| `--topology-line` | `#3A6FA8` | NetworkTopology.tsx connector lines |

### 1.6 Border & Divider

| Token | Light Value | Dark Value | Usage |
|---|---|---|---|
| `--border` | `rgba(20,17,13,0.18)` | `rgba(241,236,221,0.14)` | Strong divider |
| `--border-subtle` | `rgba(20,17,13,0.09)` | `rgba(241,236,221,0.07)` | Default card border |
| `--border-accent` | `rgba(184,114,46,0.35)` | `rgba(232,166,86,0.30)` | Accent-tinted border |
| `--border-glass` | `rgba(255,255,255,0.18)` | `rgba(255,255,255,0.08)` | Glass surface inner highlight |

---

## 2. Typography

### 2.1 Font Stack

| Role | Family | Variable | Weights | OpenType |
|---|---|---|---|---|
| **Display / KPI** | Bricolage Grotesque | Yes | 400–800 | `opsz` for optical sizing |
| **Body / UI** | Geist Sans | No | 300–700 | `cv11`, `ss01`, `ss03` |
| **Editorial Accent** | Instrument Serif | No | 400 italic only | Italics for personality |
| **Data / Code** | JetBrains Mono | No | 400–600 | `tnum` tabular numerals always on |
| **System Fallback** | system-ui, sans-serif | — | — | Used if primary fails to load |

```css
:root {
  --font-display: 'Bricolage Grotesque', system-ui, sans-serif;
  --font-body: 'Geist Sans', system-ui, sans-serif;
  --font-editorial: 'Instrument Serif', Georgia, serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### 2.2 Type Scale

All sizes in `rem`. Base: `16px`.

| Token | Value | Usage |
|---|---|---|
| `--text-xs` | `0.6875rem` (11px) | Pills, badges, icon labels |
| `--text-sm` | `0.8125rem` (13px) | Secondary UI, metadata, timestamps |
| `--text-base` | `0.9375rem` (15px) | Default body text |
| `--text-md` | `1rem` (16px) | Primary body, nav items |
| `--text-lg` | `1.125rem` (18px) | Section leads, drawer titles |
| `--text-xl` | `1.375rem` (22px) | Card headings, modal titles |
| `--text-2xl` | `1.75rem` (28px) | Page titles, KPI labels |
| `--text-3xl` | `2.25rem` (36px) | Display, hero numbers |
| `--text-4xl` | `3rem` (48px) | Major KPI values, optically sized |

### 2.3 Letter Spacing

| Role | Value |
|---|---|
| Display headings | `-0.03em` to `-0.04em` |
| Body / UI | `-0.005em` to `-0.01em` |
| Mono / data | `0` (never tracked) |
| All-caps labels | `+0.06em` |

### 2.4 Tabular Numerals

All financial figures, timestamps, health scores, counts, and data table cells must use JetBrains Mono with `font-feature-settings: "tnum" 1`. This is non-negotiable — proportional numerals in data surfaces cause column misalignment.

```css
.hzn-mono.hzn-tabular {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1, "zero" 1;
}
```

---

## 3. Spacing Scale

Based on a 4px base unit. All spacing values are multiples.

| Token | Value | Common Use |
|---|---|---|
| `--space-1` | `4px` | Icon padding, tight labels |
| `--space-2` | `8px` | Internal component padding |
| `--space-3` | `12px` | Component inner gap |
| `--space-4` | `16px` | Default padding unit |
| `--space-5` | `20px` | Card padding (mobile) |
| `--space-6` | `24px` | Card padding (desktop) |
| `--space-8` | `32px` | Section gap |
| `--space-10` | `40px` | Large section gap |
| `--space-12` | `48px` | Layout breathing room |
| `--space-16` | `64px` | Page section separation |
| `--space-20` | `80px` | Hero/top-of-page padding |

---

## 4. Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `6px` | Badges, pills, kbd |
| `--radius-md` | `10px` | Buttons, inputs, small cards |
| `--radius-lg` | `16px` | Cards, panels |
| `--radius-xl` | `20px` | Drawers, elevated cards |
| `--radius-2xl` | `28px` | Modals, large surfaces |
| `--radius-full` | `9999px` | Avatars, toggle switches |

**Rule:** Use `--radius-lg` as the default card radius. Never mix radius scales within the same component.

---

## 5. Elevation & Shadow System

Shadows carry warmth tint in light theme; they do not appear blue or cool-grey.

| Token | Light Value | Dark Value | Usage |
|---|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(20,17,13,0.08)` | `0 1px 3px rgba(0,0,0,0.24)` | Subtle lift — inputs, badges |
| `--shadow-md` | `0 4px 12px rgba(20,17,13,0.10), 0 1px 3px rgba(20,17,13,0.06)` | `0 4px 12px rgba(0,0,0,0.32)` | Cards, default panels |
| `--shadow-lg` | `0 8px 24px rgba(20,17,13,0.12), 0 2px 6px rgba(20,17,13,0.06)` | `0 8px 24px rgba(0,0,0,0.40)` | Modals, popovers |
| `--shadow-xl` | `0 20px 48px rgba(20,17,13,0.14), 0 4px 12px rgba(20,17,13,0.08)` | `0 20px 48px rgba(0,0,0,0.52)` | Drawers, floating panels |
| `--shadow-glass` | `inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 32px rgba(20,17,13,0.10)` | `inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.36)` | Glass cards — the standard |
| `--shadow-glow` | `0 0 0 3px rgba(184,114,46,0.20)` | `0 0 0 3px rgba(232,166,86,0.22)` | Focus ring — accent halo |
| `--shadow-glow-danger` | `0 0 0 3px rgba(184,48,48,0.20)` | `0 0 0 3px rgba(224,82,82,0.22)` | Focus ring — error state |

---

## 6. Motion & Animation

All motion uses Framer Motion. CSS-only fallbacks for reduced-motion.

### 6.1 Spring Presets

| Preset | Stiffness | Damping | Usage |
|---|---|---|---|
| `spring-gentle` | 180 | 28 | Page load, content entrance |
| `spring-responsive` | 240 | 24 | Card hover, interactive feedback |
| `spring-snappy` | 320 | 30 | Drawer/modal open |
| `spring-exit` | — | — | Use `ease: [0.4, 0, 1, 0.6], duration: 0.18` |

### 6.2 Stagger Timing

| Context | Delay per item | Max items staggered |
|---|---|---|
| Dashboard KPI cards | `0.04s` | 6 |
| Contact list rows | `0.03s` | 10 (cap; remainder instant) |
| Nudge shelf items | `0.05s` | 5 |
| Call log entries | `0.025s` | 12 |

### 6.3 Standard Transition Durations

| Token | Value | Usage |
|---|---|---|
| `--duration-fast` | `120ms` | Button color shifts, hover borders |
| `--duration-base` | `200ms` | Standard UI transitions |
| `--duration-slow` | `320ms` | Panel slides, accordion |
| `--duration-page` | `400ms` | Page/route transitions |
| `--duration-theme` | `200ms` | Theme toggle rotation |

### 6.4 Easing

| Token | Cubic Bezier | Usage |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances — overshoots slightly |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 0.6)` | Exits — quick departure |
| `--ease-inout` | `cubic-bezier(0.4, 0, 0.2, 1)` | Continuous motion |

### 6.5 Prohibited Motion

- No bouncy springs on data values or numeric counters
- No pulse animations on idle/ambient state (exception: Sentinel scanline in SystemBots.tsx)
- No animated gradients in chrome or structural elements
- No motion on elements the user is actively typing into

### 6.6 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

All Framer Motion components must pass `transition: { duration: prefersReducedMotion ? 0 : duration }`.

---

## 7. Component Token Map

Named patterns that compose the primitives above.

### 7.1 `.hzn-card` (Standard Glass Card)
```css
.hzn-card {
  background: var(--surface);
  backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glass);
}
.hzn-card:hover {
  box-shadow: var(--shadow-glass), 0 0 0 1px var(--border-accent);
  transition: box-shadow var(--duration-base) var(--ease-out);
}
```

### 7.2 `.hzn-card-elevated` (Modal / Hover Lift)
```css
.hzn-card-elevated {
  background: var(--surface-overlay);
  backdrop-filter: blur(24px) saturate(150%);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
}
```

### 7.3 `.hzn-btn .hzn-btn-primary` (Ink Fill)
```css
.hzn-btn {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  transition: all var(--duration-fast) var(--ease-out);
  position: relative;
  overflow: hidden;
}
.hzn-btn-primary {
  background: var(--ink);
  color: var(--bg);
  border: none;
}
.hzn-btn-primary:hover {
  background: var(--ink-2);
}
.hzn-btn-primary:active {
  transform: scale(0.97);
}
.hzn-btn-primary:focus-visible {
  outline: none;
  box-shadow: var(--shadow-glow);
}
.hzn-btn-primary:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
/* Ripple overlay */
.hzn-btn-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.14);
  opacity: 0;
  transition: opacity var(--duration-fast);
}
.hzn-btn-primary:active::after { opacity: 1; }
```

### 7.4 `.hzn-btn-accent` (Ochre Fill — Use Sparingly)
```css
.hzn-btn-accent {
  background: var(--accent);
  color: var(--accent-fg);
  border: none;
}
.hzn-btn-accent:hover { background: var(--accent-2); }
.hzn-btn-accent:focus-visible { box-shadow: var(--shadow-glow); }
```

### 7.5 `.hzn-btn-ghost` (Bordered, Transparent)
```css
.hzn-btn-ghost {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--border);
}
.hzn-btn-ghost:hover {
  background: var(--surface-3);
  border-color: var(--border-accent);
}
```

### 7.6 `.hzn-input`
```css
.hzn-input {
  background: var(--surface-2);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--ink);
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
}
.hzn-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-glow);
}
.hzn-input::placeholder { color: var(--ink-4); }
```

### 7.7 `.hzn-pill` Status Indicators

```css
.hzn-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.hzn-pill-success { background: var(--success-soft); color: var(--success); }
.hzn-pill-warning { background: var(--warning-soft); color: var(--warning); }
.hzn-pill-danger  { background: var(--danger-soft);  color: var(--danger);  }
.hzn-pill-accent  { background: var(--accent-soft);  color: var(--accent);  }
```

### 7.8 `.hzn-kbd`
```css
.hzn-kbd {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-3);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: var(--radius-sm);
}
```

### 7.9 `.hzn-nav-item`
```css
.hzn-nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--ink-3);
  transition: all var(--duration-fast) var(--ease-out);
  position: relative;
}
.hzn-nav-item:hover {
  background: var(--surface-3);
  color: var(--ink);
}
.hzn-nav-item.active {
  color: var(--accent);
  background: var(--accent-soft);
}
/* Left bar accent on active */
.hzn-nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2.5px;
  border-radius: var(--radius-full);
  background: var(--accent);
}
```

---

## 8. Tailwind Config Extension

Add to `tailwind.config.js` under `extend:` to expose tokens as Tailwind utilities.

```js
// tailwind.config.js — extend block
{
  colors: {
    // Ochre — brand accent
    'hzn-ochre': {
      light: '#B8722E',
      DEFAULT: '#B8722E',
      dark: '#E8A656',
      hover: '#9A5E22',
      soft: 'rgba(184,114,46,0.12)',
    },
    // Semantic
    'hzn-success': '#1A7F4E',
    'hzn-warning': '#C47A0F',
    'hzn-danger': '#B83030',
    // Functional blue — NON-BRAND
    'hzn-link': '#1A5FA8',
    // Ink
    'hzn-ink': '#14110D',
    'hzn-ink-2': '#3D3830',
    'hzn-ink-3': '#7A7166',
    'hzn-ink-4': '#B3A99A',
    // Surface (dark theme equivalents in dark: variants)
    'hzn-bg': '#F7F4ED',
    'hzn-bg-dark': '#0E0D0B',
  },
  fontFamily: {
    display: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
    body: ['Geist Sans', 'system-ui', 'sans-serif'],
    editorial: ['Instrument Serif', 'Georgia', 'serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
  },
  borderRadius: {
    'hzn-sm': '6px',
    'hzn-md': '10px',
    'hzn-lg': '16px',
    'hzn-xl': '20px',
    'hzn-2xl': '28px',
  },
  boxShadow: {
    'glass': 'inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 32px rgba(20,17,13,0.10)',
    'glass-dark': 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.36)',
    'glow': '0 0 0 3px rgba(184,114,46,0.20)',
    'glow-dark': '0 0 0 3px rgba(232,166,86,0.22)',
    'xl-elevated': '0 20px 48px rgba(20,17,13,0.14), 0 4px 12px rgba(20,17,13,0.08)',
  },
  backdropBlur: {
    'hzn': '20px',
    'hzn-lg': '24px',
  },
}
```

---

## 9. CSS Root Implementation

Place in `src/styles/tokens.css` (or equivalent global entry). Import before all component styles.

```css
/* ─── Horizon PRM Design Tokens v4.0 ─────────────────────────────────── */

[data-theme="light"],
:root {
  /* Accent */
  --accent:         #B8722E;
  --accent-2:       #9A5E22;
  --accent-soft:    rgba(184, 114, 46, 0.12);
  --accent-fg:      #FFFFFF;
  --accent-border:  rgba(184, 114, 46, 0.35);

  /* Background */
  --bg:             #F7F4ED;
  --bg-subtle:      #EFECE4;

  /* Surface */
  --surface:        rgba(247, 244, 237, 0.65);
  --surface-2:      rgba(239, 236, 228, 0.70);
  --surface-3:      rgba(230, 227, 218, 0.75);
  --surface-solid:  #F7F4ED;
  --surface-overlay:rgba(247, 244, 237, 0.90);

  /* Ink */
  --ink:   #14110D;
  --ink-2: #3D3830;
  --ink-3: #7A7166;
  --ink-4: #B3A99A;

  /* Semantic */
  --success:       #1A7F4E;
  --success-soft:  rgba(26, 127, 78, 0.12);
  --warning:       #C47A0F;
  --warning-soft:  rgba(196, 122, 15, 0.12);
  --danger:        #B83030;
  --danger-soft:   rgba(184, 48, 48, 0.12);
  --info:          #1A5FA8;
  --info-soft:     rgba(26, 95, 168, 0.10);

  /* Functional blue (NON-BRAND) */
  --link:          #1A5FA8;
  --link-hover:    #0D4A8A;

  /* Border */
  --border:        rgba(20, 17, 13, 0.18);
  --border-subtle: rgba(20, 17, 13, 0.09);
  --border-accent: rgba(184, 114, 46, 0.35);
  --border-glass:  rgba(255, 255, 255, 0.18);

  /* Shadow */
  --shadow-sm:     0 1px 3px rgba(20, 17, 13, 0.08);
  --shadow-md:     0 4px 12px rgba(20, 17, 13, 0.10), 0 1px 3px rgba(20, 17, 13, 0.06);
  --shadow-lg:     0 8px 24px rgba(20, 17, 13, 0.12), 0 2px 6px rgba(20, 17, 13, 0.06);
  --shadow-xl:     0 20px 48px rgba(20, 17, 13, 0.14), 0 4px 12px rgba(20, 17, 13, 0.08);
  --shadow-glass:  inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 8px 32px rgba(20, 17, 13, 0.10);
  --shadow-glow:   0 0 0 3px rgba(184, 114, 46, 0.20);
  --shadow-glow-danger: 0 0 0 3px rgba(184, 48, 48, 0.20);
}

[data-theme="dark"] {
  /* Accent */
  --accent:         #E8A656;
  --accent-2:       #F0B96A;
  --accent-soft:    rgba(232, 166, 86, 0.14);
  --accent-fg:      #0E0D0B;
  --accent-border:  rgba(232, 166, 86, 0.30);

  /* Background */
  --bg:             #0E0D0B;
  --bg-subtle:      #131210;

  /* Surface */
  --surface:        rgba(22, 21, 18, 0.60);
  --surface-2:      rgba(18, 17, 15, 0.65);
  --surface-3:      rgba(14, 13, 11, 0.70);
  --surface-solid:  #181714;
  --surface-overlay:rgba(14, 13, 11, 0.92);

  /* Ink */
  --ink:   #F1ECDD;
  --ink-2: #C8BFA8;
  --ink-3: #857C6E;
  --ink-4: #4D4840;

  /* Semantic */
  --success:       #2DB87A;
  --success-soft:  rgba(45, 184, 122, 0.14);
  --warning:       #F0A832;
  --warning-soft:  rgba(240, 168, 50, 0.14);
  --danger:        #E05252;
  --danger-soft:   rgba(224, 82, 82, 0.14);
  --info:          #4A90E2;
  --info-soft:     rgba(74, 144, 226, 0.12);

  /* Functional blue (NON-BRAND) */
  --link:          #4A90E2;
  --link-hover:    #6BA8EC;

  /* Border */
  --border:        rgba(241, 236, 221, 0.14);
  --border-subtle: rgba(241, 236, 221, 0.07);
  --border-accent: rgba(232, 166, 86, 0.30);
  --border-glass:  rgba(255, 255, 255, 0.08);

  /* Shadow */
  --shadow-sm:     0 1px 3px rgba(0, 0, 0, 0.24);
  --shadow-md:     0 4px 12px rgba(0, 0, 0, 0.32);
  --shadow-lg:     0 8px 24px rgba(0, 0, 0, 0.40);
  --shadow-xl:     0 20px 48px rgba(0, 0, 0, 0.52);
  --shadow-glass:  inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 8px 32px rgba(0, 0, 0, 0.36);
  --shadow-glow:   0 0 0 3px rgba(232, 166, 86, 0.22);
  --shadow-glow-danger: 0 0 0 3px rgba(224, 82, 82, 0.22);
}

/* ─── Reduced Motion Override ─────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration:        0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration:       0.01ms !important;
  }
}
```

---

## 10. Usage Rules & Enforcement

### Mandatory

- Every color reference in a component must use a `var(--token)`. Direct hex in components is a bug.
- Every shadow must use a shadow token. `box-shadow: 0 2px 4px #000` is a bug.
- Every border-radius must use a radius token.
- Tabular numerals on all data surfaces (health scores, timestamps, counts, deltas).
- `backdrop-filter: blur(20px) saturate(140%)` on all translucent `.hzn-card` surfaces.

### Prohibited

- `#0066FF` or `horizon-blue` as brand/CTA/button color.
- `#3B82F6` (Tailwind blue-500) anywhere in the design system.
- Purple/pink gradients of any kind.
- `font-family: 'Inter'` or `'Roboto'` — these are Geist replacements.
- Hard-coded `opacity` values for surface translucency — use `--surface` token instead.
- `box-shadow: none` on glass cards — the inset highlight must remain.

---

## 11. Migration Checklist (from Constitution v3.0)

The following changes are required to bring all files into alignment with v4.0:

| File / Area | v3.0 State | v4.0 Target |
|---|---|---|
| `tailwind.config.js` `horizon-500` | `#0066FF` (brand primary) | Remove or rename to `hzn-link` |
| `tailwind.config.js` `horizon-800` | `#0A0F1E` (dark body) | Replace with `hzn-ink: #14110D` |
| `tailwind.config.js` `horizon-50` | `#EEF2FF` (light bg) | Replace with `hzn-bg: #F7F4ED` |
| `tailwind.config.js` `horizon-200` | `#C7D2FE` (borders) | Replace with `--border-subtle` token |
| Any `bg-horizon-500` utility class | Blue buttons/links | Audit: brand CTA → `hzn-btn-primary` (ink); functional link → `--link` |
| `CONSTITUTION.pdf §14` brand color | `#0066FF` as primary | `#B8722E` / `#E8A656` per this document |
| `GuardianService.ts` agent cards | Blue activity glow | Muted to `--border-subtle` pulse (cosmetic agents must not use brand accent) |
| `NetworkTopology.tsx` connector lines | Any color | Use `--topology-line: #3A6FA8` |

---

## 12. Version History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-03 | Initial design system established. Ochre accent, Warm Paper / Deep Ink palette. |
| 2.0 | 2026-05-03 | Typography stack finalized. Bricolage + Geist + Instrument Serif + JetBrains Mono. |
| 3.0 ❌ | 2026-05-13 | Incorrect migration to horizon-blue `#0066FF` as primary. **This was an error.** |
| **4.0** | **2026-06** | **Ochre restored as canonical brand accent. Blue demoted to functional/non-brand. This document supersedes all prior versions.** |

---

*End of DESIGN_TOKENS.md — Update on every meaningful token decision.*  
*Reference this file before writing any new component. If a token you need is missing, add it here first, then use it.*
