import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readSupabaseAdminSecret } from "@veyocast/config/server";

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
  const adminSecret = readSupabaseAdminSecret();

  if (!config || !adminSecret) {
    throw new Error("De Player-beheerconfiguratie is niet beschikbaar.");
  }

  return createClient(config.url, adminSecret, {
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
