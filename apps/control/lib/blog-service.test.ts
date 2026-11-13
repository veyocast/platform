import {beforeEach, describe, expect, it, vi} from "vitest";
import {emptyDraft} from "../app/(shell)/platform/blog/_components/blog-form";

const mocks = vi.hoisted(() => ({session: vi.fn(), guard: vi.fn(), client: vi.fn(), command: vi.fn(), token: vi.fn()}));
vi.mock("./control-session", () => ({getControlSession: mocks.session, requireControlCapability: mocks.guard}));
vi.mock("./supabase/server", () => ({createControlSupabaseClient: mocks.client}));
vi.mock("@veyocast/blog/server", async importOriginal => ({...await importOriginal<object>(), blogCommand: mocks.command}));

import {assertBlogControlOrigin, blogEntryFromResponse, getBlogEntries, getBlogPublicOrigin, requireBlogStaff} from "./blog-service";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://control.example");
  vi.stubEnv("VEYOCAST_ENVIRONMENT", "test");
  vi.stubEnv("VEYOCAST_BLOG_PUBLIC_ORIGIN", "http://localhost:3002");
  mocks.session.mockResolvedValue({isLive: true, userId: "editor", assuranceLevel: "aal2", capabilities: ["platform.blog.read", "platform.blog.write", "platform.blog.publish"]});
  mocks.token.mockResolvedValue({data: {session: {access_token: "isolated-user-token", user: {id: "editor"}}}, error: null});
  mocks.client.mockResolvedValue({auth: {getSession: mocks.token}});
});

describe("platform blog server boundary", () => {
  it("refuses absent, demo, unprivileged and AAL1 mutation sessions before obtaining any token", async () => {
    for (const session of [null, {isLive: false}, {isLive: true, capabilities: []}]) {
      mocks.session.mockResolvedValue(session);
      await expect(requireBlogStaff("platform.blog.write", true)).rejects.toMatchObject({status: 403, code: "PERMISSION_DENIED"});
    }
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.command).not.toHaveBeenCalled();
    mocks.session.mockResolvedValue({isLive: true, capabilities: ["platform.blog.write"], assuranceLevel: "aal1"});
    await expect(requireBlogStaff("platform.blog.write", true)).rejects.toMatchObject({status: 403, code: "MFA_REQUIRED"});
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it("passes only the verified user's JWT through the staff read path", async () => {
    mocks.command.mockResolvedValue({httpStatus: 200, body: []});
    expect(await getBlogEntries()).toEqual([]);
    expect(mocks.guard).toHaveBeenCalledWith("platform.blog.read", {aal2: false, returnTo: "/platform/blog"});
    expect(mocks.command).toHaveBeenCalledWith("list", {accessToken: "isolated-user-token"});
    mocks.token.mockResolvedValue({data: {session: {access_token: "different-user-token", user: {id: "someone-else"}}}, error: null});
    await expect(requireBlogStaff()).rejects.toMatchObject({code: "PERMISSION_DENIED"});
  });

  it("requires the exact configured origin and host, including protocol", () => {
    const request = (origin: string, host = "control.example") => new Request("http://internal:3000/api/platform/blog", {headers: {origin, host}});
    expect(() => assertBlogControlOrigin(request("https://control.example"))).not.toThrow();
    for (const [origin, host] of [["http://control.example", "control.example"], ["https://evil.example", "control.example"], ["https://control.example/path", "control.example"], ["null", "control.example"], ["https://control.example", "evil.example"]]) {
      expect(() => assertBlogControlOrigin(request(origin!, host))).toThrow();
    }
    expect(() => assertBlogControlOrigin(new Request("https://control.example/api/platform/blog"))).toThrow();
  });

  it("preserves real revision dates and the live URL independently from the draft", () => {
    const entry = blogEntryFromResponse({id: "article", externalId: "manual_article", draftRevision: 3, publishedRevision: 2, publicUrl: "http://localhost:3002/blog/live", publishedSlug: "live", publishedAt: "2026-11-12T12:00:00.000Z", updatedAt: "2026-11-13T12:00:00.000Z", payload: {...emptyDraft, slug: "draft"}});
    expect(entry.draft.slug).toBe("draft");
    expect(entry.publicUrl).toBe("http://localhost:3002/blog/live");
    expect(entry.updatedAt).toBe("2026-11-13T12:00:00.000Z");
    expect(() => blogEntryFromResponse({id: "article", externalId: "manual_article", draftRevision: 1, payload: emptyDraft})).toThrow();
    expect(getBlogPublicOrigin()).toBe("http://localhost:3002");
    vi.stubEnv("VEYOCAST_ENVIRONMENT", "staging"); vi.stubEnv("VEYOCAST_BLOG_PUBLIC_ORIGIN", ""); vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", "");
    expect(getBlogPublicOrigin()).toBe("");
  });
});
