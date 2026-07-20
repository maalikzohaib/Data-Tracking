import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0e1a",
        panel: "#111726",
        panel2: "#161d30",
        border: "#232b41",
        muted: "#8b95ad",
        text: "#e6e9f0",
        brand: {
          DEFAULT: "#6366f1",
          light: "#818cf8",
        },
        accent: "#22d3ee",
        good: "#34d399",
        bad: "#f87171",
        warn: "#fbbf24",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(99,102,241,0.25), 0 8px 30px rgba(99,102,241,0.15)",
        card: "0 4px 24px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
