import { menuDocumentV2Schema, type MenuBlock, type MenuDocumentV2, type MenuProductPlacement, type SitesDynamicConfiguration } from "@veyocast/contracts";
import type { MenuStudioMediaOption, MenuStudioProductOption } from "./menu-studio-editor";

export const menuWidgetZones = { landscape: { x: 96, y: 248, w: 1728, h: 704 }, portrait: { x: 72, y: 348, w: 936, h: 1388 } } as const;
/** Decimal input becomes exact integer cents; no floating-point rounding. */
export function parseMenuPriceMinor(value: string): number | null {
  const match = /^(\d{1,7})(?:[,.](\d{1,2}))?$/u.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return amount <= 999_999_999 ? amount : null;
}
export function menuWidgetLayout() { return Object.fromEntries(Object.entries(menuWidgetZones).map(([key, zone]) => [key, { ...zone, rotation: 0 }])) as MenuBlock["layout"]; }
export function menuProductPlacement(product: MenuStudioProductOption, id = crypto.randomUUID()): MenuProductPlacement {
  return { id, kind: "product", order: 0, productRef: { productId: product.id, source: product.sourceKind === "twelve_excel" ? "twelve" : "manual", sourceRevision: product.sourceRevision, ...(product.sourceKind === "twelve_excel" ? { providerConnectionId: product.sourceId } : {}) }, snapshotFallback: { available: product.available, name: product.name, price: { amountMinor: product.priceCents, currency: product.currency, taxMode: product.taxMode, ...(product.taxRateBps === undefined ? {} : { taxRateBps: product.taxRateBps }), ...(product.unitKey ? { unitKey: product.unitKey } : {}) } } };
}
export function menuLinkedIds(document: MenuDocumentV2): string[] {
  const ids: string[] = [];
  function visit(value: unknown) { if (!value || typeof value !== "object") return; if (Array.isArray(value)) { value.forEach(visit); return; } const item = value as Record<string, unknown>; if (item.kind === "product" || item.kind === "linked-product") { const ref = item.productRef as {productId?:string}; if (ref?.productId) ids.push(ref.productId); } Object.values(item).forEach(visit); }
  visit(document.pages); return ids;
}
export function prepareMenuWidgets(document: MenuDocumentV2): MenuDocumentV2 {
  return { ...document, pages: document.pages.map(page => ({ ...page, landscapeColumns: page.landscapeColumns ?? 2, portraitColumns: page.portraitColumns ?? 1, blocks: page.blocks.map(block => ({ ...block, widget: block.widget ?? { column: "full" }, ...(block.type === "category" ? { columns: block.columns ?? 2 } : {}) })) })) };
}
/** Save the actual widget document; refresh only its linked product snapshots. */
export function buildMenuWidgetDocument(document: MenuDocumentV2, products: MenuStudioProductOption[], design: SitesDynamicConfiguration, media: MenuStudioMediaOption[]): MenuDocumentV2 {
  if (design.provider !== "menu") throw new Error("Dit ontwerp vereist een menubron.");
  const ids = menuLinkedIds(document);
  if (ids.length > 100) throw new Error("Kies maximaal honderd producten en subproducten.");
  if (ids.some(id => !products.some(product => product.id === id))) throw new Error("Een gekoppeld product ontbreekt. Verwijder het of kies een beschikbaar product.");
  const refresh = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(refresh);
    if (!value || typeof value !== "object") return value;
    const item = value as Record<string, unknown>;
    const result = Object.fromEntries(Object.entries(item).map(([key, child]) => [key, refresh(child)]));
    if (item.kind === "product" || item.kind === "linked-product") {
      const ref = item.productRef as {productId: string}; const product = products.find(product => product.id === ref.productId)!;
      const placement = menuProductPlacement(product, String(item.id));
      result.productRef = placement.productRef;
      const previousSnapshot=item.snapshotFallback as {variantLabel?:string;imageAssetId?:string}|undefined;
      const variantLabel=previousSnapshot?.variantLabel;
      result.snapshotFallback = { ...placement.snapshotFallback, ...(variantLabel ? { variantLabel } : {}), ...(previousSnapshot?.imageAssetId?{imageAssetId:previousSnapshot.imageAssetId}:{}) };
    }
    return result;
  };
  const pages = (refresh(document.pages) as MenuDocumentV2["pages"]).map((page, order) => {
    const columnCount = design.orientation === "landscape" ? page.landscapeColumns ?? 2 : page.portraitColumns ?? 1;
    const positions = [0, 0];
    const placements = page.blocks.map(block => {
      const column = columnCount === 1 ? "full" : block.widget?.column ?? "full";
      const lane = column === "right" ? 1 : 0;
      const row = column === "full" ? Math.max(...positions) : positions[lane]!;
      if (column === "full") positions[0] = positions[1] = row + 1; else positions[lane] = row + 1;
      return {block, column, row};
    });
    const rowCount = Math.max(1, ...positions);
    return { ...page, order, durationMs: Math.max(6000, design.seconds * 1000), blocks: placements.map(({block, column, row}, index) => ({ ...block, order: index, layout: Object.fromEntries(Object.entries(menuWidgetZones).map(([orientation, zone]) => { const full = column === "full"; const w = full ? zone.w : (zone.w - 32) / 2; return [orientation, {x: zone.x + (column === "right" ? w + 32 : 0), y: zone.y + row * zone.h / rowCount, w, h: zone.h / rowCount - 8, rotation: 0}]; })) as MenuBlock["layout"] })) };
  });
  const assetIds = new Set<string>();
  const collect = (value: unknown) => { if (!value || typeof value !== "object") return; if (Array.isArray(value)) {value.forEach(collect);return;} for (const [key, child] of Object.entries(value)) { if (["assetId", "imageAssetId", "logoAssetId", "mediaOverrideAssetId", "posterAssetId"].includes(key) && typeof child === "string") assetIds.add(child); else collect(child); } };
  collect(pages); if (document.theme.brand.logoAssetId) assetIds.add(document.theme.brand.logoAssetId);
  if (design.background?.kind === "tenant") assetIds.add(design.background.mediaAssetId);
  const assets = [...assetIds].map(assetId => {
    const option = media.find(item => item.id === assetId); const stored = document.assets.find(item => item.assetId === assetId);
    if (!option && !stored) throw new Error("Een widgetafbeelding is niet meer beschikbaar. Kies de afbeelding opnieuw.");
    if (design.background?.kind === "tenant" && design.background.mediaAssetId === assetId && option?.sha256 !== design.background.checksumSha256) throw new Error("De achtergrond is gewijzigd. Kies de afbeelding opnieuw.");
    return option ? {assetId, assetVersion: option.assetVersion, sha256: option.sha256, kind: option.kind, status: "ready" as const, ...(option.posterAssetVersion ? {posterAssetVersion:option.posterAssetVersion} : {})} : stored!;
  });
  return menuDocumentV2Schema.parse({...document, pages, assets, title:design.title, sitesConfiguration:{...design, menuWidgets:true}, theme:{...document.theme, themeId:design.themeId, themeVersion:design.themeId === "onzetrots-tv" ? "11.0.0" : "1.0.0", brand:{...document.theme.brand, accent:design.accent}}});
}
