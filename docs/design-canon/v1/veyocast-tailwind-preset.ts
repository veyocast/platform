import type { Config } from "tailwindcss";

export const veyocastPreset: Partial<Config> = {
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        veyocast: {
          ink: "#0A0A0A",
          paper: "#FAFAF7",
          orange: "#FF5C20",
          blue: "#315CFF",
          grey: "#E8E8E3",
        },
        background: "var(--vc-bg)",
        surface: "var(--vc-surface)",
        muted: "var(--vc-surface-muted)",
        foreground: "var(--vc-text)",
        border: "var(--vc-border)",
        action: {
          DEFAULT: "var(--vc-action)",
          foreground: "var(--vc-on-action)",
        },
        success: "var(--vc-success)",
        warning: "var(--vc-warning)",
        critical: "var(--vc-critical)",
        info: "var(--vc-info)",
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
        cvSm: "var(--vc-shadow-sm)",
        cvMd: "var(--vc-shadow-md)",
        cvLg: "var(--vc-shadow-lg)",
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
        vc: "cubic-bezier(.2,0,0,1)",
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

export default veyocastPreset;
