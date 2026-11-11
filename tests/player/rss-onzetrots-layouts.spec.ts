import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { test, expect, chromium, type Page } from '@playwright/test';
import { syncSlidePresentationSchema, syncSlideRendererAssets, type SyncOnzeTrotsV9Presentation } from '@veyocast/contracts';
import { measureSyncOnzeTrotsV9Layout } from '@veyocast/content-templates/sync-slide-static-view';
import { createSyncTemplatePreview } from '../../apps/control/app/(shell)/dashboard/studio/sync-template-preview';

test.use({ launchOptions: { executablePath: chromium.executablePath() } });
const output = process.env.RSS_LAYOUT_EVIDENCE ?? '/tmp/castivo-rss-evidence';
const layouts = ['beeldheld', 'nachteditie', 'clubkrant'] as const;
const orientations = ['landscape', 'portrait'] as const;
const url = 'https://example.org/nieuws/regionale-plannen?artikel=309&bron=redactie';
function fixture(layout: typeof layouts[number], orientation: typeof orientations[number], kind: string) {
  const sample = createSyncTemplatePreview('rss') as SyncOnzeTrotsV9Presentation;
  return syncSlidePresentationSchema.parse({ ...sample, orientation, club: { name: 'Schermbeheerder' },
    authoring: { ...sample.authoring, rssLayout: layout, headerTexts: {}, headerSubtitles: {} }, news: [],
    rich: { news: [{ id: 'article-a', title: kind === 'long' ? 'Nieuwe plannen voor sport en bewegen in de regio, met ruimte voor iedereen. '.repeat(6).slice(0, 400) : 'Nieuwe plannen voor sport en bewegen in de regio',
      intro: '<p>Sport &amp; ontmoeting: echte verhalen van de regionale redactie.</p> '.repeat(kind === 'long' ? 40 : 2),
      source: kind === 'long' ? 'Voorbeeldredactie voor regionaal nieuws, sport, cultuur en ontmoeting' : 'Voorbeeldredactie',
      ...(kind === 'no-url' ? {} : { url: kind === 'dense' ? `https://example.org/${'artikel-'.repeat(45)}` : url }),
      ...(kind === 'missing' ? {} : { heroImage: sample.rich?.featureImage }),
      dateLabel: '10 november 2026' }, { id: 'article-b', title: 'Eigen nieuws van de vereniging', intro: 'Eigen bericht met een eigen bron.', source: 'Verenigingsredactie', url: 'https://vereniging.example/nieuws/eigen-bericht' }] } });
}
async function mount(page: Page, presentation: ReturnType<typeof fixture>, index = 0, broken = false) {
  const directory = mkdtempSync(join(tmpdir(), 'rss-layout-')), input = join(directory, 'input.json'), html = join(directory, 'slide.html');
  writeFileSync(input, JSON.stringify(presentation));
  execFileSync(process.execPath, ['--import', 'tsx', 'tests/helpers/s291-worker-frame.mts', input, html, 'html', String(index)], { timeout: 15000 });
  const assets = syncSlideRendererAssets(presentation);
  await page.route('**/*', route => {
    const path = new URL(route.request().url()).pathname, asset = assets.find(value => value.path === path);
    if (asset) {
      if (broken && asset.mimeType.startsWith('image/')) return route.abort();
      return route.fulfill({ body: readFileSync(join(process.cwd(), 'apps/player/public', path)), contentType: asset.mimeType });
    }
    if (path === '/__rss-layout') return route.fulfill({ body: readFileSync(html), contentType: 'text/html' });
    return route.abort();
  });
  await page.setViewportSize(presentation.orientation === 'portrait' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:3391/__rss-layout');
  await page.evaluate(async () => { await Promise.all([...document.fonts].map(font => font.load())); await document.fonts.ready; });
  await page.evaluate(measureSyncOnzeTrotsV9Layout, undefined);
}
for (const layout of layouts) for (const orientation of orientations) for (const kind of ['regular', 'long', 'dense', 'no-url', 'missing']) {
  test(`${layout}/${orientation}/${kind}: real renderer, full headline and matching decoded QR`, async ({ page }) => {
    const presentation = fixture(layout, orientation, kind);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mount(page, presentation);
    const canvas = page.locator('.rss-design');
    await expect(canvas).toHaveClass(new RegExp(`rss-${layout}`));
    await expect(canvas.locator('[data-rss-title]')).toHaveText((presentation as SyncOnzeTrotsV9Presentation).rich!.news![0]!.title);
    await expect(canvas).not.toContainText('Clubnieuws'); await expect(canvas).not.toContainText('SINDS 1950');
    await expect(canvas.locator('.rss-mast strong')).toHaveText('Nieuws');
    await expect(canvas.locator('.rss-source')).toContainText('Voorbeeldredactie');
    const geometry = await canvas.evaluate(element => {
      const copy = element.querySelector<HTMLElement>('[data-rss-copy]')!, heading = element.querySelector<HTMLElement>('[data-rss-title]')!;
      const rect = heading.getBoundingClientRect(), qr = element.querySelector('.rss-story-qr')?.getBoundingClientRect(), photo = element.querySelector('.rss-story-photo')!.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(heading);
      return { title: rect.toJSON(), glyphs: [...range.getClientRects()].map(value => value.toJSON()), copy: copy.getBoundingClientRect().toJSON(), photo: photo.toJSON(), qr: qr?.toJSON(), font: getComputedStyle(heading).fontFamily, fontSize: getComputedStyle(heading).fontSize, tight: (element as HTMLElement).dataset.rssTight, logicalHeight: copy.clientHeight, headingHeight: heading.offsetHeight, text: element.querySelector('[data-rss-summary]')!.textContent };
    });
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, `${layout}-${orientation}-${kind}.json`), JSON.stringify(geometry, null, 2));
    expect(geometry.font).toContain('OTMarker');
    for (const glyph of geometry.glyphs) { expect(glyph.bottom).toBeLessThanOrEqual(geometry.copy.bottom + 3); expect(glyph.right).toBeLessThanOrEqual(geometry.copy.right + 3); }
    if (geometry.qr && layout !== 'beeldheld' || geometry.qr && orientation === 'portrait') expect(geometry.title.bottom).toBeLessThan(geometry.qr!.top);
    expect(geometry.text).not.toMatch(/<\/?p>|&amp;/);
    mkdirSync(output, { recursive: true }); const frame = join(output, `${layout}-${orientation}-${kind}.png`);
    await page.screenshot({ path: frame });
    const target = kind === 'no-url' ? undefined : (presentation as SyncOnzeTrotsV9Presentation).rich!.news![0]!.url;
    execFileSync(process.execPath, ['--import', 'tsx', 'tests/helpers/s291-decode-qr.mts', frame, ...(target ? [target] : [])], { timeout: 15000 });
    if (!target) await expect(canvas.locator('.rss-story-qr')).toHaveCount(0);
    writeFileSync(frame.replace('.png', '.json'), JSON.stringify(geometry, null, 2));
  });
}
test('article B and a broken photograph retain neutral fallback and the correct own-feed QR', async ({ page }) => {
  const presentation = fixture('nachteditie', 'portrait', 'regular');
  await mount(page, presentation, 1, true);
  await expect(page.locator('.rss-design')).toHaveAttribute('data-article-id', 'article-b');
  await expect(page.locator('[data-rss-title]')).toHaveText('Eigen nieuws van de vereniging');
  await expect(page.locator('.rss-source')).toHaveText('Verenigingsredactie');
  mkdirSync(output, { recursive: true }); const frame = join(output, 'own-feed-article-b.png'); await page.screenshot({ path: frame });
  execFileSync(process.execPath, ['--import', 'tsx', 'tests/helpers/s291-decode-qr.mts', frame, 'https://vereniging.example/nieuws/eigen-bericht'], { timeout: 15000 });
});

for (const layout of layouts) for (const orientation of orientations) test(`Worker capture ${layout}/${orientation} preserves the actual article QR`, async () => {
  mkdirSync(output, { recursive: true });
  const presentation = fixture(layout, orientation, 'regular');
  const input = join(output, `worker-${layout}-${orientation}.json`), frame = join(output, `worker-${layout}-${orientation}.png`);
  writeFileSync(input, JSON.stringify(presentation));
  execFileSync(process.execPath, ['--import', 'tsx', 'tests/helpers/s291-worker-frame.mts', input, frame], { timeout: 45000 });
  execFileSync(process.execPath, ['--import', 'tsx', 'tests/helpers/s291-decode-qr.mts', frame, url], { timeout: 15000 });
});
