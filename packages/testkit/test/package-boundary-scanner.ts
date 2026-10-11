import { dirname, join, resolve } from "node:path";

import ts from "typescript";

export type ModuleReferences = {
  directives: ReadonlySet<string>;
  imports: string[];
  runtimeImports: string[];
};

/** Type-only declarations are erased; mixed declarations remain runtime edges. */
export function moduleReferences(source: string): ModuleReferences {
  const file = ts.createSourceFile("module.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Set<string>();
  const runtimeImports = new Set<string>();
  const directives = new Set<string>();

  for (const statement of file.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    directives.add(statement.expression.text);
  }

  function addSpecifier(node: ts.Node | undefined, typeOnly: boolean): void {
    if (!node || (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node))) return;
    imports.add(node.text);
    if (!typeOnly) runtimeImports.add(node.text);
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      // Treat a value declaration conservatively even if its binding is unused.
      // Only declaration-level `import type` guarantees erasure in every emitter.
      addSpecifier(node.moduleSpecifier, node.importClause?.isTypeOnly === true);
    } else if (ts.isExportDeclaration(node)) {
      addSpecifier(node.moduleSpecifier, node.isTypeOnly);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      addSpecifier(node.moduleReference.expression, node.isTypeOnly);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      addSpecifier(node.argument.literal, true);
    } else if (ts.isCallExpression(node) && (
      node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require")
    )) {
      addSpecifier(node.arguments[0], false);
    }
    ts.forEachChild(node, visit);
  }

  visit(file);
  return { directives, imports: [...imports], runtimeImports: [...runtimeImports] };
}

export function explicitServerImports(references: ModuleReferences): string[] {
  return references.runtimeImports.filter((specifier) =>
    specifier === "server-only" || specifier.endsWith("/server") || specifier.includes("/server/")
  );
}

export function resolveLocalSourceFile(
  importer: string,
  specifier: string,
  knownSourceFiles: ReadonlySet<string>
): string | null {
  if (!specifier.startsWith(".")) return null;

  const candidate = resolve(dirname(importer), specifier);
  const candidates = [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    `${candidate}.mts`,
    `${candidate}.mjs`,
    join(candidate, "index.ts"),
    join(candidate, "index.tsx"),
    join(candidate, "index.mts"),
    join(candidate, "index.mjs")
  ];

  return candidates.find((path) => knownSourceFiles.has(path)) ?? null;
}

export function findReachableServerFile(
  entry: string,
  localImports: ReadonlyMap<string, readonly string[]>,
  serverOnlyFiles: ReadonlySet<string>,
  serverActionFiles: ReadonlySet<string>
): string | null {
  const pending = [...(localImports.get(entry) ?? [])];
  const visited = new Set<string>([entry]);

  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    if (serverOnlyFiles.has(file)) return file;
    // Next emits an RPC reference for a `use server` module. Its imports stay server-side.
    if (serverActionFiles.has(file)) continue;

    visited.add(file);
    pending.push(...(localImports.get(file) ?? []));
  }

  return null;
}
