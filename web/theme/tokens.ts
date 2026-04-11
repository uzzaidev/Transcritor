/**
 * Tokens visuais — fonte semântica consumida pelo Tailwind (`tailwind.config.ts`).
 * Para alterar o tema da app, edite aqui; evite cores soltas nos componentes.
 */
export const themeTokens = {
  colors: {
    background: {
      DEFAULT: "#0b1220",
      elevated: "#111b2e",
    },
    foreground: {
      DEFAULT: "#e8edf7",
      muted: "#9aa8c3",
    },
    accent: {
      DEFAULT: "#5b8def",
      hover: "#7aa6f7",
      foreground: "#061018",
    },
    border: {
      DEFAULT: "#1e2a40",
      strong: "#2c3d5c",
    },
    danger: {
      DEFAULT: "#f07178",
      foreground: "#1a0a0c",
    },
    success: {
      DEFAULT: "#7fd99f",
      foreground: "#061810",
    },
  },
  fontFamily: {
    sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
    mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
  },
  borderRadius: {
    card: "12px",
    button: "8px",
  },
} as const;
