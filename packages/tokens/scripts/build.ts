import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCssVariables,
  createFieldflowCssVariables,
  createFieldflowTokenModuleSource,
  createTailwindPresetSource,
  createTokenModuleSource,
  createVectorCssVariables,
  createVectorTokenModuleSource
} from "../src/builders";
import type {
  VeyoCastDesignTokens,
  VeyoCastFieldflowTokens,
  VeyoCastVectorTokens
} from "../src/schema";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const sourcePath = resolve(repoRoot, "tokens/veyocast-design-tokens.json");
const vectorSourcePath = resolve(repoRoot, "tokens/veyocast-vector-v2-tokens.json");
const fieldflowSourcePath = resolve(repoRoot, "tokens/veyocast-fieldflow-v3-tokens.json");
const cssPath = resolve(repoRoot, "tokens/veyocast-design-tokens.css");
const rootPresetPath = resolve(repoRoot, "tokens/veyocast-tailwind-preset.ts");
const generatedDir = resolve(scriptDir, "../src/generated");
const generatedTokensPath = resolve(generatedDir, "tokens.ts");
const generatedVectorTokensPath = resolve(generatedDir, "vector-tokens.ts");
const generatedFieldflowTokensPath = resolve(generatedDir, "fieldflow-tokens.ts");
const generatedPresetPath = resolve(generatedDir, "tailwind-preset.ts");

async function writeGeneratedFile(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

async function main() {
  const [source, vectorSource, fieldflowSource] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(vectorSourcePath, "utf8"),
    readFile(fieldflowSourcePath, "utf8")
  ]);
  const tokens = JSON.parse(source) as VeyoCastDesignTokens;
  const vectorTokens = JSON.parse(vectorSource) as VeyoCastVectorTokens;
  const fieldflowTokens = JSON.parse(fieldflowSource) as VeyoCastFieldflowTokens;
  const css = `${createCssVariables(tokens)}\n${createVectorCssVariables(vectorTokens)}\n${createFieldflowCssVariables(fieldflowTokens)}`;
  const presetSource = createTailwindPresetSource(tokens);
  const tokenModuleSource = createTokenModuleSource(tokens);
  const vectorTokenModuleSource = createVectorTokenModuleSource(vectorTokens);
  const fieldflowTokenModuleSource = createFieldflowTokenModuleSource(fieldflowTokens);

  await Promise.all([
    writeGeneratedFile(cssPath, css),
    writeGeneratedFile(rootPresetPath, presetSource),
    writeGeneratedFile(generatedPresetPath, presetSource),
    writeGeneratedFile(generatedTokensPath, tokenModuleSource),
    writeGeneratedFile(generatedVectorTokensPath, vectorTokenModuleSource),
    writeGeneratedFile(generatedFieldflowTokensPath, fieldflowTokenModuleSource)
  ]);
}

await main();
