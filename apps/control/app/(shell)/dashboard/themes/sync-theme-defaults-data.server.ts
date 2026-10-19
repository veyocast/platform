import "server-only";
import { hasCapability, type Capability } from "@veyocast/auth";
import { syncThemeDefaultsReadModelSchema, type SyncThemeDefaultsReadModel } from "@veyocast/contracts";

export type SyncThemeDefaultsClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
};
export type SyncThemeDefaultsReadResult =
  | { ok: true; value: SyncThemeDefaultsReadModel }
  | { ok: false; code: "unavailable"; uncertain: false; message: string };

export function canReadSyncThemeCreationDefaults(capabilities: readonly Capability[]): boolean {
  return (["tenant.settings.read", "tenant.settings.manage", "tenant.studio.read", "tenant.studio.create", "tenant.dynamic_slide.read", "tenant.dynamic_slide.write"] as const)
    .some(capability => hasCapability(capabilities, capability));
}

/** Pure bounded read. Null profiles are valid unset; corrupt data is an error. */
export async function loadSyncThemeCreationDefaults(client: SyncThemeDefaultsClient, tenantId: string): Promise<SyncThemeDefaultsReadResult> {
  const failure = { ok: false, code: "unavailable", uncertain: false,
    message: "Je opgeslagen thema-instellingen konden niet volledig worden bevestigd. Je invoer blijft behouden; laad de pagina opnieuw voordat je nieuwe instellingen gebruikt of opslaat." } as const;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(tenantId)) return failure;
  try {
    const result = await client.rpc("read_sync_theme_creation_defaults_v1", { p_tenant_id: tenantId });
    if (result.error) return failure;
    const parsed = syncThemeDefaultsReadModelSchema.safeParse(result.data);
    return parsed.success && parsed.data.tenantId === tenantId ? { ok: true, value: parsed.data } : failure;
  } catch { return failure; }
}
