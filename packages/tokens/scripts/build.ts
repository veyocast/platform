import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createCssVariables, createTailwindPresetSource, createTokenModuleSource } from "../src/builders";
import type { CastivoDesignTokens } from "../src/schema";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const sourcePath = resolve(repoRoot, "tokens/castivo-design-tokens.json");
const cssPath = resolve(repoRoot, "tokens/castivo-design-tokens.css");
const rootPresetPath = resolve(repoRoot, "tokens/castivo-tailwind-preset.ts");
const generatedDir = resolve(scriptDir, "../src/generated");
const generatedTokensPath = resolve(generatedDir, "tokens.ts");
const generatedPresetPath = resolve(generatedDir, "tailwind-preset.ts");

async function writeGeneratedFile(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

async function main() {
  const source = await readFile(sourcePath, "utf8");
  const tokens = JSON.parse(source) as CastivoDesignTokens;
  const css = createCssVariables(tokens);
  const presetSource = createTailwindPresetSource(tokens);
  const tokenModuleSource = createTokenModuleSource(tokens);

  await Promise.all([
    writeGeneratedFile(cssPath, css),
    writeGeneratedFile(rootPresetPath, presetSource),
    writeGeneratedFile(generatedPresetPath, presetSource),
    writeGeneratedFile(generatedTokensPath, tokenModuleSource)
  ]);
}

await main();
