import type {
  VeyoCastDesignTokens,
  VeyoCastFieldflowTokens,
  VeyoCastVectorTokens
} from "./schema";

export function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function createCssVariables(tokens: VeyoCastDesignTokens) {
  const lines: string[] = [];

  lines.push(":root, [data-theme=\"light\"] {");
  for (const [name, value] of Object.entries(tokens.color.theme.light)) {
    lines.push(`  --vc-${toKebabCase(name)}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.color.brand)) {
    lines.push(`  --vc-brand-${toKebabCase(name)}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.color.neutral)) {
    lines.push(`  --vc-neutral-${name}: ${value};`);
  }
  for (const [groupName, group] of Object.entries(tokens.color.semantic)) {
    for (const [name, value] of Object.entries(group)) {
      lines.push(`  --vc-semantic-${toKebabCase(groupName)}-${toKebabCase(name)}: ${value};`);
    }
  }
  lines.push("}");
  lines.push("");
  lines.push("[data-theme=\"dark\"] {");
  for (const [name, value] of Object.entries(tokens.color.theme.dark)) {
    lines.push(`  --vc-${toKebabCase(name)}: ${value};`);
  }
  lines.push("}");
  lines.push("");
  lines.push(":root {");
  lines.push(`  --vc-font-display: "${tokens.font.display}", "Inter", system-ui, sans-serif;`);
  lines.push(`  --vc-font-ui: "${tokens.font.ui}", system-ui, sans-serif;`);
  lines.push(`  --vc-font-mono: "${tokens.font.mono}", ui-monospace, monospace;`);
  for (const spacing of tokens.spacingPx) {
    lines.push(`  --vc-space-${spacing}: ${spacing}px;`);
  }
  for (const [name, value] of Object.entries(tokens.radiiPx)) {
    lines.push(`  --vc-radius-${toKebabCase(name)}: ${value}px;`);
  }
  for (const [name, value] of Object.entries(tokens.motionMs)) {
    lines.push(`  --vc-motion-${toKebabCase(name)}: ${value}ms;`);
  }
  for (const [name, value] of Object.entries(tokens.breakpointsPx)) {
    lines.push(`  --vc-breakpoint-${toKebabCase(name)}: ${value}px;`);
  }
  for (const [name, value] of Object.entries(tokens.zIndex)) {
    lines.push(`  --vc-z-${toKebabCase(name)}: ${value};`);
  }
  for (const [componentName, componentValue] of Object.entries(tokens.componentHeightPx)) {
    if (typeof componentValue === "number") {
      lines.push(`  --vc-component-height-${toKebabCase(componentName)}: ${componentValue}px;`);
      continue;
    }

    for (const [name, value] of Object.entries(componentValue)) {
      const cssValue = typeof value === "number" ? `${value}px` : value;
      lines.push(
        `  --vc-component-height-${toKebabCase(componentName)}-${toKebabCase(name)}: ${cssValue};`
      );
    }
  }
  lines.push("  --vc-focus-ring-width: 2px;");
  lines.push("  --vc-focus-ring-offset: 2px;");
  lines.push("}");

  return `${lines.join("\n")}\n`;
}

function formatCubicBezier(points: number[]) {
  return `cubic-bezier(${points.join(", ")})`;
}

export function createVectorCssVariables(tokens: VeyoCastVectorTokens) {
  const lines: string[] = [];
  const writeTheme = (selector: string, theme: VeyoCastVectorTokens["themes"]["light"]) => {
    lines.push(`${selector} {`);
    for (const [name, value] of Object.entries(theme)) {
      lines.push(`  --vc-vector-${toKebabCase(name)}: ${value};`);
    }
    lines.push("}");
  };

  writeTheme(':root, [data-theme="light"]', tokens.themes.light);
  lines.push("");
  writeTheme('[data-theme="dark"]', tokens.themes.dark);
  lines.push("");
  lines.push(":root {");
  for (const [name, value] of Object.entries(tokens.brand)) {
    lines.push(`  --vc-vector-brand-${toKebabCase(name)}: ${value};`);
  }
  for (const [groupName, group] of Object.entries(tokens.semantic)) {
    for (const [name, value] of Object.entries(group)) {
      lines.push(`  --vc-vector-${toKebabCase(groupName)}-${toKebabCase(name)}: ${value};`);
    }
  }
  lines.push(`  --vc-vector-tenant-accent-fallback: ${tokens.tenantAccent.fallback};`);
  lines.push(`  --vc-vector-font-ui: ${tokens.typography.uiFamily};`);
  lines.push(`  --vc-vector-font-display: ${tokens.typography.displayFamily};`);
  lines.push(`  --vc-vector-font-mono: ${tokens.typography.monoFamily};`);
  for (const [name, value] of Object.entries(tokens.typography.weights)) {
    lines.push(`  --vc-vector-font-weight-${toKebabCase(name)}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.typography.sizesPx)) {
    lines.push(`  --vc-vector-font-size-${toKebabCase(name)}: ${value}px;`);
  }
  for (const [name, value] of Object.entries(tokens.typography.lineHeights)) {
    lines.push(`  --vc-vector-line-height-${toKebabCase(name)}: ${value};`);
  }
  for (const spacing of tokens.spacingPx) lines.push(`  --vc-vector-space-${spacing}: ${spacing}px;`);
  for (const [name, value] of Object.entries(tokens.radiiPx)) lines.push(`  --vc-vector-radius-${toKebabCase(name)}: ${value}px;`);
  for (const [name, value] of Object.entries(tokens.bordersPx)) lines.push(`  --vc-vector-border-${toKebabCase(name)}: ${value}px;`);
  for (const [name, value] of Object.entries(tokens.elevation)) lines.push(`  --vc-vector-elevation-${toKebabCase(name)}: ${value};`);
  for (const [name, value] of Object.entries(tokens.motion.durationsMs)) lines.push(`  --vc-vector-motion-${toKebabCase(name)}: ${value}ms;`);
  for (const [name, value] of Object.entries(tokens.motion.easing)) lines.push(`  --vc-vector-easing-${toKebabCase(name)}: ${formatCubicBezier(value)};`);
  for (const [name, value] of Object.entries(tokens.touch)) lines.push(`  --vc-vector-touch-${toKebabCase(name)}: ${value}px;`);
  for (const [name, value] of Object.entries(tokens.layout)) lines.push(`  --vc-vector-layout-${toKebabCase(name)}: ${value}px;`);
  for (const [name, value] of Object.entries(tokens.zIndex)) lines.push(`  --vc-vector-z-${toKebabCase(name)}: ${value};`);
  lines.push("}", "", "@media (prefers-reduced-motion: reduce) {", "  :root {", "    --vc-vector-motion-venue: 0ms;", "    --vc-vector-motion-page: 0ms;", "    --vc-vector-motion-panel: 80ms;", "  }", "}");
  return `${lines.join("\n")}\n`;
}

export function createVectorTokenModuleSource(tokens: VeyoCastVectorTokens) {
  return `import type { VeyoCastVectorTokens } from "../schema";

export const veyocastVectorTokens = ${JSON.stringify(tokens, null, 2)} as const satisfies VeyoCastVectorTokens;

export default veyocastVectorTokens;
`;
}

export function createFieldflowCssVariables(tokens: VeyoCastFieldflowTokens) {
  const lines: string[] = [];
  const writeTheme = (
    selector: string,
    theme: VeyoCastFieldflowTokens["themes"]["light"]
  ) => {
    lines.push(`${selector} {`);
    for (const [name, value] of Object.entries(theme)) {
      const tokenName = toKebabCase(name);
      lines.push(`  --ff-${tokenName}: ${value};`);
      lines.push(`  --vc-vector-${tokenName}: var(--ff-${tokenName});`);
    }
    lines.push("  --vc-background: var(--ff-canvas);");
    lines.push("  --vc-surface: var(--ff-surface);");
    lines.push("  --vc-surface-muted: var(--ff-surface-muted);");
    lines.push("  --vc-surface-strong: var(--ff-surface-strong);");
    lines.push("  --vc-text: var(--ff-ink);");
    lines.push("  --vc-text-muted: var(--ff-ink-muted);");
    lines.push("  --vc-text-subtle: var(--ff-ink-subtle);");
    lines.push("  --vc-border: var(--ff-line);");
    lines.push("  --vc-border-strong: var(--ff-line-strong);");
    lines.push("  --vc-focus: var(--ff-focus);");
    lines.push("}");
  };

  writeTheme(':root, [data-theme="light"]', tokens.themes.light);
  lines.push("");
  writeTheme('[data-theme="dark"]', tokens.themes.dark);
  lines.push("");
  writeTheme('[data-contrast="high"]', tokens.themes.highContrast);
  lines.push("", ":root {");
  for (const [name, value] of Object.entries(tokens.brand)) {
    const tokenName = toKebabCase(name);
    lines.push(`  --ff-brand-${tokenName}: ${value};`);
    lines.push(`  --vc-vector-brand-${tokenName}: var(--ff-brand-${tokenName});`);
  }
  for (const [groupName, group] of Object.entries(tokens.semantic)) {
    for (const [name, value] of Object.entries(group)) {
      const tokenName = `${toKebabCase(groupName)}-${toKebabCase(name)}`;
      lines.push(`  --ff-${tokenName}: ${value};`);
      lines.push(`  --vc-vector-${tokenName}: var(--ff-${tokenName});`);
    }
  }
  lines.push("  --vc-action: var(--ff-action-default);");
  lines.push("  --vc-on-action: var(--ff-action-on-action);");
  lines.push("  --vc-link: var(--ff-info-default);");
  lines.push(`  --ff-font-ui: ${tokens.typography.uiFamily};`);
  lines.push(`  --ff-font-display: ${tokens.typography.displayFamily};`);
  lines.push("  --vc-font-ui: var(--ff-font-ui);");
  lines.push("  --vc-font-display: var(--ff-font-display);");
  lines.push("  --vc-semantic-success-solid: var(--ff-success-default);");
  lines.push("  --vc-semantic-success-surface: var(--ff-success-surface);");
  lines.push("  --vc-semantic-success-text: var(--ff-success-on-surface);");
  lines.push("  --vc-semantic-warning-solid: var(--ff-warning-default);");
  lines.push("  --vc-semantic-warning-surface: var(--ff-warning-surface);");
  lines.push("  --vc-semantic-warning-text: var(--ff-warning-on-surface);");
  lines.push("  --vc-semantic-critical-solid: var(--ff-danger-default);");
  lines.push("  --vc-semantic-critical-surface: var(--ff-danger-surface);");
  lines.push("  --vc-semantic-critical-text: var(--ff-danger-on-surface);");
  lines.push("  --vc-semantic-info-solid: var(--ff-info-default);");
  lines.push("  --vc-semantic-info-surface: var(--ff-info-surface);");
  lines.push("  --vc-semantic-info-text: var(--ff-info-on-surface);");
  lines.push("  --vc-component-height-button-compact: 36px;");
  lines.push("  --vc-component-height-button-standard: 44px;");
  lines.push("  --vc-component-height-button-touch: 48px;");
  lines.push("  --vc-component-height-input-compact: 36px;");
  lines.push("  --vc-component-height-input-standard: 44px;");
  lines.push("  --vc-component-height-input-touch: 48px;");
  lines.push("  --vc-radius-lg: var(--ff-radius-control);");
  lines.push("  --vc-radius-xl: var(--ff-radius-card);");
  for (const spacing of tokens.spacingPx) {
    lines.push(`  --ff-space-${spacing}: ${spacing}px;`);
  }
  for (const [name, value] of Object.entries(tokens.radiiPx)) {
    lines.push(`  --ff-radius-${toKebabCase(name)}: ${value}px;`);
  }
  for (const [name, value] of Object.entries(tokens.motion.durationsMs)) {
    lines.push(`  --ff-motion-${toKebabCase(name)}: ${value}ms;`);
  }
  for (const [name, value] of Object.entries(tokens.touch)) {
    lines.push(`  --ff-touch-${toKebabCase(name)}: ${value}px;`);
  }
  for (const [name, value] of Object.entries(tokens.layout)) {
    lines.push(`  --ff-layout-${toKebabCase(name)}: ${value}px;`);
  }
  for (const [name, value] of Object.entries(tokens.zIndex)) {
    lines.push(`  --ff-z-${toKebabCase(name)}: ${value};`);
  }
  lines.push(
    "}",
    "",
    "@media (prefers-reduced-motion: reduce) {",
    "  :root {",
    "    --ff-motion-quick: 0ms;",
    "    --ff-motion-standard: 80ms;",
    "    --ff-motion-deliberate: 80ms;",
    "  }",
    "}"
  );
  return `${lines.join("\n")}\n`;
}

export function createFieldflowTokenModuleSource(
  tokens: VeyoCastFieldflowTokens
) {
  return `import type { VeyoCastFieldflowTokens } from "../schema";

export const veyocastFieldflowTokens = ${JSON.stringify(tokens, null, 2)} as const satisfies VeyoCastFieldflowTokens;

export default veyocastFieldflowTokens;
`;
}

export function createTailwindPresetSource(tokens: VeyoCastDesignTokens) {
  const fromKeys = <T>(
    source: Record<string, T>,
    createValue: (key: string) => string
  ) => Object.fromEntries(Object.keys(source).map((key) => [toKebabCase(key), createValue(key)]));

  const preset = {
    theme: {
      extend: {
        colors: {
          vc: {
            ...fromKeys(tokens.color.theme.light, (key) => `var(--vc-${toKebabCase(key)})`),
            brand: fromKeys(
              tokens.color.brand,
              (key) => `var(--vc-brand-${toKebabCase(key)})`
            ),
            neutral: Object.fromEntries(
              Object.keys(tokens.color.neutral).map((key) => [key, `var(--vc-neutral-${key})`])
            ),
            semantic: Object.fromEntries(
              Object.entries(tokens.color.semantic).map(([groupName, group]) => [
                toKebabCase(groupName),
                fromKeys(
                  group,
                  (key) => `var(--vc-semantic-${toKebabCase(groupName)}-${toKebabCase(key)})`
                )
              ])
            )
          }
        },
        spacing: Object.fromEntries(
          tokens.spacingPx.map((value) => [String(value), `var(--vc-space-${value})`])
        ),
        fontFamily: {
          display: [tokens.font.display, "Inter", "system-ui", "sans-serif"],
          sans: [tokens.font.ui, "system-ui", "sans-serif"],
          mono: [tokens.font.mono, "ui-monospace", "monospace"]
        },
        borderRadius: fromKeys(
          tokens.radiiPx,
          (key) => `var(--vc-radius-${toKebabCase(key)})`
        ),
        transitionDuration: fromKeys(
          tokens.motionMs,
          (key) => `var(--vc-motion-${toKebabCase(key)})`
        )
      }
    }
  };

  return `export const veyocastTailwindPreset = ${JSON.stringify(preset, null, 2)} as const;

export default veyocastTailwindPreset;
`;
}

export function createTokenModuleSource(tokens: VeyoCastDesignTokens) {
  return `import type { VeyoCastDesignTokens } from "../schema";

export const veyocastTokens = ${JSON.stringify(tokens, null, 2)} as const satisfies VeyoCastDesignTokens;

export default veyocastTokens;
`;
}
