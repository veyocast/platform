import { afterEach, expect, it, vi } from "vitest";
import { createMediaDownloader } from "./media-download";
import { createMediaTraffic } from "./media-traffic";

afterEach(() => vi.useRealTimers());

it("coalesces rotated Storage signatures only within the same tenant, object, origin and representation", async () => {
  const fetchMedia = vi.fn<typeof fetch>(async () => new Response("same bytes"));
  const download = createMediaDownloader(fetchMedia, createMediaTraffic());
  const path = "https://project.supabase.co/storage/v1/object/sign/tenant-media/tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000001/variants/player.mp4";
  await Promise.all([
    download(path + "?token=old", "hash", 100),
    download(path + "?token=new", "hash", 100),
    download(path.replace("tenants/10000000", "tenants/30000000") + "?token=new", "hash", 100),
    download(path + "?token=new&width=200", "hash", 100),
    download(path.replace("project.supabase.co", "other.supabase.co") + "?token=new", "hash", 100)
  ]);
  expect(fetchMedia).toHaveBeenCalledTimes(4);
});

it("shares simultaneous preloader/player/intro reads without sharing a different signed authorization", async () => {
  const meter = createMediaTraffic();
  const fetchMedia = vi.fn<typeof fetch>(async () => new Response("same bytes"));
  const download = createMediaDownloader(fetchMedia, meter);
  const results = await Promise.all([1, 2, 3].map(() => download("https://storage.test/tenants/a/movie?token=one", "hash", 100)));
  expect(results.map((r) => r.bytes.byteLength)).toEqual([10, 10, 10]);
  expect(fetchMedia).toHaveBeenCalledTimes(1);
  expect(meter.snapshot().networkPayloadBytes).toBe(10);
  await download("https://storage.test/tenants/b/movie?token=two", "hash", 100);
  expect(fetchMedia).toHaveBeenCalledTimes(2);
});

it("canceling an obsolete release does not cancel an intro still using the same transfer", async () => {
  let finish!: () => void;
  let transportSignal: AbortSignal | null | undefined;
  const fetchMedia = vi.fn<typeof fetch>((_, init) => {
    transportSignal = init?.signal;
    return new Promise((resolve) => { finish = () => resolve(new Response("video")); });
  });
  const download = createMediaDownloader(fetchMedia, createMediaTraffic());
  const controller = new AbortController();
  const obsolete = download("https://fixture.test/a", "a", 100, controller.signal);
  const intro = download("https://fixture.test/a", "a", 100);
  controller.abort();
  await expect(obsolete).rejects.toThrow("TARGET_SUPERSEDED");
  expect(transportSignal?.aborted).toBe(false);
  finish();
  expect((await intro).bytes.byteLength).toBe(5);
});

it.each([206, 403, 429, 503])("rejects status %i and never treats partial/error responses as ready", async (status) => {
  const download = createMediaDownloader(async () => new Response("partial", { status }), createMediaTraffic());
  await expect(download("https://fixture.test/a", "hash", 100)).rejects.toThrow("ASSET_FETCH_FAILED_" + status);
});

it("accounts streamed bytes even when a size budget rejects the transfer", async () => {
  const meter = createMediaTraffic();
  const download = createMediaDownloader(async () => new Response("too many bytes"), meter);
  await expect(download("https://fixture.test/a", "hash", 3)).rejects.toThrow("ASSET_TOO_LARGE");
  expect(meter.snapshot().networkPayloadBytes).toBe(14);
  expect(meter.snapshot().downloads).toBe(0);
});
