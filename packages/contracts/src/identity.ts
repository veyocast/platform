import { z } from "zod";

import { commandMetadataSchema } from "./commands";

export const supportedTenantLocales = ["nl-NL", "en-GB"] as const;
export const supportedTenantLocaleSchema = z.enum(supportedTenantLocales);

export const tenantRoleSchema = z.enum([
  "tenant_owner",
  "tenant_admin",
  "tenant_editor",
  "tenant_viewer"
]);

export const platformRoleSchema = z.enum([
  "platform_owner",
  "platform_admin",
  "platform_support",
  "platform_viewer"
]);

export const tenantProvisioningCommandSchema = z
  .object({
    actorBecomesOwner: z.boolean(),
    locale: supportedTenantLocaleSchema,
    metadata: commandMetadataSchema,
    name: z.string().trim().min(2).max(120),
    ownerEmail: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    screenLimit: z.number().int().min(1).max(10_000),
    slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/),
    timezone: z.string().trim().min(3).max(64)
  })
  .strict();

export const tenantInvitationCommandSchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    role: tenantRoleSchema
  })
  .strict();

export type TenantProvisioningCommand = z.infer<typeof tenantProvisioningCommandSchema>;
export type TenantInvitationCommand = z.infer<typeof tenantInvitationCommandSchema>;
