import type { CastivoDesignTokens } from "./schema";

export function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function createCssVariables(tokens: CastivoDesignTokens) {
  const lines: string[] = [];

  lines.push(":root, [data-theme=\"light\"] {");
  for (const [name, value] of Object.entries(tokens.color.theme.light)) {
    lines.push(`  --cv-${toKebabCase(name)}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.color.brand)) {
    lines.push(`  --cv-brand-${toKebabCase(name)}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.color.neutral)) {
    lines.push(`  --cv-neutral-${name}: ${value};`);
  }
  for (const [groupName, group] of Object.entries(tokens.color.semantic)) {
    for (const [name, value] of Object.entries(group)) {
      lines.push(`  --cv-semantic-${toKebabCase(groupName)}-${toKebabCase(name)}: ${value};`);
    }
  }
  lines.push("}");
  lines.push("");
  lines.push("[data-theme=\"dark\"] {");
  for (const [name, value] of Object.entries(tokens.color.theme.dark)) {
    lines.push(`  --cv-${toKebabCase(name)}: ${value};`);
  }
  lines.push("}");
  lines.push("");
  lines.push(":root {");
  lines.push(`  --cv-font-display: "${tokens.font.display}", "Inter", system-ui, sans-serif;`);
  lines.push(`  --cv-font-ui: "${tokens.font.ui}", system-ui, sans-serif;`);
  lines.push(`  --cv-font-mono: "${tokens.font.mono}", ui-monospace, monospace;`);
  for (const spacing of tokens.spacingPx) {
    lines.push(`  --cv-space-${spacing}: ${spacing}px;`);
  }
  for (const [name, value] of Object.entries(tokens.radiiPx)) {
    lines.push(`  --cv-radius-${toKebabCase(name)}: ${value}px;`);
  }
  for (const [name, value] of Object.entries(tokens.motionMs)) {
    lines.push(`  --cv-motion-${toKebabCase(name)}: ${value}ms;`);
  }
  for (const [name, value] of Object.entries(tokens.breakpointsPx)) {
    lines.push(`  --cv-breakpoint-${toKebabCase(name)}: ${value}px;`);
  }
  for (const [name, value] of Object.entries(tokens.zIndex)) {
    lines.push(`  --cv-z-${toKebabCase(name)}: ${value};`);
  }
  for (const [componentName, componentValue] of Object.entries(tokens.componentHeightPx)) {
    if (typeof componentValue === "number") {
      lines.push(`  --cv-component-height-${toKebabCase(componentName)}: ${componentValue}px;`);
      continue;
    }

    for (const [name, value] of Object.entries(componentValue)) {
      const cssValue = typeof value === "number" ? `${value}px` : value;
      lines.push(
        `  --cv-component-height-${toKebabCase(componentName)}-${toKebabCase(name)}: ${cssValue};`
      );
    }
  }
  lines.push("  --cv-focus-ring-width: 2px;");
  lines.push("  --cv-focus-ring-offset: 2px;");
  lines.push("}");

  return `${lines.join("\n")}\n`;
}

export function createTailwindPresetSource(tokens: CastivoDesignTokens) {
  const fromKeys = <T>(
    source: Record<string, T>,
    createValue: (key: string) => string
  ) => Object.fromEntries(Object.keys(source).map((key) => [toKebabCase(key), createValue(key)]));

  const preset = {
    theme: {
      extend: {
        colors: {
          cv: {
            ...fromKeys(tokens.color.theme.light, (key) => `var(--cv-${toKebabCase(key)})`),
            brand: fromKeys(
              tokens.color.brand,
              (key) => `var(--cv-brand-${toKebabCase(key)})`
            ),
            neutral: Object.fromEntries(
              Object.keys(tokens.color.neutral).map((key) => [key, `var(--cv-neutral-${key})`])
            ),
            semantic: Object.fromEntries(
              Object.entries(tokens.color.semantic).map(([groupName, group]) => [
                toKebabCase(groupName),
                fromKeys(
                  group,
                  (key) => `var(--cv-semantic-${toKebabCase(groupName)}-${toKebabCase(key)})`
                )
              ])
            )
          }
        },
        spacing: Object.fromEntries(
          tokens.spacingPx.map((value) => [String(value), `var(--cv-space-${value})`])
        ),
        fontFamily: {
          display: [tokens.font.display, "Inter", "system-ui", "sans-serif"],
          sans: [tokens.font.ui, "system-ui", "sans-serif"],
          mono: [tokens.font.mono, "ui-monospace", "monospace"]
        },
        borderRadius: fromKeys(
          tokens.radiiPx,
          (key) => `var(--cv-radius-${toKebabCase(key)})`
        ),
        transitionDuration: fromKeys(
          tokens.motionMs,
          (key) => `var(--cv-motion-${toKebabCase(key)})`
        )
      }
    }
  };

  return `export const castivoTailwindPreset = ${JSON.stringify(preset, null, 2)} as const;

export default castivoTailwindPreset;
`;
}

export function createTokenModuleSource(tokens: CastivoDesignTokens) {
  return `import type { CastivoDesignTokens } from "../schema";

export const castivoTokens = ${JSON.stringify(tokens, null, 2)} as const satisfies CastivoDesignTokens;

export default castivoTokens;
`;
}
