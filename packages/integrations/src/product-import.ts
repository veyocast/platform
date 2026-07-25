import ExcelJS from "exceljs";

export const productImportLimits = {
  columns: 75,
  fileBytes: 8 * 1024 * 1024,
  rows: 10_000,
  sheets: 8,
  valueLength: 1_000
} as const;

export const productStandardFields = [
  "external_id",
  "name",
  "description",
  "category",
  "price",
  "vat_rate",
  "unit",
  "barcode",
  "active"
] as const;

export type ProductStandardField = (typeof productStandardFields)[number];
export type ProductColumnTarget =
  | ProductStandardField
  | `custom:${string}`
  | null;
export type ProductColumnMapping = Readonly<Record<string, ProductColumnTarget>>;
export type ProductCellValue = boolean | number | string | null;

export type ParsedProductWorkbook = Readonly<{
  fileName: string;
  headerRow: number;
  headers: readonly string[];
  rows: readonly Readonly<Record<string, ProductCellValue>>[];
  sheetName: string;
  sheets: readonly string[];
}>;

export type NormalizedProductRow = Readonly<{
  errors: readonly string[];
  included: boolean;
  normalized: Readonly<{
    active: boolean;
    barcode: string | null;
    category: string | null;
    custom_fields: Readonly<Record<string, ProductCellValue>>;
    description: string | null;
    external_id: string | null;
    name: string;
    price_cents: number | null;
    slug: string;
    unit: string | null;
    vat_rate: number | null;
  }>;
  rowNumber: number;
  source: Readonly<Record<string, ProductCellValue>>;
}>;

export class ProductWorkbookError extends Error {
  constructor(
    readonly code:
      | "empty"
      | "file_too_large"
      | "invalid_format"
      | "no_header"
      | "too_many_columns"
      | "too_many_rows"
      | "too_many_sheets"
  ) {
    super(code);
    this.name = "ProductWorkbookError";
  }
}

export async function parseProductWorkbook(
  fileName: string,
  input: Uint8Array
): Promise<ParsedProductWorkbook> {
  if (!input.byteLength) throw new ProductWorkbookError("empty");
  if (input.byteLength > productImportLimits.fileBytes) {
    throw new ProductWorkbookError("file_too_large");
  }
  if (
    !fileName.toLocaleLowerCase("nl-NL").endsWith(".xlsx") ||
    input[0] !== 0x50 ||
    input[1] !== 0x4b
  ) {
    throw new ProductWorkbookError("invalid_format");
  }

  const workbook = new ExcelJS.Workbook();
  // ExcelJS still declares the pre-generic Node Buffer type. The runtime
  // accepts a regular Uint8Array-backed Buffer.
  await workbook.xlsx.load(Buffer.from(input) as never);
  if (workbook.worksheets.length > productImportLimits.sheets) {
    throw new ProductWorkbookError("too_many_sheets");
  }
  const worksheet = workbook.worksheets.find((candidate) =>
    candidate.actualRowCount > 0 && candidate.actualColumnCount > 0
  );
  if (!worksheet) throw new ProductWorkbookError("empty");
  if (worksheet.actualRowCount > productImportLimits.rows + 20) {
    throw new ProductWorkbookError("too_many_rows");
  }
  if (worksheet.actualColumnCount > productImportLimits.columns) {
    throw new ProductWorkbookError("too_many_columns");
  }

  const headerRow = detectHeaderRow(worksheet);
  const headers = uniqueHeaders(
    rowValues(worksheet.getRow(headerRow))
      .slice(1)
      .map((value, index) => cellText(value) || `Kolom ${index + 1}`)
  );
  if (headers.length < 2) throw new ProductWorkbookError("no_header");

  const rows: Record<string, ProductCellValue>[] = [];
  for (
    let rowNumber = headerRow + 1;
    rowNumber <= worksheet.actualRowCount;
    rowNumber += 1
  ) {
    const row = worksheet.getRow(rowNumber);
    const values = headers.map((header, index) => [
      header,
      cellValue(row.getCell(index + 1).value)
    ] as const);
    if (values.every(([, value]) => value === null || value === "")) continue;
    rows.push(Object.fromEntries(values));
  }
  if (rows.length > productImportLimits.rows) {
    throw new ProductWorkbookError("too_many_rows");
  }

  return {
    fileName: safeFileName(fileName),
    headerRow,
    headers,
    rows,
    sheetName: worksheet.name,
    sheets: workbook.worksheets.map((sheet) => sheet.name)
  };
}

export function guessProductColumnMapping(
  headers: readonly string[]
): ProductColumnMapping {
  const claimed = new Set<ProductStandardField>();
  return Object.fromEntries(
    headers.map((header) => {
      const normalized = normalizeHeader(header);
      const exactTarget = exactTwelveHeaderTargets[normalized];
      if (exactTarget) {
        if (!exactTarget.startsWith("custom:")) {
          if (claimed.has(exactTarget)) {
            return [header, `custom:${slugify(header)}` as const];
          }
          claimed.add(exactTarget);
        }
        return [header, exactTarget];
      }
      const target = productStandardFields.find((field) =>
        !claimed.has(field) && headerAliases[field].some((alias) =>
          normalized === alias || normalized.includes(alias)
        )
      );
      if (target) {
        claimed.add(target);
        return [header, target];
      }
      return [header, `custom:${slugify(header)}` as const];
    })
  );
}

export function normalizeProductRows(
  rows: readonly Readonly<Record<string, ProductCellValue>>[],
  mapping: ProductColumnMapping
): NormalizedProductRow[] {
  return rows.map((source, index) => {
    const fields = new Map<ProductStandardField, ProductCellValue>();
    const customFields: Record<string, ProductCellValue> = {};
    for (const [header, target] of Object.entries(mapping)) {
      if (!target) continue;
      const value = source[header] ?? null;
      if (target.startsWith("custom:")) {
        customFields[target.slice("custom:".length)] = value;
      } else {
        fields.set(target as ProductStandardField, value);
      }
    }
    const name = asText(fields.get("name"));
    const externalId = nullableText(fields.get("external_id"));
    const price = parsePriceCents(fields.get("price"));
    const vatRate = parseDecimal(fields.get("vat_rate"));
    const slug = slugify(externalId || name || `product-${index + 1}`);
    const errors: string[] = [];
    if (!name) errors.push("Productnaam ontbreekt.");
    if (!slug) errors.push("Productcode kon niet worden gemaakt.");
    if (fields.has("price") && price === null) {
      errors.push("Prijs is geen geldig bedrag.");
    }
    if (vatRate !== null && (vatRate < 0 || vatRate > 100)) {
      errors.push("Btw-percentage moet tussen 0 en 100 liggen.");
    }
    return {
      errors,
      included: true,
      normalized: {
        active: parseActive(fields.get("active")),
        barcode: nullableText(fields.get("barcode")),
        category: nullableText(fields.get("category")),
        custom_fields: customFields,
        description: nullableText(fields.get("description")),
        external_id: externalId,
        name,
        price_cents: price,
        slug,
        unit: nullableText(fields.get("unit")),
        vat_rate: vatRate
      },
      rowNumber: index + 1,
      source
    };
  });
}

export function sanitizeProductMapping(
  headers: readonly string[],
  mapping: Readonly<Record<string, unknown>>
): ProductColumnMapping {
  const allowedHeaders = new Set(headers);
  const claimed = new Set<ProductStandardField>();
  const result: Record<string, ProductColumnTarget> = {};
  for (const header of headers) {
    if (!allowedHeaders.has(header)) continue;
    const value = mapping[header];
    if (value === null || value === "") {
      result[header] = null;
    } else if (
      typeof value === "string" &&
      productStandardFields.includes(value as ProductStandardField) &&
      !claimed.has(value as ProductStandardField)
    ) {
      claimed.add(value as ProductStandardField);
      result[header] = value as ProductStandardField;
    } else if (typeof value === "string" && value.startsWith("custom:")) {
      const customKey = slugify(value.slice("custom:".length));
      result[header] = customKey ? `custom:${customKey}` : null;
    } else {
      result[header] = null;
    }
  }
  return result;
}

function detectHeaderRow(worksheet: ExcelJS.Worksheet) {
  let bestRow = 0;
  let bestScore = 0;
  const limit = Math.min(worksheet.actualRowCount, 20);
  for (let rowNumber = 1; rowNumber <= limit; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const score = rowValues(row)
      .slice(1)
      .filter((value) => cellText(value).length > 0).length;
    if (score > bestScore) {
      bestRow = rowNumber;
      bestScore = score;
    }
  }
  if (!bestRow || bestScore < 2) throw new ProductWorkbookError("no_header");
  return bestRow;
}

function rowValues(row: ExcelJS.Row): ExcelJS.CellValue[] {
  return Array.isArray(row.values) ? row.values : [];
}

function uniqueHeaders(headers: readonly string[]) {
  const counts = new Map<string, number>();
  return headers.map((header) => {
    const safe = header.trim().slice(0, 120);
    const count = (counts.get(safe) ?? 0) + 1;
    counts.set(safe, count);
    return count === 1 ? safe : `${safe} (${count})`;
  });
}

function cellText(value: ExcelJS.CellValue | undefined) {
  const normalized = cellValue(value);
  return normalized === null ? "" : String(normalized).trim();
}

function cellValue(value: ExcelJS.CellValue | undefined): ProductCellValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, productImportLimits.valueLength);
  if (value instanceof Date) return value.toISOString();
  if ("result" in value) return cellValue(value.result);
  if ("text" in value) return String(value.text).slice(0, productImportLimits.valueLength);
  if ("richText" in value) {
    return value.richText
      .map((part) => part.text)
      .join("")
      .slice(0, productImportLimits.valueLength);
  }
  return String(value).slice(0, productImportLimits.valueLength);
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("nl-NL")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(value: string) {
  return normalizeHeader(value).replace(/\s+/g, "-").slice(0, 80);
}

function asText(value: ProductCellValue | undefined) {
  return value === undefined || value === null
    ? ""
    : String(value).trim().slice(0, 160);
}

function nullableText(value: ProductCellValue | undefined) {
  const text = asText(value);
  return text || null;
}

function parsePriceCents(value: ProductCellValue | undefined) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value)
    ? Math.round(value * 100)
    : null;
  const cleaned = String(value)
    .replace(/[€\s]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

function parseDecimal(value: ProductCellValue | undefined) {
  if (value === undefined || value === null || value === "") return null;
  const number = typeof value === "number"
    ? value
    : Number(String(value).replace("%", "").replace(",", ".").trim());
  return Number.isFinite(number) ? number : null;
}

function parseActive(value: ProductCellValue | undefined) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return true;
  const normalized = normalizeHeader(String(value));
  return !["0", "nee", "no", "false", "inactief", "vervallen", "uit"].includes(normalized);
}

function safeFileName(value: string) {
  return [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return character === "/" || character === "\\" || codePoint < 32
        ? "_"
        : character;
    })
    .join("")
    .slice(0, 180);
}

const headerAliases: Record<ProductStandardField, readonly string[]> = {
  active: ["actief", "active", "beschikbaar", "status"],
  barcode: ["barcode", "ean", "gtin"],
  category: ["categorie", "category", "hoofdgroep", "productgroep", "groep"],
  description: ["beschrijving", "description", "toelichting", "lange omschrijving"],
  external_id: ["artikelnummer", "product id", "productid", "plu", "code", "nummer", "id"],
  name: ["productnaam", "artikelnaam", "naam", "product", "artikel", "omschrijving"],
  price: ["verkoopprijs", "prijs inclusief btw", "incl btw", "prijs", "price", "bedrag"],
  unit: ["eenheid", "unit", "verpakking"],
  vat_rate: ["btw percentage", "btw tarief", "btw", "vat"]
};

/**
 * Twelve exports use English technical column names whose meaning is not
 * always the literal label. In particular, `Amount` is the sales price,
 * `VAT Id` is a Twelve reference (not a percentage), and `Open price` is a
 * boolean. Exact matches therefore take precedence over the generic aliases.
 */
const exactTwelveHeaderTargets: Readonly<
  Record<string, Exclude<ProductColumnTarget, null>>
> = {
  amount: "price",
  "external id": "custom:external-id",
  id: "external_id",
  "main product": "custom:main-product",
  "name long": "description",
  "name short": "name",
  "open price": "custom:open-price",
  "vat id": "custom:twelve-vat-id"
};
