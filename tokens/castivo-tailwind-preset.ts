import type { Config } from "tailwindcss";

export const castivoTailwindPreset = {
  theme: {
    extend: {
      colors: {
        cv: {
          background: "var(--cv-background)",
          surface: "var(--cv-surface)",
          "surface-muted": "var(--cv-surfaceMuted)",
          "surface-strong": "var(--cv-surfaceStrong)",
          text: "var(--cv-text)",
          "text-muted": "var(--cv-textMuted)",
          "text-subtle": "var(--cv-textSubtle)",
          border: "var(--cv-border)",
          "border-strong": "var(--cv-borderStrong)",
          focus: "var(--cv-focus)",
          action: "var(--cv-action)",
          "on-action": "var(--cv-onAction)",
          ink: "#0A0A0A",
          paper: "#FAFAF7",
          orange: "#FF5C20",
          blue: "#315CFF",
          grey: "#E8E8E3",
        },
      },
      fontFamily: {
        display: ["Inter Tight", "Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        cvxs: "2px",
        cvsm: "4px",
        cvmd: "6px",
        cvlg: "8px",
        cvxl: "12px",
      },
      transitionDuration: {
        instant: "80ms",
        fast: "140ms",
        standard: "220ms",
        slow: "320ms",
        scene: "480ms",
      },
    },
  },
} satisfies Config;

export default castivoTailwindPreset;
