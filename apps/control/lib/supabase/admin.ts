import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "./config";

export function createControlAdminClient() {
  const config = getSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (
    !config ||
    !serviceRoleKey ||
    serviceRoleKey.includes("replace-local")
  ) {
    throw new Error(
      "Lokale Supabase-configuratie mist een server-only service-role key."
    );
  }

  return createClient(config.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
