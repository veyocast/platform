import { env } from "cloudflare:workers";
import { canEditBlog, sameBlogOrigin } from "../../../../lib/blog/access";

const maxBytes = 5 * 1024 * 1024;

function imageType(bytes: Uint8Array) {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => value === bytes[index])) return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function POST(request: Request) {
  if (!sameBlogOrigin(request) || !(await canEditBlog())) return Response.json({ error: "Toegang geweigerd." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > maxBytes + 64 * 1024) return Response.json({ error: "Kies een afbeelding van maximaal 5 MB." }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size > maxBytes) return Response.json({ error: "Kies een JPEG, PNG of WebP van maximaal 5 MB." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = imageType(bytes);
  if (!contentType) return Response.json({ error: "Deze afbeelding is geen ondersteunde JPEG, PNG of WebP." }, { status: 415 });
  if (!env.BUCKET) return Response.json({ error: "Afbeeldingsopslag is tijdelijk niet beschikbaar." }, { status: 503 });
  const id = crypto.randomUUID();
  await env.BUCKET.put(`blog/${id}`, bytes, { httpMetadata: { contentType } });
  return Response.json({ src: `/api/blog-demo/media/${id}` }, { status: 201 });
}
