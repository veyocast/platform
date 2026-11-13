import { socialHeroDraft } from "@veyocast/blog";
import { authorizeBlogToken, blogCommand, blogError, blogFailure, blogJson, readBlogJson, requestKey } from "@veyocast/blog/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ externalId: string }> };
function identity(value: string) { if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(value)) throw blogError("INVALID_REQUEST"); return value; }
export async function GET(request: Request, context: Context) {
  try {
    const token = await authorizeBlogToken(request, "posts:read"); const externalId = identity((await context.params).externalId);
    const result = await blogCommand("status", { tokenHash: token.hash, externalId });
    return blogJson(result.body, result.httpStatus);
  } catch (error) { return blogFailure(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    const token = await authorizeBlogToken(request, "posts:write"); const externalId = identity((await context.params).externalId);
    const key = requestKey(request); const ifMatch = request.headers.get("if-match");
    let expectedRevision: number | undefined;
    if (ifMatch !== null) {
      const match = /^"([1-9][0-9]{0,9})"$/u.exec(ifMatch);
      if (!match || !Number.isSafeInteger(Number(match[1]))) throw blogError("INVALID_REQUEST");
      expectedRevision = Number(match[1]);
    }
    const draft = socialHeroDraft(await readBlogJson(request));
    // Let the transaction replay an original create before checking current revision.
    try {
      const result = await blogCommand("upsert", { tokenHash: token.hash, externalId, payload: draft, expectedRevision, idempotencyKey: key });
      return blogJson(result.body, result.httpStatus, { ETag: `"${result.body.revision}"` });
    } catch (error) {
      if (expectedRevision === undefined && error instanceof Error && "code" in error && error.code === "REVISION_CONFLICT") throw blogError("REVISION_REQUIRED", 428);
      throw error;
    }
  } catch (error) { return blogFailure(error); }
}
