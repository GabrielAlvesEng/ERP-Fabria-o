/** @type {import('tailwindcss').Config} */
// Redesign, etapa 1 (decisão 51): roxo da marca #410FA0, aço/grafite #0E0E10 no escuro, verde-petróleo nos indicadores.
// As cores semânticas (pagina, superficie, borda, texto, suave) vêm das variáveis de src/index.css e mudam com o tema.
const v = (nome) => `rgb(var(--${nome}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        pagina: v('pagina'), superficie: v('superficie'), borda: v('borda'), texto: v('texto'), suave: v('suave'),
        // Roxo da marca: 500 = #410FA0 (botões e destaques); 300/100 para texto sobre fundo escuro (#9672E9 no escuro).
        roxo: { 50: '#f3effb', 100: '#e4dbf8', 200: '#c9b6f1', 300: '#9672e9', 400: '#6a3fd0', 500: '#410fa0', 600: '#370d88', 700: '#2c0a6d', 800: '#200750', 900: '#150533' },
        // Aço/grafite: superfícies do tema escuro e textos fortes.
        marinho: { 50: '#f4f4f6', 100: '#e5e5ea', 200: '#c9c9d1', 300: '#a0a0ab', 400: '#6e6e7a', 500: '#3b3b44', 600: '#2d2d34', 700: '#232328', 800: '#18181c', 900: '#0e0e10' },
        petroleo: { 50: '#e6f4f3', 100: '#c6e6e3', 500: '#0f766e', 600: '#0d5f59', 700: '#0a4b46' },
      },
      borderRadius: { xl: '12px', lg: '8px' },
    },
  },
  plugins: [],
};
