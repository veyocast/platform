export const productShortcodeFields = [
  "name",
  "description",
  "category",
  "price",
  "vat_rate",
  "unit",
  "barcode",
  "external_id"
] as const;

export type ProductShortcodeField = (typeof productShortcodeFields)[number];

export function productShortcode(slug: string, field: ProductShortcodeField) {
  return `{{product:${slug}:${field}}}`;
}

export function formatProductPrice(priceCents: number | null) {
  if (priceCents === null) return "";
  return new Intl.NumberFormat("nl-NL", {
    currency: "EUR",
    style: "currency"
  }).format(priceCents / 100);
}
