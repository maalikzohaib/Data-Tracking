import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f10",
        panel: "#12181a",
        panel2: "#171f22",
        border: "#232e31",
        muted: "#7d8f92",
        text: "#e8efec",
        brand: {
          DEFAULT: "#10b981",
          light: "#34d399",
          dark: "#059669",
        },
        accent: "#f5c451",
        good: "#34d399",
        bad: "#f87171",
        warn: "#fbbf24",
      },
      fontFamily: {
        sans: ["var(--font-body)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(16,185,129,0.2), 0 8px 30px rgba(16,185,129,0.12)",
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 30px rgba(0,0,0,0.4)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};

export default config;
