import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#0D1B2A",
          blue: "#2563EB",
          green: "#10B981",
          cyan: "#06B6D4",
          purple: "#8B5CF6",
          orange: "#F59E0B",
          pink: "#EC4899",
          bg: "#F3F4F6",
          danger: "#EF4444",
          // Back-compat aliases for code that uses bg-brand / text-brand-dark.
          DEFAULT: "#10B981",
          dark: "#0D1B2A"
        }
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
        "card-hover": "0 4px 12px rgba(15, 23, 42, 0.08)",
        fab: "0 6px 18px rgba(16, 185, 129, 0.35)"
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)"
      }
    }
  },
  plugins: []
};

export default config;
