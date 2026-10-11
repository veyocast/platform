import type { SupabaseClient } from "@supabase/supabase-js";

export type SportlinkLatestRun = {
  errorCode: string | null;
  status: string | null;
  unavailable: boolean;
};

export type SportlinkPolicyHealthInput = {
  enabled: boolean;
  frequency: string;
  last_error_code: string | null;
  last_run_status: string | null;
  last_success_at: string | null;
  run_status_unavailable?: boolean;
};

type SportlinkHealth = {
  kind: "disconnected" | "failed" | "partial" | "paused" | "pending" | "ready" | "running" | "stale" | "unknown";
  label: string;
  tone: "critical" | "neutral" | "success" | "warning";
};

const frequencyMs: Readonly<Record<string, number>> = {
  five_minutes: 5 * 60_000,
  hourly: 60 * 60_000,
  daily: 24 * 60 * 60_000,
  weekly: 7 * 24 * 60 * 60_000,
  monthly: 31 * 24 * 60 * 60_000
};

export async function loadLatestSportlinkRuns(
  client: Pick<SupabaseClient, "from">,
  tenantId: string,
  connectionId: string,
  datasetGroups: readonly string[]
) {
  // Each policy owns its latest observation. Frequent match runs must never
  // push a daily birthday failure out of an unrelated shared history window.
  const observations = await Promise.all([...new Set(datasetGroups)].map(async (group) => {
    try {
      const result = await client.from("sportlink_sync_runs")
        .select("status,error_code")
        .eq("tenant_id", tenantId)
        .eq("connection_id", connectionId)
        .eq("dataset_group", group)
        .order("started_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      return [group, {
        errorCode: result.data?.error_code ?? null,
        status: result.data?.status ?? null,
        unavailable: Boolean(result.error)
      }] as const;
    } catch {
      return [group, { errorCode: null, status: null, unavailable: true }] as const;
    }
  }));
  return new Map<string, SportlinkLatestRun>(observations);
}

export function sportlinkDatasetStatus(policy: SportlinkPolicyHealthInput, now = Date.now()): SportlinkHealth {
  if (!policy.enabled) return { kind: "paused", label: "Gepauzeerd", tone: "neutral" };
  if (policy.run_status_unavailable) return { kind: "unknown", label: "Status onbekend", tone: "warning" };
  if (policy.last_run_status === "failed" || policy.last_error_code) {
    return { kind: "failed", label: "Mislukt", tone: "critical" };
  }
  if (policy.last_run_status === "partial") {
    return { kind: "partial", label: "Gedeeltelijk bijgewerkt", tone: "warning" };
  }
  if (policy.last_run_status === "running") return { kind: "running", label: "Bezig", tone: "warning" };
  if (policy.last_run_status === "queued" || !policy.last_success_at) {
    return { kind: "pending", label: "Ingepland", tone: "warning" };
  }
  const lastSuccess = Date.parse(policy.last_success_at);
  const interval = frequencyMs[policy.frequency];
  if (!Number.isFinite(lastSuccess) || !interval || lastSuccess > now + 5 * 60_000) {
    return { kind: "unknown", label: "Status onbekend", tone: "warning" };
  }
  // Allow one missed scheduled observation before reporting stale content.
  if (lastSuccess + 2 * interval <= now) return { kind: "stale", label: "Verouderd", tone: "warning" };
  return { kind: "ready", label: "Gereed", tone: "success" };
}

export function sportlinkConnectionStatus(
  connection: { last_error_code: string | null; status: string } | null,
  policies: readonly SportlinkPolicyHealthInput[],
  now = Date.now(),
  policiesUnavailable = false
): SportlinkHealth {
  if (!connection) return { kind: "disconnected", label: "Niet verbonden", tone: "neutral" };
  if (connection.status === "paused" || connection.status === "revoked") {
    return { kind: "paused", label: "Gepauzeerd", tone: "neutral" };
  }
  if (connection.status === "error" || connection.last_error_code) {
    return { kind: "failed", label: "Aandacht nodig", tone: "critical" };
  }
  if (policiesUnavailable) return { kind: "unknown", label: "Status onbekend", tone: "warning" };
  const states = policies.filter((policy) => policy.enabled).map((policy) => sportlinkDatasetStatus(policy, now));
  if (!states.length) return { kind: "paused", label: "Gepauzeerd", tone: "neutral" };
  if (states.some((state) => state.kind === "failed")) {
    return { kind: "failed", label: "Aandacht nodig", tone: "critical" };
  }
  if (states.some((state) => state.kind === "unknown")) {
    return { kind: "unknown", label: "Status onbekend", tone: "warning" };
  }
  if (states.some((state) => state.kind === "stale")) {
    return { kind: "stale", label: "Gegevens verouderd", tone: "warning" };
  }
  if (states.some((state) => state.kind === "partial")) {
    return { kind: "partial", label: "Gedeeltelijk bijgewerkt", tone: "warning" };
  }
  if (states.some((state) => state.kind === "running")) {
    return { kind: "running", label: "Synchroniseren", tone: "warning" };
  }
  if (states.some((state) => state.kind === "pending")) {
    return { kind: "pending", label: "Wacht op synchronisatie", tone: "warning" };
  }
  return { kind: "ready", label: "Gesynchroniseerd", tone: "success" };
}

export function safeSportlinkErrorCode(code: unknown) {
  return typeof code === "string" && /^SPORTLINK_[A-Z0-9_]{1,71}$/u.test(code)
    ? code : "SPORTLINK_SYNC_FAILED";
}

export function sportlinkSyncFailureCopy(code: string | null) {
  const causes: Record<string, string> = {
    SPORTLINK_ARGUMENT_INVALID: "Een providerfilter valt buiten het ondersteunde contract.",
    SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY: "Sportlink gaf een antwoord waarin geen geldige verjaardag kon worden herkend.",
    SPORTLINK_CLIENT_ID_INVALID: "Sportlink accepteert de opgeslagen Client ID niet meer.",
    SPORTLINK_CONDITION_ERROR: "Sportlink heeft deze selectie op dit moment niet beschikbaar.",
    SPORTLINK_CONFIGURATION_UNAVAILABLE: "De serverconfiguratie voor de versleutelde koppeling ontbreekt.",
    SPORTLINK_NETWORK_ERROR: "Sportlink was tijdelijk niet bereikbaar.",
    SPORTLINK_RATE_LIMITED: "Sportlink vraagt tijdelijk om minder aanvragen.",
    SPORTLINK_REQUIRED_ARGUMENT_MISSING: "Sportlink ontvangt niet alle benodigde competitiecodes.",
    SPORTLINK_SCOPE_INSUFFICIENT: "De Client ID heeft onvoldoende rechten voor deze dataset.",
    SPORTLINK_SERVER_ERROR: "Sportlink meldde een tijdelijke providerstoring.",
    SPORTLINK_SYNC_COMPLETE_57014: "Het opslaan van de opgehaalde gegevens overschreed de tijdslimiet.",
    SPORTLINK_SYNC_INTERNAL_ERROR: "De opgehaalde gegevens konden niet veilig worden opgeslagen.",
    SPORTLINK_TIMEOUT: "Sportlink reageerde niet binnen de veilige tijdslimiet.",
    SPORTLINK_WORKER_LEASE_EXPIRED: "De synchronisatieworker werd onderbroken.",
    SPORTLINK_WORKER_LEASE_LOST: "Een andere worker heeft de verlopen synchronisatie overgenomen."
  };
  const safeCode = safeSportlinkErrorCode(code);
  const cause = causes[safeCode] ?? "Deze dataset kon niet veilig worden bijgewerkt.";
  const recovery = safeCode === "SPORTLINK_CLIENT_ID_INVALID" || safeCode === "SPORTLINK_SCOPE_INSUFFICIENT"
    ? "Controleer de Client ID en de toegang tot deze dataset en synchroniseer daarna opnieuw."
    : safeCode === "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY"
      ? "Laat het providerantwoord controleren en synchroniseer daarna opnieuw."
      : "Start de synchronisatie opnieuw. Blijft de fout terugkomen, neem dan contact op met de beheerder.";
  return `${cause} De laatste goede inhoud blijft beschikbaar. ${recovery}`;
}
