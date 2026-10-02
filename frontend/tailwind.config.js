/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
      },
      colors: {
        // Neutral base — Zinc
        zinc: {
          950: "#09090b",
          900: "#18181b",
          800: "#27272a",
          700: "#3f3f46",
          600: "#52525b",
          500: "#71717a",
          400: "#a1a1aa",
          300: "#d4d4d8",
          200: "#e4e4e7",
          100: "#f4f4f5",
          50:  "#fafafa",
        },
        // Primary accent — Emerald (matches billing/finance trust)
        emerald: {
          950: "#022c22",
          900: "#064e3b",
          800: "#065f46",
          700: "#047857",
          600: "#059669",
          500: "#10b981",
          400: "#34d399",
          300: "#6ee7b7",
          200: "#a7f3d0",
          100: "#d1fae5",
          50:  "#ecfdf5",
        },
        // Status colors
        rose:   { 50:"#fff1f2", 100:"#ffe4e6", 200:"#fecdd3", 300:"#fda4af", 400:"#fb7185", 500: "#f43f5e", 600: "#e11d48", 700:"#be123c", 800:"#9f1239", 900:"#881337", 950:"#4c0519" },
        amber:  { 50:"#fffbeb", 100:"#fef3c7", 200:"#fde68a", 300:"#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600:"#d97706", 700:"#b45309", 800:"#92400e", 900:"#78350f", 950:"#451a03" },
        sky:    { 50:"#f0f9ff", 100:"#e0f2fe", 200:"#bae6fd", 300:"#7dd3fc", 400: "#38bdf8", 500: "#0ea5e9", 600:"#0284c7", 700:"#0369a1", 800:"#075985", 900:"#0c4a6e", 950:"#082f49" },
      },
      borderRadius: {
        DEFAULT: "8px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
        "card-hover": "0 4px 12px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
        glow: "0 0 16px rgba(16,185,129,0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-in": "slideIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideIn: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
