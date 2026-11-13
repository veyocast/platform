import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as capabilities } from "./capabilities/route";
import { GET as status, PUT as save } from "./posts/[externalId]/route";
import { POST as publish } from "./posts/[externalId]/publish/route";
import { POST as media } from "./media/route";

const origin = "http://127.0.0.1:9313";
const token = "isolated-test-token-313000000000000000000000";
const externalId = "sh_veyocast_313";
const context = { params: Promise.resolve({ externalId }) };
const assetId = "31300000-0000-4000-8000-000000000001";
const payload = {
  type: "blog", locale: "nl-NL", title: "Zo houd je clubschermen actueel", slug: "clubschermen-actueel", excerpt: "Een draaiboek voor de wedstrijddag.",
  content: { format: "markdown", body: "## Begin met de wedstrijddag\nControleer het programma en de sponsorcontent." },
  seo: { title: "Clubschermen actueel | VeyoCast", description: "Een draaiboek voor actuele clubschermen." },
  authorId: "redactie", categoryId: "clubtv", tags: ["clubschermen"],
  hero: { assetId, alt: "Het programma op een scherm boven de bar", focalPoint: { x: .55, y: .4 } }, ogImageAssetId: null
};
const result = { id: "31300000-0000-4000-8000-000000000002", externalId, revision: 7, draftRevision: 7, publishedRevision: 7, status: "published", publicUrl: `${origin}/blog/clubschermen-actueel`, publishedAt: "2026-11-13T12:00:00.000Z" };
let calls: { name: string; body: Record<string, unknown> }[];
let authorized: Record<string, unknown>;
let commandError: string | null;

function request(path: string, method = "GET", body?: unknown, extra: Record<string, string> = {}) {
  return new Request(`${origin}/api/socialhero/v1${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": `sh_blog_${"a".repeat(64)}/draft`, ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => {
  calls = []; commandError = null;
  authorized = { allowed: true, id: "test-credential", scopes: ["capabilities:read", "posts:read", "media:write", "posts:write", "posts:publish"], publicOrigin: origin };
  vi.stubEnv("VEYOCAST_ENVIRONMENT", "test"); vi.stubEnv("VEYOCAST_BLOG_PUBLIC_ORIGIN", origin);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:9988"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "isolated-anon");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", `sb_secret_${"x".repeat(48)}`);
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
    const name = new URL(input).pathname.split("/").at(-1)!; const body = JSON.parse(String(init.body)); calls.push({ name, body });
    if (name === "blog_authorize_token") return Response.json(authorized);
    if (commandError) return Response.json({ code: "PT409", message: commandError }, { status: 409 });
    return Response.json({ httpStatus: body.p_operation === "upsert" ? 201 : 200, body: body.p_operation === "capabilities" ? { siteId: "veyocast", environment: "test", contractVersion: "1", blogPath: "/blog", publicOrigin: origin } : result });
  }));
});

describe("SocialHero v1 HTTP boundary", () => {
  it("advertises the real existing SocialHero contract and only the credential's scopes", async () => {
    authorized.scopes = ["capabilities:read"];
    const response = await capabilities(request("/capabilities"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ contractVersion: "1", siteId: "veyocast", environment: "test", locales: ["nl-NL"], permissions: { media: false, drafts: false, publish: false }, media: { maxBytes: 8388608 } });
    expect(calls[0]?.body.p_scope).toBe("capabilities:read");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects missing credentials before parsing a request or touching the database", async () => {
    const response = await save(new Request(`${origin}/api/socialhero/v1/posts/${externalId}`, { method: "PUT", body: "{" }), context);
    expect(response.status).toBe(401); expect((await response.json()).error.code).toBe("INVALID_CREDENTIAL"); expect(calls).toEqual([]);
  });
  it("binds credentials to the configured public destination before writes", async () => {
    authorized.publicOrigin = "https://another-site.example";
    const response = await save(request(`/posts/${externalId}`, "PUT", payload), context);
    expect(response.status).toBe(503); expect(calls).toHaveLength(1);
  });
  it("returns durable rate limits before parsing large uploads", async () => {
    authorized = { allowed: false, code: "RATE_LIMITED", retryAfter: 17 };
    const response = await media(request("/media", "POST", { unsupported: true }));
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("17"); expect(calls).toHaveLength(1);
  });
  it("rejects malformed multipart as invalid media without a retryable server error", async () => {
    const response = await media(new Request(`${origin}/api/socialhero/v1/media`, {method: "POST", headers: {Authorization: `Bearer ${token}`, "Idempotency-Key": "malformed-multipart-313", "Content-Type": "multipart/form-data; boundary=veyocast313"}, body: "not-a-multipart-body"}));
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("INVALID_MEDIA");
    expect(calls).toHaveLength(1);
  });
  it("accepts the existing scheduler's slash operation key and maps Markdown to the shared schema", async () => {
    const response = await save(request(`/posts/${externalId}`, "PUT", payload, { "If-Match": '"6"' }), context);
    expect(response.status).toBe(201); expect(response.headers.get("etag")).toBe('"7"');
    expect(calls[1]?.body).toMatchObject({ p_site_id: "veyocast", p_environment: "test", p_external_id: externalId, p_expected_revision: 6, p_idempotency_key: `sh_blog_${"a".repeat(64)}/draft`, p_payload: { seoTitle: payload.seo.title, content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 } }, { type: "paragraph" }] } } });
  });
  it("requires a strong revision precondition and rejects unknown or unsafe content", async () => {
    for (const ifMatch of ['W/"6"', "6", '"-1"']) expect((await save(request(`/posts/${externalId}`, "PUT", payload, { "If-Match": ifMatch }), context)).status).toBe(400);
    const malicious = { ...payload, content: { format: "markdown", body: "[Klik](javascript:alert(1))" } };
    const response = await save(request(`/posts/${externalId}`, "PUT", malicious), context);
    expect(response.status).toBe(400); expect((await response.json()).error.code).toBe("INVALID_REQUEST");
    commandError = "REVISION_CONFLICT";
    const missing = await save(request(`/posts/${externalId}`, "PUT", payload), context);
    expect(missing.status).toBe(428); expect((await missing.json()).error.code).toBe("REVISION_REQUIRED");
  });
  it("publishes exactly the requested revision and leaves restart recovery to the durable transaction", async () => {
    const response = await publish(request(`/posts/${externalId}/publish`, "POST", { revision: 7 }, { "Idempotency-Key": `sh_blog_${"a".repeat(64)}/publish` }), context);
    expect(response.status).toBe(200); expect(await response.json()).toEqual(result);
    expect(calls[1]?.body).toMatchObject({ p_operation: "publish", p_payload: { revision: 7 }, p_expected_revision: 7 });
    expect((await publish(request(`/posts/${externalId}/publish`, "POST", { revision: 6, title: "stale" }), context)).status).toBe(400);
  });
  it("returns status and fixed safe error codes without database details or credential data", async () => {
    expect((await status(request(`/posts/${externalId}`), context)).status).toBe(200);
    commandError = "SLUG_CONFLICT";
    const response = await save(request(`/posts/${externalId}`, "PUT", payload), context);
    expect(response.status).toBe(409); const text = await response.text();
    expect(text).toContain("SLUG_CONFLICT"); expect(text).not.toContain(token); expect(text).not.toContain("sb_secret_"); expect(text).not.toContain("PT409");
  });
});
