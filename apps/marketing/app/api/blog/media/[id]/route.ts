import { resolveBlogConfig } from "@veyocast/blog";
import { blogError, blogFailure, downloadBlogStorage, publicBlogRows, sha256 } from "@veyocast/blog/server";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: suppliedId } = await context.params;
    const id = suppliedId.toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)) throw blogError("NOT_FOUND", 404);
    const config = resolveBlogConfig();
    const query = new URLSearchParams({ select: "id,storage_path,type,bytes,output_sha256", id: `eq.${id}`, site_id: `eq.${config.siteId}`, environment: `eq.${config.environment}`, limit: "1" });
    const asset = (await publicBlogRows<{ storage_path: string; type: string; bytes: number; output_sha256: string }>("platform_blog_assets", query))[0];
    if (!asset || !asset.storage_path.startsWith(`platform/${config.siteId}/${config.environment}/assets/${id}/`)) throw blogError("NOT_FOUND", 404);
    const bytes = await downloadBlogStorage(asset.storage_path);
    if (bytes.byteLength !== asset.bytes || sha256(bytes) !== asset.output_sha256) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
    return new Response(bytes as BodyInit, { headers: { "Content-Type": asset.type, "Content-Length": String(bytes.byteLength), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
  } catch (error) { return blogFailure(error); }
}
