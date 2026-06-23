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
        primary: {
          DEFAULT: "#0B3C5D",
          hover: "#082d47",
        },
        secondary: {
          DEFAULT: "#328CC1",
          hover: "#2875a1",
        },
        accent: {
          DEFAULT: "#D9B310",
          hover: "#bca00e",
        },
        dark: {
          DEFAULT: "#1D2731",
          hover: "#151d25",
        },
        light: {
          DEFAULT: "#F9FBFC",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        heading: ["var(--font-heading)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
