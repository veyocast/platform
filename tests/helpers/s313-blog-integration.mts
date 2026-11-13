/** End-to-end API evidence using the actual SocialHero client and Next app.
 * The backend is explicitly a LOCAL TEST ADAPTER over real disposable PG/RLS. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { adapterQuery, readAdapterConfig, runtimeDirectory } from "./s313-blog-backend.mts";

type Row = Record<string, unknown>;
type Media = { assetId: string; width: number; height: number; type: string };
type Client = {
  capabilities(environment: string): Promise<Row>; upload(bytes: Buffer, mime: string, name: string, key: string): Promise<Media>;
  put(id: string, payload: Row, key: string, revision?: number): Promise<Row>; status(id: string): Promise<Row>;
  publish(id: string, revision: number, key: string): Promise<Row>; verify(url: string, expected: { externalId: string; revision: number }): Promise<{ publicUrl: string }>;
};
type Prototype = { type: string; locale: string; title: string; slug: string; excerpt: string; content: unknown; seoTitle: string; seoDescription: string; category: string; tags: string[]; hero: { src: string; alt: string; x: number; y: number }; socialImage: string };
type Step = { name: string; result: unknown; startedAt: string; completedAt: string; durationMs: number };
type State = { runId: string; steps: Step[]; failures: Array<{ step: string; code: string; status: number | null }> };
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const statePath = `${runtimeDirectory}/integration-state.json`;
const evidence = join(process.cwd(), "docs/s313-blog-socialhero/evidence/integration");
const clientSource = "/home/codex/.codex/worktrees/veyocast-blog-adapter/socialhero/src/server/blog-client.ts";

async function verifyWorkerCompletion() {
  const config = await readAdapterConfig();
  const workerPath = resolve(clientSource, "../../../docs/veyocast-blog-evidence/worker-next-result.json");
  const workerBytes = await readFile(workerPath);
  const worker = JSON.parse(workerBytes.toString()) as { status: string; assertions: Record<string, unknown> };
  assert.equal(worker.status, "passed");
  assert.equal(worker.assertions.publishWrites, 1); assert.equal(worker.assertions.articleReceipts, 1);
  const counts = await adapterQuery("select jsonb_build_object('posts',(select count(*) from public.platform_blog_posts),'assets',(select count(*) from public.platform_blog_assets),'published',(select count(*) from public.platform_blog_publications),'revisions',(select count(*) from public.platform_blog_revisions),'storageObjects',(select count(*) from storage.objects where bucket_id='platform_blog_media'))");
  assert.deepEqual(counts, { posts: 4, assets: 8, published: 4, revisions: 7, storageObjects: 8 });
  const installedBlogFunctions = await adapterQuery("select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'sha256',encode(extensions.digest(pg_get_functiondef(p.oid),'sha256'),'hex')) order by n.nspname,p.proname,p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like '%blog%'");
  const sourceFiles = [
    "tests/helpers/s313-blog-backend.mts", "tests/helpers/s313-blog-integration.mts", "tests/e2e/blog-publication.spec.ts",
    "apps/marketing/app/_lib/blog-source.ts", "apps/marketing/next.config.mjs",
    "packages/blog/src/media.ts", "packages/blog/src/server.ts", "packages/blog/src/config.ts",
    ...execFileSync("rg", ["--files", "apps/marketing/app/blog", "apps/marketing/app/api/socialhero", "apps/marketing/app/api/blog"], { encoding: "utf8" }).trim().split("\n")
  ];
  const files = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, sha256(await readFile(file))])));
  const databaseGate = JSON.parse(await readFile(join(evidence, "../database/summary.json"), "utf8")) as { sourceFiles: unknown };
  await writeFile(join(evidence, "post-worker.json"), `${JSON.stringify({ status: "passed", command: "./node_modules/.bin/tsx tests/helpers/s313-blog-integration.mts --verify-worker", checkedAt: new Date().toISOString(), database: config.database, counts, workerReport: { repository: "SocialHero", path: "docs/veyocast-blog-evidence/worker-next-result.json", sha256: sha256(workerBytes), assertions: worker.assertions }, source: { veyocast: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), uncommittedCandidate: true, files }, installedDatabaseGateSource: databaseGate.sourceFiles, installedBlogFunctions, limitations: ["Explicit LOCAL TEST ADAPTER with synthetic Auth and Storage HTTP; real PostgreSQL/RLS and actual Next routes.", "This integration database remains at the recorded initial migration hash. A subsequent direct-RPC slug-type guard is checked by separate final fresh-database gates; application routes already reject those types."] }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: "passed", counts, secretsPrinted: false, report: "docs/s313-blog-socialhero/evidence/integration/post-worker.json" })}\n`);
}

async function main() {
  if (process.argv.includes("--verify-worker")) return verifyWorkerCompletion();
  const config = await readAdapterConfig();
  process.env.SOCIALHERO_ENV = "development";
  const clientFingerprint = sha256(await readFile(clientSource));
  const { BlogClient } = await import(pathToFileURL(clientSource).href);
  const client = new BlogClient(config.marketingOrigin, config.siteCredential, { environment: "development" }) as Client;
  const prototypeSource = resolve("docs/s313-blog-socialhero/reference/broncode/app/(marketing)/blog/_blog/blog-seed.ts");
  const prototypes = (await import(pathToFileURL(prototypeSource).href)).blogDemoArticles as Prototype[];
  let state: State;
  try { state = JSON.parse(await readFile(statePath, "utf8")); } catch { state = { runId: randomBytes(5).toString("hex"), steps: [], failures: [] }; }
  await mkdir(evidence, { recursive: true });
  const save = async () => {
    await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
    const report = { kind: "actual-next-and-socialhero-client-with-local-postgres-test-adapter", source: { veyocast: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), candidateContainsUncommittedChanges: true, socialHero: execFileSync("git", ["-C", resolve(clientSource, "../../.."), "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), socialHeroClientSha256: clientFingerprint, prototypeDatasetSha256: sha256(await readFile(prototypeSource)) }, adapter: { database: config.database, backendOrigin: config.backendOrigin, marketingOrigin: config.marketingOrigin, syntheticAuth: true, syntheticStorageHttp: true, realSql: true, realRls: true, credentialsOmitted: true }, ...state };
    await writeFile(join(evidence, "result.json"), `${JSON.stringify(report, null, 2)}\n`);
  };
  async function step<T>(name: string, work: () => Promise<T>): Promise<T> {
    const previous = state.steps.find((entry) => entry.name === name);
    if (previous) return previous.result as T;
    const started = Date.now();
    try {
      const result = await work();
      state.steps.push({ name, result, startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString(), durationMs: Date.now() - started });
      await save(); process.stdout.write(`${JSON.stringify({ step: name, status: "passed" })}\n`); return result;
    } catch (error) {
      const failure = error as { code?: string; status?: number; name?: string };
      state.failures.push({ step: name, code: failure.code ?? failure.name ?? "UNKNOWN", status: failure.status ?? null });
      await save(); process.stdout.write(`${JSON.stringify({ step: name, status: "failed", code: failure.code ?? failure.name ?? "UNKNOWN", httpStatus: failure.status ?? null })}\n`); throw error;
    }
  }
  const origin = config.marketingOrigin;
  const headers = { apikey: config.serviceRoleKey, authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" };
  const external = (index: number) => `s313-${state.runId}-${index}`;
  const operationKey = (id: string, operation: string) => `sh_blog_${sha256(`${state.runId}/${id}/${operation}`)}/${operation}`;
  async function expectCode(work: () => Promise<unknown>, expected: string) {
    try { await work(); } catch (error) { const failure = error as { code?: string; status?: number }; assert.equal(failure.code, expected); return { code: failure.code, status: failure.status }; }
    assert.fail(`Expected ${expected}.`);
  }
  async function health() { const response = await fetch(`${config.backendOrigin}/_s313/health`); assert.equal(response.status, 200); return response.json() as Promise<{ instance: string }>; }
  async function afterCommitRestart(operation: string, key: string, work: () => Promise<unknown>) {
    const before = await health();
    const arm = await fetch(`${config.backendOrigin}/_s313/inject`, { method: "POST", headers, body: JSON.stringify({ rpc: "blog_command", operation, key, restart: true }) }); assert.equal(arm.status, 200);
    let ambiguous: { code?: string; status?: number } | undefined;
    try { await work(); } catch (error) { ambiguous = error as { code?: string; status?: number }; }
    assert.ok(ambiguous && Number(ambiguous.status) >= 500, "The HTTP response must fail after the real database commit.");
    for (let attempt = 0; attempt < 50; attempt++) {
      await new Promise((done) => setTimeout(done, 100));
      try { const next = await health(); if (next.instance !== before.instance) return { errorCode: ambiguous.code, httpStatus: ambiguous.status, processRestarted: true }; } catch { /* Supervisor is restarting the isolated adapter. */ }
    }
    assert.fail("The controlled adapter restart did not recover.");
  }
  async function publicHtml(url: string) { const response = await fetch(url, { redirect: "manual", headers: { "User-Agent": "SocialHeroBlogPublisher/1.0" } }); assert.equal(response.status, 200); return response.text(); }
  // The supplied Sites fixture hosts home below /website. Real VeyoCast keeps
  // the same text but resolves those internal destinations from marketing /.
  const payload = (prototype: Prototype, hero: Media, social: Media): Row => ({ type: prototype.type, locale: prototype.locale, title: prototype.title, slug: prototype.slug, excerpt: prototype.excerpt, content: { format: "tiptap", body: JSON.parse(JSON.stringify(prototype.content).replaceAll('"/website/', '"/')) }, seo: { title: prototype.seoTitle, description: prototype.seoDescription }, authorId: "redactie", categoryId: prototype.category, tags: prototype.tags, hero: { assetId: hero.assetId, alt: prototype.hero.alt, focalPoint: { x: prototype.hero.x, y: prototype.hero.y } }, ogImageAssetId: social.assetId });
  const sourceImage = (path: string) => readFile(join(process.cwd(), "docs/s313-blog-socialhero/reference/broncode/public", path.replace(/^\//u, "")));

  await step("unauthorized-and-wrong-credential", async () => {
    const missing = await fetch(`${origin}/api/socialhero/v1/capabilities`); assert.equal(missing.status, 401); assert.equal((await missing.json()).error.code, "INVALID_CREDENTIAL");
    const wrong = await fetch(`${origin}/api/socialhero/v1/capabilities`, { headers: { Authorization: `Bearer ${"example_invalid_".repeat(3)}` } }); assert.equal(wrong.status, 401); assert.equal((await wrong.json()).error.code, "INVALID_CREDENTIAL");
    return { missing: 401, wrong: 401 };
  });
  await step("real-socialhero-capabilities", async () => { const capabilities = await client.capabilities("development"); assert.equal(capabilities.siteId, "veyocast"); assert.equal(capabilities.blogPath, "/blog"); return capabilities; });
  await step("expired-revoked-scope-and-environment-credentials", async () => {
    assert.ok(config.credentialVariants);
    const results = [];
    for (const [variant, credential] of Object.entries(config.credentialVariants)) {
      const route = variant === "readOnly" ? "/media" : "/capabilities";
      const response = await fetch(`${origin}/api/socialhero/v1${route}`, { method: variant === "readOnly" ? "POST" : "GET", headers: { Authorization: `Bearer ${credential}` } });
      const expected = variant === "readOnly" || variant === "wrongEnvironment" ? 403 : 401;
      assert.equal(response.status, expected);
      results.push({ variant, status: response.status, code: (await response.json()).error.code });
    }
    const parts = config.anonKey.split("."); const signature = parts[2]!;
    parts[2] = (signature.startsWith("a") ? "b" : "a") + signature.slice(1);
    const invalid = parts.join(".");
    const response = await fetch(`${config.backendOrigin}/rest/v1/platform_blog_publications?select=id`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${invalid}` } });
    assert.equal(response.status, 401);
    return { results, adapterRejectsTamperedJwt: true };
  });
  const first = prototypes[0]!;
  const heroBytes = await sourceImage(first.hero.src);
  await step("media-commit-timeout-and-process-restart", () => afterCommitRestart("media.complete", operationKey(external(0), "hero"), () => client.upload(heroBytes, "image/webp", "portrait.webp", operationKey(external(0), "hero"))));
  const firstHero = await step("media-replay-after-restart", async () => {
    const result = await client.upload(heroBytes, "image/webp", "portrait.webp", operationKey(external(0), "hero"));
    const repeat = await client.upload(heroBytes, "image/webp", "portrait.webp", operationKey(external(0), "hero"));
    assert.deepEqual(repeat, result); assert.equal(result.width, 1600); assert.equal(result.height, 2000); return result;
  });
  const firstSocial = await step("separate-wide-social-image", () => sourceImage(first.socialImage).then((bytes) => client.upload(bytes, "image/jpeg", "social.jpg", operationKey(external(0), "og"))));
  const firstPayload = payload(first, firstHero, firstSocial);
  await step("draft-commit-timeout-and-process-restart", () => afterCommitRestart("upsert", operationKey(external(0), "draft"), () => client.put(external(0), firstPayload, operationKey(external(0), "draft"))));
  const draft = await step("draft-status-and-durable-replay", async () => {
    const status = await client.status(external(0)); assert.equal(status.draftRevision, 1); assert.equal(status.publishedRevision, null);
    const original = await client.put(external(0), firstPayload, operationKey(external(0), "draft")); assert.equal(original.revision, 1); return original;
  });
  await step("draft-and-media-stay-private", async () => {
    const page = await fetch(`${origin}/blog/${first.slug}`); assert.equal(page.status, 404);
    const media = await fetch(`${origin}/api/blog/media/${firstHero.assetId}`); assert.equal(media.status, 404);
    const query = new URLSearchParams({ select: "id,external_id", external_id: `eq.${external(0)}` });
    const anon = await fetch(`${config.backendOrigin}/rest/v1/platform_blog_publications?${query}`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` } }); assert.equal(anon.status, 200); assert.deepEqual(await anon.json(), []);
    return { detail: 404, media: 404, anonymousPublications: [] };
  });
  await step("same-key-different-content-conflict", () => expectCode(() => client.put(external(0), { ...firstPayload, title: "Andere inhoud" }, operationKey(external(0), "draft")), "IDEMPOTENCY_CONFLICT"));
  await step("slug-collision-is-transactional", () => expectCode(() => client.put(`${external(0)}-collision`, firstPayload, operationKey(external(0), "collision")), "SLUG_CONFLICT"));
  await step("publish-commit-timeout-and-process-restart", () => afterCommitRestart("publish", operationKey(external(0), "publish"), () => client.publish(external(0), Number(draft.revision), operationKey(external(0), "publish"))));
  const published = await step("publication-status-replay-and-real-client-verifier", async () => {
    const status = await client.status(external(0)); assert.equal(status.publishedRevision, 1);
    const result = await client.publish(external(0), 1, operationKey(external(0), "publish")); assert.equal(result.publishedRevision, 1);
    const verified = await client.verify(String(result.publicUrl), { externalId: external(0), revision: 1 });
    const html = await publicHtml(verified.publicUrl); assert.ok(html.includes(first.title)); assert.ok(html.includes('application/ld+json')); assert.ok(html.includes('noindex'));
    const head = /<head\b[^>]*>([\s\S]*?)<\/head>/iu.exec(html)?.[1] ?? "";
    assert.ok(head.includes(`name="socialhero:external-id" content="${external(0)}"`));
    assert.ok(head.includes(`property="og:image:width" content="${firstSocial.width}"`));
    assert.ok(head.includes(`property="og:image:height" content="${firstSocial.height}"`));
    assert.equal(html.match(/<h1(?:\s|>)/gu)?.length, 1);
    const image = await fetch(`${origin}/api/blog/media/${firstHero.assetId}`); assert.equal(image.status, 200); assert.equal(image.headers.get("content-type"), "image/webp");
    assert.ok((await (await fetch(`${origin}/blog`)).text()).includes(first.title));
    assert.ok((await (await fetch(`${origin}/sitemap.xml`)).text()).includes(verified.publicUrl));
    return { ...result, publicUrl: String(result.publicUrl), verified: true, publicationMarkersInActiveHead: true, actualSeparateOgDimensions: { width: firstSocial.width, height: firstSocial.height }, publicMediaStatus: image.status };
  });
  const secondPayload = { ...firstPayload, title: `${first.title} — redactionele update`, ogImageAssetId: null };
  const revision2 = await step("editable-revision-preserves-live-and-title-url", async () => {
    const writers = await Promise.allSettled([client.put(external(0), secondPayload, operationKey(external(0), "revision2a"), 1), client.put(external(0), secondPayload, operationKey(external(0), "revision2b"), 1)]);
    const successes = writers.filter((writer): writer is PromiseFulfilledResult<Row> => writer.status === "fulfilled");
    const conflicts = writers.filter((writer): writer is PromiseRejectedResult => writer.status === "rejected");
    assert.equal(successes.length, 1); assert.equal(conflicts.length, 1); assert.equal(conflicts[0]!.reason.code, "REVISION_CONFLICT");
    const result = successes[0]!.value; assert.equal(result.revision, 2);
    const html = await publicHtml(String(published.publicUrl)); assert.ok(!html.includes("redactionele update"));
    await client.verify(String(published.publicUrl), { externalId: external(0), revision: 1 });
    return { ...result, revision: Number(result.revision), concurrentSuccessfulWrites: 1, concurrentConflicts: 1 };
  });
  await step("old-job-and-missing-revision-cannot-overwrite", async () => {
    const stale = await expectCode(() => client.put(external(0), { ...firstPayload, excerpt: "Verouderde update" }, operationKey(external(0), "stale"), 1), "REVISION_CONFLICT");
    const missing = await expectCode(() => client.put(external(0), firstPayload, operationKey(external(0), "missing")), "REVISION_REQUIRED");
    return { stale, missing };
  });
  await step("publish-approved-second-revision", async () => {
    const result = await client.publish(external(0), Number(revision2.revision), operationKey(external(0), "publish2")); assert.equal(result.publicUrl, published.publicUrl);
    await client.verify(String(result.publicUrl), { externalId: external(0), revision: 2 });
    const head = /<head\b[^>]*>([\s\S]*?)<\/head>/iu.exec(await publicHtml(String(result.publicUrl)))?.[1] ?? "";
    assert.ok(head.includes(`property="og:image:width" content="${firstHero.width}"`)); assert.ok(head.includes(`property="og:image:height" content="${firstHero.height}"`));
    return { ...result, actualPortraitOgFallbackDimensions: { width: firstHero.width, height: firstHero.height } };
  });
  const changed = await step("explicit-slug-change-with-permanent-redirect", async () => {
    const slug = `${first.slug}-actueel`;
    const changedDraft = await client.put(external(0), { ...firstPayload, slug }, operationKey(external(0), "revision3"), 2); assert.equal(changedDraft.revision, 3);
    const result = await client.publish(external(0), 3, operationKey(external(0), "publish3"));
    const old = await fetch(String(published.publicUrl), { redirect: "manual" }); assert.equal(old.status, 308); assert.equal(new URL(old.headers.get("location")!, origin).href, result.publicUrl);
    await client.verify(String(result.publicUrl), { externalId: external(0), revision: 3 }); return result;
  });
  const current = await step("all-historical-slugs-redirect-directly-to-current", async () => {
    const slug = `${first.slug}-definitief`;
    const changedDraft = await client.put(external(0), { ...firstPayload, slug }, operationKey(external(0), "revision4"), 3); assert.equal(changedDraft.revision, 4);
    const result = await client.publish(external(0), 4, operationKey(external(0), "publish4"));
    for (const oldUrl of [published.publicUrl, changed.publicUrl]) { const old = await fetch(String(oldUrl), { redirect: "manual" }); assert.equal(old.status, 308); assert.equal(new URL(old.headers.get("location")!, origin).href, result.publicUrl); }
    await client.verify(String(result.publicUrl), { externalId: external(0), revision: 4 }); return result;
  });
  await step("publish-the-other-two-exact-prototype-articles", async () => {
    const results = [];
    for (const [index, prototype] of prototypes.entries()) {
      if (!index) continue;
      const hero = await client.upload(await sourceImage(prototype.hero.src), "image/webp", "portrait.webp", operationKey(external(index), "hero"));
      const social = await client.upload(await sourceImage(prototype.socialImage), "image/jpeg", "social.jpg", operationKey(external(index), "og"));
      const draft = await client.put(external(index), payload(prototype, hero, social), operationKey(external(index), "draft"));
      const result = await client.publish(external(index), Number(draft.revision), operationKey(external(index), "publish"));
      await client.verify(String(result.publicUrl), { externalId: external(index), revision: Number(draft.revision) }); results.push(result);
    }
    return results;
  });
  await step("spoofed-and-corrupt-real-uploads-are-rejected", async () => {
    const spoofed = await expectCode(() => client.upload(heroBytes, "image/jpeg", "spoofed.jpg", operationKey("invalid", "spoofed")), "INVALID_MEDIA");
    const corrupt = await expectCode(() => client.upload(Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0, 1]), "image/jpeg", "corrupt.jpg", operationKey("invalid", "corrupt")), "INVALID_MEDIA");
    return { spoofed, corrupt };
  });
  await step("durable-rate-limit-returns-retry-after", async () => {
    for (let attempt = 0; attempt < 22; attempt++) {
      const response = await fetch(`${origin}/api/socialhero/v1/media`, { method: "POST", headers: { Authorization: `Bearer ${config.siteCredential}`, "Idempotency-Key": operationKey("limit", "hero"), "Content-Type": "application/json" }, body: "{}" });
      if (response.status === 429) { assert.ok(Number(response.headers.get("retry-after")) > 0); return { status: 429, code: (await response.json()).error.code, retryAfterPresent: true }; }
      assert.equal(response.status, 415);
    }
    assert.fail("The persisted media rate limit did not activate.");
  });
  await step("database-counts-and-final-canonical-sitemap", async () => {
    const counts = await adapterQuery(`select jsonb_build_object('posts',(select count(*) from public.platform_blog_posts),'assets',(select count(*) from public.platform_blog_assets),'storageObjects',(select count(*) from storage.objects where bucket_id='platform_blog_media'),'published',(select count(*) from public.platform_blog_posts where published_revision is not null),'revisions',(select count(*) from public.platform_blog_revisions))`) as Record<string, number>;
    assert.equal(counts.posts, 3); assert.equal(counts.published, 3); assert.equal(counts.assets, 6); assert.equal(counts.storageObjects, 6); assert.equal(counts.revisions, 6);
    const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text(); assert.ok(sitemap.includes(String(current.publicUrl))); assert.ok(!sitemap.includes(String(published.publicUrl) + "<")); assert.ok(!sitemap.includes(String(changed.publicUrl) + "<"));
    return { counts, currentPublicUrl: current.publicUrl, noDuplicateLogicalOperation: true };
  });
  await save();
  process.stdout.write(`${JSON.stringify({ complete: true, passed: state.steps.length, report: "docs/s313-blog-socialhero/evidence/integration/result.json", adapter: "LOCAL TEST ADAPTER — real disposable PG/RLS, synthetic Auth/Storage HTTP" })}\n`);
}
main().catch(() => { process.stderr.write("S313 integration stopped. Inspect the safe step output and evidence reports; credentials remain in the private runtime configuration.\n"); process.exitCode = 1; });
