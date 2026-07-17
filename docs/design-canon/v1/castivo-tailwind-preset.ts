import type { Config } from "tailwindcss";

export const castivoPreset: Partial<Config> = {
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        castivo: {
          ink: "#0A0A0A",
          paper: "#FAFAF7",
          orange: "#FF5C20",
          blue: "#315CFF",
          grey: "#E8E8E3",
        },
        background: "var(--cv-bg)",
        surface: "var(--cv-surface)",
        muted: "var(--cv-surface-muted)",
        foreground: "var(--cv-text)",
        border: "var(--cv-border)",
        action: {
          DEFAULT: "var(--cv-action)",
          foreground: "var(--cv-on-action)",
        },
        success: "var(--cv-success)",
        warning: "var(--cv-warning)",
        critical: "var(--cv-critical)",
        info: "var(--cv-info)",
      },
      fontFamily: {
        display: ["Inter Tight", "Inter", "Arial", "sans-serif"],
        sans: ["Inter", "Arial", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        xs: "2px",
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
      },
      boxShadow: {
        cvSm: "var(--cv-shadow-sm)",
        cvMd: "var(--cv-shadow-md)",
        cvLg: "var(--cv-shadow-lg)",
      },
      maxWidth: {
        reading: "720px",
        content: "1280px",
        wide: "1440px",
      },
      transitionDuration: {
        fast: "140ms",
        standard: "220ms",
        slow: "320ms",
      },
      transitionTimingFunction: {
        cv: "cubic-bezier(.2,0,0,1)",
        cvEnter: "cubic-bezier(0,0,.2,1)",
        cvExit: "cubic-bezier(.4,0,1,1)",
      },
      zIndex: {
        sticky: "100",
        dropdown: "300",
        overlay: "500",
        modal: "700",
        toast: "900",
        critical: "1000",
      },
    },
  },
};

export default castivoPreset;
