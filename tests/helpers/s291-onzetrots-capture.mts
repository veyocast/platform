import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { syncContentFamilies, syncSlidePresentationSchema } from '../../packages/contracts/src/index';
import { createSyncStudioDocument } from '../../packages/studio/src/sync';
import { createSyncTemplatePreview } from '../../apps/control/app/(shell)/dashboard/studio/sync-template-preview';
import { createSyncSlideCapture } from '../../apps/media-worker/src/sync-dom-capture';

const require = createRequire(new URL('../../apps/media-worker/package.json', import.meta.url));
const sharp = require('sharp');
if (!process.argv[2]) throw Error('Provide a new owned capture directory.');
const output = resolve(process.argv[2]);
await mkdir(output, { recursive: false });
const selected = process.env.OT_CURRENT_FAMILIES?.split(',');
const matrix = [];
for (const family of syncContentFamilies.filter(value => !selected || selected.includes(value.id))) {
  for (const orientation of ['landscape', 'portrait'] as const) for (const mode of ['light', 'dark'] as const) {
    const example = createSyncTemplatePreview(family.id);
    if (example.rendererVersion === 'sync-v1') throw Error('The approved display fixture is required.');
    const presentation = syncSlidePresentationSchema.parse({
      ...example, rendererVersion: 'sync-onzetrots-v9', sourceRevision: '5ba52a657d6d16ad103ba2fb43b8db18aa83715a',
      orientation, visual: { ...example.visual, mode }, authoring: { visualRevision: 'onzetrots-20261024', schemaVersion: 1, headerSubtitles: {}, headerTexts: {}, welcomeScalePercent: 150 },
    });
    const document = createSyncStudioDocument(presentation);
    const capture = await createSyncSlideCapture({
      presentation, durationMs: document.motion.durationMs, executablePath: chromium.executablePath(),
      sceneState: { paused: true, pausedAtMs: 1200, introFinished: true },
    });
    try {
      const bytes = await capture.renderPng(1200), metadata = await sharp(bytes).metadata();
      if (metadata.width !== document.artboard.width || metadata.height !== document.artboard.height) throw Error('Native capture dimensions changed.');
      const filename = `${family.id}-${orientation}-${mode}.png`;
      await writeFile(join(output, filename), bytes, { flag: 'wx' });
      matrix.push({ family: family.id, orientation, mode, filename, width: metadata.width, height: metadata.height,
        elapsedMs: 1200, paused: true, introFinished: true, durationMs: document.motion.durationMs,
        visualRevision:'onzetrots-20261024', rendererVersion: presentation.rendererVersion, sourceRevision: presentation.sourceRevision,
        contextScalePercent:130,
        sha256: createHash('sha256').update(bytes).digest('hex') });
      await writeFile(join(output, 'matrix.json'), JSON.stringify(matrix, null, 2) + '\n');
      process.stdout.write(`${matrix.length}: ${filename}\n`);
    } finally { await capture.close(); }
  }
}
