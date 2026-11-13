import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { BlogNode } from './blog-types';
import styles from './blog-public.module.css';

export function blogUrl(value: unknown, kind: 'link' | 'image' = 'link'): string | undefined {
  if (typeof value !== 'string' || !value || /[\x00-\x20\\]/u.test(value)) return;
  if (/^\/(?!\/)/u.test(value) || (kind === 'link' && /^#[\w-]+$/u.test(value))) return value;
  if (kind === 'image' && /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/]+={0,2}$/iu.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.username || url.password) return;
    if (kind === 'image' && url.protocol === 'https:') return url.href;
    if (kind === 'link' && ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) return url.href;
  } catch {
    return;
  }
}

function youtubeEmbed(value: unknown) {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return;
    const hosts = ['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'];
    if (!hosts.includes(url.hostname) && url.hostname !== 'youtu.be') return;
    const [kind, id] = url.pathname.split('/').filter(Boolean);
    const videoId = url.hostname === 'youtu.be' ? kind : kind === 'watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(kind ?? '') ? id : null;
    if (videoId && /^[\w-]{11}$/u.test(videoId)) return `https://www.youtube-nocookie.com/embed/${videoId}`;
  } catch {
    return;
  }
}

function textAlignment(attrs: BlogNode['attrs']): CSSProperties | undefined {
  const alignment = attrs?.textAlign;
  if (alignment === 'left' || alignment === 'right' || alignment === 'center' || alignment === 'justify') {
    return { textAlign: alignment };
  }
}

function textMarks(node: BlogNode) {
  const marks = Array.isArray(node.marks) ? node.marks : [];
  return marks.reduce<ReactNode>((content, mark) => {
    switch (mark?.type) {
      case 'bold': return <strong>{content}</strong>;
      case 'italic': return <em>{content}</em>;
      case 'underline': return <u>{content}</u>;
      case 'strike': return <s>{content}</s>;
      case 'code': return <code>{content}</code>;
      case 'highlight': return <mark>{content}</mark>;
      case 'superscript': return <sup>{content}</sup>;
      case 'subscript': return <sub>{content}</sub>;
      case 'link': {
        const href = blogUrl(mark.attrs?.href);
        return href ? <a href={href}>{content}</a> : content;
      }
      default: return content;
    }
  }, typeof node.text === 'string' ? node.text : '');
}

function tableSpan(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 1 && value <= 50 ? value : undefined;
}

function renderNode(node: BlogNode, depth = 0): ReactNode {
  if (!node || typeof node !== 'object' || depth > 40) return null;
  const children = Array.isArray(node.content)
    ? node.content.map((child, index) => <Fragment key={index}>{renderNode(child, depth + 1)}</Fragment>)
    : undefined;
  const attrs = node.attrs;
  switch (node.type) {
    case 'doc': return children;
    case 'text': return textMarks(node);
    case 'paragraph': return <p style={textAlignment(attrs)}>{children}</p>;
    case 'heading': {
      const Heading = attrs?.level === 3 ? 'h3' : attrs?.level === 4 ? 'h4' : attrs?.level === 5 ? 'h5' : attrs?.level === 6 ? 'h6' : 'h2';
      return <Heading style={textAlignment(attrs)}>{children}</Heading>;
    }
    case 'bulletList': return <ul>{children}</ul>;
    case 'orderedList': return <ol start={typeof attrs?.start === 'number' && Number.isSafeInteger(attrs.start) ? attrs.start : undefined}>{children}</ol>;
    case 'listItem': return <li>{children}</li>;
    case 'taskList': return <ul className={styles.taskList}>{children}</ul>;
    case 'taskItem': return <li><input aria-label="Taak voltooid" checked={attrs?.checked === true} type="checkbox" disabled readOnly />{children}</li>;
    case 'blockquote': return <blockquote>{children}</blockquote>;
    case 'codeBlock': return <pre><code>{children}</code></pre>;
    case 'hardBreak': return <br />;
    case 'horizontalRule': return <hr />;
    case 'image': {
      const src = blogUrl(attrs?.src, 'image');
      const alt = typeof attrs?.alt === 'string' ? attrs.alt : '';
      const title = typeof attrs?.title === 'string' ? attrs.title : undefined;
      return src ? <figure><img alt={alt} decoding="async" loading="lazy" src={src} title={title} /></figure> : null;
    }
    case 'youtube': {
      const src = youtubeEmbed(attrs?.src);
      if (!src) return null;
      const title = typeof attrs?.title === 'string' && attrs.title.trim() ? attrs.title : 'YouTube-video';
      return <div className={styles.video}><iframe allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" src={src} title={title} /></div>;
    }
    case 'table': return <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Tabel"><table><tbody>{children}</tbody></table></div>;
    case 'tableRow': return <tr>{children}</tr>;
    case 'tableHeader': return <th colSpan={tableSpan(attrs?.colspan)} rowSpan={tableSpan(attrs?.rowspan)}>{children}</th>;
    case 'tableCell': return <td colSpan={tableSpan(attrs?.colspan)} rowSpan={tableSpan(attrs?.rowspan)}>{children}</td>;
    case 'details': return <details>{children}</details>;
    case 'detailsSummary': return <summary>{children}</summary>;
    case 'detailsContent': return <div>{children}</div>;
    default: return children;
  }
}

export function BlogContent({ content, className }: { content: BlogNode; className?: string }) {
  return <div className={className ? `${styles.prose} ${className}` : styles.prose}>{renderNode(content)}</div>;
}
