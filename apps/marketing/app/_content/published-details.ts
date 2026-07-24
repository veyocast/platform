import type { MarketingPageDefinition } from "./pages";

export type PublishedMarketingDetail = MarketingPageDefinition & {
  publishedAt: string;
  slug: string;
};

// Bewust leeg: cases en blogposts worden pas toegevoegd nadat inhoud, bewijs,
// publicatiestatus en metadata expliciet zijn goedgekeurd.
export const publishedCases: readonly PublishedMarketingDetail[] = [];
export const publishedBlogPosts: readonly PublishedMarketingDetail[] = [];

export function findPublishedDetail(
  details: readonly PublishedMarketingDetail[],
  slug: string
) {
  return details.find((detail) => detail.slug === slug);
}
