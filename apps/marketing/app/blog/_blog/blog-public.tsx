import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, Clock3 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { BlogContent, blogUrl } from './blog-content';
import type { BlogArticle, BlogNode } from '@veyocast/blog';
import styles from './blog-public.module.css';

export type { BlogArticle } from '@veyocast/blog';

export const blogCategories = [
  { value: 'clubtv', label: 'ClubTV' },
  { value: 'sponsoring', label: 'Sponsoring' },
  { value: 'schermen', label: 'Schermen & opstelling' }
] as const;

function categoryLabel(category: string) {
  return blogCategories.find((entry) => entry.value === category)?.label ?? category;
}

function blogDate(date: string, locale: string) {
  const time = Date.parse(date);
  if (!Number.isFinite(time)) return '';
  try {
    return new Intl.DateTimeFormat(locale || 'nl-NL', { dateStyle: 'long', timeZone: 'Europe/Amsterdam' }).format(time);
  } catch {
    return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeZone: 'Europe/Amsterdam' }).format(time);
  }
}

function countWords(node: BlogNode, depth = 0): number {
  if (!node || typeof node !== 'object' || depth > 40) return 0;
  const own = typeof node.text === 'string' ? node.text.match(/\S+/gu)?.length ?? 0 : 0;
  return Array.isArray(node.content)
    ? own + node.content.reduce((total, child) => total + countWords(child, depth + 1), 0)
    : own;
}

function readingTime(article: BlogArticle) {
  return Math.max(1, Math.ceil(countWords(article.content) / 220));
}

function focal(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : .5;
}

// Assets are served by the verified blog media endpoint with immutable dimensions.
/* eslint-disable @next/next/no-img-element */
function BlogHeroImage({ article, priority = false }: { article: BlogArticle; priority?: boolean }) {
  const src = blogUrl(article.hero.src, 'image');
  if (!src) return null;
  const style = { objectPosition: `${focal(article.hero.x) * 100}% ${focal(article.hero.y) * 100}%` } satisfies CSSProperties;
  return <img width={article.hero.width} height={article.hero.height} alt={article.hero.alt} decoding="async" fetchPriority={priority ? 'high' : 'auto'} loading={priority ? 'eager' : 'lazy'} src={src} style={style} />;
}

function ArticleCard({ article }: { article: BlogArticle }) {
  const date = blogDate(article.publishedAt, article.locale);
  return (
    <article className={styles.card}>
      <Link className={styles.cardLink} href={`/blog/${encodeURIComponent(article.slug)}`}>
        <div className={styles.cardMedia}>
          <BlogHeroImage article={article} />
          {article.category && <span className={styles.cardCategory}>{categoryLabel(article.category)}</span>}
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardMeta}>
            {date && <time dateTime={article.publishedAt}>{date}</time>}
            <span><Clock3 size={15} aria-hidden="true" /> {readingTime(article)} min leestijd</span>
          </div>
          <h3>{article.title}</h3>
          <p>{article.excerpt}</p>
          <span className={styles.cardAction}>Lees verder <ArrowUpRight size={19} aria-hidden="true" /></span>
        </div>
      </Link>
    </article>
  );
}

export function BlogIndexPage({ articles, category }: { articles: readonly BlogArticle[]; category?: string }) {
  const custom = [...new Set(articles.map(({ category }) => category).filter(Boolean))]
    .filter((value) => !blogCategories.some((entry) => entry.value === value))
    .map((value) => ({ value, label: categoryLabel(value) }));
  const categories = [...blogCategories, ...custom];
  const selected = categories.find((entry) => entry.value === category);
  const visible = selected ? articles.filter((article) => article.category === selected.value) : articles;
  return (
    <main id="main-content" className={styles.blog}>
      <section className={styles.intro} aria-labelledby="blog-title">
        <div className={styles.introContent}>
          <nav className={styles.introCrumbs} aria-label="Broodkruimelpad">
            <Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Blog</span>
          </nav>
          <h1 id="blog-title">Het VeyoCast-blog</h1>
          <p>Van je eerste clubscherm tot een strakke wedstrijddag. Praktische tips over ClubTV, sponsoring en schermbeheer.</p>
        </div>
      </section>
      <section className={styles.section} aria-labelledby="blog-articles">
        <div className={styles.sectionHead}>
          <h2 id="blog-articles">Artikelen</h2>
          <nav className={styles.filters} aria-label="Filter op categorie">
            <Link href="/blog" aria-current={selected ? undefined : 'true'}>Alles</Link>
            {categories.map((entry) => <Link aria-current={selected?.value === entry.value ? 'true' : undefined} href={`/blog?categorie=${encodeURIComponent(entry.value)}`} key={entry.value}>{entry.label}</Link>)}
          </nav>
        </div>
        {visible.length ? <div className={styles.grid}>{visible.map((article) => <ArticleCard key={article.id} article={article} />)}</div> : (
          <div className={styles.empty}><p>Hier staan nog geen artikelen.</p>{selected && <Link href="/blog">Bekijk alle artikelen <ArrowRight size={17} aria-hidden="true" /></Link>}</div>
        )}
      </section>
    </main>
  );
}

export function BlogArticlePage({ article, related = [], preview = false, canonicalUrl }: { article: BlogArticle; related?: readonly BlogArticle[]; preview?: boolean; canonicalUrl?: string }) {
  const PageContainer = preview ? "div" : "main";
  const date = blogDate(article.publishedAt, article.locale);
  const categoryHref = `/blog?categorie=${encodeURIComponent(article.category)}`;
  const shareUrl = !preview && blogUrl(canonicalUrl)?.startsWith('https://') ? canonicalUrl : undefined;
  const shareLink = shareUrl ? encodeURIComponent(shareUrl) : undefined;
  return (
    <PageContainer className={styles.blog} id={preview ? undefined : "main-content"}>
      <div className={styles.detail}>
        <nav className={styles.breadcrumbs} aria-label="Broodkruimelpad">
          <Link href="/blog"><ArrowLeft size={17} aria-hidden="true" /> Naar het blog</Link>
        </nav>
        {preview && <p className={styles.preview}>Conceptvoorbeeld</p>}
        <article lang={article.locale}>
          <header className={styles.articleHeader}>
            <div className={styles.articleHeading}>
              {article.category && <Link className={styles.articleCategory} href={categoryHref}>{categoryLabel(article.category)}</Link>}
              <h1>{article.title}</h1>
              <p className={styles.articleExcerpt}>{article.excerpt}</p>
              <div className={styles.articleMeta}>
                {article.author && <span className={styles.author}>{article.author}</span>}
                {date && <time dateTime={article.publishedAt}>{date}</time>}
                <span><Clock3 size={16} aria-hidden="true" /> {readingTime(article)} min leestijd</span>
              </div>
            </div>
            {blogUrl(article.hero.src, 'image') && <figure className={styles.articleMedia}><BlogHeroImage article={article} priority /></figure>}
          </header>
          <div className={styles.articleBody}>
            <BlogContent content={article.content} />
            {article.tags.length > 0 && <ul className={styles.tags} aria-label="Onderwerpen">{article.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
            {shareLink && (
              <nav className={styles.share} aria-label="Deel dit artikel">
                <strong>Deel dit artikel</strong>
                <Link href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareLink}`} rel="noreferrer" target="_blank">LinkedIn <ArrowUpRight size={15} aria-hidden="true" /></Link>
                <Link href={`https://wa.me/?text=${shareLink}`} rel="noreferrer" target="_blank">WhatsApp <ArrowUpRight size={15} aria-hidden="true" /></Link>
              </nav>
            )}
          </div>
        </article>
      </div>
      {!preview && related.length > 0 && (
        <section className={`${styles.section} ${styles.related}`} aria-labelledby="blog-related">
          <div className={styles.sectionHead}><h2 id="blog-related">Lees ook</h2><Link className={styles.more} href="/blog">Alle artikelen <ArrowRight size={18} aria-hidden="true" /></Link></div>
          <div className={styles.grid}>{related.slice(0, 3).map((entry) => <ArticleCard key={entry.id} article={entry} />)}</div>
        </section>
      )}
    </PageContainer>
  );
}
