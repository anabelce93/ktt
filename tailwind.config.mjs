/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand1: "#f08e80",
        brand2: "#bdcbcd",
        brand3: "#91c5c5"
      }
    }
  },
  plugins: []
};
