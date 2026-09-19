/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: { 50: '#eef4ff', 600: '#1d4ed8', 700: '#1e40af', 900: '#0f1e3d' } },
      boxShadow: { card: '0 1px 3px rgba(16,24,40,.08), 0 4px 12px rgba(16,24,40,.06)' },
    },
  },
  plugins: [],
};
