import {beforeEach, describe, expect, it, vi} from "vitest";
import {blogError} from "@veyocast/blog/server";

const mocks = vi.hoisted(() => ({staff: vi.fn(), prepare: vi.fn(), persist: vi.fn(), rate: vi.fn()}));
vi.mock("../../../../../lib/blog-service", async importOriginal => ({...await importOriginal<object>(), requireBlogStaff: mocks.staff}));
vi.mock("@veyocast/blog/media", () => ({prepareBlogMedia: mocks.prepare, persistBlogMedia: mocks.persist}));
vi.mock("@veyocast/blog/server", async importOriginal => ({...await importOriginal<object>(), blogRpc: mocks.rate}));

import {POST} from "./route";

function request(extra = false) {
  const form = new FormData();form.append("file", new File([new Uint8Array([1, 2, 3])], "fixture.png", {type: "image/png"}));
  if (extra) form.append("unexpected", "ignored?");
  return new Request("https://control.example/api/platform/blog/media", {method: "POST", headers: {origin: "https://control.example", host: "control.example", "Idempotency-Key": "isolated-upload-key"}, body: form});
}
beforeEach(() => {
  vi.clearAllMocks();vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://control.example");
  vi.stubEnv("VEYOCAST_ENVIRONMENT", "test");vi.stubEnv("VEYOCAST_BLOG_SITE_ID", "veyocast");vi.stubEnv("VEYOCAST_BLOG_PUBLIC_ORIGIN", "http://localhost:3002");mocks.rate.mockResolvedValue({allowed: true});
  mocks.staff.mockResolvedValue({accessToken: "isolated-user-token", session: {userId: "verified-editor"}});mocks.prepare.mockResolvedValue({bytes: new Uint8Array([1]), payload: {}});
  mocks.persist.mockResolvedValue({assetId: "11111111-1111-4111-8111-111111111111", width: 1200, height: 1800, type: "image/png", url: "untrusted-transport-url"});
});

describe("staff blog media upload", () => {
  it("checks origin and staff AAL2 before image processing", async () => {
    const foreign = request();foreign.headers.set("origin", "https://evil.example");
    expect((await POST(foreign)).status).toBe(403);expect(mocks.staff).not.toHaveBeenCalled();
    mocks.staff.mockRejectedValue(blogError("PERMISSION_DENIED", 403));
    expect((await POST(request())).status).toBe(403);expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("rejects oversized or multiple-field requests before decoding media", async () => {
    const oversized = request();oversized.headers.set("content-length", String(10 * 1024 * 1024));
    expect((await POST(oversized)).status).toBe(413);expect((await POST(request(true))).status).toBe(400);
    expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("binds persistence to the user's token and original key and returns only an own media route", async () => {
    const response = await POST(request());expect(response.status).toBe(201);
    expect(mocks.staff).toHaveBeenCalledWith("platform.blog.write", true);
    expect(mocks.rate).toHaveBeenCalledWith("blog_authorize_media_upload", {p_site_id: "veyocast", p_environment: "test"}, {accessToken: "isolated-user-token"});
    expect(mocks.persist).toHaveBeenCalledWith(expect.any(Object), {accessToken: "isolated-user-token", actorId: "verified-editor", idempotencyKey: "isolated-upload-key"});
    expect(await response.json()).toMatchObject({url: "/api/blog/media/11111111-1111-4111-8111-111111111111", width: 1200, height: 1800});
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("honors the durable upload rate limit before reading or decoding a file", async () => {
    mocks.rate.mockResolvedValue({allowed: false, code: "RATE_LIMITED", retryAfter: 60});
    const response = await POST(request());expect(response.status).toBe(429);expect(response.headers.get("retry-after")).toBe("60");
    expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.persist).not.toHaveBeenCalled();
  });
});
