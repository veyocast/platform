import {resolveBlogConfig} from "@veyocast/blog";
import {prepareBlogMedia, persistBlogMedia} from "@veyocast/blog/media";
import {blogError, blogFailure, blogJson, blogMediaLimit, blogRpc, boundedRequestBytes, requestKey} from "@veyocast/blog/server";
import {assertBlogControlOrigin, requireBlogStaff} from "../../../../../lib/blog-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertBlogControlOrigin(request);
    const {accessToken, session} = await requireBlogStaff("platform.blog.write", true);
    const idempotencyKey = requestKey(request);
    const contentType = request.headers.get("content-type") || "";
    if (!/^multipart\/form-data;\s*boundary=/iu.test(contentType)) throw blogError("INVALID_MEDIA", 415);
    const config = resolveBlogConfig();
    const rate = await blogRpc<{allowed: boolean; code?: string; retryAfter?: number}>("blog_authorize_media_upload", {p_site_id: config.siteId, p_environment: config.environment}, {accessToken});
    if (!rate.allowed) throw rate.code === "RATE_LIMITED" ? blogError("RATE_LIMITED", 429, Number.isSafeInteger(rate.retryAfter) && Number(rate.retryAfter) > 0 ? Number(rate.retryAfter) : 60) : blogError("TEMPORARILY_UNAVAILABLE", 503);
    const bytes = await boundedRequestBytes(request, blogMediaLimit + 65_536);
    const bounded = new Request(request.url, {method: "POST", headers: {"Content-Type": contentType}, body: bytes as BodyInit});
    const form = await bounded.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File) || [...form.keys()].length !== 1) throw blogError("INVALID_MEDIA");
    const result = await persistBlogMedia(await prepareBlogMedia(file), {accessToken, actorId: session.userId, idempotencyKey});
    return blogJson({...result, url: `/api/blog/media/${result.assetId}`}, 201, {"X-Robots-Tag": "noindex"});
  } catch (error) {return blogFailure(error);}
}
