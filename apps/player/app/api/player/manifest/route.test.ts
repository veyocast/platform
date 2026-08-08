import { describe, expect, it, vi } from "vitest";

vi.mock("../../../_lib/player-supabase", () => ({
  createPlayerAnonClient: () => null,
  isLivePlayerConfigured: () => false
}));

import { GET } from "./route";

describe("player manifest conditionele releasecheck", () => {
  it("levert een release-ETag bij het volledige manifest", async () => {
    const response = await GET(manifestRequest());
    const body = (await response.json()) as {
      manifest: { releaseId: string };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("etag")).toBe(
      `"release-${body.manifest.releaseId}"`
    );
    expect(response.headers.get("x-veyocast-player-version")).toBeTruthy();
  });

  it("slaat manifest en signed URLs over wanneer de release ongewijzigd is", async () => {
    const initial = await GET(manifestRequest());
    const etag = initial.headers.get("etag");
    expect(etag).toBeTruthy();

    const response = await GET(manifestRequest(etag ?? undefined));

    expect(response.status).toBe(304);
    expect(response.headers.get("x-veyocast-player-version")).toBeTruthy();
    expect(response.headers.get("etag")).toBe(etag);
    expect(await response.text()).toBe("");
  });

  it("levert het manifest wanneer de bekende release afwijkt", async () => {
    const response = await GET(
      manifestRequest('"release-00000000-0000-4000-8000-000000000000"')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("manifest.releaseId");
  });
});

function manifestRequest(etag?: string) {
  return new Request("https://player.veyocast.nl/api/player/manifest", {
    headers: {
      Authorization: "Bearer demo-online",
      ...(etag ? { "If-None-Match": etag } : {})
    }
  });
}
