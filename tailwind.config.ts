import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Палитра из дизайна «GSM — Вариант D»
        ink: "#152a24",
        canvas: "#eef5f2",
        brand: {
          DEFAULT: "#0f9d8c",
          dark: "#0c7d70",
          light: "#13c1ab",
          deep: "#0b7466",
        },
        accent: "#f5a623",
        mint: "#d6f0eb",
        line: "#e6efec",
        muted: "#6f887f",
        slate: "#4a5f57",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        expand: {
          from: { opacity: "0", maxHeight: "0" },
          to: { opacity: "1", maxHeight: "1200px" },
        },
      },
      animation: {
        fadeUp: "fadeUp .4s ease",
        expand: "expand .25s ease",
      },
    },
  },
  plugins: [],
};

export default config;
