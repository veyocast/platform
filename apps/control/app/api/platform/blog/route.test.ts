import {beforeEach, describe, expect, it, vi} from "vitest";
import {emptyDraft} from "../../../(shell)/platform/blog/_components/blog-form";

const mocks = vi.hoisted(() => ({staff: vi.fn(), command: vi.fn(), entries: vi.fn()}));
vi.mock("../../../../lib/blog-service", async importOriginal => ({...await importOriginal<object>(), requireBlogStaff: mocks.staff, getBlogEntries: mocks.entries}));
vi.mock("@veyocast/blog/server", async importOriginal => ({...await importOriginal<object>(), blogCommand: mocks.command}));

import {GET, POST} from "./route";

const draft = {...emptyDraft, title: "Een gecontroleerd artikel", slug: "gecontroleerd-artikel", excerpt: "Een samenvatting.", seoTitle: "Een gecontroleerd artikel | VeyoCast", seoDescription: "Een samenvatting voor zoekmachines.", hero: {...emptyDraft.hero, assetId: "11111111-1111-4111-8111-111111111111", alt: "Een clubscherm."}, content: {type: "doc", content: [{type: "paragraph", content: [{type: "text", text: "Dit is gecontroleerde inhoud."}]}]}};
const payload = {action: "publish", draft, idempotencyKey: "isolated-publish-key"};
const request = (body: unknown = payload, origin = "https://control.example") => new Request("https://control.example/api/platform/blog", {method: "POST", headers: {origin, host: "control.example", "Content-Type": "application/json"}, body: JSON.stringify(body)});
const responseBody = (externalId: string) => ({id: "post", externalId, draftRevision: 1, publishedRevision: null, publicUrl: null, publishedSlug: null, publishedAt: null, updatedAt: "2026-11-13T12:00:00.000Z"});

beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://control.example");
  mocks.staff.mockResolvedValue({accessToken: "isolated-user-token"}); mocks.entries.mockResolvedValue([]);
});

describe("platform blog management API", () => {
  it("rejects a foreign origin before auth or writes and does not expose private details", async () => {
    const response = await POST(request(payload, "https://evil.example"));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("PERMISSION_DENIED");
    expect(mocks.staff).not.toHaveBeenCalled(); expect(mocks.command).not.toHaveBeenCalled();
  });

  it("returns no-store listings and refuses malformed or unapproved content before a write", async () => {
    const listing = await GET(); expect(listing.status).toBe(200); expect(listing.headers.get("cache-control")).toContain("no-store");
    expect(await listing.json()).toEqual({entries: []});
    for (const body of [{...payload, unrecognized: true}, {...payload, expectedRevision: -1}, {...payload, draft: {...draft, content: {type: "doc", content: [{type: "script"}]}}}]) {
      const response = await POST(request(body)); expect(response.status).toBe(400);
    }
    expect(mocks.command).not.toHaveBeenCalled();
  });

  it("resumes save and publish with the original identity, payload and keys after a lost successful publication response", async () => {
    let published = false; const receipts = new Map<string, object>();
    mocks.command.mockImplementation(async (operation: string, input: {externalId: string; payload: unknown; expectedRevision: number | null; idempotencyKey: string}) => {
      const stored = receipts.get(input.idempotencyKey); if (stored) return stored;
      const body = responseBody(input.externalId);
      const result = operation === "publish" ? {httpStatus: 200, body: {...body, publishedRevision: 1, publishedSlug: draft.slug, publicUrl: `http://localhost:3002/blog/${draft.slug}`, publishedAt: "2026-11-13T12:00:00.000Z"}} : {httpStatus: 201, body};
      receipts.set(input.idempotencyKey, result);
      if (operation === "publish" && !published) {published = true; throw new Error("lost HTTP response");}
      return result;
    });
    expect((await POST(request())).status).toBe(503);
    const retry = await POST(request()); expect(retry.status).toBe(200);
    const result = await retry.json(); expect(result.entry.publishedRevision).toBe(1); expect(result.entry.draft).toEqual(draft);
    expect(receipts.size).toBe(2);
    const calls = mocks.command.mock.calls;
    expect(calls[0]?.[1]).toEqual(calls[2]?.[1]); expect(calls[1]?.[1]).toEqual(calls[3]?.[1]);
    expect(calls[0]?.[1]).toMatchObject({idempotencyKey: "isolated-publish-key:save", expectedRevision: null});
    expect(calls[1]?.[1]).toMatchObject({idempotencyKey: "isolated-publish-key:publish", payload: {revision: 1}, expectedRevision: 1});
    expect(mocks.staff).toHaveBeenCalledWith("platform.blog.write", true); expect(mocks.staff).toHaveBeenCalledWith("platform.blog.publish", true);
  });
});
