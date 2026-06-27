/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      colors: {
        brand: {
          yellow: "#F5C518",
          "yellow-hover": "#E0AD00",
          "yellow-muted": "#FEF9E7",
          ink: "#111111",
          charcoal: "#141414",
          slate: "#2A2A2E",
          surface: "#F5F4F0",
        },
      },
      boxShadow: {
        brand: "0 4px 14px -2px rgba(245, 197, 24, 0.35)",
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};
