import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readSupabaseAdminSecret } from "@veyocast/config/server";

import { getSupabasePublicConfig } from "./config";

export function createControlAdminClient() {
  const config = getSupabasePublicConfig();
  const adminSecret = readSupabaseAdminSecret();

  if (!config || !adminSecret) {
    throw new Error(
      "Lokale Supabase-beheerconfiguratie is niet beschikbaar."
    );
  }

  return createClient(config.url, adminSecret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
