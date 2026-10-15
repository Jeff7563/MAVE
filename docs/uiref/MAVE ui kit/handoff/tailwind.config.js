/** MAVE design tokens for Tailwind v3 — drop into apps/desktop (Vite + React).
 *  Fonts must be self-hosted (renderer CSP: default-src 'self'). See handoff/mave.css. */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        mave: {
          bg: '#05060D',
          surface: 'rgba(12,14,30,0.60)',
          raised: 'rgba(255,255,255,0.035)',
          line: 'rgba(255,255,255,0.08)',
          edge: 'rgba(180,190,255,0.14)',
          ink: '#EEF0FB',
          dim: 'rgba(222,226,255,0.60)',
          faint: 'rgba(222,226,255,0.38)',
          blue: '#5B84FF',   // accent-1 · primary actions, selection
          violet: '#9A72FF', // accent-2 · ambient, gradients
          cyan: '#5FD2FF',   // accent-3 · live state, MAVE voice, highlights
          ok: '#5FE0A8',
          err: '#FF7A85',
          warn: '#FFC46B',
        },
      },
      fontFamily: {
        wordmark: ['Jost', 'sans-serif'],
        sans: ['Manrope', 'IBM Plex Sans Thai', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        display: ['64px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '300' }],
        time: ['52px', { lineHeight: '1', fontWeight: '300' }],
        h1: ['36px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],
        h2: ['28px', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'body-lg': ['24px', { lineHeight: '1.4' }],
        body: ['20px', { lineHeight: '1.45' }],
        small: ['16px', { lineHeight: '1.45' }],
        caption: ['14px', { lineHeight: '1.4' }],
        label: ['13px', { lineHeight: '1', letterSpacing: '0.18em' }], // mono, uppercase
        code: ['15px', { lineHeight: '34px' }],
      },
      borderRadius: { chip: '17px', sm: '12px', inner: '18px', card: '24px', panel: '30px' },
      spacing: { 4.5: '18px', 13: '52px', 18: '72px' },
      boxShadow: {
        glass: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 30px 70px -24px rgba(0,0,0,0.7)',
        pill: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 46px rgba(91,132,255,0.16), 0 24px 60px -20px rgba(0,0,0,0.7)',
        active: '0 0 36px -6px rgba(91,132,255,0.35)',
      },
      backdropBlur: { glass: '22px' },
      transitionTimingFunction: {
        enter: 'cubic-bezier(0.25, 1, 0.5, 1)',   // easeOutQuart — things arriving
        glide: 'cubic-bezier(0.65, 0, 0.35, 1)',  // easeInOutCubic — surfaces morphing
        pop: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // easeOutBack — value changes (gym 18→19)
      },
      transitionDuration: { enter: '450ms', glide: '800ms', quick: '200ms' },
      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
        live: { '0%,100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
      },
      animation: { spin: 'spin 0.9s linear infinite', live: 'live 1.6s ease-in-out infinite' },
    },
  },
  plugins: [],
};
