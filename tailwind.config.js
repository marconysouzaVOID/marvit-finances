/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './utils/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        oat: {
          50: 'var(--oat-50)',
          100: 'var(--oat-100)',
          200: 'var(--oat-200)',
          300: 'var(--oat-300)',
          400: 'var(--oat-400)',
        },
        maldives: {
          50: 'var(--maldives-50)',
          100: 'var(--maldives-100)',
          200: 'var(--maldives-200)',
          300: 'var(--maldives-300)',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: 'var(--maldives-600)',
          700: 'var(--maldives-700)',
          800: 'var(--maldives-800)',
          900: '#134E4A',
        },
        sage: {
          50: 'var(--sage-50)',
          100: 'var(--sage-100)',
          200: 'var(--sage-200)',
          300: 'var(--sage-300)',
          400: '#84A98C',
          500: '#658B6E',
          600: 'var(--sage-600)',
        },
        terracotta: {
          50: 'var(--terracotta-50)',
          100: 'var(--terracotta-100)',
          200: 'var(--terracotta-200)',
          300: 'var(--terracotta-300)',
          400: '#E07A5F',
          500: '#D97757',
          600: 'var(--terracotta-600)',
          700: 'var(--terracotta-700)',
        },
        espresso: {
          900: 'var(--espresso-900)',
          800: 'var(--espresso-800)',
          700: 'var(--espresso-700)',
          600: 'var(--espresso-600)',
          500: 'var(--espresso-500)',
          400: 'var(--espresso-400)',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['"Fraunces"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        cozy: '0 10px 30px -8px rgba(44, 37, 35, 0.07), 0 4px 12px -2px rgba(44, 37, 35, 0.04)',
        'cozy-lg':
          '0 20px 40px -12px rgba(20, 184, 166, 0.14), 0 8px 20px -4px rgba(44, 37, 35, 0.08)',
        'cozy-inner': 'inset 0 2px 5px 0 rgba(44, 37, 35, 0.05)',
      },
    },
  },
  plugins: [],
};
