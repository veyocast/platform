import { createHash } from "node:crypto";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as Server from "../src/server";

const storage = vi.hoisted(() => ({ command: vi.fn(), rpc: vi.fn(), upload: vi.fn(), download: vi.fn() }));
vi.mock("../src/server", async (original) => ({
  ...await original<typeof Server>(),
  blogCommand: storage.command, blogRpc: storage.rpc, uploadBlogStorage: storage.upload, downloadBlogStorage: storage.download
}));

import { persistBlogMedia, prepareBlogMedia, type PreparedBlogMedia } from "../src/media";
import { BlogHttpError, blogMediaLimit } from "../src/server";

function file(bytes: Uint8Array, type = "image/png") {
  return new File([Uint8Array.from(bytes)], "untrusted-name.svg", { type });
}
async function png(width = 24, height = 12) {
  return sharp({ create: { width, height, channels: 3, background: "#113c3d" } }).png().toBuffer();
}
const assetId = "11111111-1111-4111-8111-111111111111";
const storagePath = `platform/veyocast/test/assets/${assetId}/original.png`;
const options = { accessToken: "isolated-test-session", actorId: "22222222-2222-4222-8222-222222222222", idempotencyKey: "media-operation-42" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VEYOCAST_ENVIRONMENT", "test");
  storage.upload.mockResolvedValue(new Response(null, { status: 200 }));
});

function pending(prepared: PreparedBlogMedia) {
  const ready = { httpStatus: 201, body: { assetId, width: prepared.payload.width, height: prepared.payload.height, type: prepared.payload.type, status: "ready" } };
  storage.command.mockImplementation(async (operation: string) => operation === "media.intent"
    ? { httpStatus: 202, body: { assetId, storagePath, status: "pending" } } : ready);
  storage.download.mockResolvedValue(prepared.bytes);
  storage.rpc.mockResolvedValue(ready);
  return ready;
}

describe("verified blog image preparation", () => {
  it.each(["image/jpeg", "image/png", "image/webp"] as const)("decodes and re-encodes real %s bytes with actual dimensions and stable hashes", async (type) => {
    const source = sharp({ create: { width: 24, height: 12, channels: 3, background: "#113c3d" } });
    const bytes = await (type === "image/jpeg" ? source.jpeg() : type === "image/png" ? source.png() : source.webp()).toBuffer();
    const prepared = await prepareBlogMedia(file(bytes, type));
    const repeat = await prepareBlogMedia(file(bytes, type));
    const metadata = await sharp(prepared.bytes).metadata();
    expect(prepared.payload).toMatchObject({ type, width: 24, height: 12, bytes: prepared.bytes.length });
    expect(prepared.payload.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(prepared.payload.outputSha256).toBe(createHash("sha256").update(prepared.bytes).digest("hex"));
    expect(prepared.payload).toEqual(repeat.payload);
    expect(metadata.format).toBe(type.replace("image/", ""));
  });

  it("applies EXIF orientation and removes embedded metadata", async () => {
    const bytes = await sharp({ create: { width: 24, height: 12, channels: 3, background: "#113c3d" } }).jpeg().withMetadata({ orientation: 6 }).withExifMerge({ IFD0: { Copyright: "Private photographer details" } }).toBuffer();
    expect((await sharp(bytes).metadata()).exif).toBeDefined();
    const prepared = await prepareBlogMedia(file(bytes, "image/jpeg"));
    const metadata = await sharp(prepared.bytes).metadata();
    expect(prepared.payload).toMatchObject({ width: 12, height: 24, type: "image/jpeg" });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it("rejects a spoofed MIME, corrupt decoder input, SVG and truncated image", async () => {
    const bytes = await png();
    await expect(prepareBlogMedia(file(bytes, "image/jpeg"))).rejects.toMatchObject({ status: 415, code: "INVALID_MEDIA" });
    await expect(prepareBlogMedia(file(Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0, 1]), "image/jpeg"))).rejects.toMatchObject({ status: 422, code: "INVALID_MEDIA" });
    await expect(prepareBlogMedia(file(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script></svg>')))).rejects.toMatchObject({ status: 415, code: "INVALID_MEDIA" });
    await expect(prepareBlogMedia(file(bytes.subarray(0, bytes.length - 20)))).rejects.toMatchObject({ status: 422, code: "INVALID_MEDIA" });
  });

  it("rejects empty/oversized files and dimensions beyond the limit", async () => {
    await expect(prepareBlogMedia(file(new Uint8Array()))).rejects.toMatchObject({ status: 422, code: "INVALID_MEDIA" });
    await expect(prepareBlogMedia(file(new Uint8Array(blogMediaLimit + 1)))).rejects.toMatchObject({ status: 413, code: "INVALID_MEDIA" });
    await expect(prepareBlogMedia(file(await png(10001, 1)))).rejects.toMatchObject({ status: 422, code: "INVALID_MEDIA" });
    await expect(prepareBlogMedia(file(await png(6400, 6400)))).rejects.toMatchObject({ status: 422, code: "INVALID_MEDIA" });
  });

  it("rejects animated WebP instead of silently publishing the first frame", async () => {
    const pixels = Buffer.alloc(2 * 4 * 3);
    pixels.fill(255, 2 * 2 * 3);
    const animated = await sharp(pixels, { raw: { width: 2, height: 4, channels: 3, pageHeight: 2 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(animated, { animated: true }).metadata()).pages).toBe(2);
    await expect(prepareBlogMedia(file(animated, "image/webp"))).rejects.toMatchObject({ status: 422, code: "INVALID_MEDIA" });
  });
});

describe("durable blog media upload", () => {
  it("reserves first, uploads with the staff token, verifies readback and completes with the identical payload/key", async () => {
    const prepared = await prepareBlogMedia(file(await png()));
    pending(prepared);
    await expect(persistBlogMedia(prepared, options)).resolves.toEqual({ assetId, width: 24, height: 12, type: "image/png", url: `/api/blog/media/${assetId}` });
    expect(storage.command.mock.calls).toEqual([["media.intent", { ...options, payload: prepared.payload }]]);
    expect(storage.rpc).toHaveBeenCalledWith("blog_complete_human_media", { p_site_id: "veyocast", p_environment: "test", p_payload: prepared.payload, p_idempotency_key: options.idempotencyKey, p_actor_user_id: options.actorId }, { admin: true });
    expect(storage.upload).toHaveBeenCalledWith(storagePath, prepared.bytes, "image/png", options.accessToken);
    expect(storage.download).toHaveBeenCalledWith(storagePath, options.accessToken);
    expect(storage.command.mock.invocationCallOrder[0]).toBeLessThan(storage.upload.mock.invocationCallOrder[0]!);
    expect(storage.download.mock.invocationCallOrder[0]).toBeLessThan(storage.rpc.mock.invocationCallOrder[0]!);
  });

  it("replays the stored result after a completed write and process restart without a second upload", async () => {
    const prepared = await prepareBlogMedia(file(await png()));
    const ready = pending(prepared);
    await persistBlogMedia(prepared, options);
    vi.clearAllMocks();
    storage.command.mockResolvedValue(ready);
    await expect(persistBlogMedia(prepared, options)).resolves.toMatchObject({ assetId });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.download).not.toHaveBeenCalled();
    expect(storage.command).toHaveBeenCalledTimes(1);
  });

  it("resumes a successful upload after its response times out and accepts only matching stored bytes", async () => {
    const prepared = await prepareBlogMedia(file(await png()));
    pending(prepared);
    storage.upload.mockRejectedValue(new BlogHttpError(503, "TEMPORARILY_UNAVAILABLE", "Test time-out after write"));
    await expect(persistBlogMedia(prepared, options)).resolves.toMatchObject({ assetId });
    expect(storage.download).toHaveBeenCalledTimes(1);
    expect(storage.rpc).toHaveBeenCalledTimes(1);
  });

  it("never completes a create-only collision with corrupt or different stored bytes", async () => {
    const prepared = await prepareBlogMedia(file(await png()));
    pending(prepared);
    storage.upload.mockRejectedValue(new BlogHttpError(503, "TEMPORARILY_UNAVAILABLE", "Storage collision"));
    const corrupt = Uint8Array.from(prepared.bytes);
    corrupt[corrupt.length - 1] = corrupt[corrupt.length - 1]! ^ 1;
    storage.download.mockResolvedValue(corrupt);
    await expect(persistBlogMedia(prepared, options)).rejects.toMatchObject({ code: "INVALID_MEDIA", status: 422 });
    expect(storage.command.mock.calls.map(([operation]) => operation)).toEqual(["media.intent"]);
  });

  it("keeps an interrupted readback pending and resumes the same reserved asset on retry", async () => {
    const prepared = await prepareBlogMedia(file(await png()));
    pending(prepared);
    storage.download.mockRejectedValueOnce(new BlogHttpError(503, "TEMPORARILY_UNAVAILABLE", "Readback unavailable"));
    await expect(persistBlogMedia(prepared, options)).rejects.toMatchObject({ status: 503 });
    expect(storage.command).toHaveBeenCalledTimes(1);
    storage.upload.mockRejectedValueOnce(new BlogHttpError(503, "TEMPORARILY_UNAVAILABLE", "Already exists"));
    await expect(persistBlogMedia(prepared, options)).resolves.toMatchObject({ assetId });
    expect(storage.upload.mock.calls.map(([path]) => path)).toEqual([storagePath, storagePath]);
  });

  it("propagates idempotency conflicts before touching storage and rejects ambiguous credentials", async () => {
    const prepared = await prepareBlogMedia(file(await png()));
    storage.command.mockRejectedValue(new BlogHttpError(409, "IDEMPOTENCY_CONFLICT", "Changed bytes"));
    await expect(persistBlogMedia(prepared, options)).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_CONFLICT" });
    expect(storage.upload).not.toHaveBeenCalled();
    await expect(persistBlogMedia(prepared, { ...options, tokenHash: "other-auth" })).rejects.toMatchObject({ status: 403 });
    await expect(persistBlogMedia(prepared, { accessToken: options.accessToken, idempotencyKey: options.idempotencyKey })).rejects.toMatchObject({ status: 403 });
  });

  it("keeps the scoped API-token completion on the existing command path", async () => {
    const prepared = await prepareBlogMedia(file(await png()));
    pending(prepared);
    const tokenOptions = { tokenHash: "test-token-hash", idempotencyKey: "api-media-operation-42" };
    await expect(persistBlogMedia(prepared, tokenOptions)).resolves.toMatchObject({ assetId });
    expect(storage.command).toHaveBeenLastCalledWith("media.complete", { ...tokenOptions, payload: prepared.payload });
    expect(storage.rpc).not.toHaveBeenCalled();
  });

  it("accepts the existing SocialHero operation keys with their slash suffix", async () => {
    const prepared = await prepareBlogMedia(file(await png()));
    pending(prepared);
    const idempotencyKey = `sh_blog_${"a".repeat(64)}/hero`;
    await expect(persistBlogMedia(prepared, { tokenHash: "test-token-hash", idempotencyKey })).resolves.toMatchObject({ assetId });
    expect(storage.command).toHaveBeenLastCalledWith("media.complete", { tokenHash: "test-token-hash", idempotencyKey, payload: prepared.payload });
  });
});
