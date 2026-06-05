/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A08",
        surface: "#141410",
        "surface-2": "#1E1E18",
        "surface-3": "#282820",
        ink: "#F5F0E8",
        "ink-muted": "#A09880",
        gold: "#C8A85C",
        "gold-dim": "#8B7340",
        green: "#4ADE80",
        red: "#F87171",
        blue: "#60A5FA",
        purple: "#C084FC",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
