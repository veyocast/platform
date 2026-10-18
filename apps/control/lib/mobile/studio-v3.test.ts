import {beforeEach, describe, expect, it, vi} from "vitest";
import {createSyncStudioStarter} from "@veyocast/studio";
import type {MobileRequestContext, MobileTenantContext} from "../mobile-api/context";

vi.mock("server-only", () => ({}));
vi.mock("../sites-authoring-state", () => ({loadSitesAuthoringState: async () => ({paused: false}), sitesAuthoringPausedMessage: "Gepauzeerd"}));
import {loadMobileStudioV3, mutateMobileStudioV3} from "./studio-v3";

const tenantId = "19170000-0000-4000-8000-000000000010", id = "19170000-0000-4000-8000-000000000901", nextId = "19170000-0000-4000-8000-000000000902";
const document = createSyncStudioStarter({family: "club-story", tenantName: "Eigen club"});
const tenant: MobileTenantContext = {id: tenantId, name: "Eigen club", slug: "eigen-club", role: "tenant_admin", roleLabel: "Beheerder", status: "active", capabilities: ["tenant.studio.read", "tenant.studio.create", "tenant.studio.edit_all", "tenant.studio.render", "tenant.studio.archive"]};
let rows: Record<string, unknown>;
let filters: Array<{table: string; field: string; value: unknown}>;
let active: boolean;
const rpc = vi.fn(), sign = vi.fn(async (path: string) => ({data: {signedUrl: `https://private.invalid/${path}`}, error: null}));
function client() {
  return {rpc, storage: {from: () => ({createSignedUrl: sign})}, from(table: string) {
    let activeOnly = false;
    const result = () => ({error: null, data: table === "studio_projects" && activeOnly && !active ? null : rows[table] ?? [], count: 1});
    const q = {select: () => q, eq: (field: string, value: unknown) => {filters.push({table, field, value}); activeOnly ||= field === "status" && value === "active"; return q;}, not: () => q, is: () => q, in: () => q, order: () => q, range: () => q, limit: () => q, maybeSingle: async () => {const r = result(); return {...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data};}, then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve)};
    return q;
  }};
}
const context = (c = client(), assuranceLevel = "aal2") => ({supabase: c, assuranceLevel, requestId: id} as unknown as MobileRequestContext);
beforeEach(() => {active = true; filters = []; rows = {studio_projects: [{id, name: "Eigen ontwerp"}]}; rpc.mockReset(); sign.mockClear();});
describe("native Sync tenant writer and verified readback", () => {
  it("rejects AAL1 and missing create rights before a writer is called", async () => {
    const input = {operation: "create" as const, document, idempotencyKey: id};
    await expect(mutateMobileStudioV3(context(undefined, "aal1"), tenant, input)).rejects.toThrow("tweestaps");
    await expect(mutateMobileStudioV3(context(), {...tenant, capabilities: []}, input)).rejects.toThrow("geen rechten");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("forwards the complete original save body, revision and command key", async () => {
    rpc.mockResolvedValue({data: {outcome: "saved", draftRevision: 5}, error: null});
    const result = await mutateMobileStudioV3(context(), tenant, {operation: "save", projectId: id, expectedDraftRevision: 4, document, idempotencyKey: nextId});
    expect(result).toMatchObject({outcome: "saved", draftRevision: 5});
    expect(rpc).toHaveBeenCalledWith("save_studio_draft_v1", expect.objectContaining({p_project_id: id, p_expected_revision: 4, p_document: document, p_idempotency_key: nextId}));
    expect(filters).toContainEqual({table: "studio_projects", field: "tenant_id", value: tenantId});
  });
  it("replays an acknowledged removal after its project is archived", async () => {
    rpc.mockResolvedValue({data: {outcome: "applied", seriesId: nextId, revision: 2, projectIds: [nextId], nextProjectId: nextId}, error: null});
    const input = {operation: "series" as const, projectId: id, draftRevision: 0, seriesId: nextId, seriesRevision: 1, action: "remove" as const, name: null, memberIds: null, idempotencyKey: id};
    const first = await mutateMobileStudioV3(context(), tenant, input);
    active = false; // The first HTTP result may be lost after the SQL commit.
    const replay = await mutateMobileStudioV3(context(), tenant, input);
    expect(replay).toEqual(first);
    expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0]);
    expect(filters.some(filter => filter.field === "status")).toBe(false);
  });
  it.each(["40001", "PT409"])("reports a receipt-checked %s series CAS conflict without claiming application", async code => {
    rpc.mockResolvedValue({data: null, error: {code}});
    const result = await mutateMobileStudioV3(context(), tenant, {operation: "series", projectId: id, draftRevision: 1, seriesId: nextId, seriesRevision: 2, action: "rename", name: "Nieuwe reeksnaam", memberIds: null, idempotencyKey: id});
    expect(result).toMatchObject({outcome: "conflict", projectId: id, series: null, renderJobId: null});
  });
  it("recovers a stale render rejected before CAS by a concurrent motion edit", async () => {
    rows.studio_project_drafts = [{draft_revision: 2}];
    rpc.mockResolvedValue({data: null, error: {code: "23514"}});
    const command = {operation: "render" as const, projectId: id, expectedDraftRevision: 1, outputKind: "png" as const, idempotencyKey: nextId};
    await expect(mutateMobileStudioV3(context(), tenant, command)).resolves.toMatchObject({outcome: "conflict", draftRevision: 2, renderJobId: null});
    expect(filters).toContainEqual({table: "studio_project_drafts", field: "tenant_id", value: tenantId});
    rows.studio_project_drafts = [{draft_revision: 1}];
    await expect(mutateMobileStudioV3(context(), tenant, command)).rejects.toThrow("UNCONFIRMED");
    rows.studio_project_drafts = [{draft_revision: 2}];
    rpc.mockResolvedValue({data: null, error: {code: "PGRST000"}});
    await expect(mutateMobileStudioV3(context(), tenant, command)).rejects.toThrow("UNCONFIRMED");
  });
  it("verifies the actual MP4 checksum and uses its thumbnail poster", async () => {
    const sha = "a".repeat(64), assetId = nextId, base = `tenants/${tenantId}/assets/${assetId}/variants/`;
    rows = {studio_project_drafts: [{project_id: id, draft_revision: 3, document_json: document, studio_projects: {id, name: "Eigen ontwerp"}}], studio_series_items: [], studio_render_jobs: [{id, status: "completed", revision_id: id, media_asset_id: assetId, output_kind: "mp4"}], studio_revisions: [{draft_revision: 3}], studio_exports: [{checksum_sha256: sha}], media_assets: [{id: assetId}], media_variants: [{variant_type: "player_1080p", storage_bucket: "tenant-media", storage_path: base + "player-1080p.mp4", checksum_sha256: sha, file_size_bytes: 12000}, {variant_type: "thumbnail", storage_bucket: "tenant-media", storage_path: base + "studio-poster.png", checksum_sha256: "b".repeat(64), file_size_bytes: 4000}]};
    const workspace = await loadMobileStudioV3(context(), tenant, id);
    expect(workspace.projects[0]).toMatchObject({renderStatus: "completed", mediaAssetId: assetId, previewUrl: `https://private.invalid/${base}studio-poster.png`});
    expect(sign).toHaveBeenCalledWith(base + "studio-poster.png", 600);
    (rows.studio_exports as Array<{checksum_sha256: string}>)[0]!.checksum_sha256 = "c".repeat(64);
    sign.mockClear();
    const corrupt = await loadMobileStudioV3(context(), tenant, id);
    expect(corrupt.projects[0]).toMatchObject({renderStatus: "rendering", mediaAssetId: null, previewUrl: null});
    expect(sign).not.toHaveBeenCalled();
  });
});
