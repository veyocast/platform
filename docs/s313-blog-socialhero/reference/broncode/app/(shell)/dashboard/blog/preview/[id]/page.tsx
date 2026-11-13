import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBlogEditor } from "../../../../../../lib/blog/access";
import { getEntry } from "../../../../../../lib/blog/store";
import { BlogArticlePage } from "../../../../../(marketing)/blog/_blog/blog-public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blogvoorbeeld | VeyoCast Control", robots: { index: false, follow: false } };

export default async function BlogPreview({ params }: { params: Promise<{ id: string }> }) {
  await requireBlogEditor();
  const entry = await getEntry((await params).id);
  if (!entry) notFound();
  return <div className="veyocast-marketing"><BlogArticlePage article={{ ...entry.draft, id: entry.id, publishedAt: entry.publishedAt ?? entry.updatedAt }} preview /></div>;
}
