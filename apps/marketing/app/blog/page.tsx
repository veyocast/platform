import type { Metadata } from "next";

import { blogCanonicalUrl, getPublishedBlogPosts } from "../_lib/blog-source";
import { isPublicIndexEnvironment } from "../_lib/site-config";
import { BlogIndexPage } from "./_blog/blog-public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog over ClubTV en narrowcasting | VeyoCast",
  description: "Praktische artikelen over ClubTV, narrowcasting, sponsoring en schermcontent voor sportverenigingen.",
  alternates: { canonical: blogCanonicalUrl("/blog") },
  robots: { index: isPublicIndexEnvironment(), follow: isPublicIndexEnvironment() }
};

export default async function BlogIndex({ searchParams }: { searchParams: Promise<{ categorie?: string | string[] }> }) {
  const { categorie } = await searchParams;
  return <BlogIndexPage articles={await getPublishedBlogPosts()} category={typeof categorie === "string" ? categorie : undefined} />;
}
