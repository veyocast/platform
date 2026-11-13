import {resolveBlogConfig} from "@veyocast/blog";
import {blogError, blogFailure, downloadBlogStorage, sha256} from "@veyocast/blog/server";
import {requireBlogStaff} from "../../../../../lib/blog-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: {params: Promise<{id: string}>}) {
  try {
    const {client, accessToken} = await requireBlogStaff();
    const {id} = await context.params;
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(id)) throw blogError("NOT_FOUND", 404);
    const config = resolveBlogConfig();
    const result = await client.from("platform_blog_assets").select("storage_path,output_sha256,type,bytes")
      .eq("id", id).eq("site_id", config.siteId).eq("environment", config.environment).eq("status", "ready").maybeSingle();
    const asset = result.data;
    if (result.error || !asset) throw blogError("NOT_FOUND", 404);
    const bytes = await downloadBlogStorage(asset.storage_path, accessToken);
    if (bytes.byteLength !== Number(asset.bytes) || sha256(bytes) !== asset.output_sha256 || !["image/png", "image/jpeg", "image/webp"].includes(asset.type)) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
    return new Response(bytes as BodyInit, {headers: {"Content-Type": asset.type, "Content-Length": String(bytes.byteLength), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex", "Content-Security-Policy": "default-src 'none'; sandbox"}});
  } catch (error) {return blogFailure(error);}
}
