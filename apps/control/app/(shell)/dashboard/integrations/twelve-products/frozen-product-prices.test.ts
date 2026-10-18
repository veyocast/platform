import { describe, expect, it } from "vitest";
import { frozenProductPrices } from "./frozen-product-prices";
const linked = (amount: number, override?: number) => ({ kind: "product", productRef: { productId: "coffee" }, snapshotFallback: { price: { currency: "EUR", amountMinor: amount } }, priceOverrideMinor: override });
describe("frozen product price evidence", () => {
  it("keeps multiple frozen prices and explicit overrides apart from the captured catalog", () => {
    const result = frozenProductPrices([{ menuDocument: { nodes: [linked(250, 200), linked(275), linked(250, 200), { ...linked(999), hidden: true }] } }]);
    expect(result.coffee).toEqual({ capturedCatalogCents: [250, 275], displayCents: [200, 275] });
  });
  it("reads legacy rendered prices without inventing their catalog baseline", () => {
    expect(frozenProductPrices([{ priceList: { sections: [{ products: [{ productId: "coffee", formattedPrice: "€ 2,50" }] }] } }]).coffee)
      .toEqual({ capturedCatalogCents: [], displayCents: [250] });
  });
  it("does not promote malformed, foreign-currency or hidden values into price proof", () => {
    expect(frozenProductPrices([linked(2.5), { ...linked(500), visible: false }, { ...linked(500), snapshotFallback: { price: { currency: "USD", amountMinor: 500 } } }, { productId: "coffee", formattedPrice: "geen prijs" }])).toEqual({});
  });
});
