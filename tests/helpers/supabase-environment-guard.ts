type Environment = Record<string, string | undefined>;

const mutatingPlaywrightFlags = [
  "MENU_STUDIO_E2E",
  "S146_VISUAL_EVIDENCE",
  "VEYOCAST_LIVE_BIRTHDAYS_E2E",
  "VEYOCAST_LIVE_INTEGRATIONS_E2E",
  "VEYOCAST_LIVE_MEDIA_E2E",
  "VEYOCAST_LIVE_ONBOARDING_E2E",
  "VEYOCAST_LIVE_PILOT",
  "VEYOCAST_LIVE_PRODUCT_LOGO_E2E",
  "VEYOCAST_LIVE_STUDIO_E2E",
  "VEYOCAST_LIVE_VENUE_E2E",
  "VEYOCAST_VISUAL_EVIDENCE"
] as const;

export function assertMutatingPlaywrightUsesLocalSupabase(
  environment: Environment
) {
  const enabledFlags = enabledMutatingPlaywrightFlags(environment);
  if (enabledFlags.length === 0) return;

  if (environment.PLAYWRIGHT_EXTERNAL_SERVERS === "1") {
    throw new Error(
      `Muterende Playwright-suite geweigerd (${enabledFlags.join(", ")}). ` +
      "Externe of vooraf gestarte applicaties kunnen hun Supabase-doel niet bewijzen."
    );
  }

  const configuredUrl = environment.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl || !isLocalSupabaseUrl(configuredUrl)) {
    throw new Error(
      `Muterende Playwright-suite geweigerd (${enabledFlags.join(", ")}). ` +
      "Gebruik uitsluitend een verse lokale Supabase-stack op localhost of 127.0.0.1."
    );
  }
}

export function isMutatingPlaywrightRun(environment: Environment) {
  return enabledMutatingPlaywrightFlags(environment).length > 0;
}

export function enabledMutatingPlaywrightFlags(environment: Environment) {
  const enabled: string[] = mutatingPlaywrightFlags.filter(
    (flag) => environment[flag] === "1"
  );
  if (
    environment.ATELIER_IVORY_EVIDENCE === "1" &&
    environment.ATELIER_IVORY_DEMO !== "1"
  ) {
    enabled.push("ATELIER_IVORY_EVIDENCE");
  }
  return enabled;
}

export function isLocalSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}
