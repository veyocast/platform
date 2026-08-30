import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../../_lib/player-supabase", () => ({
  createPlayerAdminClient: () => ({ rpc })
}));

import { POST } from "./route";

const token = "player_device_credential_123456789";
const deliveryId = "11111111-1111-4111-8111-111111111111";

describe("LED Scores acknowledgement API", () => {
  beforeEach(() => rpc.mockReset());

  it("stuurt een begrensde acknowledgement met gehashte device credential", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const response = await POST(request(JSON.stringify({
      deliveryId,
      detail: "render_latency_ms:21",
      status: "rendered"
    })));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("ack_ledscores_player_delivery_v1", expect.objectContaining({
      p_delivery_id: deliveryId,
      p_status: "rendered",
      p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/)
    }));
  });

  it("weigert ongeldige statussen voordat Supabase wordt aangeroepen", async () => {
    const response = await POST(request(JSON.stringify({ deliveryId, status: "hacked" })));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("weigert oversized acknowledgements", async () => {
    const response = await POST(request("x".repeat(513)));
    expect(response.status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
});

function request(body: string) {
  return new Request("https://player.test/api/player/realtime/ack", {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
}
