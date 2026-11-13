import {beforeEach, describe, expect, it, vi} from "vitest";
import {blogError, sha256} from "@veyocast/blog/server";

const mocks = vi.hoisted(() => ({staff: vi.fn(), download: vi.fn(), query: vi.fn(), filter: vi.fn(), row: vi.fn()}));
vi.mock("../../../../../lib/blog-service", () => ({requireBlogStaff: mocks.staff}));
vi.mock("@veyocast/blog/server", async importOriginal => ({...await importOriginal<object>(), downloadBlogStorage: mocks.download}));

import {GET} from "./route";

const assetId = "11111111-1111-4111-8111-111111111111", bytes = new TextEncoder().encode("verified-test-bytes");
const request = new Request(`http://localhost:3000/api/blog/media/${assetId}`);
const context = (id = assetId) => ({params: Promise.resolve({id})});
beforeEach(() => {
  vi.clearAllMocks();vi.stubEnv("VEYOCAST_ENVIRONMENT", "test");vi.stubEnv("VEYOCAST_BLOG_SITE_ID", "veyocast");vi.stubEnv("VEYOCAST_BLOG_PUBLIC_ORIGIN", "http://localhost:3002");
  const builder = {select: vi.fn(), eq: mocks.filter, maybeSingle: mocks.row};builder.select.mockReturnValue(builder);mocks.filter.mockReturnValue(builder);mocks.query.mockReturnValue(builder);
  mocks.staff.mockResolvedValue({accessToken: "isolated-user-token", client: {from: mocks.query}});
  mocks.row.mockResolvedValue({error: null, data: {storage_path: `platform/veyocast/test/assets/${assetId}/original.png`, output_sha256: sha256(bytes), type: "image/png", bytes: bytes.byteLength}});
  mocks.download.mockResolvedValue(bytes);
});

describe("private staff article media", () => {
  it("requires staff read access before metadata or storage access", async () => {
    mocks.staff.mockRejectedValue(blogError("PERMISSION_DENIED", 403));
    expect((await GET(request, context())).status).toBe(403);expect(mocks.query).not.toHaveBeenCalled();expect(mocks.download).not.toHaveBeenCalled();
  });
  it("scopes ready media to the configured site and environment, verifies bytes, and prevents shared caching", async () => {
    const response = await GET(request, context());expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("platform_blog_assets");expect(mocks.filter).toHaveBeenCalledWith("site_id", "veyocast");expect(mocks.filter).toHaveBeenCalledWith("environment", "test");expect(mocks.filter).toHaveBeenCalledWith("status", "ready");
    expect(mocks.download).toHaveBeenCalledWith(`platform/veyocast/test/assets/${assetId}/original.png`, "isolated-user-token");
    expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("x-robots-tag")).toBe("noindex");expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });
  it("never serves missing identities or corrupt stored bytes", async () => {
    expect((await GET(request, context("../other-site"))).status).toBe(404);expect(mocks.download).not.toHaveBeenCalled();
    mocks.download.mockResolvedValue(new Uint8Array([0]));const response = await GET(request, context());expect(response.status).toBe(503);expect((await response.json()).error.code).toBe("TEMPORARILY_UNAVAILABLE");
  });
});
