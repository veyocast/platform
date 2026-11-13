import {validateArticleDraft} from "@veyocast/blog";
import {blogCommand, blogError, blogFailure, blogJson, readBlogJson, sha256} from "@veyocast/blog/server";
import {assertBlogControlOrigin, blogEntryFromResponse, getBlogEntries, requireBlogStaff} from "../../../../lib/blog-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {return blogJson({entries: await getBlogEntries()}, 200, {"X-Robots-Tag": "noindex"});}
  catch (error) {return blogFailure(error);}
}

export async function POST(request: Request) {
  try {
    assertBlogControlOrigin(request);
    const body = await readBlogJson(request);
    if (!Object.keys(body).every(key => ["action", "externalId", "expectedRevision", "draft", "idempotencyKey"].includes(key)) || !["save", "publish"].includes(String(body.action)) || typeof body.idempotencyKey !== "string" || !/^[A-Za-z0-9_.:-]{8,120}$/u.test(body.idempotencyKey)) throw blogError("INVALID_REQUEST");
    const publishing = body.action === "publish";
    const {accessToken} = await requireBlogStaff("platform.blog.write", true);
    if (publishing) await requireBlogStaff("platform.blog.publish", true);
    const expectedRevision = body.expectedRevision === undefined ? null : body.expectedRevision;
    if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || Number(expectedRevision) < 1)) throw blogError("INVALID_REQUEST");
    const externalId = body.externalId === undefined ? `manual_${sha256(body.idempotencyKey).slice(0, 48)}` : body.externalId;
    if (typeof externalId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(externalId)) throw blogError("INVALID_REQUEST");
    const draft = validateArticleDraft(body.draft, publishing);
    // Each durable receipt replays before checking the original revision. A restart
    // after the save resumes publication with the original payload and keys.
    const saved = await blogCommand("upsert", {externalId, payload: draft, expectedRevision: expectedRevision as number | null, idempotencyKey: `${body.idempotencyKey}:save`, accessToken});
    const revision = saved.body.draftRevision;
    if (!Number.isSafeInteger(revision) || Number(revision) < 1) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
    const result = publishing ? await blogCommand("publish", {externalId, payload: {revision}, expectedRevision: Number(revision), idempotencyKey: `${body.idempotencyKey}:publish`, accessToken}) : saved;
    return blogJson({entry: blogEntryFromResponse(result.body, draft)}, result.httpStatus, {"X-Robots-Tag": "noindex"});
  } catch (error) {return blogFailure(error);}
}
