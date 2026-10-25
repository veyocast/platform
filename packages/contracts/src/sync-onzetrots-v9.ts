import { z } from 'zod';
import { syncContentFamilies } from './sync-content-families';

/** Additive identity. S285/v1 documents keep their original layout and timing. */
export const syncOnzeTrotsV9RendererVersion = 'sync-onzetrots-v9' as const;
export const syncOnzeTrotsV9SourceRevision = '5ba52a657d6d16ad103ba2fb43b8db18aa83715a' as const;

/** Saved authoring, independent of canonical provider facts. A family switch
 * preserves every other header and the shared visitors/welcome scale. */
export const syncOnzeTrotsV9AuthoringSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  /** Explicit opt-in on a new or consciously saved draft; absent means historical v9. */
  visualRevision: z.literal('onzetrots-20261024').optional(),
  headerSubtitles: z.partialRecord(
    z.enum(syncContentFamilies.map(family => family.id)),
    z.string().max(120),
  ).default({}),
  headerTexts: z.partialRecord(
    z.enum(syncContentFamilies.map(family => family.id)),
    z.string().max(120),
  ).default({}),
  welcomeScalePercent: z.number().int().min(100).max(200).multipleOf(5).default(150),
}).strict();
