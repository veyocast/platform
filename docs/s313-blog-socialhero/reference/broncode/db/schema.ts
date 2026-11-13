import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const blogEntries = sqliteTable("blog_entries", {
  id: text().primaryKey(),
  draft: text().notNull(),
  live: text(),
  draftSlug: text("draft_slug").notNull(),
  liveSlug: text("live_slug"),
  revision: integer().notNull(),
  publishedRevision: integer("published_revision"),
  publishedAt: text("published_at"),
  publishedUpdatedAt: text("published_updated_at"),
  updatedAt: text("updated_at").notNull(),
  source: text({ enum: ["manual", "socialhero"] }).notNull(),
}, (table) => [
  uniqueIndex("blog_entries_draft_slug").on(table.draftSlug),
  uniqueIndex("blog_entries_live_slug").on(table.liveSlug),
]);

export const blogRedirects = sqliteTable("blog_redirects", {
  slug: text().primaryKey(),
  entryId: text("entry_id").notNull().references(() => blogEntries.id),
});
