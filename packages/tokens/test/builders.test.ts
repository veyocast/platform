import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createCssVariables, createTailwindPresetSource, toKebabCase } from "../src/builders";
import type { CastivoDesignTokens } from "../src/schema";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");

async function readTokens() {
  const source = await readFile(resolve(repoRoot, "tokens/castivo-design-tokens.json"), "utf8");
  return JSON.parse(source) as CastivoDesignTokens;
}

describe("Castivo token builders", () => {
  it("normalizes token keys to css variable names", () => {
    expect(toKebabCase("surfaceMuted")).toBe("surface-muted");
    expect(toKebabCase("inkBlack")).toBe("ink-black");
  });

  it("generates theme and brand css variables from the canonical json", async () => {
    const css = createCssVariables(await readTokens());

    expect(css).toContain("--cv-action: #FF5C20;");
    expect(css).toContain("--cv-brand-electric-orange: #FF5C20;");
    expect(css).toContain("--cv-semantic-success-solid: #18794E;");
    expect(css).not.toContain("--cv-space-44");
  });

  it("uses css variables instead of raw brand hex values in the tailwind preset", async () => {
    const tokens = await readTokens();
    const presetSource = createTailwindPresetSource(tokens);

    expect(presetSource).toContain('"action": "var(--cv-action)"');
    expect(presetSource).toContain('"electric-orange": "var(--cv-brand-electric-orange)"');
    expect(presetSource).not.toContain(tokens.color.brand.electricOrange);
    expect(presetSource).not.toContain(tokens.color.brand.inkBlack);
  });
});
