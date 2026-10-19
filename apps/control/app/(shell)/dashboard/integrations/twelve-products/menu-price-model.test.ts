import { describe, expect, it } from "vitest";
import { menuPriceCandidatesSchema, menuPriceImpactSchema, prepareMenuPriceCandidatesSchema, publishMenuPriceCandidatesSchema } from "./menu-price-model";
const id = (n: number) => `a2610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const selection = { slideId: id(1), basisVersionId: id(2), expectedRevision: 7 };
const prepare = { reviewHash: "a".repeat(64), selections: [selection], idempotencyKey: id(3) };
describe("reviewed menu price commands", () => {
  it("carries the selected basis, CAS and original key without accepting price data", () => {
    expect(prepareMenuPriceCandidatesSchema.parse(prepare)).toEqual(prepare);
    for (const extra of [{ prices: { [id(8)]: 1 } }, { menuPriceSet: {} }, { tenantId: id(9) }, { publish: true }])
      expect(prepareMenuPriceCandidatesSchema.safeParse({ ...prepare, ...extra }).success).toBe(false);
  });
  it("requires an explicit nonempty selection and bounds raw input before deduplication", () => {
    expect(prepareMenuPriceCandidatesSchema.safeParse({ ...prepare, selections: [] }).success).toBe(false);
    expect(prepareMenuPriceCandidatesSchema.safeParse({ ...prepare, selections: Array.from({ length: 26 }, () => selection) }).success).toBe(false);
    expect(prepareMenuPriceCandidatesSchema.safeParse({ ...prepare, selections: [selection, { ...selection, slideId: selection.slideId.toUpperCase() }] }).success).toBe(false);
  });
  it("does not turn malformed identifiers, hashes or fractional revisions into another target", () => {
    for (const selections of [[{ ...selection, slideId: "foreign" }], [{ ...selection, expectedRevision: 0.5 }], [{ ...selection, basisVersionId: null }]])
      expect(prepareMenuPriceCandidatesSchema.safeParse({ ...prepare, selections }).success).toBe(false);
    expect(prepareMenuPriceCandidatesSchema.safeParse({ ...prepare, reviewHash: "new prices" }).success).toBe(false);
  });
  it("publishes only the exact prepared versions with a separate original command key", () => {
    const publish = { captureActorId: id(4), captureKey: id(3), candidates: [{ slideId: id(1), versionId: id(5), expectedRevision: 8 }], idempotencyKey: id(6) };
    expect(publishMenuPriceCandidatesSchema.parse(publish)).toEqual(publish);
    expect(publishMenuPriceCandidatesSchema.safeParse({ ...publish, candidates: [] }).success).toBe(false);
    expect(publishMenuPriceCandidatesSchema.safeParse({ ...publish, prices: [1] }).success).toBe(false);
    expect(publishMenuPriceCandidatesSchema.safeParse({ ...publish, candidates: [...publish.candidates, ...publish.candidates] }).success).toBe(false);
  });
  it("never labels a truncated or unsigned catalogue check ready", () => {
    const impact = { status: "ready", complete: true, reviewHash: "a".repeat(64), totalProducts: 75, changedProducts: 51, affectedMenus: 2, affectedPlacements: 3, affectedPlaylists: 1, desiredScreens: 1, confirmedScreens: 0, unknownScreens: 1, reviewRequiredProducts: 1, offset: 0, limit: 20, hasMore: true, rows: [], menus: [], error: null };
    expect(menuPriceImpactSchema.parse(impact)).toEqual(impact);
    expect(menuPriceImpactSchema.safeParse({ ...impact, complete: false }).success).toBe(false);
    expect(menuPriceImpactSchema.safeParse({ ...impact, reviewHash: null }).success).toBe(false);
    expect(menuPriceImpactSchema.safeParse({ ...impact, status: ["ready"], complete: false, reviewHash: null }).success).toBe(false);
  });
  it("keeps render readiness distinct from receipt/draft state and screen confirmation", () => {
    const candidate = { slideId: id(1), versionId: id(2), editRevision: 7, name: "Clubmenu", editor: "sync", priceSetHash: "b".repeat(64), state: "draft", snapshotId: null, jobId: null, playlists: [] };
    const result = { captureActorId: id(4), captureKey: id(3), candidates: [candidate] };
    expect(menuPriceCandidatesSchema.parse(result)).toEqual(result);
    expect(menuPriceCandidatesSchema.safeParse({ ...result, candidates: [{ ...candidate, state: "ready" }] }).success).toBe(false);
    expect(menuPriceCandidatesSchema.safeParse({ ...result, tvActive: true }).success).toBe(false);
    expect(menuPriceCandidatesSchema.safeParse({ ...result, candidates: [{ ...candidate, editor: ["sync"] }] }).success).toBe(false);
    expect(menuPriceCandidatesSchema.safeParse({ ...result, candidates: [{ ...candidate, state: ["draft"] }] }).success).toBe(false);
  });
});
