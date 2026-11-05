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
        // Lumiere Belleza + Solar Axis inspired palette
        navy: {
          950: "#0B1220",
          900: "#0F1C2E",
          800: "#152338",
          700: "#1C2E45",
          600: "#243B55",
        },
        accent: {
          DEFAULT: "#F5A623",
          hover: "#E09515",
          muted: "#F5A62333",
        },
        ai: {
          DEFAULT: "#1A7A4C",
          light: "#22A05A",
        },
        admin: {
          DEFAULT: "#2B5CDB",
          light: "#3B6FE0",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
