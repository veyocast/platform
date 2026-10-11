import { normalizeProductRows, productImportLimits, type ParsedProductWorkbook, type ProductCellValue, type ProductColumnMapping } from "@veyocast/integrations";
export class ProductCsvError extends Error {
  constructor(readonly code: "bytes" | "encoding" | "format" | "quotes" | "headers" | "columns" | "rows" | "value" | "empty") { super(code); }
}
export const productCsvMaxBytes = 2 * 1024 * 1024;
export function parseProductCsv(fileName: string, bytes: Uint8Array, mimeType = ""): ParsedProductWorkbook {
  if (!fileName.toLowerCase().endsWith(".csv") || !["", "text/csv", "text/plain", "application/csv", "application/vnd.ms-excel", "application/octet-stream"].includes(mimeType.split(";")[0]!.toLowerCase())) throw new ProductCsvError("format");
  if (!bytes.length) throw new ProductCsvError("empty");
  if (bytes.length > productCsvMaxBytes) throw new ProductCsvError("bytes");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/u, ""); } catch { throw new ProductCsvError("encoding"); }
  if ([...text].some(character => { const code = character.codePointAt(0)!; return code < 32 && ![9, 10, 13].includes(code); })) throw new ProductCsvError("format");
  const separatorLine = /^sep=([;,\t])\r?\n/iu.exec(text);
  const declared = separatorLine?.[1]; if (separatorLine) text = text.slice(separatorLine[0].length);
  let delimiter = declared ?? ";";
  if (!declared) {
    const counts = new Map([[";", 0], [",", 0], ["\t", 0]]); let quoted = false;
    for (let index = 0; index < text.length; index++) {
      const character = text[index]!;
      if (character === '"') { if (quoted && text[index + 1] === '"') index++; else quoted = !quoted; }
      if (!quoted && (character === "\n" || character === "\r")) break;
      if (!quoted && counts.has(character)) counts.set(character, counts.get(character)! + 1);
    }
    delimiter = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
  }
  const records: string[][] = []; let cells: string[] = [], value = "", quoted = false, closed = false;
  const finishCell = () => { if (value.length > productImportLimits.valueLength) throw new ProductCsvError("value"); cells.push(value); if (cells.length > productImportLimits.columns) throw new ProductCsvError("columns"); value = ""; closed = false; };
  const finishRecord = () => { finishCell(); if (cells.some(cell => cell.trim())) records.push(cells); cells = []; if (records.length > productImportLimits.rows + 1) throw new ProductCsvError("rows"); };
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (quoted) { if (character === '"') { if (text[index + 1] === '"') { value += '"'; index++; } else { quoted = false; closed = true; } } else value += character; }
    else if (character === '"') { if (value || closed) throw new ProductCsvError("quotes"); quoted = true; }
    else if (character === delimiter) finishCell();
    else if (character === "\n" || character === "\r") { if (character === "\r" && text[index + 1] === "\n") index++; finishRecord(); }
    else { if (closed) throw new ProductCsvError("quotes"); value += character; }
    if (value.length > productImportLimits.valueLength) throw new ProductCsvError("value");
  }
  if (quoted) throw new ProductCsvError("quotes");
  if (value || cells.length || closed) finishRecord();
  const headers = records.shift()?.map(header => header.trim()) ?? [];
  if (headers.length < 2 || headers.some(header => !header || header.length > 120 || ["__proto__", "constructor", "prototype"].includes(header)) || new Set(headers.map(header => header.toLocaleLowerCase("nl-NL"))).size !== headers.length) throw new ProductCsvError("headers");
  if (!records.length) throw new ProductCsvError("empty");
  if (records.some(record => record.length !== headers.length)) throw new ProductCsvError("columns");
  return { fileName: [...fileName].map(character => character === "/" || character === "\\" || character.codePointAt(0)! < 32 ? "_" : character).join("").slice(0, 180), headerRow: separatorLine ? 2 : 1, headers, rows: records.map(record => Object.fromEntries(headers.map((header, index) => [header, record[index]!] as const))), sheetName: "CSV", sheets: ["CSV"] };
}
export function normalizeProductCsvRows(rows: readonly Readonly<Record<string, ProductCellValue>>[], mapping: ProductColumnMapping) {
  const priceHeader = Object.entries(mapping).find(([, target]) => target === "price")?.[0];
  return normalizeProductRows(rows, mapping).map(row => {
    if (!priceHeader) return row;
    const raw = String(row.source[priceHeader] ?? "").replace(/[€\s]/gu, "");
    if (!raw) return { ...row, normalized: { ...row.normalized, price_cents: null } };
    const normalized = /^\d{1,3}(?:\.\d{3})+,\d{1,2}$/u.test(raw) ? raw.replace(/\./gu, "").replace(",", ".") : raw.replace(",", ".");
    const parts = /^(\d+)(?:\.(\d{1,2}))?$/u.exec(normalized);
    const cents = parts ? Number(parts[1]) * 100 + Number((parts[2] ?? "").padEnd(2, "0")) : NaN;
    if (!Number.isSafeInteger(cents) || cents < 0 || cents > 100_000_000) return { ...row, normalized: { ...row.normalized, price_cents: null }, errors: [...new Set([...row.errors, "Prijs moet gehele eurocenten bevatten, met maximaal twee decimalen."])] };
    return { ...row, normalized: { ...row.normalized, price_cents: cents } };
  });
}
export const productCsvErrors: Record<ProductCsvError["code"], string> = {
  bytes: "Kies een CSV-bestand van maximaal 2 MB.", encoding: "De CSV moet UTF-8 gebruiken. Exporteer het bestand opnieuw als UTF-8 CSV.", format: "Gebruik een tekstbestand met extensie .csv, geen werkmap of ander bestand.", quotes: "De CSV bevat onjuist gesloten aanhalingstekens. Controleer de export en probeer opnieuw.", headers: "Gebruik unieke kolomnamen op de eerste regel, bijvoorbeeld naam en prijs.", columns: "De CSV heeft inconsistente regels of meer dan 75 kolommen. Controleer de export.", rows: "Kies maximaal 10.000 productregels per import.", value: "Een veld is langer dan 1.000 tekens. Kort dit veld in en probeer opnieuw.", empty: "De CSV bevat geen productregels. Voeg een kopregel en minimaal één product toe."
};
