import {beforeEach, describe, expect, it, vi} from "vitest";
vi.mock("server-only", () => ({}));
const f = vi.hoisted(() => ({token: "native-test-session-token", user: vi.fn(), assurance: vi.fn()}));
vi.mock("../supabase/config", () => ({getSupabasePublicConfig: () => ({url: "https://native-test.invalid", anonKey: "public-test-key"})}));
vi.mock("@supabase/supabase-js", () => ({createClient: () => ({
  auth: {getUser: f.user, mfa: {getAuthenticatorAssuranceLevel: f.assurance}},
  from(table: string) {
    const data = table === "profiles" ? {display_name: "Eigen beheerder"} : [];
    const query = {select: () => query, eq: () => query, order: () => query, maybeSingle: async () => ({data, error: null}), then: (resolve: (value: unknown) => unknown) => Promise.resolve({data, error: null}).then(resolve)};
    return query;
  }
})}));
import {getMobileRequestContext} from "./context";
beforeEach(() => {
  f.user.mockReset().mockResolvedValue({data: {user: {id: "19170000-0000-4000-8000-000000000001", email: "native@voorbeeld.invalid", user_metadata: {}}}, error: null});
  // The installed stateless Auth client has no persisted session. Without an
  // explicit JWT it reports no current level, even after getUser(jwt).
  f.assurance.mockReset().mockImplementation(async (token?: string) => ({data: {currentLevel: token === f.token ? "aal2" : null}, error: null}));
});
describe("stateless mobile bearer assurance", () => {
  it("uses the same verified bearer when resolving AAL2", async () => {
    const context = await getMobileRequestContext(new Request("https://control.example/api/mobile/v3/studio", {headers: {Authorization: `Bearer ${f.token}`}}));
    expect(f.user).toHaveBeenCalledWith(f.token);
    expect(f.assurance).toHaveBeenCalledWith(f.token);
    expect(context.assuranceLevel).toBe("aal2");
  });
  it("does not trust assurance from a rejected user token", async () => {
    f.user.mockResolvedValue({data: {user: null}, error: {message: "invalid"}});
    await expect(getMobileRequestContext(new Request("https://control.example/api/mobile/v3/studio", {headers: {Authorization: `Bearer ${f.token}`}}))).rejects.toMatchObject({status: 401});
    expect(f.assurance).not.toHaveBeenCalled();
  });
});
