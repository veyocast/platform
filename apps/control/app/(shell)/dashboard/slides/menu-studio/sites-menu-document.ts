import { menuDocumentV2Schema, type MenuDocumentV2, type MenuProductPlacement, type SitesDynamicConfiguration } from "@veyocast/contracts";
import type { MenuStudioMediaOption, MenuStudioProductOption } from "./menu-studio-editor";

export function sitesMenuProductIds(document: MenuDocumentV2) {
  return document.pages.flatMap(page => page.blocks.flatMap(block => block.type === "category" ? block.productNodes.flatMap(node => node.kind === "product" ? [node.productRef.productId] : []) : []));
}
/** Reuses real provider references and integer amounts; no formatted-price parsing. */
export function buildSitesMenuDocument(document: MenuDocumentV2, selected: MenuStudioProductOption[], design: SitesDynamicConfiguration, showCategories: boolean, media: MenuStudioMediaOption[]): MenuDocumentV2 {
  if (design.provider !== "menu" || selected.length > 100 || new Set(selected.map(item => item.id)).size !== selected.length) throw new Error("Kies maximaal honderd unieke producten.");
  const products: MenuProductPlacement[] = selected.map((product, order) => ({ id: `sites-product-${product.id}`, kind: "product", order,
    productRef: { productId: product.id, source: product.sourceKind === "twelve_excel" ? "twelve" : "manual", sourceRevision: product.sourceRevision, ...(product.sourceKind === "twelve_excel" ? { providerConnectionId: product.sourceId } : {}) },
    snapshotFallback: { available: product.available, name: product.name, price: { amountMinor: product.priceCents, currency: product.currency, taxMode: product.taxMode, ...(product.taxRateBps === undefined ? {} : { taxRateBps: product.taxRateBps }), ...(product.unitKey ? { unitKey: product.unitKey } : {}) } } }));
  const categories: Array<{ name: string; indices: number[] }> = [];
  selected.forEach((product, index) => {
    const name = showCategories ? product.category : "Menu";
    const previous = categories.at(-1);
    if (previous?.name === name) previous.indices.push(index); else categories.push({ name, indices: [index] });
  });
  const page = document.pages[0]!;
  const blocks = categories.map((category, order) => ({ id: `sites-category-${order}`, type: "category" as const, order, headingVisible: showCategories,
    layout: { landscape: { x: 96, y: 248, w: 1728, h: 704, rotation: 0 }, portrait: { x: 72, y: 348, w: 936, h: 1388, rotation: 0 } },
    source: { source: "manual" as const, sourceCategoryId: `sites-category-${order}`, sourceName: category.name }, productNodes: category.indices.map((productIndex, index) => ({ ...products[productIndex]!, order: index })) }));
  const assets = [...document.assets];
  const backgroundRef = design.background;
  if (backgroundRef?.kind === "tenant") {
    const background = media.find(item => item.id === backgroundRef.mediaAssetId && item.kind === "image");
    if (!background || background.sha256 !== backgroundRef.checksumSha256) throw new Error("De gekozen achtergrond is niet meer beschikbaar. Kies opnieuw.");
    const reference = { assetId: background.id, assetVersion: background.assetVersion, kind: "image" as const, status: "ready" as const };
    const existing = assets.findIndex(item => item.assetId === background.id);
    if (existing >= 0) assets[existing] = reference; else assets.push(reference);
  }
  return menuDocumentV2Schema.parse({ ...document, assets, sitesConfiguration: { ...design, showCategories }, theme: { ...document.theme, themeId: design.themeId, themeVersion: design.themeId === "onzetrots-tv" ? "11.0.0" : "1.0.0", brand: { ...document.theme.brand, accent: design.accent } }, pages: [{ ...page, blocks, durationMs: Math.max(6_000, design.seconds * 1000) }], title: design.title });
}
