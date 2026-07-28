import type { DynamicTemplateManifest } from "@veyocast/contracts";

const allowedSvgElements = new Set([
  "circle",
  "clipPath",
  "defs",
  "ellipse",
  "g",
  "image",
  "line",
  "linearGradient",
  "path",
  "rect",
  "stop",
  "text",
  "tspan"
]);
const forbiddenMarkupPattern =
  /<(?:script|foreignObject|iframe|object|embed|audio|video|style)\b|(?:on[a-z]+|srcdoc)\s*=|(?:href|xlink:href)\s*=\s*["'](?!data:image\/(?:png|jpeg|webp);base64,|#)/i;
const forbiddenCssPattern =
  /[<>]|@(?:import|font-face|namespace|supports|document)\b|expression\s*\(|javascript\s*:|url\s*\(\s*(?!["']?data:image\/(?:png|jpeg|webp);base64,)/i;
const forbiddenTemplatePattern =
  /\{\{\{|~\}\}|\{\{~|@root|@key|@index|__proto__|prototype|constructor|\.\.\//i;
const tokenPattern = /\{\{([#/])?\s*([^{}]+?)\s*\}\}/g;
const pathPattern = /^(?:this|[a-zA-Z][a-zA-Z0-9_]*)(?:\.[a-zA-Z][a-zA-Z0-9_]*)*$/;
const helperNames = new Set(["currency", "date", "default", "truncate"]);

export class DynamicTemplateError extends Error {
  constructor(
    readonly code:
      | "template_invalid_css"
      | "template_invalid_markup"
      | "template_invalid_syntax"
      | "template_missing_field"
      | "template_render_limit",
    message: string
  ) {
    super(message);
    this.name = "DynamicTemplateError";
  }
}

export type DynamicTemplateSource = {
  css: string;
  manifest: DynamicTemplateManifest;
  markup: string;
};

type RenderScope = {
  parent: RenderScope | null;
  value: unknown;
};

export function validateDynamicTemplate({
  css,
  manifest,
  markup
}: DynamicTemplateSource): void {
  if (markup.length > 100_000 || css.length > 50_000) {
    throw new DynamicTemplateError(
      "template_render_limit",
      "De templatebron is groter dan de veilige renderlimiet."
    );
  }
  if (forbiddenMarkupPattern.test(markup)) {
    throw new DynamicTemplateError(
      "template_invalid_markup",
      "De markup bevat een niet-toegestaan element, attribuut of externe URL."
    );
  }
  if (forbiddenCssPattern.test(css)) {
    throw new DynamicTemplateError(
      "template_invalid_css",
      "De CSS bevat een niet-toegestane import, functie of externe URL."
    );
  }
  const elements = markup.matchAll(/<\s*([a-zA-Z][a-zA-Z0-9]*)\b/g);
  for (const match of elements) {
    const element = match[1];
    if (!element || !allowedSvgElements.has(element)) {
      throw new DynamicTemplateError(
        "template_invalid_markup",
        `SVG-element <${match[1]}> is niet toegestaan.`
      );
    }
  }
  if (forbiddenTemplatePattern.test(markup)) {
    throw new DynamicTemplateError(
      "template_invalid_syntax",
      "De template gebruikt onveilige of niet-ondersteunde syntaxis."
    );
  }
  validateTokens(markup, manifest);
}

export function renderDynamicTemplate(
  source: DynamicTemplateSource,
  input: unknown
): string {
  validateDynamicTemplate(source);
  const rendered = renderBlock(
    source.markup,
    { parent: null, value: input },
    source.manifest,
    0
  );
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${source.manifest.canvas.width}" height="${source.manifest.canvas.height}" viewBox="0 0 ${source.manifest.canvas.width} ${source.manifest.canvas.height}">`,
    `<style>${source.css}</style>`,
    rendered,
    "</svg>"
  ].join("");
}

function validateTokens(
  markup: string,
  manifest: DynamicTemplateManifest
): void {
  const allowedFields = new Set(manifest.allowedFields.map((field) => field.path));
  const blocks: string[] = [];
  for (const match of markup.matchAll(tokenPattern)) {
    const marker = match[1] ?? "";
    const expression = match[2]?.trim();
    if (!expression) invalidSyntax("lege expressie");
    if (marker === "#") {
      const [operator, rawPath] = splitExpression(expression);
      if (operator !== "each" && operator !== "if") invalidSyntax(expression);
      if (!rawPath) invalidSyntax(expression);
      assertSafePath(rawPath, allowedFields, blocks);
      blocks.push(operator);
      continue;
    }
    if (marker === "/") {
      const expected = blocks.pop();
      if (!expected || expected !== expression) invalidSyntax(expression);
      continue;
    }
    const [first, ...args] = splitExpression(expression);
    if (!first) invalidSyntax(expression);
    if (helperNames.has(first)) {
      if (!args.length || args.length > 2) invalidSyntax(expression);
      assertSafePath(args[0]!, allowedFields, blocks);
      continue;
    }
    if (args.length) invalidSyntax(expression);
    assertSafePath(first, allowedFields, blocks);
  }
  if (blocks.length) invalidSyntax("onafgesloten blok");
}

function assertSafePath(
  path: string,
  allowedFields: ReadonlySet<string>,
  blocks: readonly string[]
) {
  if (!pathPattern.test(path)) invalidSyntax(path);
  if (path === "this") return;
  if (
    !allowedFields.has(path) &&
    ![...allowedFields].some(
      (allowed) =>
        allowed.startsWith(`${path}.`) ||
        (blocks.includes("each") && allowed.endsWith(`.${path}`))
    )
  ) {
    throw new DynamicTemplateError(
      "template_missing_field",
      `Veld ${path} staat niet in het templatemanfest.`
    );
  }
}

function renderBlock(
  template: string,
  scope: RenderScope,
  manifest: DynamicTemplateManifest,
  depth: number
): string {
  if (depth > 8) {
    throw new DynamicTemplateError(
      "template_render_limit",
      "De template bevat te veel geneste blokken."
    );
  }
  const block = findFirstBlock(template);
  if (!block) return renderInline(template, scope);
  const before = renderInline(template.slice(0, block.start), scope);
  const afterTemplate = template.slice(block.end);
  const value = resolvePath(scope, block.path);
  let body = "";
  if (block.operator === "if" && Boolean(value)) {
    body = renderBlock(block.body, scope, manifest, depth + 1);
  } else if (block.operator === "each" && Array.isArray(value)) {
    body = value
      .slice(0, manifest.maxCollectionItems)
      .map((item) =>
        renderBlock(
          block.body,
          { parent: scope, value: item },
          manifest,
          depth + 1
        )
      )
      .join("");
  }
  return `${before}${body}${renderBlock(afterTemplate, scope, manifest, depth)}`;
}

function findFirstBlock(template: string): {
  body: string;
  end: number;
  operator: "each" | "if";
  path: string;
  start: number;
} | null {
  const openPattern = /\{\{#(each|if)\s+([^{} ]+)\s*\}\}/g;
  const open = openPattern.exec(template);
  if (!open) return null;
  let depth = 1;
  const boundaryPattern = /\{\{([#/])(each|if)(?:\s+[^{}]+)?\s*\}\}/g;
  boundaryPattern.lastIndex = open.index + open[0].length;
  for (let match = boundaryPattern.exec(template); match; match = boundaryPattern.exec(template)) {
    if (match[1] === "#") depth += 1;
    else depth -= 1;
    if (depth === 0) {
      if (match[2] !== open[1]) invalidSyntax(match[0]);
      return {
        body: template.slice(open.index + open[0].length, match.index),
        end: match.index + match[0].length,
        operator: open[1] as "each" | "if",
        path: open[2]!,
        start: open.index
      };
    }
  }
  invalidSyntax(open[0]);
}

function renderInline(template: string, scope: RenderScope): string {
  return template.replace(tokenPattern, (token, marker, expression: string) => {
    if (marker) invalidSyntax(token);
    const [first, ...args] = splitExpression(expression.trim());
    if (!first) invalidSyntax(expression);
    if (helperNames.has(first)) {
      const helperPath = args[0];
      if (!helperPath) invalidSyntax(expression);
      const value = resolvePath(scope, helperPath);
      const option = args[1] ? stripQuotes(args[1]) : undefined;
      return escapeXml(applyHelper(first, value, option));
    }
    return escapeXml(stringValue(resolvePath(scope, first)));
  });
}

function resolvePath(scope: RenderScope, path: string): unknown {
  if (path === "this") return scope.value;
  let candidate: RenderScope | null = scope;
  while (candidate) {
    const result = readOwnPath(candidate.value, path);
    if (result.found) return result.value;
    candidate = candidate.parent;
  }
  return undefined;
}

function readOwnPath(
  value: unknown,
  path: string
): { found: boolean; value: unknown } {
  let current = value;
  for (const segment of path.split(".")) {
    if (
      !current ||
      typeof current !== "object" ||
      Array.isArray(current) ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return { found: false, value: undefined };
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return { found: true, value: current };
}

function applyHelper(name: string, value: unknown, option?: string): string {
  if (name === "currency") {
    const amount = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(amount)) return "";
    return new Intl.NumberFormat("nl-NL", {
      currency: option || "EUR",
      style: "currency"
    }).format(amount / 100);
  }
  if (name === "date") {
    const date = new Date(stringValue(value));
    if (Number.isNaN(date.valueOf())) return "";
    return new Intl.DateTimeFormat("nl-NL", {
      dateStyle: option === "long" ? "long" : "medium"
    }).format(date);
  }
  if (name === "truncate") {
    const length = Math.min(500, Math.max(1, Number(option) || 120));
    const text = stringValue(value);
    return text.length > length ? `${text.slice(0, Math.max(1, length - 1))}…` : text;
  }
  return stringValue(value) || option || "";
}

function splitExpression(expression: string): string[] {
  return expression.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
}

function stripQuotes(value: string): string {
  return /^(['"]).*\1$/.test(value) ? value.slice(1, -1) : value;
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function invalidSyntax(expression: string): never {
  throw new DynamicTemplateError(
    "template_invalid_syntax",
    `Niet-ondersteunde templatesyntaxis: ${expression}`
  );
}
