export type BlogMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type BlogNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: BlogMark[];
  content?: BlogNode[];
};

export type BlogArticle = {
  id: string;
  type: 'blog' | 'article';
  locale: string;
  title: string;
  slug: string;
  excerpt: string;
  content: BlogNode;
  seoTitle: string;
  seoDescription: string;
  author: string;
  category: string;
  tags: string[];
  hero: { src: string; alt: string; x: number; y: number };
  socialImage: string;
  publishedAt: string;
  updatedAt?: string;
};
