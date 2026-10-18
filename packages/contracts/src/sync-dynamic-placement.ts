import {z} from 'zod';

export const syncDynamicPlacementCommandSchema=z.object({
 snapshotId:z.string().uuid(),theme:z.enum(['fieldflow','onzetrots-tv']),
 secondsPerPage:z.number().int().min(3).max(120),idempotencyKey:z.string().uuid(),
}).strict();
export const syncDynamicPlacementReadSchema=z.object({jobId:z.string().uuid()}).strict();
export type SyncDynamicPlacementCommand=z.infer<typeof syncDynamicPlacementCommandSchema>;
