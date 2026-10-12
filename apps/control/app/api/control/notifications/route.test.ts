import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ session: vi.fn(), client: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn() }));
vi.mock("../../../../lib/control-session", () => ({ getControlSession: f.session }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: f.client }));
import { GET } from "./route";

const tenantA = "19170000-0000-4000-8000-000000000010", tenantB = "19170000-0000-4000-8000-000000000011";
const actor = "19170000-0000-4000-8000-000000000001";
const session = { isLive: true, userId: actor, tenantId: tenantA, tenantStatus: "active", capabilities: ["tenant.audit.read"] };
beforeEach(() => {
  vi.resetAllMocks();
  f.session.mockResolvedValue(session);
  const query = { select: f.select, eq: f.eq, order: f.order, limit: f.limit };
  f.client.mockResolvedValue({ from: f.from }); f.from.mockReturnValue(query); f.select.mockReturnValue(query); f.eq.mockReturnValue(query); f.order.mockReturnValue(query); f.limit.mockResolvedValue({ data: [], error: null });
});
describe("Meldingen gebruiken de echte actor/context/capability en beperkte RLS-query", () => {
  it("weigert ontbrekende actor en demosessie vóór elke databasequery", async () => {
    for (const value of [null, { ...session, isLive: false }, { ...session, userId: "" }]) { f.session.mockResolvedValue(value); expect((await GET()).status).toBe(401); }
    expect(f.client).not.toHaveBeenCalled(); expect(f.from).not.toHaveBeenCalled();
  });
  it("weigert zonder leesrecht, actieve tenant of context vóór databasequery", async () => {
    for (const value of [{ ...session, capabilities: [] }, { ...session, tenantId: null }, { ...session, tenantStatus: "paused" }, { ...session, tenantStatus: "archived" }]) { f.session.mockResolvedValue(value); expect((await GET()).status).toBe(403); }
    expect(f.client).not.toHaveBeenCalled();
  });
  it("bindt actor A en B uitsluitend aan hun actieve tenant en houdt RLS/sessionclient", async () => {
    for (const tenantId of [tenantA, tenantB]) { f.session.mockResolvedValue({ ...session, tenantId, userId: tenantId === tenantA ? actor : "19170000-0000-4000-8000-000000000002" }); const response = await GET(); expect(await response.json()).toEqual({ tenantId, notifications: [] }); expect(f.eq).toHaveBeenLastCalledWith("tenant_id", tenantId); }
    expect(f.from).toHaveBeenCalledWith("audit_events"); expect(f.select).toHaveBeenCalledWith("id, action, result, created_at"); expect(f.limit).toHaveBeenCalledWith(20); expect(f.order).toHaveBeenCalledWith("created_at", { ascending: false }); expect(f.order).toHaveBeenCalledWith("id", { ascending: false });
  });
  it("verwijdert metadata/actoridentiteit en begrenst ook onverwacht te grote queryresultaten", async () => {
    f.limit.mockResolvedValue({ error: null, data: Array.from({ length: 25 }, (_, index) => ({ id: `19170000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`, action: "playlist.release.published", result: "success", created_at: "2026-10-11T10:00:00.000Z", actor_user_id: actor, metadata: { secret: "DO_NOT_DISPLAY", member: "PRIVATE_MEMBER" } })) });
    const response = await GET(), payload = await response.json(); expect(payload.notifications).toHaveLength(20); expect(payload.notifications[0]).toEqual({ id: "19170000-0000-4000-8000-000000000100", title: "Playlist gepubliceerd", result: "success", createdAt: "2026-10-11T10:00:00.000Z", href: "/dashboard/activity" }); expect(JSON.stringify(payload)).not.toMatch(/DO_NOT_DISPLAY|PRIVATE_MEMBER|metadata|actor_user_id/); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("vary")).toBe("Cookie");
  });
  it("toont denied/failed nooit als een geslaagde publicatie en onbekende acties nooit letterlijk", async () => {
    f.limit.mockResolvedValue({ error: null, data: ["denied", "failed", "success"].map(result => ({ id: actor, action: "raw_error_token_member@example.test", result, created_at: "2026-10-11T10:00:00Z" })) });
    const payload = await (await GET()).json(); expect(payload.notifications.map((row: { title: string }) => row.title)).toEqual(["Actie geweigerd", "Actie mislukt", "Activiteit vastgelegd"]); expect(JSON.stringify(payload)).not.toContain("member@example.test");
  });
  it("houdt fouten veilig en onderscheidt databasefalen van een lege echte lijst", async () => {
    f.limit.mockResolvedValue({ data: null, error: { message: "secret=DO_NOT_DISPLAY stack PRIVATE_MEMBER", code: "XX001" } }); const response = await GET(); expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "NOTIFICATIONS_UNAVAILABLE" });
    f.session.mockRejectedValue(new Error("AUTH_SECRET")); expect(await (await GET()).json()).toEqual({ error: "NOTIFICATIONS_UNAVAILABLE" });
  });
});
