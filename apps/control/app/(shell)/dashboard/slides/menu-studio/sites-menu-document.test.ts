import { describe, expect, it } from "vitest";
import type { MenuDocumentV2 } from "@veyocast/contracts";
import { buildSitesMenuPresentation } from "@veyocast/content-templates/sites-dynamic-projector";
import { createSitesSourceDesign } from "../../studio/sportlink/new/sites-source-design";
import { buildSitesMenuDocument, sitesMenuProductIds } from "./sites-menu-document";
import type { MenuStudioMediaOption, MenuStudioProductOption } from "./menu-studio-editor";
const document: MenuDocumentV2 = { schemaVersion: "menu-document.v2", id: "test-menu", tenantId: "test-tenant", revision: 3, title: "Menu", createdAt: "2026-10-11T12:00:00.000Z", updatedAt: "2026-10-11T12:00:00.000Z", assets: [], pages: [{ id: "page", order: 0, blocks: [] }], theme: { themeId: "editorial", themeVersion: "1.0.0", mode: "light", brand: { accent: "#FF5C20" } } };
function product(index: number, category = "Dranken"): MenuStudioProductOption { return { id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`, sourceId: "20000000-0000-4000-8000-000000000001", sourceKind: "twelve_excel", sourceRevision: "provider-revision-42", name: `Product ${index}`, priceCents: 235 + index, category, currency: "EUR", available: true, description: "", taxMode: "inclusive", taxRateBps: 900 }; }
const design = createSitesSourceDesign("menu", "Onze kaart");
describe("Menu wizard typed document", () => {
 it("retains selection order across repeated categories and uses exact integer money and provider revisions", () => {
  const selected = [product(1), product(2, "Snacks"), product(3)]; const built = buildSitesMenuDocument(document, selected, design, true, []);
  expect(sitesMenuProductIds(built)).toEqual(selected.map(item => item.id));
  const nodes = built.pages.flatMap(page => page.blocks.flatMap(block => block.type === "category" ? block.productNodes : []));
  expect(nodes[0]).toMatchObject({ productRef: { source: "twelve", sourceRevision: "provider-revision-42" }, snapshotFallback: { price: { amountMinor: 236, currency: "EUR", taxRateBps: 900 } } });
  expect(buildSitesMenuPresentation(built, design)?.kind).toBe("dynamic"); expect(document.pages[0]!.blocks).toEqual([]); expect(document.revision).toBe(3);
 });
 it("preserves all twelve original QA-menu products across three categories without truncation", () => {
  const selected = Array.from({ length: 12 }, (_, index) => product(index, ["Koffie & thee", "Lekker fris", "De derde helft"][Math.floor(index / 4)]));
  const built = buildSitesMenuDocument(document, selected, design, true, []); expect(sitesMenuProductIds(built)).toEqual(selected.map(item => item.id)); expect(built.pages[0]!.blocks).toHaveLength(3); const result = buildSitesMenuPresentation(built, design); expect(result?.kind === "dynamic" ? result.content.rows.length : 0).toBe(12);
 });
 it("turns category headings off without dropping products or their order", () => {
  const built = buildSitesMenuDocument(document, [product(1), product(2, "Snacks")], design, false, []);
  expect(built.sitesConfiguration?.showCategories).toBe(false); expect(built.pages[0]!.blocks).toHaveLength(1); expect(built.pages[0]!.blocks[0]).toMatchObject({ headingVisible: false }); expect(sitesMenuProductIds(built)).toHaveLength(2);
 });
 it("refuses duplicate and over-cap selections", () => {
  expect(() => buildSitesMenuDocument(document, [product(1), product(1)], design, true, [])).toThrow();
  expect(() => buildSitesMenuDocument(document, Array.from({ length: 101 }, (_, index) => product(index)), design, true, [])).toThrow();
 });
 it("only adds a verified actual tenant background to the asset manifest", () => {
  const media: MenuStudioMediaOption = { id: "30000000-0000-4000-8000-000000000001", assetVersion: "original-v1", kind: "image", mimeType: "image/png", name: "Clubfoto", sha256: "a".repeat(64), tintable: false, url: "https://example.invalid/actual-signed-asset" };
  const withPhoto = { ...design, background: { kind: "tenant" as const, mediaAssetId: media.id, checksumSha256: media.sha256 } };
  expect(buildSitesMenuDocument(document, [product(1)], withPhoto, true, [media]).assets).toEqual([{ assetId: media.id, assetVersion: media.assetVersion, kind: "image", status: "ready" }]);
  expect(() => buildSitesMenuDocument(document, [product(1)], withPhoto, true, [])).toThrow();
  expect(() => buildSitesMenuDocument(document, [product(1)], { ...withPhoto, background: { ...withPhoto.background, checksumSha256: "b".repeat(64) } }, true, [media])).toThrow();
 });
});
