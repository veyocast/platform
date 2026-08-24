import type { VeyoCastDesignTokens, VeyoCastVectorTokens } from "./schema";

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
