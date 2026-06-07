import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      boxShadow: {
        "neon-cyan": "0 0 22px rgba(34, 211, 238, 0.34)",
        "neon-purple": "0 0 24px rgba(168, 85, 247, 0.32)",
        "neon-green": "0 0 18px rgba(74, 222, 128, 0.32)"
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "SFMono-Regular", "Consolas", "monospace"],
        sans: ["var(--font-geist-sans)", "Inter", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
