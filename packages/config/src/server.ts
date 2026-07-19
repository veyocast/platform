import "server-only";

export type ServerRuntimeEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type ServerSecretValidation = Readonly<{
  valid: boolean;
}>;

const serviceRoleEnvironmentName = "SUPABASE_SERVICE_ROLE_KEY";

export function validateSupabaseAdminSecret(
  environment: ServerRuntimeEnvironment = process.env
): ServerSecretValidation {
  return { valid: readSupabaseAdminSecret(environment) !== null };
}

export function readSupabaseAdminSecret(
  environment: ServerRuntimeEnvironment = process.env
) {
  const value = environment[serviceRoleEnvironmentName]?.trim();

  if (!value || /^(placeholder|change-me|replace(?:-local)?)/i.test(value)) {
    return null;
  }

  if (value.startsWith("sb_secret_")) {
    return value.length >= 32 ? value : null;
  }

  return readJwtRole(value) === "service_role" ? value : null;
}

function readJwtRole(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1] ?? "", "base64url").toString("utf8")
    ) as { role?: unknown };

    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}
