import type { Config } from "tailwindcss";
import { themeTokens } from "./theme/tokens";

const { colors, fontFamily, borderRadius } = themeTokens;

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: colors.background,
        foreground: colors.foreground,
        accent: colors.accent,
        border: colors.border,
        danger: colors.danger,
        success: colors.success,
      },
      fontFamily,
      borderRadius,
    },
  },
  plugins: [],
};

export default config;
