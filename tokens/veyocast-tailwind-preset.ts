export const veyocastTailwindPreset = {
  "theme": {
    "extend": {
      "colors": {
        "vc": {
          "background": "var(--vc-background)",
          "surface": "var(--vc-surface)",
          "surface-muted": "var(--vc-surface-muted)",
          "surface-strong": "var(--vc-surface-strong)",
          "text": "var(--vc-text)",
          "text-muted": "var(--vc-text-muted)",
          "text-subtle": "var(--vc-text-subtle)",
          "border": "var(--vc-border)",
          "border-strong": "var(--vc-border-strong)",
          "focus": "var(--vc-focus)",
          "action": "var(--vc-action)",
          "on-action": "var(--vc-on-action)",
          "brand": {
            "ink-black": "var(--vc-brand-ink-black)",
            "paper-white": "var(--vc-brand-paper-white)",
            "electric-orange": "var(--vc-brand-electric-orange)",
            "signal-blue": "var(--vc-brand-signal-blue)",
            "soft-grey": "var(--vc-brand-soft-grey)"
          },
          "neutral": {
            "0": "var(--vc-neutral-0)",
            "25": "var(--vc-neutral-25)",
            "50": "var(--vc-neutral-50)",
            "100": "var(--vc-neutral-100)",
            "200": "var(--vc-neutral-200)",
            "300": "var(--vc-neutral-300)",
            "400": "var(--vc-neutral-400)",
            "500": "var(--vc-neutral-500)",
            "600": "var(--vc-neutral-600)",
            "700": "var(--vc-neutral-700)",
            "800": "var(--vc-neutral-800)",
            "850": "var(--vc-neutral-850)",
            "900": "var(--vc-neutral-900)",
            "950": "var(--vc-neutral-950)",
            "1000": "var(--vc-neutral-1000)"
          },
          "semantic": {
            "success": {
              "solid": "var(--vc-semantic-success-solid)",
              "surface": "var(--vc-semantic-success-surface)",
              "text": "var(--vc-semantic-success-text)",
              "dark": "var(--vc-semantic-success-dark)"
            },
            "warning": {
              "solid": "var(--vc-semantic-warning-solid)",
              "surface": "var(--vc-semantic-warning-surface)",
              "text": "var(--vc-semantic-warning-text)",
              "dark": "var(--vc-semantic-warning-dark)"
            },
            "critical": {
              "solid": "var(--vc-semantic-critical-solid)",
              "surface": "var(--vc-semantic-critical-surface)",
              "text": "var(--vc-semantic-critical-text)",
              "dark": "var(--vc-semantic-critical-dark)"
            },
            "info": {
              "solid": "var(--vc-semantic-info-solid)",
              "surface": "var(--vc-semantic-info-surface)",
              "text": "var(--vc-semantic-info-text)",
              "dark": "var(--vc-semantic-info-dark)"
            }
          }
        }
      },
      "spacing": {
        "0": "var(--vc-space-0)",
        "2": "var(--vc-space-2)",
        "4": "var(--vc-space-4)",
        "6": "var(--vc-space-6)",
        "8": "var(--vc-space-8)",
        "10": "var(--vc-space-10)",
        "12": "var(--vc-space-12)",
        "16": "var(--vc-space-16)",
        "20": "var(--vc-space-20)",
        "24": "var(--vc-space-24)",
        "28": "var(--vc-space-28)",
        "32": "var(--vc-space-32)",
        "36": "var(--vc-space-36)",
        "40": "var(--vc-space-40)",
        "48": "var(--vc-space-48)",
        "56": "var(--vc-space-56)",
        "64": "var(--vc-space-64)",
        "72": "var(--vc-space-72)",
        "80": "var(--vc-space-80)",
        "96": "var(--vc-space-96)",
        "112": "var(--vc-space-112)",
        "128": "var(--vc-space-128)",
        "160": "var(--vc-space-160)",
        "192": "var(--vc-space-192)"
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
        "none": "var(--vc-radius-none)",
        "xs": "var(--vc-radius-xs)",
        "sm": "var(--vc-radius-sm)",
        "md": "var(--vc-radius-md)",
        "lg": "var(--vc-radius-lg)",
        "xl": "var(--vc-radius-xl)",
        "2xl": "var(--vc-radius-2xl)",
        "full": "var(--vc-radius-full)"
      },
      "transitionDuration": {
        "instant": "var(--vc-motion-instant)",
        "fast": "var(--vc-motion-fast)",
        "standard": "var(--vc-motion-standard)",
        "slow": "var(--vc-motion-slow)",
        "scene": "var(--vc-motion-scene)"
      }
    }
  }
} as const;

export default veyocastTailwindPreset;
