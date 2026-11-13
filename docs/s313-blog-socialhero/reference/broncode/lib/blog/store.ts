import "server-only";
import { env } from "cloudflare:workers";
import { hasArticleContent, type ArticleDraft } from "./draft";
import { blogDemoArticles } from "../../app/(marketing)/blog/_blog/blog-seed";

export type BlogEntry = {
  id: string;
  draft: ArticleDraft;
  live: ArticleDraft | null;
  revision: number;
  publishedRevision: number | null;
  publishedAt: string | null;
  publishedUpdatedAt?: string | null;
  updatedAt: string;
  source: "manual" | "socialhero";
};

type EntryRow = {
  id: string;
  draft: string;
  live: string | null;
  revision: number;
  published_revision: number | null;
  published_at: string | null;
  published_updated_at: string | null;
  updated_at: string;
  source: BlogEntry["source"];
};

export class BlogWriteError extends Error {
  constructor(message: string, readonly code: string, readonly status = 409) {
    super(message);
  }
}

function deserialize(row: EntryRow): BlogEntry {
  return {
    id: row.id,
    draft: JSON.parse(row.draft),
    live: row.live ? JSON.parse(row.live) : null,
    revision: row.revision,
    publishedRevision: row.published_revision,
    publishedAt: row.published_at,
    publishedUpdatedAt: row.published_updated_at,
    updatedAt: row.updated_at,
    source: row.source,
  };
}

const seeds: BlogEntry[] = blogDemoArticles.map((article) => {
  const { id, publishedAt, updatedAt, ...draft } = article;
  return { id, draft, live: draft, revision: 1, publishedRevision: 1, publishedAt, publishedUpdatedAt: updatedAt ?? publishedAt, updatedAt: updatedAt ?? publishedAt, source: "manual" };
});

export async function listEntries() {
  const result = env.DB ? await env.DB.prepare("SELECT * FROM blog_entries ORDER BY updated_at DESC LIMIT 100").all<EntryRow>() : null;
  const stored = result?.results.map(deserialize) ?? [];
  const ids = new Set(stored.map(({ id }) => id));
  return [...stored, ...seeds.filter(({ id }) => !ids.has(id))];
}

export async function getEntry(id: string) {
  const row = await env.DB?.prepare("SELECT * FROM blog_entries WHERE id = ?").bind(id).first<EntryRow>();
  return row ? deserialize(row) : seeds.find((entry) => entry.id === id);
}

export async function publishedArticles() {
  const result = env.DB ? await env.DB.prepare("SELECT * FROM blog_entries WHERE live IS NOT NULL").all<EntryRow>() : null;
  const stored = result?.results.map(deserialize) ?? [];
  const ids = new Set(stored.map(({ id }) => id));
  return [...stored, ...seeds.filter(({ id }) => !ids.has(id))]
    .flatMap(({ id, live, publishedAt, publishedUpdatedAt }) => live && publishedAt
      ? [{ ...live, id, publishedAt, updatedAt: publishedUpdatedAt ?? publishedAt }]
      : [])
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export async function getBlogRedirect(slug: string) {
  const result = await env.DB?.prepare("SELECT blog_entries.live_slug AS slug FROM blog_redirects JOIN blog_entries ON blog_entries.id = blog_redirects.entry_id WHERE blog_redirects.slug = ?").bind(slug).first<{ slug: string | null }>();
  return result?.slug && result.slug !== slug ? result.slug : null;
}

export async function writeEntry(input: {
  action: "save" | "publish";
  id?: string;
  expectedRevision?: number | null;
  draft: ArticleDraft;
  source?: BlogEntry["source"];
}) {
  const db = env.DB;
  if (!db) throw new BlogWriteError("Blogopslag is tijdelijk niet beschikbaar.", "STORAGE_UNAVAILABLE", 503);
  const { action, draft, expectedRevision } = input;
  const previous = input.id ? await getEntry(input.id) : undefined;
  if (input.id && !previous) throw new BlogWriteError("Dit bericht is niet gevonden.", "ARTICLE_NOT_FOUND", 404);
  if (previous && expectedRevision !== previous.revision) {
    throw new BlogWriteError("Deze revisie is intussen gewijzigd. Herlaad het artikel.", "REVISION_CONFLICT");
  }
  if (action === "publish" && (!draft.excerpt || !draft.author || !draft.hero.src || !draft.hero.alt || !hasArticleContent(draft.content))) {
    throw new BlogWriteError("Vul samenvatting, auteur, inhoud en een hero-afbeelding met alt-tekst in.", "INVALID_ARTICLE", 422);
  }
  const id = previous?.id ?? crypto.randomUUID();
  if (seeds.some((seed) => seed.id !== id && seed.draft.slug === draft.slug)) {
    throw new BlogWriteError("Deze URL is al in gebruik. Kies een andere slug.", "SLUG_CONFLICT");
  }
  const now = new Date().toISOString();
  const revision = (previous?.revision ?? 0) + 1;
  const live = action === "publish" ? draft : previous?.live ?? null;
  const entry: BlogEntry = {
    id, draft, live, revision, updatedAt: now,
    source: previous?.source ?? input.source ?? "manual",
    publishedAt: action === "publish" ? previous?.publishedAt ?? now : previous?.publishedAt ?? null,
    publishedUpdatedAt: action === "publish" ? now : previous?.publishedUpdatedAt ?? null,
    publishedRevision: action === "publish" ? revision : previous?.publishedRevision ?? null,
  };
  try {
    const statement = db.prepare(`INSERT INTO blog_entries
      (id, draft, live, draft_slug, live_slug, revision, published_revision, published_at, published_updated_at, updated_at, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET draft = excluded.draft, live = excluded.live,
        draft_slug = excluded.draft_slug, live_slug = excluded.live_slug,
        revision = excluded.revision, published_revision = excluded.published_revision,
        published_at = excluded.published_at, published_updated_at = excluded.published_updated_at, updated_at = excluded.updated_at
      WHERE blog_entries.revision = ?`)
      .bind(id, JSON.stringify(draft), live ? JSON.stringify(live) : null, draft.slug, live?.slug ?? null,
        revision, entry.publishedRevision, entry.publishedAt, entry.publishedUpdatedAt, now, entry.source, previous?.revision ?? 0);
    const oldSlug = previous?.live?.slug;
    const fixtureRedirect = oldSlug && live?.slug !== oldSlug && seeds.some((seed) => seed.id === id && seed.live?.slug === oldSlug);
    const result = fixtureRedirect
      ? (await db.batch([statement, db.prepare("INSERT OR IGNORE INTO blog_redirects (slug, entry_id) SELECT ?, id FROM blog_entries WHERE id = ? AND revision = ? AND live_slug = ?").bind(oldSlug, id, revision, live?.slug)]))[0]
      : await statement.run();
    if (!result.meta.changes) throw new BlogWriteError("Deze revisie is intussen gewijzigd. Herlaad het artikel.", "REVISION_CONFLICT");
  } catch (error) {
    if (error instanceof Error && /SLUG_CONFLICT|UNIQUE constraint failed.*slug/.test(error.message)) {
      throw new BlogWriteError("Deze URL is al in gebruik. Kies een andere slug.", "SLUG_CONFLICT");
    }
    throw error;
  }
  return entry;
}
