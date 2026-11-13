import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getControlSession } from "../control-session";
import { blogSiteOrigin } from "./config";

export async function canEditBlog() {
  const identity = (await headers()).get("oai-authenticated-user-id");
  if (!identity && !import.meta.env.DEV) return false;
  const session = await getControlSession();
  return Boolean(session?.roles.includes("platform_admin"));
}

export async function requireBlogEditor() {
  if (!(await canEditBlog())) notFound();
}

export function sameBlogOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin || origin === blogSiteOrigin;
}
