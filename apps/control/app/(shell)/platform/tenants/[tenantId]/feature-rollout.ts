export const platformTenantFeatureDefinitions = [
  {
    description:
      "Semantische Vector-tokens, compacte geometrie en consistente light/dark componenttaal.",
    key: "vector_v2_design_system",
    label: "Vector-designsysteem",
    status: "STABIELE BASIS"
  },
  {
    description:
      "Living Venue-rail, commandbar, System Pulse en zichtbare operationele context in Control.",
    key: "vector_v2_control_shell",
    label: "Vector Control-shell",
    status: "PILOT"
  },
  {
    description:
      "Eén toegankelijke bronkiezer voor media, slides, templates en ondersteunde integratieassets.",
    key: "unified_resource_picker",
    label: "Unified Resource Picker",
    status: "PILOT"
  },
  {
    description:
      "Eén samenhangende zoek- en filterervaring voor operationele resourcepagina's.",
    key: "unified_filter_dock",
    label: "Unified Filter Dock",
    status: "PILOT"
  },
  {
    description:
      "Persistente venues, zones, plattegronden en genormaliseerde schermposities met toegankelijke lijstfallback.",
    key: "venue_twin",
    label: "Venue Twin",
    status: "PILOTPRODUCT"
  },
  {
    description:
      "Samengestelde vlootgezondheid boven bestaande heartbeat-, sync-, error- en opslagtelemetry.",
    key: "screen_health_view",
    label: "Screen Health",
    status: "PILOT UI"
  },
  {
    description:
      "Polls en publieksstemmen met QR, lifecycle, misbruikbeperking en live resultaten.",
    key: "engage",
    label: "Engage",
    status: "PILOTPRODUCT"
  },
  {
    description:
      "Officiële online-only playback met Data/IFrame API en verplichte lokale fallback.",
    key: "youtube_integration",
    label: "YouTube",
    status: "PROVIDER GATED"
  },
  {
    description:
      "Read-only LED Scores-websocketconnector met immutable Goal Alerts en gesynchroniseerde Player-overlays.",
    key: "ledscores_realtime",
    label: "LED Scores realtime",
    status: "EXPERIMENTELE PILOT"
  }
] as const;

export type PlatformTenantFeatureKey =
  (typeof platformTenantFeatureDefinitions)[number]["key"];

export const platformTenantFeatureKeys = platformTenantFeatureDefinitions.map(
  (definition) => definition.key
);

const platformTenantFeatureKeySet = new Set<string>(platformTenantFeatureKeys);

export const tenantFeatureRolloutErrorMessages: Readonly<Record<string, string>> = {
  "feature-audit":
    "De auditregistratie kon niet worden opgeslagen; er is niets gewijzigd. Probeer opnieuw en geef de referentie door aan support als dit blijft gebeuren.",
  "feature-conflict":
    "De tenantstatus of vrijgave is ondertussen gewijzigd. Vernieuw de pagina en beoordeel de actuele status opnieuw.",
  "feature-definition":
    "De featuredefinitie ontbreekt in deze omgeving. Er is niets gewijzigd; laat eerst de deploymentconfiguratie controleren.",
  "feature-kill-switch":
    "Deze feature is door de globale kill switch geblokkeerd. Er is niets gewijzigd.",
  "feature-reden":
    "Vul een reden van minimaal 8 en maximaal 500 tekens in, met cohort, eigenaar en verificatiepad.",
  "feature-tenant":
    "De vereniging bestaat niet meer of is niet beschikbaar. Vernieuw het verenigingsoverzicht.",
  "feature-onbekend":
    "Deze feature is niet beschikbaar voor tenantvrijgave. Vernieuw de pagina en probeer geen verouderd formulier opnieuw.",
  "feature-invoer":
    "Het vrijgaveformulier is ongeldig of verouderd. Vernieuw de pagina en probeer opnieuw.",
  "feature-uitkomst-onzeker":
    "De serverbevestiging ontbreekt. Vernieuw de pagina en controleer de actuele status voordat je opnieuw indient; geef de referentie door aan support als dit blijft gebeuren."
};

type RolloutParseError =
  | "feature-invoer"
  | "feature-onbekend"
  | "feature-reden";

export type TenantFeatureRolloutCommand = Readonly<{
  enabled: boolean;
  expectedRevision: number;
  flagKey: PlatformTenantFeatureKey;
  reason: string;
  requestId: string;
}>;

export type TenantFeatureRolloutResult = Readonly<{
  auditEventId: string | null;
  enabled: boolean;
  flagKey: PlatformTenantFeatureKey;
  outcome: "applied" | "unchanged";
  requestId: string;
  revision: number;
  tenantId: string;
}>;

export function parseTenantFeatureRolloutCommand(input: Readonly<{
  enabled: string;
  flagKey: string;
  reason: string;
  requestId: string;
  revision: string;
}>):
  | Readonly<{ data: TenantFeatureRolloutCommand; ok: true }>
  | Readonly<{ error: RolloutParseError; ok: false }> {
  if (!platformTenantFeatureKeySet.has(input.flagKey)) {
    return { error: "feature-onbekend", ok: false };
  }

  const reason = input.reason.trim();
  if (reason.length < 8 || reason.length > 500) {
    return { error: "feature-reden", ok: false };
  }

  if (
    (input.enabled !== "yes" && input.enabled !== "no") ||
    !/^(0|[1-9][0-9]*)$/.test(input.revision) ||
    !isUuid(input.requestId)
  ) {
    return { error: "feature-invoer", ok: false };
  }

  const expectedRevision = Number(input.revision);
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0
  ) {
    return { error: "feature-invoer", ok: false };
  }

  return {
    data: {
      enabled: input.enabled === "yes",
      expectedRevision,
      flagKey: input.flagKey as PlatformTenantFeatureKey,
      reason,
      requestId: input.requestId
    },
    ok: true
  };
}

export function classifyTenantFeatureRolloutError(code: string | undefined) {
  switch (code) {
    case "42501":
      return "rechten";
    case "23514":
    case "22023":
      return "feature-invoer";
    case "42704":
    case "PGRST202":
      return "feature-definition";
    case "P0002":
      return "feature-tenant";
    case "40001":
    case "23505":
    case "PT409":
      return "feature-conflict";
    case "55000":
      return "feature-kill-switch";
    case "23503":
    case "PT500":
      return "feature-audit";
    default:
      return "feature-uitkomst-onzeker";
  }
}

export function isTenantFeatureRolloutResult(
  value: unknown,
  command: TenantFeatureRolloutCommand,
  tenantId: string
): value is TenantFeatureRolloutResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return (
    (result.outcome === "applied" || result.outcome === "unchanged") &&
    result.enabled === command.enabled &&
    result.flagKey === command.flagKey &&
    result.requestId === command.requestId &&
    result.tenantId === tenantId &&
    typeof result.revision === "number" &&
    Number.isSafeInteger(result.revision) &&
    result.revision >= 0 &&
    (result.outcome === "applied"
      ? typeof result.auditEventId === "string" && isUuid(result.auditEventId)
      : result.auditEventId === null)
  );
}

export function deriveTenantFeatureRolloutDisplay(input: Readonly<{
  definitionAvailable: boolean;
  effectiveEnabled: boolean;
  killSwitchActive: boolean;
  storedEnabled: boolean;
  tenantActive: boolean;
}>) {
  if (!input.definitionAvailable) {
    return {
      detail: "De featuredefinitie ontbreekt in deze omgeving.",
      label: "Definitie ontbreekt",
      tone: "warning" as const
    };
  }
  if (input.killSwitchActive) {
    return {
      detail: input.storedEnabled
        ? "Het tenantbesluit blijft bewaard, maar de globale noodstop blokkeert de feature."
        : "De globale noodstop blokkeert nieuwe vrijgave.",
      label: "Globaal geblokkeerd",
      tone: "warning" as const
    };
  }
  if (!input.tenantActive && input.storedEnabled) {
    return {
      detail: "Het tenantbesluit blijft bewaard, maar de tenantstatus blokkeert de feature.",
      label: "Tenant geblokkeerd",
      tone: "warning" as const
    };
  }
  if (input.effectiveEnabled) {
    return {
      detail: null,
      label: "Vrijgegeven",
      tone: "success" as const
    };
  }
  return { detail: null, label: "Uit", tone: "neutral" as const };
}

export function safeFeatureRolloutReference(value: string | undefined) {
  return value && isUuid(value) ? value : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
