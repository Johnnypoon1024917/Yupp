import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

/**
 * Category gradient plugin — maps collection categories from
 * src/utils/categories.ts to short utility classes so components
 * can use e.g. `bg-cat-food` instead of importing gradient strings.
 */
const categoryGradients = plugin(function ({ addUtilities }) {
  addUtilities({
    ".bg-cat-food": {
      backgroundImage: "linear-gradient(to bottom right, #fb923c, #f43f5e)",
    },
    ".bg-cat-stay": {
      backgroundImage: "linear-gradient(to bottom right, #60a5fa, #6366f1)",
    },
    ".bg-cat-see": {
      backgroundImage: "linear-gradient(to bottom right, #34d399, #14b8a6)",
    },
    ".bg-cat-shop": {
      backgroundImage: "linear-gradient(to bottom right, #f472b6, #a855f7)",
    },
    ".bg-cat-default": {
      backgroundImage: "linear-gradient(to bottom right, #9ca3af, #64748b)",
    },
  });
});

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FAFAFA",
        primary: "#000000",
        brand: "#FF5A4E",
        "brand-soft": "#FFE4E1",
        "brand-ink": "#7A1F18",
        surface: "#FFFFFF",
        "surface-raised": "#FAFAFA",
        "surface-sunken": "#F4F4F5",
        "ink-1": "#0A0A0B",
        "ink-2": "#52525B",
        "ink-3": "#A1A1AA",
        border: "#E5E7EB",
        "border-strong": "#D4D4D8",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        accent: "#FF5A4E",
      },
      borderRadius: {
        chip: "8px",
        control: "12px",
        card: "16px",
        sheet: "24px",
        pill: "9999px",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: [
          "32px",
          { lineHeight: "36px", letterSpacing: "-0.5px", fontWeight: "700" },
        ],
        title: [
          "24px",
          { lineHeight: "28px", letterSpacing: "-0.4px", fontWeight: "700" },
        ],
        headline: [
          "17px",
          { lineHeight: "22px", letterSpacing: "-0.2px", fontWeight: "600" },
        ],
        body: [
          "15px",
          { lineHeight: "22px", letterSpacing: "0px", fontWeight: "400" },
        ],
        caption: [
          "13px",
          { lineHeight: "18px", letterSpacing: "0.1px", fontWeight: "500" },
        ],
        micro: [
          "11px",
          { lineHeight: "14px", letterSpacing: "0.4px", fontWeight: "600" },
        ],
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "elev-0": "none",
        "elev-1":
          "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        "elev-2":
          "0 4px 12px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
        "elev-3":
          "0 12px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)",
        "elev-modal":
          "0 24px 80px rgba(0,0,0,0.16), 0 8px 24px rgba(0,0,0,0.10)",
      },
      backdropBlur: {
        md: "12px",
      },
    },
  },
  plugins: [categoryGradients],
};
export default config;
