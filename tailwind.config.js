/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pfa: {
          green: '#3fae52',
          black: '#0a0f0a',
          card: '#0d1a0e',
          border: 'rgba(63,174,82,0.2)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
