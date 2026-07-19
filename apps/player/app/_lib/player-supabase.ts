import "server-only";

import { createClient } from "@supabase/supabase-js";

export type RuntimeEnvironment = Readonly<
  Record<string, string | undefined>
>;

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

export function getSupabaseConfig(
  environment: RuntimeEnvironment = process.env
) {
  const url = readPlayerRuntimeValue(
    "NEXT_PUBLIC_SUPABASE_URL",
    environment
  );
  const anonKey = readPlayerRuntimeValue(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    environment
  );

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

export function readPlayerRuntimeValue(
  name: string,
  environment: RuntimeEnvironment = process.env
) {
  return environment[name]?.trim();
}
