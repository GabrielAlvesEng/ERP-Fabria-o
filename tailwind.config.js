/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        marinho: { 50: '#eef1f8', 100: '#d7deee', 500: '#2b3a67', 700: '#1b2140', 800: '#141a33', 900: '#0d1124' },
        roxo: { 50: '#f1edff', 100: '#e2d9ff', 500: '#6d4aff', 600: '#5a36e8', 700: '#4826c2' },
        petroleo: { 50: '#e6f4f3', 500: '#0f766e', 600: '#0d5f59' },
      },
    },
  },
  plugins: [],
};
