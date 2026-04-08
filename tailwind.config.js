/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* rgba(var(--r, g, b), a) — compatível com Safari/WebKit onde rgb(r g b / a) em variável falha */
      colors: {
        bg:       'rgba(var(--color-bg), <alpha-value>)',
        surface:  'rgba(var(--color-surface), <alpha-value>)',
        card:     'rgba(var(--color-card), <alpha-value>)',
        primary:  'rgba(var(--color-primary), <alpha-value>)',
        success:  'rgba(var(--color-success), <alpha-value>)',
        danger:   'rgba(var(--color-danger), <alpha-value>)',
        warning:  'rgba(var(--color-warning), <alpha-value>)',
        textMain: 'rgba(var(--color-text), <alpha-value>)',
        muted:    'rgba(var(--color-muted), <alpha-value>)',
        border:   'var(--color-border)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      screens: {
        'xs': '375px',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in':  'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      addVariant('light', ['html.light &', "html[data-theme='light'] &"])
    },
  ],
}
