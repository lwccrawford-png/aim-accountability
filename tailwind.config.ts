import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0b0c0b", 900: "#101211", 800: "#151715", 700: "#1c211b", 600: "#262b25" },
        bone: { DEFAULT: "#f4f5ef", dim: "#b4b9b3", mute: "#818b80" },
        gold: { DEFAULT: "#c9a65a", deep: "#b89446", dark: "#8a6d2c", soft: "#e3cf9a" },
        ok: "#7fb38a",
        warn: "#e0b354",
        bad: "#d9776a"
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        body: ["var(--font-body)", "Helvetica Neue", "sans-serif"]
      },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "none" } },
        glint: { "0%,100%": { opacity: ".35" }, "50%": { opacity: ".9" } }
      },
      animation: { rise: "rise .5s cubic-bezier(.2,.7,.2,1) both", glint: "glint 3.2s ease-in-out infinite" }
    }
  },
  plugins: []
} satisfies Config;
