import type * as Integrations from "@veyocast/integrations";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ capability: vi.fn(), rpc: vi.fn(), flag: vi.fn(), existing: vi.fn(), video: vi.fn(), playlist: vi.fn(), register: vi.fn(), revalidate: vi.fn() }));
vi.mock("../../../../../lib/control-session", () => ({ requireTenantCapability: f.capability }));
vi.mock("../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ rpc: f.rpc, from: (table: string) => { const query = { select: () => query, eq: () => query, maybeSingle: () => table === "tenant_feature_flags" ? f.flag() : f.existing() }; return query; } }) }));
vi.mock("../../data-sources/sportlink/sites-source-provider-proof", () => ({ registerSitesSourceProviderProof: f.register }));
vi.mock("../../../../../lib/supabase/youtube-provider-validation", () => ({ registerYouTubePlaylistValidation: f.register }));
vi.mock("@veyocast/integrations", async importOriginal => ({ ...await importOriginal<typeof Integrations>(), fetchYouTubeMetadata: f.video, fetchYouTubePlaylistMetadata: f.playlist }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
import { manageYouTubeSource, saveYouTubeSource, validateYouTubeSelection } from "./actions";
const tenant = "a1910000-0000-4000-8000-000000007001", actor = "a1910000-0000-4000-8000-000000007002", proof = "a1910000-0000-4000-8000-000000007003", asset = "a1910000-0000-4000-8000-000000007004", source = "a1910000-0000-4000-8000-000000007005", command = "a1910000-0000-4000-8000-000000007006";
function form(values: Record<string, string>) { const result = new FormData(); for (const [key, value] of Object.entries(values)) result.set(key, value); return result; }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("YOUTUBE_DATA_API_KEY", "unit-provider-key"); f.capability.mockResolvedValue({ tenantId: tenant, userId: actor }); f.flag.mockResolvedValue({ data: { enabled: true }, error: null }); f.register.mockResolvedValue(proof); f.rpc.mockResolvedValue({ data: { outcome: "saved" }, error: null }); });
afterEach(() => vi.unstubAllEnvs());
describe("YouTube bronwizard gebruikt servercontrole en tenantgebonden opslag", () => {
  it("controleert beheerrechten en featureactivatie vóór providerverkeer", async () => {
    f.flag.mockResolvedValue({ data: { enabled: false }, error: null });
    expect(await validateYouTubeSelection({ kind: "playlist", url: "https://youtube.com/playlist?list=PLabcdefghijkl", name: "Clubfilms" })).toEqual({ ok: false, code: "niet-geactiveerd" });
    expect(f.capability).toHaveBeenCalledWith("tenant.data_source.manage"); expect(f.playlist).not.toHaveBeenCalled(); expect(f.register).not.toHaveBeenCalled();
  });
  it("behoudt werkelijk beschikbare volgorde en aantallen en bindt de proof aan de huidige actor", async () => {
    const metadata = { playlistId: "PLabcdefghijkl", title: "Providerfilms", channelTitle: "Clubkanaal", videoIds: ["abcdefghijk", "lmnopqrstuv", "abcdefghijk"], unavailableItems: 2, providerItemCount: 5 };
    f.playlist.mockResolvedValue(metadata);
    expect(await validateYouTubeSelection({ kind: "playlist", url: "https://youtube.com/playlist?list=PLabcdefghijkl", name: "Onze clubfilms" })).toMatchObject({ ok: true, validationId: proof, videoCount: 3, unavailableItems: 2, providerItemCount: 5, providerTitle: "Providerfilms" });
    expect(f.register).toHaveBeenCalledWith(tenant, actor, { ...metadata, title: "Onze clubfilms" });
  });
  it("weigert niet-insluitbare video zonder opslaan of providerproof", async () => {
    f.video.mockResolvedValue({ videoId: "abcdefghijk", title: "Video", channelTitle: "Club", embeddable: false, privacyStatus: "public" });
    expect(await validateYouTubeSelection({ kind: "video", url: "https://youtu.be/abcdefghijk", name: "Clubfilm" })).toEqual({ ok: false, code: "niet-insluitbaar" }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("slaagt uitsluitend via actuele proof, gewenste revisie en echte back-upasset", async () => {
    const values = { kind: "playlist", validationId: proof, expectedRevision: "0", fallbackMediaAssetId: asset, repeat: "true", idempotencyKey: command };
    await expect(saveYouTubeSource(form(values))).rejects.toThrow("succes=bron-opgeslagen");
    expect(f.rpc).toHaveBeenCalledWith("save_youtube_playlist_source_v1", { p_tenant_id: tenant, p_source_id: null, p_expected_revision: 0, p_validation_id: proof, p_fallback_media_asset_id: asset, p_repeat: true, p_idempotency_key: command });
    expect(f.playlist).not.toHaveBeenCalled();
  });
  it("meldt CAS-conflict zonder opgeslagen-status en zonder pagina ongeldig te maken", async () => {
    f.rpc.mockResolvedValue({ data: { outcome: "conflict", actualRevision: 8 }, error: null });
    await expect(saveYouTubeSource(form({ kind: "playlist", validationId: proof, expectedRevision: "7", fallbackMediaAssetId: asset }))).rejects.toThrow("fout=conflict"); expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("weigert een bron buiten de tenant vóór het save-RPC", async () => {
    f.existing.mockResolvedValue({ data: null, error: null });
    await expect(saveYouTubeSource(form({ sourceId: source, kind: "playlist", validationId: proof, expectedRevision: "7", fallbackMediaAssetId: asset }))).rejects.toThrow("fout=bron"); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("pauzeren en verwijderen gebruiken de bestaande revisie en bewaren frozen-publications contract", async () => {
    f.rpc.mockResolvedValue({ data: { outcome: "archived", frozenPublicationsPreserved: true }, error: null });
    await expect(manageYouTubeSource(form({ sourceId: source, expectedRevision: "7", action: "delete", idempotencyKey: command }))).rejects.toThrow("succes=archived");
    expect(f.rpc).toHaveBeenCalledWith("manage_youtube_source_v1", { p_tenant_id: tenant, p_source_id: source, p_expected_revision: 7, p_action: "delete", p_idempotency_key: command });
  });
});
