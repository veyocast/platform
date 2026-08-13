import {
  paginatePriceList,
  PRICE_LIST_METRICS,
  type DynamicTemplateManifest,
  type PriceListColumn,
  type PriceListOrientation,
  type ResolvedPriceListItem,
  type ResolvedPriceListSection
} from "@veyocast/contracts";

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
  if (source.manifest.slideType === "price_list") {
    return renderPriceListSnapshotSvg(source, input);
  }
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

function renderPriceListSnapshotSvg(
  source: DynamicTemplateSource,
  input: unknown
) {
  const orientation: PriceListOrientation = source.manifest.canvas.width >
    source.manifest.canvas.height ? "landscape" : "portrait";
  const metrics = PRICE_LIST_METRICS[orientation];
  const root = recordValue(input);
  const priceList = recordValue(root?.priceList);
  const brand = recordValue(root?.brand);
  const sections = arrayValue(priceList?.sections).flatMap((value) => {
    const section = recordValue(value);
    const column = section?.column;
    const id = stringValue(section?.id);
    const name = stringValue(section?.name);
    if ((column !== "left" && column !== "right") || !id || !name) return [];
    const products = arrayValue(section?.products).flatMap((entry) => {
      const product = recordValue(entry);
      const productId = stringValue(product?.id);
      const productName = stringValue(product?.name);
      if (!productId || !productName) return [];
      return [{
        description: stringValue(product?.description),
        formattedPrice: stringValue(product?.formattedPrice),
        id: productId,
        image: { kind: "empty" as const },
        name: productName,
        photoVisible: product?.photoVisible === true
      } satisfies ResolvedPriceListItem];
    });
    if (!products.length) return [];
    return [{
      column,
      id,
      name,
      order: finiteInteger(section?.order),
      products
    } satisfies ResolvedPriceListSection];
  });
  const page = paginatePriceList(sections, orientation)[0]!;
  const light = source.css.includes("#f3f1ec");
  const background = light ? "#f3f1ec" : "#070a0e";
  const foreground = light ? "#17202a" : "#f3f0e9";
  const muted = light ? "#6f7882" : "#9aa2ac";
  const divider = light ? "rgba(23,32,42,.12)" : "rgba(255,255,255,.12)";
  const accentCandidate = stringValue(brand?.primaryColor).toUpperCase();
  const accent = /^#[0-9A-F]{6}$/.test(accentCandidate)
    ? accentCandidate
    : "#FF5C20";
  const title = truncate(stringValue(priceList?.title) || "Prijslijst", 32);
  const clubName = truncate(stringValue(brand?.clubName) || "Vereniging", 46);
  const logoSize = orientation === "landscape" ? 112 : 104;
  const headerX = metrics.safeMargin + logoSize + 32;
  const priceWidth = orientation === "landscape" ? 120 : 92;
  const nameSize = orientation === "landscape" ? 26 : 20;
  const descriptionSize = orientation === "landscape" ? 17 : 14;
  const priceSize = orientation === "landscape" ? 32 : 24;
  const categorySize = orientation === "landscape" ? 28 : 22;
  const columns = (["left", "right"] as const).map((column, columnIndex) =>
    renderSnapshotPriceListColumn({
      accent,
      categorySize,
      descriptionSize,
      divider,
      foreground,
      metrics,
      muted,
      nameSize,
      priceSize,
      priceWidth,
      rows: page.columns[column],
      x: metrics.safeMargin + columnIndex * (metrics.columnWidth + metrics.columnGap)
    })
  ).join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${metrics.canvasWidth}" height="${metrics.canvasHeight}" viewBox="0 0 ${metrics.canvasWidth} ${metrics.canvasHeight}">`,
    `<rect width="100%" height="100%" fill="${background}"/>`,
    `<rect width="100%" height="8" fill="${accent}"/>`,
    `<rect x="${metrics.safeMargin}" y="40" width="${logoSize}" height="${logoSize}" fill="none"/>`,
    `<text x="${headerX}" y="112" fill="${foreground}" font-family="Arial,sans-serif" font-size="58" font-weight="900">${escapeXml(title)}</text>`,
    `<line x1="${metrics.safeMargin}" x2="${metrics.canvasWidth - metrics.safeMargin}" y1="176" y2="176" stroke="${divider}"/>`,
    columns,
    `<text x="${metrics.safeMargin}" y="${metrics.canvasHeight - 34}" fill="${muted}" font-family="Arial,sans-serif" font-size="14" font-weight="700">${escapeXml(clubName)}</text>`,
    `<text x="${metrics.canvasWidth - metrics.safeMargin}" y="${metrics.canvasHeight - 34}" text-anchor="end" fill="${muted}" font-family="Arial,sans-serif" font-size="14">1 / ${page.pageCount}</text>`,
    "</svg>"
  ].join("");
}

function renderSnapshotPriceListColumn({
  accent,
  categorySize,
  descriptionSize,
  divider,
  foreground,
  metrics,
  muted,
  nameSize,
  priceSize,
  priceWidth,
  rows,
  x
}: {
  accent: string;
  categorySize: number;
  descriptionSize: number;
  divider: string;
  foreground: string;
  metrics: (typeof PRICE_LIST_METRICS)[PriceListOrientation];
  muted: string;
  nameSize: number;
  priceSize: number;
  priceWidth: number;
  rows: ReturnType<typeof paginatePriceList>[number]["columns"][PriceListColumn];
  x: number;
}) {
  return rows.map((row, index) => {
    const y = metrics.contentTop + index * metrics.rowHeight;
    const dividerLine = `<line x1="${x}" x2="${x + metrics.columnWidth}" y1="${y + metrics.rowHeight}" y2="${y + metrics.rowHeight}" stroke="${divider}"/>`;
    if (row.kind === "category") {
      return [
        `<rect x="${x}" y="${y + 12}" width="8" height="${metrics.rowHeight - 24}" fill="${accent}"/>`,
        `<text x="${x + 28}" y="${y + metrics.rowHeight * .62}" fill="${foreground}" font-family="Arial,sans-serif" font-size="${categorySize}" font-weight="900">${escapeXml(truncate(row.name, 34))}</text>`,
        row.continuation
          ? `<text x="${x + metrics.columnWidth}" y="${y + metrics.rowHeight * .62}" text-anchor="end" fill="${muted}" font-family="Arial,sans-serif" font-size="11" font-weight="700">VERVOLG</text>`
          : "",
        dividerLine
      ].join("");
    }
    const copyX = x + metrics.mediaSize + 16;
    const priceX = x + metrics.columnWidth;
    const copyWidth = metrics.columnWidth - metrics.mediaSize - 32 - priceWidth;
    const nameLength = Math.max(8, Math.floor(copyWidth / (nameSize * .58)));
    const descriptionLength = Math.max(8, Math.floor(copyWidth / (descriptionSize * .55)));
    return [
      `<text x="${copyX}" y="${y + metrics.rowHeight * .45}" fill="${foreground}" font-family="Arial,sans-serif" font-size="${nameSize}" font-weight="800">${escapeXml(truncate(row.item.name, nameLength))}</text>`,
      `<text x="${copyX}" y="${y + metrics.rowHeight * .73}" fill="${muted}" font-family="Arial,sans-serif" font-size="${descriptionSize}">${escapeXml(truncate(row.item.description, descriptionLength))}</text>`,
      `<text x="${priceX}" y="${y + metrics.rowHeight * .62}" text-anchor="end" fill="${accent}" font-family="Arial,sans-serif" font-size="${priceSize}" font-weight="900">${escapeXml(row.item.formattedPrice)}</text>`,
      dividerLine
    ].join("");
  }).join("");
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function finiteInteger(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, Math.max(1, length - 1))}…` : value;
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
