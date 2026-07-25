import { describe, expect, it } from "vitest";

import {
  guessProductColumnMapping,
  normalizeProductRows,
  sanitizeProductMapping
} from "../src/product-import";
import { productShortcode } from "../src/product-shortcodes";

describe("Twelve productimport", () => {
  it("herkent gangbare Nederlandse Twelve-kolommen", () => {
    expect(
      guessProductColumnMapping([
        "Artikelnummer",
        "Productnaam",
        "Hoofdgroep",
        "Verkoopprijs",
        "Btw tarief",
        "Extra label"
      ])
    ).toEqual({
      Artikelnummer: "external_id",
      Productnaam: "name",
      Hoofdgroep: "category",
      Verkoopprijs: "price",
      "Btw tarief": "vat_rate",
      "Extra label": "custom:extra-label"
    });
  });

  it("normaliseert Nederlandse prijzen en behoudt extra velden", () => {
    const [row] = normalizeProductRows(
      [{
        Actief: "ja",
        Naam: "Broodje bal",
        Prijs: "€ 3,50",
        Verpakking: "stuk"
      }],
      {
        Actief: "active",
        Naam: "name",
        Prijs: "price",
        Verpakking: "custom:verpakking"
      }
    );
    expect(row?.normalized).toMatchObject({
      active: true,
      name: "Broodje bal",
      price_cents: 350,
      slug: "broodje-bal"
    });
    expect(row?.normalized.custom_fields).toEqual({ verpakking: "stuk" });
    expect(row?.errors).toEqual([]);
  });

  it("weigert dubbele standaardmappings", () => {
    expect(
      sanitizeProductMapping(["Naam", "Omschrijving"], {
        Naam: "name",
        Omschrijving: "name"
      })
    ).toEqual({ Naam: "name", Omschrijving: null });
  });

  it("maakt een stabiele, leesbare shortcode", () => {
    expect(productShortcode("broodje-bal", "price")).toBe(
      "{{product:broodje-bal:price}}"
    );
  });
});
