import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase/admin", () => ({ createControlAdminClient: () => ({ rpc: f.rpc }) }));
import { GET, POST } from "./route";

const publicId = "19170000-0000-4000-8000-000000000123";
const request = () => new NextRequest(`https://control.example/api/engage/${publicId}`);
const context = { params: Promise.resolve({ publicId }) };
beforeEach(() => {
  vi.stubEnv("ENGAGE_ABUSE_SIGNING_SECRET", undefined);
  vi.stubEnv("NEXT_SERVER_ACTIONS_ENCRYPTION_KEY", "test-persistent-runtime-actions-key-32-characters");
  f.rpc.mockReset().mockResolvedValue({ error: null, data: {
    closesAt: null, id: publicId, kind: "poll", options: [
      { id: "19170000-0000-4000-8000-000000000124", label: "Keuze A", sortOrder: 0 },
      { id: "19170000-0000-4000-8000-000000000125", label: "Keuze B", sortOrder: 1 }
    ], privacyNotice: "Stemmen worden zonder naam verwerkt.", question: "Welke keuze?", resultVisibility: "after_close", resultsVisible: false,
    status: "live", tenantName: "Lokale test", title: "Eigen testpoll", totalVotes: 0
  } });
});
afterEach(() => vi.unstubAllEnvs());
it("serves the real public RPC contract with existing deployment configuration and no dedicated key", async () => {
  const response = await GET(request(), context);
  expect(response.status).toBe(200);
  expect(f.rpc).toHaveBeenCalledWith("get_engage_campaign_for_identity_v1", { p_public_id: publicId, p_identity_hash: expect.stringMatching(/^[0-9a-f]{64}$/) });
  expect(await response.json()).toMatchObject({ resultsVisible: false, totalVotes: 0 });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
});
it("does not call the privileged RPC when explicit signing configuration is invalid", async () => {
  vi.stubEnv("ENGAGE_ABUSE_SIGNING_SECRET", "short");
  expect((await GET(request(), context)).status).toBe(503);
  expect(f.rpc).not.toHaveBeenCalled();
});
it("returns a recoverable conflict for a vote racing with campaign closure", async () => {
  f.rpc.mockResolvedValue({ error: null, data: { accepted: false, reason: "closed", campaign: null } });
  const vote = new NextRequest(`https://control.example/api/engage/${publicId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ optionId: "19170000-0000-4000-8000-000000000124" }) });
  expect((await POST(vote, context)).status).toBe(409);
  expect(f.rpc).toHaveBeenCalledOnce();
  expect(f.rpc).toHaveBeenCalledWith("submit_engage_vote_v1", expect.objectContaining({ p_public_id: publicId }));
});
