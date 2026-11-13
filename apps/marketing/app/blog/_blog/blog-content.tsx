/* eslint-disable @next/next/no-img-element -- Blog media is decoded and dimensioned before publication. */
import { blogYoutubeUrl, safeBlogUrl, validateBlogDocument, type BlogNode } from "@veyocast/blog";
import { Fragment, type CSSProperties, type ReactNode } from "react";

import { blogImageUrl } from "../../_lib/blog-source";
import styles from "./blog-public.module.css";

export const blogUrl = safeBlogUrl;

function youtubeEmbed(value: unknown) {
  const href = blogYoutubeUrl(value);
  if (!href) return;
  try {
    const url = new URL(href);
    const videoId = url.searchParams.get("v");
    if (url.protocol === "https:" && url.hostname === "www.youtube.com" && url.pathname === "/watch" && videoId && /^[\w-]{11}$/u.test(videoId)) {
      return `https://www.youtube-nocookie.com/embed/${videoId}`;
    }
  } catch {
    return;
  }
}

function textAlignment(attrs: BlogNode["attrs"]): CSSProperties | undefined {
  const alignment = attrs?.textAlign;
  if (alignment === "left" || alignment === "right" || alignment === "center" || alignment === "justify") {
    return { textAlign: alignment };
  }
}

function textMarks(node: BlogNode) {
  return (node.marks ?? []).reduce<ReactNode>((content, mark) => {
    switch (mark.type) {
      case "bold": return <strong>{content}</strong>;
      case "italic": return <em>{content}</em>;
      case "underline": return <u>{content}</u>;
      case "strike": return <s>{content}</s>;
      case "code": return <code>{content}</code>;
      case "highlight": return <mark>{content}</mark>;
      case "superscript": return <sup>{content}</sup>;
      case "subscript": return <sub>{content}</sub>;
      case "link": {
        const href = safeBlogUrl(mark.attrs?.href);
        return href ? <a href={href}>{content}</a> : content;
      }
      default: return content;
    }
  }, node.text ?? "");
}

function tableSpan(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 1 && value <= 50 ? value : undefined;
}

function imageDimension(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function renderNode(node: BlogNode): ReactNode {
  const children = node.content?.map((child, index) => <Fragment key={index}>{renderNode(child)}</Fragment>);
  const attrs = node.attrs;
  switch (node.type) {
    case "doc": return children;
    case "text": return textMarks(node);
    case "paragraph": return <p style={textAlignment(attrs)}>{children}</p>;
    case "heading": {
      const Heading = attrs?.level === 3 ? "h3" : attrs?.level === 4 ? "h4" : "h2";
      return <Heading style={textAlignment(attrs)}>{children}</Heading>;
    }
    case "bulletList": return <ul>{children}</ul>;
    case "orderedList": return <ol start={imageDimension(attrs?.start)}>{children}</ol>;
    case "listItem": return <li>{children}</li>;
    case "taskList": return <ul className={styles.taskList}>{children}</ul>;
    case "taskItem": return <li><input aria-label="Taak voltooid" checked={attrs?.checked === true} type="checkbox" disabled readOnly />{children}</li>;
    case "blockquote": return <blockquote>{children}</blockquote>;
    case "codeBlock": return <pre><code>{children}</code></pre>;
    case "hardBreak": return <br />;
    case "horizontalRule": return <hr />;
    case "image": {
      if (typeof attrs?.assetId !== "string" || typeof attrs.alt !== "string") return null;
      // The media endpoint enforces publication; authored image URLs never reach the browser.
      return <figure><img alt={attrs.alt} decoding="async" height={imageDimension(attrs.height)} loading="lazy" src={blogImageUrl(attrs.assetId)} title={typeof attrs.title === "string" ? attrs.title : undefined} width={imageDimension(attrs.width)} /></figure>;
    }
    case "youtube": {
      const src = youtubeEmbed(attrs?.src);
      if (!src) return null;
      const title = typeof attrs?.title === "string" && attrs.title.trim() ? attrs.title : "YouTube-video";
      return <div className={styles.video}><iframe allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" src={src} title={title} /></div>;
    }
    case "table": return <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Tabel"><table><tbody>{children}</tbody></table></div>;
    case "tableRow": return <tr>{children}</tr>;
    case "tableHeader": return <th colSpan={tableSpan(attrs?.colspan)} rowSpan={tableSpan(attrs?.rowspan)} scope="col">{children}</th>;
    case "tableCell": return <td colSpan={tableSpan(attrs?.colspan)} rowSpan={tableSpan(attrs?.rowspan)}>{children}</td>;
    case "details": return <details>{children}</details>;
    case "detailsSummary": return <summary>{children}</summary>;
    case "detailsContent": return <div>{children}</div>;
    default: return null;
  }
}

export function BlogContent({ content, className }: { content: BlogNode; className?: string }) {
  let document: BlogNode;
  try {
    document = validateBlogDocument(content);
  } catch {
    return <p>De artikelinhoud is tijdelijk niet beschikbaar. Probeer het later opnieuw.</p>;
  }
  return <div className={className ? `${styles.prose} ${className}` : styles.prose}>{renderNode(document)}</div>;
}
