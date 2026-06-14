/** @type {import('tailwindcss').Config} */
export default {
  content: [
    'C:/Users/owner/Desktop/horizon/index.html',
    'C:/Users/owner/Desktop/horizon/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
        data:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // ── Futuristic Command Center Palette ────────────────────────
        hz: {
          bg:          '#12161A',   // deep charcoal void
          surface:     '#161B21',   // raised surface
          panel:       '#1A2028',   // glass panel base
          overlay:     '#1E2530',   // modal/dropdown
          // Electric Cyan — primary HUD accent
          cyan:        '#00F0FF',
          'cyan-soft': '#50F5FF',
          'cyan-dim':  '#00B4C8',
          // Coral/Pink — alert and danger only
          coral:       '#E07A5F',
          pink:        '#D4A5B8',
          'pink-dim':  '#A86A8C',
          // Warm Amber — secondary accent
          gold:        '#D4A460',
          'gold-dim':  '#A88040',
          // Semantic
          success:     '#6CAC82',
          warn:        '#D4A460',
          danger:      '#E07A5F',
          info:        '#00F0FF',
          // Text
          text:        '#F0F5F8',
          'text-sec':  '#8291A0',
          muted:       '#465564',
        },
        // ── Backward-compatible syn.* aliases ────────────────────────
        syn: {
          bg:          '#12161A',
          surface:     '#161B21',
          panel:       '#1A2028',
          overlay:     '#1E2530',
          border:      'rgba(255,255,255,0.07)',
          cyan:        '#00F0FF',   // electric cyan — primary
          'cyan-dim':  '#00B4C8',  // cyan deep
          pink:        '#D4A5B8',  // soft pink — alert only
          'pink-dim':  '#A86A8C',  // rose deep
          purple:      '#9478DC',  // electric indigo
          gold:        '#D4A460',  // warm amber
          orange:      '#E07A5F',  // coral
          green:       '#6CAC82',  // sage green
          red:         '#E07A5F',  // coral-red
          amber:       '#D4A460',  // amber
          text:        '#F0F5F8',  // cool near-white
          'text-sec':  '#8291A0',  // blue-gray secondary
          muted:       '#465564',  // cool muted
        },
        // ── Legacy horizon.* ─────────────────────────────────────────
        horizon: {
          '50':  '#f0f5f8',
          '400': '#00F0FF',
          '500': '#00B4C8',
          '600': '#008FA0',
        },
        premium: {
          success: '#6CAC82',
          warning: '#D4A460',
          error:   '#E07A5F',
        },
      },
      boxShadow: {
        'xs':          'var(--shadow-xs)',
        'sm':          'var(--shadow-sm)',
        'md':          'var(--shadow-md)',
        'lg':          'var(--shadow-lg)',
        'xl':          'var(--shadow-xl)',
        'glow':        '0 4px 24px rgba(0,240,255,0.18)',
        'glow-cyan':   '0 4px 24px rgba(0,240,255,0.22)',
        'glow-pink':   '0 4px 24px rgba(224,122,95,0.20)',
        'glow-purple': '0 4px 24px rgba(148,120,220,0.16)',
        'panel':       '0 0 0 1px rgba(255,255,255,0.07), 0 4px 32px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)',
        'panel-pink':  '0 0 0 1px rgba(0,240,255,0.10), 0 4px 32px rgba(0,0,0,0.65), inset 0 1px 0 rgba(0,240,255,0.05)',
        'glass':       'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.60)',
        'xl-premium':  '0 20px 60px rgba(0,0,0,0.72), 0 0 1px rgba(255,255,255,0.08)',
      },
      borderRadius: {
        'sm':   'var(--radius-sm)',
        'md':   'var(--radius-md)',
        'lg':   'var(--radius-lg)',
        'xl':   'var(--radius-xl)',
        '2xl':  'var(--radius-2xl)',
      },
      transitionTimingFunction: {
        'spring': 'var(--ease-spring)',
        'smooth': 'var(--ease-smooth)',
      },
      animation: {
        'in':           'fadeIn 0.3s ease-in-out',
        'shimmer':      'shimmer 1.5s ease-in-out infinite',
        'pulse-dot':    'pulse-dot 2s ease-in-out infinite',
        'view-enter':   'viewEnter 0.35s ease-out',
        'scan':         'scan 3s linear infinite',
        'pulse-glow':   'pulse-glow 4s ease-in-out infinite',
        'ambient-pulse':'ambient-pulse 6s ease-in-out infinite',
        'grid-scroll':  'grid-scroll 8s linear infinite',
        'float':        'float 8s ease-in-out infinite',
        'scanwave':     'scanwave 4s linear infinite',
        'data-flow':    'data-flow 2s ease-in-out infinite',
        'neon-pulse':   'neon-pulse 4s ease-in-out infinite',
        'neon-flicker': 'neon-flicker 10s linear infinite',
        'glass-shimmer':'glass-shimmer 5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        viewEnter: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4', filter: 'blur(8px)' },
          '50%':      { opacity: '0.8', filter: 'blur(14px)' },
        },
        'pulse-dot': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%':      { transform: 'scale(1.4)', opacity: '0.6' },
        },
        'neon-pulse': {
          '0%, 100%': { boxShadow: '0 4px 24px rgba(0,240,255,0.15)' },
          '50%':      { boxShadow: '0 4px 32px rgba(0,240,255,0.30)' },
        },
        'neon-flicker': {
          '0%, 95%, 100%': { opacity: '1' },
          '96%':            { opacity: '0.85' },
          '97.5%':          { opacity: '1' },
          '98.5%':          { opacity: '0.90' },
        },
        'glass-shimmer': {
          '0%, 100%': {
            borderColor: 'rgba(255,255,255,0.08)',
          },
          '50%': {
            borderColor: 'rgba(0,240,255,0.14)',
          },
        },
        'grid-scroll': {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 60px' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        scanwave: {
          '0%':   { transform: 'translateY(-100%)', opacity: '0' },
          '10%':  { opacity: '0.5' },
          '90%':  { opacity: '0.5' },
          '100%': { transform: 'translateY(100vh)', opacity: '0' },
        },
        'data-flow': {
          '0%':   { transform: 'translateX(-100%)', opacity: '0' },
          '50%':  { opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        'sun-rotate': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
}
