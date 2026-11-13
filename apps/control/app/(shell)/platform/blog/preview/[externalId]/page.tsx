/* Private article media is served by the same guarded media route. */
/* eslint-disable @next/next/no-img-element */
import type {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "next/link";

import {getBlogEntry} from "../../../../../../lib/blog-service";
import {requireControlCapability} from "../../../../../../lib/control-session";
import {BlogDocument} from "../../_components/blog-editor";
import {mediaUrl} from "../../_components/blog-form";
import s from "../../_components/blog-admin.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {title: "Afgeschermd conceptvoorbeeld · VeyoCast", robots: {index: false, follow: false}};

export default async function PlatformBlogPreview({params}: {params: Promise<{externalId: string}>}) {
  await requireControlCapability("platform.blog.read");
  const {externalId} = await params;
  const entry = await getBlogEntry(externalId);
  if (!entry) notFound();
  const draft = entry.draft;
  return <article className={s.page}>
    <Link className={s.crumb} href="/platform/blog">Terug naar blogbeheer</Link>
    <p className={s.banner}>Afgeschermd conceptvoorbeeld · revisie {entry.draftRevision}. Dit is geen openbare publicatie.</p>
    {mediaUrl(draft.hero.assetId) && <img className={s.previewHero} src={mediaUrl(draft.hero.assetId)} alt={draft.hero.alt}
      style={{objectPosition: `${draft.hero.focalPoint.x * 100}% ${draft.hero.focalPoint.y * 100}%`}} />}
    <span className={s.pill}>{draft.categoryId}</span>
    <h1 className={s.previewTitle}>{draft.title}</h1>
    <p className={s.previewIntro}>{draft.excerpt}</p><p className={s.help}>VeyoCast</p>
    <div className={s.previewBody}><BlogDocument content={draft.content} /></div>
  </article>;
}
