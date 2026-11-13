import { z } from "zod";
import { canEditBlog, sameBlogOrigin } from "../../../lib/blog/access";
import { draftSchema } from "../../../lib/blog/draft";
import { BlogWriteError, listEntries, writeEntry } from "../../../lib/blog/store";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const requestSchema = z.object({
  action: z.enum(["save", "publish"]),
  id: z.string().max(100).optional(),
  expectedRevision: z.number().int().nonnegative().nullish(),
  draft: draftSchema,
  source: z.enum(["manual", "socialhero"]).optional(),
});

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}

export async function GET() {
  if (!(await canEditBlog())) return reply({ error: "Toegang geweigerd." }, 403);
  return reply({ entries: await listEntries() });
}

export async function POST(request: Request) {
  if (!sameBlogOrigin(request) || !(await canEditBlog())) return reply({ error: "Toegang geweigerd." }, 403);
  try {
    const body = await request.text();
    if (body.length > 110_000) return reply({ error: "Het artikel is te groot." }, 413);
    const payload = requestSchema.safeParse(JSON.parse(body));
    if (!payload.success) return reply({ error: "Controleer de artikelvelden.", fields: payload.error.flatten().fieldErrors }, 400);
    const entry = await writeEntry(payload.data);
    return reply({ entry, entries: await listEntries() });
  } catch (error) {
    if (error instanceof BlogWriteError) return reply({ error: error.message, code: error.code }, error.status);
    if (error instanceof SyntaxError) return reply({ error: "Ongeldige JSON." }, 400);
    console.error("Blog demo write failed", error);
    return reply({ error: "Opslaan is mislukt. Probeer het opnieuw." }, 500);
  }
}
