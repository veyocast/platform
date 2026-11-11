import React, { type CSSProperties, type ReactNode } from 'react';
import { syncSlideArticleUrl, type SyncOnzeTrotsV9Presentation } from '@veyocast/contracts';
import type { SyncSlideAssetResolver } from './sync-slide-static-view';

export const rssArticleUrl = syncSlideArticleUrl;

export function rssDisplayText(value: string): string {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/giu, (_, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? '';
    const code = parseInt(entity.slice(entity[1]?.toLowerCase() === 'x' ? 2 : 1), entity[1]?.toLowerCase() === 'x' ? 16 : 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  }).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, ' ').replace(/<[^>]*>/gu, ' ').replace(/\s+/gu, ' ').trim();
}

export function OnzeTrotsRssLayout({ slide, resolveAsset, page, qr, qrSize }: {
  slide: SyncOnzeTrotsV9Presentation; resolveAsset: SyncSlideAssetResolver; page: number;
  qr: (url: string) => ReactNode; qrSize: (url: string) => number;
}) {
  const article = slide.rich?.news?.[page] ?? slide.news[page];
  const rich = slide.rich?.news?.[page];
  const url = rssArticleUrl(article?.url);
  const image = rich?.heroImage && resolveAsset(rich.heroImage);
  const logo = rich?.providerLogo && resolveAsset(rich.providerLogo);
  const tenantLogo = slide.style.showLogo && slide.club.logo && resolveAsset(slide.club.logo);
  const source = rssDisplayText(article?.source ?? '') || (url ? new URL(url).hostname : '');
  const title = rssDisplayText(article?.title ?? slide.headline ?? slide.title);
  const summary = rssDisplayText(article?.intro ?? slide.body);
  return <article className={`rss-design rss-${slide.authoring.rssLayout}`} data-article-id={rich?.id ?? page}
    data-has-qr={Boolean(url)} style={{ '--rss-royal': slide.style.accent, '--ot-rss-qr-size': `${url ? qrSize(url) : 0}px` } as CSSProperties}>
    <style>{onzeTrotsRssCss}</style>
    <div className="rss-texture" aria-hidden="true"/>
    <header className="rss-mast"><div><strong>{slide.authoring.headerTexts.rss ?? 'Nieuws'}</strong>{slide.authoring.headerSubtitles.rss && <span>{slide.authoring.headerSubtitles.rss}</span>}{rich?.dateLabel && <span>{rich.dateLabel}</span>}</div>
      {slide.style.showLogo && <div className="rss-tenant">{tenantLogo && <img src={tenantLogo} alt=""/>}<span>Scherm: {slide.club.name}</span></div>}
    </header>
    <div className="rss-story-photo">{image && <img src={image} alt="" style={rich?.imageFocalPoint ? { objectPosition: `${rich.imageFocalPoint.x * 100}% ${rich.imageFocalPoint.y * 100}%` } : undefined} onError={event => { event.currentTarget.style.visibility = 'hidden'; }}/>}</div>
    <div className="rss-story-copy" data-rss-copy>
      {source && <div className="rss-source">{logo && <img src={logo} alt=""/>}<span>{source}</span></div>}
      <h3 data-rss-title>{title}</h3><p data-rss-summary={summary}>{summary}</p>
    </div>
    {url && <aside className="rss-story-qr" data-article-url={url}>{qr(url)}<div><strong>Lees het hele artikel</strong><span>{new URL(url).hostname}</span></div></aside>}
    {slide.style.showFooter && <footer className="rss-signature"><span>{source}</span><span className="brand-brush" role="img" aria-label="OnzeTrots vormgeving"/></footer>}
  </article>;
}


export const onzeTrotsRssCss = `
.ot-v9-scope .screen[data-ot-rss-layout]{padding:0;background:#071d46}
.ot-v9-scope .screen[data-ot-rss-layout]:before,.ot-v9-scope .screen[data-ot-rss-layout]:after{display:none}
.ot-v9-scope .rss-design{--rss-navy:#071d46;--rss-paper:#fff;--rss-ink:#102c6b;--rss-band:max(194px,calc(var(--ot-rss-qr-size) + 24px));position:relative;width:1600px;height:900px;overflow:hidden;isolation:isolate;color:var(--rss-paper);background:var(--rss-navy);font-family:OTManrope,Arial,sans-serif}
.ot-v9-scope .portrait .rss-design{width:900px;height:1600px}
.ot-v9-scope .rss-design *{box-sizing:border-box}
.ot-v9-scope .rss-texture{position:absolute;inset:0;pointer-events:none;opacity:.06;background:radial-gradient(#fff 1px,transparent 1px);background-size:11px 17px;z-index:1}
.ot-v9-scope .rss-mast{position:absolute;z-index:5;left:60px;right:60px;top:38px;height:80px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.ot-v9-scope .rss-mast>div{display:flex;gap:28px;align-items:center;min-width:0}.ot-v9-scope .rss-mast strong{font-size:28px;line-height:1.2;overflow-wrap:anywhere}.ot-v9-scope .rss-mast span{font-size:16px;overflow-wrap:anywhere}
.ot-v9-scope .rss-mast .rss-tenant{max-width:42%;gap:16px}.ot-v9-scope .rss-tenant img{width:60px;height:73px;object-fit:contain}.ot-v9-scope .rss-tenant span{font-size:14px}
.ot-v9-scope .rss-story-photo{position:absolute;z-index:2;overflow:hidden;background:linear-gradient(145deg,var(--rss-royal),var(--rss-navy))}
.ot-v9-scope .rss-story-photo>img{width:100%;height:100%;object-fit:cover;display:block}
.ot-v9-scope .rss-story-copy{position:absolute;z-index:4;display:flex;flex-direction:column;gap:24px;min-width:0}
.ot-v9-scope .rss-source{display:flex;align-items:center;gap:16px;font:800 20px/1.3 OTManrope,Arial,sans-serif;overflow-wrap:anywhere;flex:none;min-width:0}.ot-v9-scope .rss-source img{width:70px;height:45px;object-fit:contain;background:white;padding:4px}.ot-v9-scope .rss-source span{min-width:0}
.ot-v9-scope .rss-design .rss-story-copy h3{font:400 68px/1.13 OTMarker,cursive;margin:0;overflow-wrap:anywhere;flex:none;color:inherit;letter-spacing:-1.5px;text-transform:none}
.ot-v9-scope .rss-story-copy p{font:500 25px/1.55 OTManrope,Arial,sans-serif;margin:0;color:inherit;flex:none;overflow-wrap:anywhere;overflow:hidden}
.ot-v9-scope .rss-story-qr{position:absolute;z-index:6;display:flex;align-items:center;gap:24px;padding:12px;background:#fff;color:var(--rss-ink);height:var(--rss-band)}
.ot-v9-scope .rss-design .rss-story-qr svg.ot-qr{width:var(--ot-rss-qr-size);height:var(--ot-rss-qr-size);display:block;flex:none;max-width:none;background:white;transform:none;filter:none;opacity:1}
.ot-v9-scope .rss-story-qr>div{display:flex;flex-direction:column;gap:12px;min-width:0}.ot-v9-scope .rss-story-qr strong{font:800 22px/1.3 OTManrope,Arial,sans-serif}.ot-v9-scope .rss-story-qr span{font:600 14px/1.4 OTManrope,Arial,sans-serif;overflow-wrap:anywhere}
.ot-v9-scope .rss-signature{position:absolute;z-index:7;left:60px;right:60px;bottom:24px;height:54px;display:flex;align-items:center;justify-content:space-between;gap:24px;font:700 13px/1.3 OTManrope,Arial,sans-serif}.ot-v9-scope .rss-signature>span:first-child{max-width:70%;overflow-wrap:anywhere}.ot-v9-scope .rss-signature .brand-brush{width:180px;height:52px}
.ot-v9-scope .rss-design[data-rss-tight] .rss-story-copy{gap:12px}.ot-v9-scope .rss-design[data-rss-tight] .rss-source{font-size:16px}
.ot-v9-scope .screen:not(.portrait) .rss-design[data-rss-tight][data-has-qr=true]:not(.rss-beeldheld) .rss-story-copy{top:160px;bottom:calc(90px + var(--rss-band) + 20px)}
.ot-v9-scope .screen:not(.portrait) .rss-design[data-rss-tight][data-has-qr=true]:not(.rss-beeldheld) .rss-story-qr{bottom:90px}
.ot-v9-scope .rss-beeldheld .rss-story-photo{inset:0}.ot-v9-scope .rss-beeldheld .rss-story-photo:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,#071d4688,transparent 28%,#071d46dd 55%,#071d46),linear-gradient(90deg,#071d4688,transparent 85%)}
.ot-v9-scope .rss-beeldheld .rss-story-copy{left:78px;top:350px;bottom:120px;width:calc(1600px - 210px - max(265px,calc(var(--ot-rss-qr-size) + 32px)))}
.ot-v9-scope .rss-beeldheld .rss-story-copy h3{font-size:80px}.ot-v9-scope .rss-beeldheld .rss-story-qr{right:95px;bottom:98px;width:max(265px,calc(var(--ot-rss-qr-size) + 32px));height:auto;min-height:272px;flex-direction:column;gap:8px;text-align:center}.ot-v9-scope .rss-beeldheld .rss-story-qr strong{font-size:18px}.ot-v9-scope .rss-beeldheld .rss-story-qr span{font-size:12px}
.ot-v9-scope .rss-nachteditie .rss-mast{border-bottom:1px solid #ffffff33;padding-bottom:25px;height:105px}.ot-v9-scope .rss-nachteditie .rss-story-photo{left:65px;top:197px;width:750px;height:570px;border:10px solid white;box-shadow:18px 18px 0 var(--rss-royal);transform:rotate(-1deg)}
.ot-v9-scope .rss-nachteditie .rss-story-copy{left:900px;top:203px;right:65px;bottom:calc(110px + var(--rss-band) + 35px)}.ot-v9-scope .rss-nachteditie .rss-story-qr{left:900px;right:65px;bottom:110px}
.ot-v9-scope .rss-clubkrant{background:var(--rss-royal);color:var(--rss-ink)}.ot-v9-scope .rss-clubkrant:before{content:'';position:absolute;z-index:1;left:37px;right:37px;top:141px;bottom:97px;background:white;clip-path:polygon(0 1%,2% 0,5% 1%,9% 0,14% 1%,22% 0,29% 1%,36% 0,44% 1%,55% 0,65% 1%,77% 0,86% 1%,95% 0,100% 1%,99% 98%,96% 100%,89% 99%,80% 100%,72% 99%,60% 100%,48% 99%,35% 100%,24% 99%,12% 100%,4% 99%,0 100%)}
.ot-v9-scope .rss-clubkrant .rss-mast,.ot-v9-scope .rss-clubkrant .rss-signature{color:white}.ot-v9-scope .rss-clubkrant .rss-story-photo{left:70px;top:180px;width:730px;height:580px;transform:rotate(-1.2deg);border:9px solid white;box-shadow:0 8px 24px #071d4633}
.ot-v9-scope .rss-clubkrant .rss-story-copy{left:860px;top:196px;right:80px;bottom:calc(115px + var(--rss-band) + 35px)}.ot-v9-scope .rss-clubkrant .rss-story-qr{left:860px;right:80px;bottom:115px;border-top:1px dashed var(--rss-royal)}
.ot-v9-scope .rss-design[data-has-qr=false] .rss-story-copy{bottom:120px}.ot-v9-scope .rss-beeldheld[data-has-qr=false] .rss-story-copy{right:78px;width:auto}
.ot-v9-scope .portrait .rss-mast{left:54px;right:54px;top:38px;height:100px}.ot-v9-scope .portrait .rss-mast>div{flex-direction:column;align-items:flex-start;gap:8px}.ot-v9-scope .portrait .rss-mast .rss-tenant{flex-direction:row;align-items:center}
.ot-v9-scope .portrait .rss-design .rss-story-copy{left:60px;right:60px;top:750px;bottom:calc(144px + var(--rss-band) + 45px);width:auto;gap:25px}.ot-v9-scope .portrait .rss-design .rss-story-copy h3{font-size:72px}.ot-v9-scope .portrait .rss-design .rss-story-copy p{font-size:28px}
.ot-v9-scope .portrait .rss-design .rss-story-qr{left:60px;right:60px;bottom:144px;width:auto;height:var(--rss-band);min-height:0;flex-direction:row;text-align:left;gap:35px}.ot-v9-scope .portrait .rss-design .rss-story-qr strong{font-size:25px}.ot-v9-scope .portrait .rss-design .rss-story-qr span{font-size:14px}
.ot-v9-scope .portrait .rss-beeldheld .rss-story-photo:after{background:linear-gradient(180deg,#071d4677,transparent 28%,#071d46bb 45%,#071d46 80%)}.ot-v9-scope .portrait .rss-nachteditie .rss-story-photo{left:64px;top:205px;width:763px;height:481px;transform:rotate(-1.2deg);box-shadow:15px 15px 0 var(--rss-royal)}
.ot-v9-scope .portrait .rss-clubkrant:before{left:28px;right:28px;top:170px;bottom:112px}.ot-v9-scope .portrait .rss-clubkrant .rss-story-photo{left:61px;top:219px;width:772px;height:475px;transform:rotate(-1.5deg);border-width:10px}.ot-v9-scope .portrait .rss-clubkrant .rss-story-copy{left:68px;right:68px;top:760px}.ot-v9-scope .portrait .rss-clubkrant .rss-story-qr{left:68px;right:68px}
.ot-v9-scope .portrait .rss-design[data-has-qr=false] .rss-story-copy{bottom:144px}
.ot-v9-scope .portrait .rss-design[data-rss-tight] .rss-story-copy{top:730px;gap:12px}
@media(prefers-reduced-motion:reduce){.ot-v9-scope .rss-design *{animation:none!important;transition:none!important}}
`;
