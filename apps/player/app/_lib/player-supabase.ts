import "server-only";

import { createClient } from "@supabase/supabase-js";

export function isLivePlayerConfigured() {
  return Boolean(getSupabaseConfig());
}

export function createPlayerAnonClient() {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createPlayerAdminClient() {
  const config = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!config || !serviceRoleKey || serviceRoleKey.includes("replace")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ontbreekt voor de live Player API.");
  }

  return createClient(config.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (
    !url ||
    !anonKey ||
    url.includes("replace") ||
    anonKey.includes("replace")
  ) {
    return null;
  }

  return { anonKey, url };
}
