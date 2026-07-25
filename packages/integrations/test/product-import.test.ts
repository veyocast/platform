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

  it("herkent de aangeleverde Twelve-export zonder technische velden verkeerd te duiden", () => {
    expect(
      guessProductColumnMapping([
        "ID",
        "Name short",
        "Name long",
        "Amount",
        "VAT Id",
        "Main product",
        "Open price",
        "External ID"
      ])
    ).toEqual({
      ID: "external_id",
      "Name short": "name",
      "Name long": "description",
      Amount: "price",
      "VAT Id": "custom:twelve-vat-id",
      "Main product": "custom:main-product",
      "Open price": "custom:open-price",
      "External ID": "custom:external-id"
    });
  });

  it("normaliseert een representatieve Twelve-regel naar naam en europrijs", () => {
    const [row] = normalizeProductRows(
      [{
        ID: 2918770,
        "Name short": "Sundae chocolade",
        "Name long": "Sundae chocolade",
        Amount: 1.8,
        "VAT Id": 2,
        Active: 1,
        Category: "Ijs"
      }],
      guessProductColumnMapping([
        "ID",
        "Name short",
        "Name long",
        "Amount",
        "VAT Id",
        "Active",
        "Category"
      ])
    );

    expect(row?.normalized).toMatchObject({
      active: true,
      category: "Ijs",
      description: "Sundae chocolade",
      external_id: "2918770",
      name: "Sundae chocolade",
      price_cents: 180,
      vat_rate: null
    });
    expect(row?.normalized.custom_fields).toEqual({ "twelve-vat-id": 2 });
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
