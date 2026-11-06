/** @type {import('tailwindcss').Config} */
export default {
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
          50: '#FFFDF9',
          100: '#FAF6F0',
          200: '#F2ECE1',
          300: '#E6DEC8',
          400: '#D5C7AD',
        },
        maldives: {
          50: '#ECFDF9',
          100: '#D1FAEE',
          200: '#A7F3DF',
          300: '#6EE7CA',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        sage: {
          50: '#F4F8F6',
          100: '#E6F0EC',
          200: '#CFE7E2',
          300: '#ADCBC3',
          400: '#84A98C',
          500: '#658B6E',
          600: '#4F6F57',
        },
        terracotta: {
          50: '#FDF4F0',
          100: '#FBECE6',
          200: '#F5D0C2',
          300: '#EBA890',
          400: '#E07A5F',
          500: '#D97757',
          600: '#BF5B3D',
          700: '#9E472D',
        },
        espresso: {
          900: '#2C2523',
          800: '#433936',
          700: '#5C4F4B',
          600: '#6E6259',
          500: '#8C7E75',
          400: '#ABA096',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['"Fraunces"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        cozy: '0 10px 30px -8px rgba(44, 37, 35, 0.06), 0 4px 12px -2px rgba(44, 37, 35, 0.04)',
        'cozy-lg': '0 20px 40px -12px rgba(20, 184, 166, 0.12), 0 8px 20px -4px rgba(44, 37, 35, 0.06)',
        'cozy-inner': 'inset 0 2px 5px 0 rgba(44, 37, 35, 0.05)',
      },
    },
  },
  plugins: [],
};

