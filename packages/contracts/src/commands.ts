import { z } from "zod";

export const idempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const commandMetadataSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative().optional(),
    idempotencyKey: idempotencyKeySchema,
    requestId: z.string().trim().min(8).max(128)
  })
  .strict();

export type CommandMetadata = z.infer<typeof commandMetadataSchema>;
