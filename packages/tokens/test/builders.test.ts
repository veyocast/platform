import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createCssVariables,
  createTailwindPresetSource,
  createVectorCssVariables,
  createVectorTokenModuleSource,
  toKebabCase
} from "../src/builders";
import type { VeyoCastDesignTokens, VeyoCastVectorTokens } from "../src/schema";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");

async function readTokens() {
  const source = await readFile(resolve(repoRoot, "tokens/veyocast-design-tokens.json"), "utf8");
  return JSON.parse(source) as VeyoCastDesignTokens;
}

async function readVectorTokens() {
  const source = await readFile(resolve(repoRoot, "tokens/veyocast-vector-v2-tokens.json"), "utf8");
  return JSON.parse(source) as VeyoCastVectorTokens;
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

  it("adds namespaced Vector aliases without replacing the established --vc contract", async () => {
    const css = createVectorCssVariables(await readVectorTokens());

    expect(css).toContain("--vc-vector-canvas: #F6F3ED;");
    expect(css).toContain("--vc-vector-action-default: #FF5C20;");
    expect(css).toContain("--vc-vector-touch-minimum-target-px: 44px;");
    expect(css).toContain("--vc-vector-motion-venue: 0ms;");
    expect(css).not.toContain("--vc-background:");
  });

  it("generates one typed Vector module for web and native consumers", async () => {
    const moduleSource = createVectorTokenModuleSource(await readVectorTokens());

    expect(moduleSource).toContain("export const veyocastVectorTokens");
    expect(moduleSource).toContain("satisfies VeyoCastVectorTokens");
    expect(moduleSource).toContain('"minimumTargetPx": 44');
    expect(moduleSource).toContain('"railExpandedPx": 248');
  });
});
