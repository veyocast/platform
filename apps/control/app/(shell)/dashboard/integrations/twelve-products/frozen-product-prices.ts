export type FrozenProductPrice = { capturedCatalogCents: number[]; displayCents: number[] };
export type ProductPriceEvidence = { status: "available" | "none" | "unavailable"; products: Record<string, FrozenProductPrice> };

/** Read only immutable snapshot values, including explicit placement overrides. */
export function frozenProductPrices(snapshots: unknown[]): Record<string, FrozenProductPrice> {
  const products = new Map<string, { catalog: Set<number>; display: Set<number> }>();
  let visited = 0;
  function add(id: string, display: number, catalog?: number) {
    const price = products.get(id) ?? { catalog: new Set<number>(), display: new Set<number>() };
    price.display.add(display); if (catalog !== undefined) price.catalog.add(catalog); products.set(id, price);
  }
  function walk(value: unknown, depth = 0, shared = false, sharedAmount?: number) {
    if (depth > 24 || ++visited > 100_000) throw new Error("Frozen menu exceeds comparison bounds");
    if (Array.isArray(value)) { value.forEach(item => walk(item, depth + 1, shared, sharedAmount)); return; }
    const row = record(value);
    if (!row || row.hidden === true || row.visible === false) return;
    const groupMoney = record(row.sharedPrice);
    if (row.kind === "product-group" && row.pricePolicy === "shared") {
      shared = true;
      sharedAmount = groupMoney?.currency === "EUR" && cents(groupMoney.amountMinor) ? groupMoney.amountMinor : undefined;
    }
    const ref = record(row.productRef), fallback = record(row.snapshotFallback), money = record(fallback?.price);
    if (["product", "linked-product"].includes(String(row.kind)) && typeof ref?.productId === "string" && money?.currency === "EUR" && cents(money.amountMinor)) {
      const display = sharedAmount ?? (cents(row.priceOverrideMinor) ? row.priceOverrideMinor : money.amountMinor);
      add(ref.productId, display, shared ? undefined : money.amountMinor);
    }
    // Source menu rows carry their integer catalogue baseline directly.
    if (typeof row.id === "string" && row.currency === "EUR" && cents(row.priceMinor))
      add(row.id, row.priceMinor, row.priceMinor);
    // The historical price-list format preserves its rendered, localized price,
    // but no independent catalog baseline. Never infer a catalog change from it.
    if (typeof row.productId === "string" && typeof row.formattedPrice === "string") {
      const match = /^€\s*(\d{1,7}),([0-9]{2})$/.exec(row.formattedPrice);
      if (match) add(row.productId, Number(match[1]) * 100 + Number(match[2]));
    }
    for (const child of Object.values(row)) if (child && typeof child === "object") walk(child, depth + 1, shared, sharedAmount);
  }
  snapshots.forEach(snapshot => walk(snapshot));
  return Object.fromEntries([...products].map(([id, price]) => [id, { capturedCatalogCents: [...price.catalog].sort((a, b) => a - b), displayCents: [...price.display].sort((a, b) => a - b) }]));
}
function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function cents(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 999_999_999; }
