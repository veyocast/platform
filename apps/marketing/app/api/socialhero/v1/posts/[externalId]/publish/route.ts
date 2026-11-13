import { authorizeBlogToken, blogCommand, blogError, blogFailure, blogJson, readBlogJson, requestKey } from "@veyocast/blog/server";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ externalId: string }> }) {
  try {
    const token = await authorizeBlogToken(request, "posts:publish"); const externalId = (await context.params).externalId;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(externalId)) throw blogError("INVALID_REQUEST");
    const key = requestKey(request); const payload = await readBlogJson(request);
    if (Object.keys(payload).length !== 1 || !Number.isSafeInteger(payload.revision) || Number(payload.revision) < 1) throw blogError("INVALID_REQUEST");
    const result = await blogCommand("publish", { tokenHash: token.hash, externalId, payload, expectedRevision: Number(payload.revision), idempotencyKey: key });
    // Public routes are uncached runtime reads. A committed publication is visible
    // even if this process exits before returning, with no invalidation side effect.
    return blogJson(result.body, result.httpStatus);
  } catch (error) { return blogFailure(error); }
}
