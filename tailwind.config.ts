import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        panel2: "var(--panel2)",
        border: "var(--border)",
        muted: "var(--muted)",
        muted2: "var(--muted2)",
        text: "var(--text)",
        brand: {
          DEFAULT: "var(--brand)",
          light: "var(--brand-light)",
          dark: "var(--brand-dark)",
        },
        accent: "var(--accent)",
        good: "var(--good)",
        bad: "var(--bad)",
        warn: "var(--warn)",
        aloe: "var(--aloe)",
        pistachio: "var(--pistachio)",
        "shade-30": "var(--shade-30)",
        "shade-40": "var(--shade-40)",
        "shade-50": "var(--shade-50)",
        "shade-60": "var(--shade-60)",
        "shade-70": "var(--shade-70)",
      },
      fontFamily: {
        sans: ["Inter", "Inter Variable", "Helvetica", "Arial", "sans-serif"],
        display: ["Inter", "Helvetica", "Arial", "sans-serif"],
      },
      fontSize: {
        "display-xxl": ["96px", { lineHeight: "1.0", letterSpacing: "2.4px", fontWeight: "330" }],
        "display-xl": ["70px", { lineHeight: "1.0", letterSpacing: "0", fontWeight: "330" }],
        "display-lg": ["55px", { lineHeight: "1.16", letterSpacing: "0", fontWeight: "330" }],
        "display-md": ["48px", { lineHeight: "1.14", letterSpacing: "0", fontWeight: "330" }],
        "heading-xl": ["28px", { lineHeight: "1.28", letterSpacing: "0.42px", fontWeight: "500" }],
        "heading-lg": ["24px", { lineHeight: "1.14", letterSpacing: "0.36px", fontWeight: "400" }],
        "heading-md": ["20px", { lineHeight: "1.4", letterSpacing: "0.3px", fontWeight: "500" }],
        "heading-sm": ["18px", { lineHeight: "1.25", letterSpacing: "0.72px", fontWeight: "500" }],
        "body-lg": ["18px", { lineHeight: "1.56", letterSpacing: "0", fontWeight: "550" }],
        "body-md": ["16px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "420" }],
        "body-strong": ["16px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "550" }],
        "caption": ["14px", { lineHeight: "1.49", letterSpacing: "0.28px", fontWeight: "500" }],
        "micro": ["13px", { lineHeight: "1.5", letterSpacing: "-0.13px", fontWeight: "500" }],
        "eyebrow": ["12px", { lineHeight: "1.2", letterSpacing: "0.72px", fontWeight: "400" }],
      },
      borderRadius: {
        "shopify-xs": "4px",
        "shopify-sm": "5px",
        "shopify-md": "8px",
        "shopify-lg": "12px",
        "shopify-xl": "20px",
        "pill": "9999px",
      },
      spacing: {
        "shopify-xxs": "2px",
        "shopify-xs": "4px",
        "shopify-sm": "8px",
        "shopify-md": "12px",
        "shopify-lg": "16px",
        "shopify-xl": "24px",
        "shopify-xxl": "32px",
        "shopify-huge": "64px",
      },
      boxShadow: {
        "card": "var(--card-shadow)",
        "card-light":
          "0 8px 8px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05)",
        "card-dark":
          "0 1px 2px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)",
        "elevated":
          "0 0 0 1px rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.3), 0 5px 10px rgba(0,0,0,0.2)",
        "modal":
          "0 25px 50px -12px rgba(0,0,0,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
