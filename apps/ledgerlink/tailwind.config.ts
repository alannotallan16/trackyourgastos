import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neutral fintech surface palette
        ink: "#0F172A", // primary text / dark surfaces
        subtle: "#64748B", // secondary text
        line: "#E2E8F0", // borders
        canvas: "#F8FAFC", // app background
        card: "#FFFFFF",
        // Semantic direction colors — never rely on color alone (icons/labels back these up)
        incoming: "#0E9F6E", // money owed to me / received (green)
        "incoming-soft": "#E6F6EF",
        outgoing: "#4F46E5", // money I owe / paid out (indigo)
        "outgoing-soft": "#EAE8FD",
        warn: "#B45309", // due soon / pending
        "warn-soft": "#FDF3E7",
        danger: "#DC2626", // overdue / rejected
        "danger-soft": "#FCECEC",
        ok: "#0E9F6E",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
        pop: "0 10px 30px rgba(15,23,42,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
