import { z } from "zod";

export const safeActionErrorCodes = [
  "VALIDATION",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "TEMPORARILY_UNAVAILABLE",
  "INTERNAL"
] as const;

export const safeActionErrorCodeSchema = z.enum(safeActionErrorCodes);

export const safeActionErrorSchema = z
  .object({
    code: safeActionErrorCodeSchema,
    message: z.string().trim().min(1).max(500),
    recovery: z.string().trim().min(1).max(500),
    fieldErrors: z.record(z.string(), z.array(z.string().trim().min(1).max(240))).optional(),
    requestId: z.string().trim().min(8).max(128).optional()
  })
  .strict();

export type SafeActionErrorCode = z.infer<typeof safeActionErrorCodeSchema>;
export type SafeActionError = z.infer<typeof safeActionErrorSchema>;

export function createSafeActionError(input: SafeActionError): SafeActionError {
  return safeActionErrorSchema.parse(input);
}
