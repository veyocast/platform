import { env } from "cloudflare:workers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const file = await env.BUCKET?.get(`blog/${id}`);
  if (!file) return new Response(null, { status: 404 });
  const headers = new Headers({ "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" });
  file.writeHttpMetadata(headers);
  return new Response(file.body, { headers });
}
