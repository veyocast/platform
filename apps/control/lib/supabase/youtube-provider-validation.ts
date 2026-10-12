import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readSupabaseAdminSecret } from "@veyocast/config/server";
import type { ResolvedYouTubePlaylist } from "@veyocast/integrations";
import { getSupabasePublicConfig } from "./config";

/** Only records metadata just resolved by the official server-side adapter. */
export async function registerYouTubePlaylistValidation(tenantId: string, actorUserId: string, metadata: ResolvedYouTubePlaylist) {
  const config = getSupabasePublicConfig(); const secret = readSupabaseAdminSecret();
  if (!config || !secret) throw new Error("De beveiligde providervalidatie is niet geconfigureerd.");
  const client = createClient(config.url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const validationId = randomUUID();
  const { error } = await client.rpc("register_youtube_playlist_validation_v1", {
    p_validation_id: validationId, p_tenant_id: tenantId, p_actor_user_id: actorUserId, p_metadata: metadata
  });
  if (error) throw new Error("De providercontrole kon niet veilig worden vastgelegd. Probeer opnieuw.");
  return validationId;
}
