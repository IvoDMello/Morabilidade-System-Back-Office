import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        olive: {
          DEFAULT: "#585a4f",
          50:  "#f5f5f3",
          100: "#e8e8e4",
          200: "#d0d1cb",
          300: "#b0b2a8",
          400: "#888b7e",
          500: "#6e7063",
          600: "#585a4f",
          700: "#4a4d43",
          800: "#3d3f36",
          900: "#2e302a",
          950: "#1a1c16",
        },
        gold: {
          DEFAULT: "#d8cb6a",
          50:  "#faf9ef",
          100: "#f3f0d0",
          200: "#e9e3a8",
          300: "#e5da8a",
          400: "#d8cb6a",
          500: "#c5b54a",
          600: "#b5a94a",
          700: "#9a8d3a",
        },
      },
      fontFamily: {
        sans:  ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "serif"],
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(135deg, #2e302a 0%, #585a4f 50%, #4a4d43 100%)",
      },
      boxShadow: {
        card: "0 2px 8px 0 rgba(46,48,42,0.08), 0 1px 2px 0 rgba(46,48,42,0.04)",
        "card-hover": "0 8px 24px 0 rgba(46,48,42,0.14), 0 2px 6px 0 rgba(46,48,42,0.06)",
        "nav": "0 1px 0 0 rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
