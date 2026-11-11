import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MenuDocumentV2 } from "@veyocast/contracts";
const f = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn(), eq: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("../../../../../lib/control-session", () => ({ requireTenantControlSession: f.session }));
vi.mock("../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ rpc: f.rpc, from: () => { const query = { select: () => query, eq: (key: string, value: unknown) => { f.eq(key, value); return query; }, neq: () => query, maybeSingle: f.read }; return query; } }) }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
import { publishMenuStudio, saveMenuStudioCommand } from "./actions";
const tenant = "a1910000-0000-4000-8000-000000007901", slide = "a1910000-0000-4000-8000-000000007902", snapshot = "a1910000-0000-4000-8000-000000007903", version = "a1910000-0000-4000-8000-000000007904";
const document: MenuDocumentV2 = { schemaVersion: "menu-document.v2", id: "menu", tenantId: tenant, revision: 5, title: "Menu", createdAt: "2026-10-11T12:00:00.000Z", updatedAt: "2026-10-11T12:00:00.000Z", assets: [], pages: [{ id: "page", order: 0, blocks: [] }], theme: { themeId: "editorial", themeVersion: "1.0.0", mode: "light", brand: { accent: "#FF5C20" } } };
beforeEach(() => { vi.resetAllMocks(); f.session.mockResolvedValue({ isLive: true, tenantId: tenant }); f.read.mockResolvedValue({ data: { active_draft_version_id: null, status: "ready", current_snapshot_id: snapshot, configuration_json: document }, error: null }); });
describe("Menu-bestemming bevestigt een verloren publicatieresponse via werkelijk opgeslagen versie", () => {
  it("herkent dezelfde gereedstaande revision als toegepast zonder een nieuwe mutatie", async () => {
    expect(await publishMenuStudio({ slideId: slide, expectedRevision: 5 })).toEqual({ ok: true, outcome: "already_applied", revision: 5, snapshotId: snapshot }); expect(f.eq).toHaveBeenCalledWith("tenant_id", tenant); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("accepteert geen gewijzigd of ongeldig document en geen onafgewerkt renderresultaat", async () => {
    for (const overrides of [{ status: "render_pending" }, { configuration_json: { ...document, revision: 6 } }, { configuration_json: {} }, { current_snapshot_id: null }]) {
      f.read.mockResolvedValue({ data: { active_draft_version_id: null, status: "ready", current_snapshot_id: snapshot, configuration_json: document, ...overrides }, error: null }); expect(await publishMenuStudio({ slideId: slide, expectedRevision: 5 })).toMatchObject({ ok: false });
    }
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("publiceert een werkelijk aanwezig concept uitsluitend met de oorspronkelijke CAS-revisie", async () => {
    f.read.mockResolvedValue({ data: { active_draft_version_id: version }, error: null }); f.rpc.mockResolvedValue({ data: { outcome: "applied", versionId: version, snapshotId: snapshot }, error: null });
    expect(await publishMenuStudio({ slideId: slide, expectedRevision: 5 })).toMatchObject({ ok: true, outcome: "applied", snapshotId: snapshot }); expect(f.rpc).toHaveBeenCalledExactlyOnceWith("publish_dynamic_slide_version_v1", { p_expected_revision: 5, p_slide_id: slide, p_version_id: version });
  });
});

describe("Menu-opslag herkent een bevestigde eerdere operatie", () => {
  const operation = { kind: "set-title" as const, title: "Kantine" };
  const command = { operationId: "a1910000-0000-4000-8000-000000007905", baseRevision: 4, operation };
  it("bevestigt dezelfde operatie na een verloren response zonder opnieuw opslaan", async () => {
    f.read.mockResolvedValueOnce({ data: { configuration_json: document }, error: null });
    f.read.mockResolvedValueOnce({ data: { base_revision: 4, next_revision: 5, command_json: operation }, error: null });
    expect(await saveMenuStudioCommand({ slideId: slide, command })).toMatchObject({ ok: true, outcome: "already_applied", revision: 5, document });
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.eq).toHaveBeenCalledWith("operation_id", command.operationId);
  });
  it("overschrijft geen nieuwere gegevens en hergebruikt geen sleutel voor andere invoer", async () => {
    for (const receipt of [
      { base_revision: 4, next_revision: 4, command_json: operation },
      { base_revision: 4, next_revision: 5, command_json: { ...operation, title: "Anders" } }
    ]) {
      f.read.mockResolvedValueOnce({ data: { configuration_json: document }, error: null });
      f.read.mockResolvedValueOnce({ data: receipt, error: null });
      expect(await saveMenuStudioCommand({ slideId: slide, command })).toMatchObject({ ok: false });
    }
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
