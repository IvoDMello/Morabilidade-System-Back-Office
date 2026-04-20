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
          600: "#585a4f",
          700: "#4a4d43",
          800: "#3d3f36",
          900: "#2e302a",
        },
        gold: {
          DEFAULT: "#d8cb6a",
          50:  "#faf9ef",
          100: "#f3f0d0",
          300: "#e5da8a",
          400: "#d8cb6a",
          500: "#c5b54a",
          600: "#b5a94a",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
