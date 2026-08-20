import type { Config } from 'tailwindcss'

/**
 * Every colour is a channel triplet on :root so that one class set works in
 * both themes (see src/styles/tokens.css). Nothing here is theme-specific.
 */
const token = (name: string) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="gece"]'],
  theme: {
    extend: {
      colors: {
        paper: token('--paper'),
        'paper-raised': token('--paper-raised'),
        ink: token('--ink'),
        'ink-soft': token('--ink-soft'),
        rule: token('--rule'),
        verified: token('--verified'),
        correction: token('--correction'),
        focus: token('--focus'),
      },
      fontFamily: {
        // Scripture. Never used for interface text.
        sacred: ['"KFGQPC Uthmanic Script HAFS"', '"Amiri Quran"', '"Scheherazade New"', 'serif'],
        // Meaning / translation: a book voice.
        meaning: ['Newsreader', 'Georgia', 'serif'],
        // Interface & data.
        ui: ['"IBM Plex Sans"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        'ui-arabic': ['"IBM Plex Sans Arabic"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // 13 / 15 / 17 / 20 / 26 / 34 — interface never exceeds 20.
        micro: ['13px', { lineHeight: '1.45' }],
        small: ['15px', { lineHeight: '1.5' }],
        base: ['17px', { lineHeight: '1.6' }],
        large: ['20px', { lineHeight: '1.4' }],
        display: ['26px', { lineHeight: '1.3' }],
        sacred: ['34px', { lineHeight: '2.2' }],
      },
      maxWidth: { column: '68ch', measure: '62ch' },
      transitionTimingFunction: { ink: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    },
  },
  plugins: [],
} satisfies Config
