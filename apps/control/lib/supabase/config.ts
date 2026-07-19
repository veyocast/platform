const placeholderMarker = "replace-local";

export type RuntimeEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type SupabasePublicConfig = {
  anonKey: string;
  url: string;
};

export type ControlRuntimeMode = "demo" | "live" | "unavailable";

export function getSupabasePublicConfig(
  environment: RuntimeEnvironment = process.env
): SupabasePublicConfig | null {
  const url = readEnvironmentValue(environment, "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnvironmentValue(
    environment,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );

  if (
    !url ||
    !anonKey ||
    url.includes(placeholderMarker) ||
    anonKey.includes(placeholderMarker)
  ) {
    return null;
  }

  return { anonKey, url };
}

export function isLiveSupabaseConfigured(
  environment: RuntimeEnvironment = process.env
) {
  return getSupabasePublicConfig(environment) !== null;
}

export function getControlRuntimeMode(
  environment: RuntimeEnvironment = process.env
): ControlRuntimeMode {
  if (isLiveSupabaseConfigured(environment)) {
    return "live";
  }

  const nodeEnvironment = readEnvironmentValue(environment, "NODE_ENV");
  const deploymentEnvironment = readEnvironmentValue(
    environment,
    "VEYOCAST_ENVIRONMENT"
  );

  return nodeEnvironment === "development" && !deploymentEnvironment
    ? "demo"
    : "unavailable";
}

export function readEnvironmentValue(
  environment: RuntimeEnvironment,
  name: string
) {
  return environment[name]?.trim();
}
