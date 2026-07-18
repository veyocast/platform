import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createCssVariables, createTailwindPresetSource, toKebabCase } from "../src/builders";
import type { VeyoCastDesignTokens } from "../src/schema";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");

async function readTokens() {
  const source = await readFile(resolve(repoRoot, "tokens/veyocast-design-tokens.json"), "utf8");
  return JSON.parse(source) as VeyoCastDesignTokens;
}

describe("VeyoCast token builders", () => {
  it("normalizes token keys to css variable names", () => {
    expect(toKebabCase("surfaceMuted")).toBe("surface-muted");
    expect(toKebabCase("inkBlack")).toBe("ink-black");
  });

  it("generates theme and brand css variables from the canonical json", async () => {
    const css = createCssVariables(await readTokens());

    expect(css).toContain("--vc-action: #FF5C20;");
    expect(css).toContain("--vc-brand-electric-orange: #FF5C20;");
    expect(css).toContain("--vc-semantic-success-solid: #18794E;");
    expect(css).toContain("--vc-component-height-button-compact: 36px;");
    expect(css).toContain("--vc-component-height-button-touch: 48px;");
    expect(css).not.toContain("32-36");
    expect(css).not.toContain("44-48");
    expect(css).not.toContain("--vc-space-44");
  });

  it("uses css variables instead of raw brand hex values in the tailwind preset", async () => {
    const tokens = await readTokens();
    const presetSource = createTailwindPresetSource(tokens);

    expect(presetSource).toContain('"action": "var(--vc-action)"');
    expect(presetSource).toContain('"vc"');
    expect(presetSource).toContain('"electric-orange": "var(--vc-brand-electric-orange)"');
    expect(presetSource).not.toContain(tokens.color.brand.electricOrange);
    expect(presetSource).not.toContain(tokens.color.brand.inkBlack);
  });
});
