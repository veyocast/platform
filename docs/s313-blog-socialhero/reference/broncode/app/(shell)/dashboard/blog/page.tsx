import type { Metadata } from "next";
import { requireBlogEditor } from "../../../../lib/blog/access";
import { blogSiteOrigin } from "../../../../lib/blog/config";
import { listEntries } from "../../../../lib/blog/store";
import { BlogAdmin } from "./_components/blog-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blogbeheer | VeyoCast Control", robots: { index: false, follow: false } };

export default async function BlogAdminPage() {
  await requireBlogEditor();
  return <BlogAdmin initialEntries={await listEntries()} canonicalOrigin={blogSiteOrigin} />;
}
