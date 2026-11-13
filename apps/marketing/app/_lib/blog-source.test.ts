import {beforeEach, expect, it, vi} from "vitest";
import {createHash} from "node:crypto";
import type * as BlogServer from "@veyocast/blog/server";

const backend = vi.hoisted(() => ({rows: vi.fn(), download: vi.fn()}));
vi.mock("@veyocast/blog/server", async (original) => ({
  ...await original<typeof BlogServer>(),
  hasBlogPublicBackend: () => true, publicBlogRows: backend.rows, downloadBlogStorage: backend.download
}));

import {getPublishedBlogPosts} from "./blog-source";
import {GET as publicMedia} from "../api/blog/media/[id]/route";

const upper = "313ABCDE-ABCD-4ABC-8DEF-123456ABCDEF";
const lower = upper.toLowerCase();
const og = "313ABCDE-ABCD-4ABC-8DEF-123456ABC123";
const bytes = new Uint8Array([137, 80, 78, 71]);
const path = `platform/veyocast/test/assets/${lower}/original.png`;
beforeEach(() => {
  backend.rows.mockReset(); backend.download.mockReset();
  vi.stubEnv("VEYOCAST_ENVIRONMENT", "test");
  vi.stubEnv("VEYOCAST_BLOG_PUBLIC_ORIGIN", "http://127.0.0.1:9313");
});

it("reads published hero, OG and document references with case-insensitive UUID identity", async () => {
  backend.rows.mockImplementation(async (table: string, query: URLSearchParams) => {
    if (table === "platform_blog_assets") {
      expect(query.get("id")).toBe(`in.(${lower},${og.toLowerCase()})`);
      return [lower, og.toLowerCase()].map(id => ({id, width: 100, height: 120, type: "image/png"}));
    }
    return [{id: lower, external_id: "uppercase-fixture", revision: 1, slug: "uuid-referenties", published_at: "2026-11-13T10:00:00Z", first_published_at: "2026-11-13T10:00:00Z", updated_at: "2026-11-13T10:00:00Z", payload: {
      type: "blog", locale: "nl-NL", title: "Geldige UUID-referenties", slug: "uuid-referenties", excerpt: "Een geldige publicatie met UUID-referenties.",
      content: {type: "doc", content: [{type: "image", attrs: {assetId: upper, src: `/api/blog/media/${upper}`, alt: "Een eigen afbeelding"}}]},
      seoTitle: "UUID-referenties", seoDescription: "Een geldige publicatie", authorId: "redactie", categoryId: "clubtv", tags: [],
      hero: {assetId: upper, alt: "Een eigen hero", focalPoint: {x: .5, y: .5}}, ogImageAssetId: og
    }}];
  });
  const [post] = await getPublishedBlogPosts();
  expect(post?.hero.src).toBe(`/api/blog/media/${lower}`);
  expect(post?.socialImage?.src).toBe(`/api/blog/media/${og.toLowerCase()}`);
});

it("serves an uppercase public media URL through the same published lower-case asset", async () => {
  backend.rows.mockImplementation(async (_table: string, query: URLSearchParams) => {
    expect(query.get("id")).toBe(`eq.${lower}`);
    return [{storage_path: path, type: "image/png", bytes: bytes.byteLength, output_sha256: createHash("sha256").update(bytes).digest("hex")}];
  });
  backend.download.mockResolvedValue(bytes);
  const response = await publicMedia(new Request(`http://127.0.0.1:9313/api/blog/media/${upper}`), {params: Promise.resolve({id: upper})});
  expect(response.status).toBe(200);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  expect(backend.download).toHaveBeenCalledWith(path);
});
