import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readSupabaseAdminSecret } from "@veyocast/config/server";
import { getSupabasePublicConfig } from "../../../../../lib/supabase/config";

/** No provider token or encrypted credentials are returned to the browser. */
export async function registerSitesSourceProviderProof(tenantId: string, actorUserId: string, provider: "sportlink" | "youtube-video", metadata: Record<string, unknown>) {
  const config = getSupabasePublicConfig(); const secret = readSupabaseAdminSecret();
  if (!config || !secret) throw new Error("SOURCE_VALIDATION_UNAVAILABLE");
  const client = createClient(config.url, secret, { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: (input, init) => globalThis.fetch(input, { ...init, signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(30_000)]) }) } });
  const validationId = randomUUID();
  const { error } = await client.rpc("register_source_connection_validation_v1", { p_validation_id: validationId, p_tenant_id: tenantId, p_actor_user_id: actorUserId, p_provider: provider, p_metadata: metadata });
  if (error) throw new Error("SOURCE_VALIDATION_UNAVAILABLE");
  return validationId;
}
