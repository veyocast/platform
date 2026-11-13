import type { Metadata } from "next";
import { blogSiteOrigin } from "../../../lib/blog/config";
import { publishedArticles } from "../../../lib/blog/store";
import { BlogIndexPage } from "./_blog/blog-public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Blog over ClubTV en narrowcasting | VeyoCast",
  description: "Praktische artikelen over ClubTV, narrowcasting, sponsoring en schermcontent voor sportverenigingen.",
  alternates: { canonical: `${blogSiteOrigin}/blog` },
};

export default async function BlogIndex({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  const { categorie } = await searchParams;
  return <BlogIndexPage articles={await publishedArticles()} category={categorie} />;
}
