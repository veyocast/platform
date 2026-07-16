export const castivoTailwindPreset = {
  "theme": {
    "extend": {
      "colors": {
        "cv": {
          "background": "var(--cv-background)",
          "surface": "var(--cv-surface)",
          "surface-muted": "var(--cv-surface-muted)",
          "surface-strong": "var(--cv-surface-strong)",
          "text": "var(--cv-text)",
          "text-muted": "var(--cv-text-muted)",
          "text-subtle": "var(--cv-text-subtle)",
          "border": "var(--cv-border)",
          "border-strong": "var(--cv-border-strong)",
          "focus": "var(--cv-focus)",
          "action": "var(--cv-action)",
          "on-action": "var(--cv-on-action)",
          "brand": {
            "ink-black": "var(--cv-brand-ink-black)",
            "paper-white": "var(--cv-brand-paper-white)",
            "electric-orange": "var(--cv-brand-electric-orange)",
            "signal-blue": "var(--cv-brand-signal-blue)",
            "soft-grey": "var(--cv-brand-soft-grey)"
          },
          "neutral": {
            "0": "var(--cv-neutral-0)",
            "25": "var(--cv-neutral-25)",
            "50": "var(--cv-neutral-50)",
            "100": "var(--cv-neutral-100)",
            "200": "var(--cv-neutral-200)",
            "300": "var(--cv-neutral-300)",
            "400": "var(--cv-neutral-400)",
            "500": "var(--cv-neutral-500)",
            "600": "var(--cv-neutral-600)",
            "700": "var(--cv-neutral-700)",
            "800": "var(--cv-neutral-800)",
            "850": "var(--cv-neutral-850)",
            "900": "var(--cv-neutral-900)",
            "950": "var(--cv-neutral-950)",
            "1000": "var(--cv-neutral-1000)"
          },
          "semantic": {
            "success": {
              "solid": "var(--cv-semantic-success-solid)",
              "surface": "var(--cv-semantic-success-surface)",
              "text": "var(--cv-semantic-success-text)",
              "dark": "var(--cv-semantic-success-dark)"
            },
            "warning": {
              "solid": "var(--cv-semantic-warning-solid)",
              "surface": "var(--cv-semantic-warning-surface)",
              "text": "var(--cv-semantic-warning-text)",
              "dark": "var(--cv-semantic-warning-dark)"
            },
            "critical": {
              "solid": "var(--cv-semantic-critical-solid)",
              "surface": "var(--cv-semantic-critical-surface)",
              "text": "var(--cv-semantic-critical-text)",
              "dark": "var(--cv-semantic-critical-dark)"
            },
            "info": {
              "solid": "var(--cv-semantic-info-solid)",
              "surface": "var(--cv-semantic-info-surface)",
              "text": "var(--cv-semantic-info-text)",
              "dark": "var(--cv-semantic-info-dark)"
            }
          }
        }
      },
      "spacing": {
        "0": "var(--cv-space-0)",
        "2": "var(--cv-space-2)",
        "4": "var(--cv-space-4)",
        "6": "var(--cv-space-6)",
        "8": "var(--cv-space-8)",
        "10": "var(--cv-space-10)",
        "12": "var(--cv-space-12)",
        "16": "var(--cv-space-16)",
        "20": "var(--cv-space-20)",
        "24": "var(--cv-space-24)",
        "28": "var(--cv-space-28)",
        "32": "var(--cv-space-32)",
        "36": "var(--cv-space-36)",
        "40": "var(--cv-space-40)",
        "48": "var(--cv-space-48)",
        "56": "var(--cv-space-56)",
        "64": "var(--cv-space-64)",
        "72": "var(--cv-space-72)",
        "80": "var(--cv-space-80)",
        "96": "var(--cv-space-96)",
        "112": "var(--cv-space-112)",
        "128": "var(--cv-space-128)",
        "160": "var(--cv-space-160)",
        "192": "var(--cv-space-192)"
      },
      "fontFamily": {
        "display": [
          "Inter Tight",
          "Inter",
          "system-ui",
          "sans-serif"
        ],
        "sans": [
          "Inter",
          "system-ui",
          "sans-serif"
        ],
        "mono": [
          "Geist Mono",
          "ui-monospace",
          "monospace"
        ]
      },
      "borderRadius": {
        "none": "var(--cv-radius-none)",
        "xs": "var(--cv-radius-xs)",
        "sm": "var(--cv-radius-sm)",
        "md": "var(--cv-radius-md)",
        "lg": "var(--cv-radius-lg)",
        "xl": "var(--cv-radius-xl)",
        "2xl": "var(--cv-radius-2xl)",
        "full": "var(--cv-radius-full)"
      },
      "transitionDuration": {
        "instant": "var(--cv-motion-instant)",
        "fast": "var(--cv-motion-fast)",
        "standard": "var(--cv-motion-standard)",
        "slow": "var(--cv-motion-slow)",
        "scene": "var(--cv-motion-scene)"
      }
    }
  }
} as const;

export default castivoTailwindPreset;
