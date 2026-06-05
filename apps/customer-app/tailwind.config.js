/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A08",
        surface: "#141410",
        "surface-2": "#1E1E18",
        ink: "#F5F0E8",
        "ink-muted": "#A09880",
        gold: "#C8A85C",
        "gold-dim": "#8B7340",
        green: "#4ADE80",
        red: "#F87171",
        blue: "#60A5FA",
      },
      fontFamily: {
        sans: ["Inter"],
        heading: ["SpaceGrotesk"],
        mono: ["JetBrainsMono"],
      },
    },
  },
  plugins: [],
};
