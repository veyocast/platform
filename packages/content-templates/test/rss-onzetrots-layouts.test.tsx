import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { syncSlidePresentationSchema, syncDynamicConfigurationSchema, type SyncOnzeTrotsV9Presentation } from '@veyocast/contracts';
import { SyncSlideStaticView } from '../src/sync-slide-static-view';
import { rssArticleUrl, rssDisplayText } from '../src/sync-onzetrots-rss';
import { projectSyncDynamicSnapshot } from '../src/sync-dynamic-projector';

function fixture(layout?: 'beeldheld' | 'nachteditie' | 'clubkrant'): SyncOnzeTrotsV9Presentation {
  return syncSlidePresentationSchema.parse({ schemaVersion: 1, rendererVersion: 'sync-onzetrots-v9', sourceRevision: '5ba52a657d6d16ad103ba2fb43b8db18aa83715a', family: 'rss', theme: 'onzetrots-tv', name: 'Regionale berichten', title: 'Nieuws', orientation: 'landscape', club: { name: 'Schermbeheerder' }, visual: { schemaVersion: 1, mode: 'dark' }, style: {}, authoring: { schemaVersion: 1, visualRevision: 'onzetrots-20261024', ...(layout ? { rssLayout: layout } : {}) } }) as SyncOnzeTrotsV9Presentation;
}
describe('saved RSS layouts through the shared renderer', () => {
  it.each(['beeldheld', 'nachteditie', 'clubkrant'] as const)('round-trips %s through connected seed, duplication and both orientations', layout => {
    for (const orientation of ['landscape', 'portrait'] as const) {
      const seed = syncSlidePresentationSchema.parse({ ...fixture(layout), orientation });
      const configuration = syncDynamicConfigurationSchema.parse({ schemaVersion: 1, kind: 'dynamic', rendererVersion: seed.rendererVersion, sourceRevision: seed.sourceRevision, slideType: 'news', secondsPerPage: 10, seed });
      const copied = syncDynamicConfigurationSchema.parse(JSON.parse(JSON.stringify(configuration)));
      expect(copied.seed).toMatchObject({ authoring: { rssLayout: layout }, orientation });
      expect(renderToStaticMarkup(<SyncSlideStaticView presentation={copied.seed}/>)).toContain(`data-ot-rss-layout="${layout}"`);
    }
  });
  it('retains unmarked historic layouts and rejects invalid authoring values', () => {
    const original = fixture();
    expect(original.authoring.rssLayout).toBeUndefined();
    expect(renderToStaticMarkup(<SyncSlideStaticView presentation={original}/>)).not.toContain('data-ot-rss-layout=');
    expect(syncSlidePresentationSchema.safeParse({ ...original, authoring: { ...original.authoring, rssLayout: 'design-3' } }).success).toBe(false);
  });
  it('keeps external publisher, real date and current article link together without tenant attribution', () => {
    const result = projectSyncDynamicSnapshot({ schemaVersion: 1, slideType: 'news', orientation: 'landscape', snapshotId: '40000000-0000-4000-8000-000000000309', snapshotHash: 'a'.repeat(64), templateVersionId: '50000000-0000-4000-8000-000000000309', templateSlug: 'rss-layout-test', data: { type: 'news', news: { sourceName: 'Voorbeeldredactie', articles: [{ externalId: 'article-a', title: 'Regionale plannen', intro: 'Echte inleiding', link: 'https://example.org/artikel-a', publishedAt: '2026-11-10T12:00:00Z' }] } } }, fixture('beeldheld'));
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error('Projection failed');
    expect(result.presentation).toMatchObject({ rich: { news: [{ source: 'Voorbeeldredactie', title: 'Regionale plannen', dateLabel: '10 november 2026', url: 'https://example.org/artikel-a' }] } });
    const html = renderToStaticMarkup(<SyncSlideStaticView presentation={result.presentation}/>);
    expect(html).toContain('Lees het hele artikel'); expect(html).not.toContain('Clubnieuws'); expect(html).not.toContain('SINDS 1950');
  });
  it('uses only the existing allowed HTTPS destination and displays plain RSS text', () => {
    for (const bad of ['javascript:alert(1)', 'https://user:password@example.org/a', 'http://example.org/a', 'not-a-url']) expect(rssArticleUrl(bad)).toBeNull();
    expect(rssArticleUrl('https://example.org/a?q=%26')).toBe('https://example.org/a?q=%26');
    expect(rssDisplayText('<p>Sport &amp; bewegen &#x1f3c3;</p><script>bad()</script>')).toBe('Sport & bewegen 🏃');
  });
  it.each(['', 'not-a-url', 'javascript:alert(1)', 'https://user:password@example.org/a', 'http://example.org/a'])('keeps an article without a QR when its canonical URL is invalid: %s', link => {
    const result = projectSyncDynamicSnapshot({ schemaVersion: 1, slideType: 'news', orientation: 'landscape', snapshotId: '40000000-0000-4000-8000-000000000309', snapshotHash: 'a'.repeat(64), templateVersionId: '50000000-0000-4000-8000-000000000309', templateSlug: 'rss-layout-test', data: { type: 'news', news: { sourceName: 'Voorbeeldredactie', articles: [{ externalId: 'article-a', title: 'Zonder bestemming', intro: 'Wel een echt bericht', link }] } } }, fixture('clubkrant'));
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error('The article must remain available');
    expect(result.presentation.news[0]?.url).toBeUndefined();
    const html = renderToStaticMarkup(<SyncSlideStaticView presentation={result.presentation}/>);
    expect(html).toContain('Zonder bestemming');
    expect(html).not.toContain('data-article-url=');
    expect(html).not.toContain('Lees het hele artikel');
  });
  it('rejects an overlong normalized destination before QR encoding, without changing article text', () => {
    expect(rssArticleUrl(`https://example.org/${'😀'.repeat(400)}`)).toBeNull();
  });
});
