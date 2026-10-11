import { describe, expect, it } from "vitest";
import ts from "typescript";

import { explicitServerImports, findReachableServerFile, moduleReferences, resolveLocalSourceFile } from "./package-boundary-scanner";

function reachableServerInFixture(sources: Record<string, string>): string | null {
  const entries = Object.entries(sources);
  const knownFiles = new Set(Object.keys(sources));
  const modules = new Map(entries.map(([file, source]) => [file, moduleReferences(source)]));
  const localImports = new Map([...modules].map(([file, references]) => [
    file,
    references.runtimeImports
      .map((specifier) => resolveLocalSourceFile(file, specifier, knownFiles))
      .filter((target): target is string => target !== null)
  ]));
  const serverOnlyFiles = new Set([...modules]
    .filter(([, references]) => references.runtimeImports.includes("server-only"))
    .map(([file]) => file));
  const serverActionFiles = new Set([...modules]
    .filter(([, references]) => references.directives.has("use server"))
    .map(([file]) => file));

  return findReachableServerFile("/fixture/client.tsx", localImports, serverOnlyFiles, serverActionFiles);
}

describe("runtime module boundary scanner", () => {
  it("allows erased type declarations without losing architecture dependency edges", () => {
    const source = `
      "use client";
      import type { SecretShape } from "./secret";
      export type { SecretShape as PublicShape } from "./secret";
      export type * from "./other-secret";
      type ServerShape = import("@veyocast/database/server").ServerShape;
      import type ForeignApplicationShape from "@veyocast/player";
      export const value: SecretShape | ServerShape | ForeignApplicationShape | null = null;
    `;
    const references = moduleReferences(source);
    const emitted = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.ESNext,
      verbatimModuleSyntax: true
    } }).outputText;

    expect(references.imports).toEqual([
      "./secret", "./other-secret", "@veyocast/database/server", "@veyocast/player"
    ]);
    expect(references.runtimeImports).toEqual([]);
    expect(explicitServerImports(references)).toEqual([]);
    expect(emitted).not.toContain("secret");
    expect(emitted).not.toContain("@veyocast/");
    expect(reachableServerInFixture({
      "/fixture/client.tsx": source,
      "/fixture/secret.ts": 'import "server-only"; export type SecretShape = string;'
    })).toBeNull();
  });

  it("rejects a mixed type and value import through a server-only file", () => {
    const client = '"use client"; import { type SecretShape, secret } from "./secret"; export const value = secret;';
    const emitted = ts.transpileModule(client, { compilerOptions: {
      module: ts.ModuleKind.ESNext,
      verbatimModuleSyntax: true
    } }).outputText;

    expect(emitted).toContain('from "./secret"');
    expect(moduleReferences(client).runtimeImports).toEqual(["./secret"]);
    expect(reachableServerInFixture({
      "/fixture/client.tsx": client,
      "/fixture/secret.ts": 'import"server-only"; export const secret = "private";'
    })).toBe("/fixture/secret.ts");
  });

  it("keeps inline type specifiers conservative because an emitter can preserve side effects", () => {
    const source = 'import { type SecretShape } from "./secret"; export type { SecretShape }';
    const emitted = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.ESNext,
      verbatimModuleSyntax: true
    } }).outputText;

    expect(emitted).toContain('import {} from "./secret"');
    expect(moduleReferences(source).runtimeImports).toEqual(["./secret"]);
  });

  it.each([
    'import "./secret";',
    'export { secret } from "./secret";',
    'export * from "./secret";',
    'export const value = import("./secret");',
    'export const value = import(`./secret`);',
    'const secret = require("./secret");',
    'import secret = require("./secret");'
  ])("rejects a runtime server edge: %s", (statement) => {
    expect(reachableServerInFixture({
      "/fixture/client.tsx": `"use client"; ${statement}`,
      "/fixture/secret.ts": 'import "server-only"; export const secret = "private";'
    })).toBe("/fixture/secret.ts");
  });

  it("rejects direct explicit server entries while permitting declaration-level type imports", () => {
    expect(explicitServerImports(moduleReferences(`
      import type { Shape } from "@veyocast/database/server";
      import "server-only";
      import { createAdmin } from "@veyocast/database/server";
      export { secret } from "./server/secret";
    `))).toEqual(["server-only", "@veyocast/database/server", "./server/secret"]);
  });

  it("follows runtime barrel re-exports and cycles to the server boundary", () => {
    expect(reachableServerInFixture({
      "/fixture/client.tsx": '"use client"; import { secret } from "./barrel";',
      "/fixture/barrel.ts": 'export * from "./cycle";',
      "/fixture/cycle.ts": 'export * from "./barrel"; export { secret } from "./secret";',
      "/fixture/secret.ts": 'import "server-only"; export const secret = "private";'
    })).toBe("/fixture/secret.ts");
  });

  it("allows real server-action RPC references without allowing a separate server-only edge", () => {
    const fixture = {
      "/fixture/client.tsx": '"use client"; import { action } from "./actions";',
      "/fixture/actions.ts": '"use server"; import { secret } from "./secret"; export async function action() { return secret; }',
      "/fixture/secret.ts": 'import "server-only"; export const secret = "private";'
    };

    expect(reachableServerInFixture(fixture)).toBeNull();
    expect(reachableServerInFixture({
      ...fixture,
      "/fixture/client.tsx": `${fixture["/fixture/client.tsx"]} export * from "./secret";`
    })).toBe("/fixture/secret.ts");
  });

  it("ignores apparent imports and directives in comments or ordinary string values", () => {
    const references = moduleReferences(`
      // "use client"; import "server-only";
      const example = 'import("./secret")';
      export const instructions = "export * from './secret'";
    `);

    expect(references.directives.size).toBe(0);
    expect(references.imports).toEqual([]);
    expect(references.runtimeImports).toEqual([]);
    expect(moduleReferences('/* explanatory comment */\n"use client"; import "./safe";')
      .directives.has("use client")).toBe(true);
  });
});
