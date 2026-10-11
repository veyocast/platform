import { describe, expect, it } from "vitest";
import { guessProductColumnMapping } from "@veyocast/integrations";
import { normalizeProductCsvRows, parseProductCsv, productCsvMaxBytes } from "./product-csv-import";
const bytes = (text: string) => new TextEncoder().encode(text);
describe("CSV wordt begrensd en via dezelfde echte productreview genormaliseerd", () => {
  it("leest UTF-8 BOM, puntkomma, quote-escaping en regels in een geciteerd veld zonder uitvoering", () => {
    const csv = parseProductCsv("export.csv", bytes('\uFEFFnaam;prijs;omschrijving;artikelnummer\r\n"Koffie; groot";2,35;"Regel één\nRegel ""twee""";0012\r\n=FORMULE;3,00;letterlijk;0013'), "text/csv");
    expect(csv.rows[0]).toMatchObject({ naam: "Koffie; groot", prijs: "2,35", omschrijving: 'Regel één\nRegel "twee"', artikelnummer: "0012" });
    const normalized = normalizeProductCsvRows(csv.rows, guessProductColumnMapping(csv.headers));
    expect(normalized[0]?.normalized.price_cents).toBe(235); expect(normalized[0]?.normalized.external_id).toBe("0012"); expect(normalized[1]?.source.naam).toBe("=FORMULE");
  });
  it("ondersteunt comma/tab en sep-exports; mist geen laatste regel zonder newline", () => {
    for (const text of ['naam,prijs\n"Koffie",2.35', 'naam\tprijs\nKoffie\t2,35', 'sep=;\nnaam;prijs\nKoffie;2,35']) expect(normalizeProductCsvRows(parseProductCsv("x.csv", bytes(text)).rows, { naam: "name", prijs: "price" })[0]?.normalized.price_cents).toBe(235);
  });
  it("weigert malformed quotes, inconsistente/dubbele headers, binair/MIME en ongeldige UTF-8 vóór opslag", () => {
    for (const text of ['naam;prijs\n"Koffie;2,35', 'naam;prijs\n"Koffie"rest;2,35', 'naam;prijs\nKof"fie;2,35', 'naam;naam\nA;B', 'naam;prijs\nA;2;3', 'naam;prijs\nA;\u0000']) expect(() => parseProductCsv("x.csv", bytes(text))).toThrow();
    expect(() => parseProductCsv("x.csv", new Uint8Array([0xff, 0xfe, 0x41]))).toThrow("encoding"); expect(() => parseProductCsv("x.csv", bytes("naam;prijs\nA;2"), "application/pdf")).toThrow("format");
  });
  it("begrensd bytes, regels en veldlengte voorkomt gedeeltelijk truncateverlies", () => {
    expect(() => parseProductCsv("x.csv", new Uint8Array(productCsvMaxBytes + 1))).toThrow("bytes");
    expect(() => parseProductCsv("x.csv", bytes(`naam;prijs\n${"A;2\n".repeat(10_001)}`))).toThrow("rows");
    expect(() => parseProductCsv("x.csv", bytes(`naam;prijs\n${"A".repeat(1_001)};2`))).toThrow("value");
  });
  it("laat derde decimalen, negatieven en exponenten als reviewfout; bewaart exacte centen en her-mapping", () => {
    const csv = parseProductCsv("x.csv", bytes('naam;prijs\nA;2,355\nB;-2\nC;1e3\nD;"1.234,56"\nE;0'));
    const normalized = normalizeProductCsvRows(csv.rows, { naam: "name", prijs: "price" });
    expect(normalized.slice(0, 3).every(row => row.errors.length && row.normalized.price_cents === null)).toBe(true); expect(normalized[3]?.normalized.price_cents).toBe(123456); expect(normalized[4]?.normalized.price_cents).toBe(0);
  });
});
