import { prepareBlogMedia, persistBlogMedia } from "@veyocast/blog/media";
import { authorizeBlogToken, blogError, blogFailure, blogJson, blogMediaLimit, boundedRequestBytes, requestKey } from "@veyocast/blog/server";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const token = await authorizeBlogToken(request, "media:write"); const key = requestKey(request);
    const type = request.headers.get("content-type");
    if (!type?.toLowerCase().startsWith("multipart/form-data;")) throw blogError("INVALID_MEDIA", 415);
    const bytes = await boundedRequestBytes(request, blogMediaLimit + 64 * 1024);
    const form = await new Response(bytes as BodyInit, { headers: { "Content-Type": type } }).formData().catch(() => null);
    if (!form) throw blogError("INVALID_MEDIA", 422);
    const files = form.getAll("file");
    if ([...form.keys()].some((name) => name !== "file") || files.length !== 1 || !(files[0] instanceof File)) throw blogError("INVALID_MEDIA", 422);
    const media = await prepareBlogMedia(files[0]);
    return blogJson(await persistBlogMedia(media, { tokenHash: token.hash, idempotencyKey: key }), 201);
  } catch (error) { return blogFailure(error); }
}
