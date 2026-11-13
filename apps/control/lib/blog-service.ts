import "server-only";

import {hasCapability, type Capability} from "@veyocast/auth";
import {resolveBlogConfig, validateArticleDraft, type BlogEntry} from "@veyocast/blog";
import {BlogHttpError, blogCommand, blogError} from "@veyocast/blog/server";

import {getControlSession, requireControlCapability} from "./control-session";
import {createControlSupabaseClient} from "./supabase/server";

/** Authorization is established against the existing verified Control session. */
export async function requireBlogStaff(capability: Capability = "platform.blog.read", mutation = false) {
  const session = await getControlSession();
  if (!session?.isLive || !hasCapability(session.capabilities, capability)) throw blogError("PERMISSION_DENIED", 403);
  if (mutation && session.assuranceLevel !== "aal2") throw new BlogHttpError(403, "MFA_REQUIRED", "Bevestig je tweestapsverificatie voordat je het artikel wijzigt. Je inhoud is hier behouden; open de tweestapsverificatie en probeer opnieuw.");
  await requireControlCapability(capability, {aal2: mutation, returnTo: "/platform/blog"});
  const client = await createControlSupabaseClient();
  if (!client) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
  // getSession only obtains the token after getControlSession has verified identity.
  // The user JWT then reaches the existing staff/AAL2 database guards unchanged.
  const result = await client.auth.getSession();
  const accessToken = result.data.session?.access_token;
  if (result.error || !accessToken || result.data.session?.user.id !== session.userId) throw blogError("PERMISSION_DENIED", 403);
  return {session, client, accessToken};
}

export function assertBlogControlOrigin(request: Request) {
  try {
    const supplied = request.headers.get("origin");
    const expected = new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() || request.url);
    const origin = supplied ? new URL(supplied) : null;
    const host = request.headers.get("host");
    if (!origin || origin.origin !== supplied || origin.origin !== expected.origin || host && host !== expected.host) throw new Error("origin");
  } catch { throw blogError("PERMISSION_DENIED", 403); }
}

export function getBlogPublicOrigin() {
  try {return resolveBlogConfig().publicOrigin;} catch {return "";}
}

export function blogEntryFromResponse(value: Record<string, unknown>, payload: unknown = value.payload): BlogEntry {
  if (typeof value.id !== "string" || typeof value.externalId !== "string" || !Number.isSafeInteger(value.draftRevision) || value.publishedRevision !== null && !Number.isSafeInteger(value.publishedRevision) || typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt))) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
  return {
    id: value.id, externalId: value.externalId, draftRevision: Number(value.draftRevision),
    publishedRevision: value.publishedRevision === null ? null : Number(value.publishedRevision),
    draft: validateArticleDraft(payload), updatedAt: value.updatedAt,
    publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : null,
    publicUrl: typeof value.publicUrl === "string" ? value.publicUrl : null,
    publishedSlug: typeof value.publishedSlug === "string" ? value.publishedSlug : null
  };
}

export async function getBlogEntries(): Promise<BlogEntry[]> {
  const {accessToken} = await requireBlogStaff();
  const result = await blogCommand("list", {accessToken});
  if (!Array.isArray(result.body)) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
  return result.body.map((row: Record<string, unknown>) => blogEntryFromResponse(row));
}

export async function getBlogEntry(externalId: string): Promise<BlogEntry | null> {
  const {accessToken} = await requireBlogStaff();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(externalId)) return null;
  try {return blogEntryFromResponse((await blogCommand("status", {externalId, accessToken})).body);}
  catch (error) {if (error instanceof Error && "code" in error && error.code === "NOT_FOUND") return null; throw error;}
}
