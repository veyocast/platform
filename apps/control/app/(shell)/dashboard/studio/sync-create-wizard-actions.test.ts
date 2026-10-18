import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSyncStudioStarter } from "@veyocast/studio";
import { syncDynamicConfigurationSchema, type SyncDynamicRequest } from "@veyocast/contracts";

const mocks = vi.hoisted(() => ({ session: vi.fn(), client: vi.fn(), manual: vi.fn(), dynamic: vi.fn(), preview: vi.fn(), options: vi.fn() }));
vi.mock("../../../../lib/control-session", () => ({ requireTenantControlSession: mocks.session }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: mocks.client }));
vi.mock("./sync-studio-actions", () => ({ createSyncStudioProjectAction: mocks.manual }));
vi.mock("../slides/sync-dynamic-actions", () => ({ mutateSyncDynamicAuthoringAction: mocks.dynamic, previewSyncDynamicAuthoringAction: mocks.preview }));
vi.mock("../slides/sync-sportlink-data", () => ({ loadSyncSportlinkOptions: mocks.options }));
import { createSyncDesignWizardAction, loadSyncWizardSportlinkOptionsAction, previewSyncWizardAction, resolveSyncCreationReceiptAction } from "./sync-create-wizard-actions";
import type { SyncCreateWizardCommand } from "./sync-create-wizard-types";

const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenant = id(1), actor = id(2), scope = `${tenant}:${actor}`, project = id(3);
const session = () => ({ isLive: true, tenantId: tenant, userId: actor, tenantStatus: "active", capabilities: ["tenant.studio.create", "tenant.dynamic_slide.write"] });
const manual = (): SyncCreateWizardCommand => ({ kind: "manual", document: createSyncStudioStarter({ family: "welcome", tenantName: "Eigen club" }), idempotencyKey: id(4) });
const request = (): SyncDynamicRequest => ({ templateVersionId: id(5), dataSourceId: id(6), configuration: { maxItems: 200, syncConfiguration: syncDynamicConfigurationSchema.parse({ schemaVersion: 1, kind: "dynamic", rendererVersion: "sync-v1", sourceRevision: createSyncStudioStarter({ family: "menu", tenantName: "Eigen club" }).syncPresentation!.sourceRevision, slideType: "menu", secondsPerPage: 12, seed: createSyncStudioStarter({ family: "menu", tenantName: "Eigen club" }).syncPresentation }) } });
const connected = (): SyncCreateWizardCommand => ({ kind: "connected", command: { action: "create", slideId: null, versionId: null, expectedRevision: 0, request: request(), idempotencyKey: id(7) } });

beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue(session()); mocks.manual.mockResolvedValue({ ok: true, projectId: project }); mocks.dynamic.mockResolvedValue({ ok: true, slideId: project }); mocks.client.mockResolvedValue({ owned: true }); mocks.options.mockResolvedValue({ sourceId: id(6), teams: [] }); mocks.preview.mockResolvedValue({ ok: true, presentation: {} });
});

describe("fresh wizard writer scope and exact original command", () => {
  it.each(["", `${tenant}:${id(9)}`, `${id(9)}:${actor}`])("rejects changed or missing scope before either writer: %s", async changed => {
    expect(await createSyncDesignWizardAction(manual(), changed)).toMatchObject({ ok: false, rejected: true });
    expect(mocks.manual).not.toHaveBeenCalled(); expect(mocks.dynamic).not.toHaveBeenCalled(); expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([{ tenantStatus: "paused" }, { userId: null }, { isLive: false }, { capabilities: [] }])("denies inactive/missing actor/role %j", async override => {
    mocks.session.mockResolvedValue({ ...session(), ...override }); expect(await createSyncDesignWizardAction(manual(), scope)).toMatchObject({ ok: false, rejected: true }); expect(mocks.manual).not.toHaveBeenCalled();
  });
  it("uses the existing manual receipt command and a verified internal destination", async () => {
    const input = manual(); expect(await createSyncDesignWizardAction(input, scope)).toEqual({ ok: true, href: `/dashboard/studio/${project}` }); if (input.kind !== "manual") throw Error("manual"); expect(mocks.manual).toHaveBeenCalledExactlyOnceWith({ document: input.document, idempotencyKey: input.idempotencyKey }); expect(mocks.dynamic).not.toHaveBeenCalled();
  });
  it("keeps a lost manual result unknown, then repeats exactly the original document/nonce", async () => {
    const input = manual(); mocks.manual.mockRejectedValueOnce(Error("response lost")); const first = await createSyncDesignWizardAction(input, scope); expect(first).toMatchObject({ ok: false }); expect(first).not.toHaveProperty("rejected", true); expect(await createSyncDesignWizardAction(input, scope)).toMatchObject({ ok: true }); expect(mocks.manual.mock.calls[1]).toEqual(mocks.manual.mock.calls[0]);
  });
  it("creates a connected design directly without creating a manual project", async () => {
    const input = connected(); expect(await createSyncDesignWizardAction(input, scope)).toEqual({ ok: true, href: `/dashboard/slides/${project}` }); if (input.kind !== "connected") throw Error("connected"); expect(mocks.dynamic).toHaveBeenCalledExactlyOnceWith(input.command); expect(mocks.manual).not.toHaveBeenCalled();
  });
  it("keeps a lost connected result unknown and replays the same canonical command", async () => {
    const input = connected(); mocks.dynamic.mockRejectedValueOnce(Error("response lost")); const first = await createSyncDesignWizardAction(input, scope); expect(first).not.toHaveProperty("rejected", true); expect(await createSyncDesignWizardAction(input, scope)).toMatchObject({ ok: true }); expect(mocks.dynamic.mock.calls[1]).toEqual(mocks.dynamic.mock.calls[0]);
  });
  it("rejects extra fields or existing-resource commands before mutation", async () => {
    const input = connected(); if (input.kind !== "connected") throw Error("connected"); expect(await createSyncDesignWizardAction({ ...input, command: { ...input.command, action: "save", slideId: project, versionId: id(8), expectedRevision: 1 } }, scope)).toMatchObject({ ok: false, rejected: true }); expect(await createSyncDesignWizardAction({ ...manual(), extra: true } as unknown as SyncCreateWizardCommand, scope)).toMatchObject({ ok: false, rejected: true }); expect(mocks.dynamic).not.toHaveBeenCalled(); expect(mocks.manual).not.toHaveBeenCalled();
  });
  it("retains an uncertain receipt instead of accepting a foreign navigation target", async () => {
    mocks.manual.mockResolvedValue({ ok: true, projectId: "https://other.invalid/" }); expect(await createSyncDesignWizardAction(manual(), scope)).toMatchObject({ ok: false }); expect(await createSyncDesignWizardAction(manual(), scope)).not.toHaveProperty("rejected", true);
  });
});

describe("read-only binding and preview scope", () => {
  it("rejects an actor switch before source client or preview service", async () => {
    expect(await loadSyncWizardSportlinkOptionsAction({ sourceId: id(6) }, `${tenant}:${id(9)}`)).toMatchObject({ ok: false }); expect(await previewSyncWizardAction(request(), `${tenant}:${id(9)}`)).toMatchObject({ ok: false }); expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.options).not.toHaveBeenCalled(); expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("uses only the fresh tenant for canonical source options and requires write capability", async () => {
    expect(await loadSyncWizardSportlinkOptionsAction({ sourceId: id(6) }, scope)).toMatchObject({ ok: true }); expect(mocks.session).toHaveBeenCalledWith("tenant.dynamic_slide.write"); expect(mocks.options).toHaveBeenCalledWith({ owned: true }, tenant, id(6));
  });
  it("preserves the authoritative read-only preview result", async () => {
    const input = request(); expect(await previewSyncWizardAction(input, scope)).toEqual({ ok: true, presentation: {} }); expect(mocks.preview).toHaveBeenCalledExactlyOnceWith(input); expect(mocks.manual).not.toHaveBeenCalled(); expect(mocks.dynamic).not.toHaveBeenCalled();
  });
});

describe("legacy receipt inspection never re-executes an unbound command", () => {
  function receiptQuery(data: unknown, error: unknown = null) {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    const from = vi.fn().mockReturnValue(query); mocks.client.mockResolvedValue({ from }); return { query, from };
  }
  it("denies a changed actor before any receipt read", async () => {
    expect(await resolveSyncCreationReceiptAction({ idempotencyKey: id(4) }, `${tenant}:${id(9)}`)).toMatchObject({ ok: false }); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("reads only this tenant/actor/nonce and validates the committed target", async () => {
    const { query, from } = receiptQuery({ command_type: "studio.project.create", target_type: "studio_projects", target_id: project, outcome_json: { outcome: "created", projectId: project } });
    expect(await resolveSyncCreationReceiptAction({ idempotencyKey: id(4) }, scope)).toEqual({ ok: true, href: `/dashboard/studio/${project}` }); expect(from).toHaveBeenCalledExactlyOnceWith("studio_command_receipts"); expect(query.eq.mock.calls).toEqual([["tenant_id", tenant], ["actor_user_id", actor], ["idempotency_key", id(4)]]); expect(mocks.manual).not.toHaveBeenCalled(); expect(mocks.dynamic).not.toHaveBeenCalled();
  });
  it("does not create anything when the current actor has no receipt", async () => {
    receiptQuery(null); expect(await resolveSyncCreationReceiptAction({ idempotencyKey: id(4) }, scope)).toEqual({ ok: true, href: null }); expect(mocks.manual).not.toHaveBeenCalled(); expect(mocks.dynamic).not.toHaveBeenCalled();
  });
  it.each([{ command_type: "other", target_type: "studio_projects", target_id: project, outcome_json: { outcome: "created", projectId: project } }, { command_type: "studio.project.create", target_type: "studio_projects", target_id: project, outcome_json: { outcome: "created", projectId: id(8) } }])("refuses an incomplete or different receipt %j", async data => {
    receiptQuery(data); expect(await resolveSyncCreationReceiptAction({ idempotencyKey: id(4) }, scope)).toMatchObject({ ok: false }); expect(mocks.manual).not.toHaveBeenCalled(); expect(mocks.dynamic).not.toHaveBeenCalled();
  });
});
