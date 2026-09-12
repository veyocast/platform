import { sportlinkSlideBlueprintKeys, sportlinkSlideBlueprints } from "@veyocast/contracts";

export function slideEditorKind(configuration: unknown) {
  const value = slideRecord(configuration);
  if (value?.schemaVersion === "menu-document.v2") return "menu" as const;
  if (typeof value?.blueprintKey === "string" && sportlinkSlideBlueprintKeys.includes(
    value.blueprintKey as (typeof sportlinkSlideBlueprintKeys)[number]
  )) return "sportlink" as const;
  return "detail" as const;
}

export function slideRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function slideAvailability(input: {
  archived: boolean;
  error: boolean;
  itemCount: number;
  pending: boolean;
  snapshot: unknown;
}) {
  const sport = slideRecord(slideRecord(input.snapshot)?.sport);
  const code = sport?.emptyStateCode;
  if (input.archived) return { label: "Gearchiveerd", detail: "Deze slide wordt niet meer aangeboden voor nieuwe playlistplaatsingen.", tone: "neutral" as const };
  if (input.error) return { label: "Controle nodig", detail: "De laatste verwerking is mislukt. Open de slide en probeer de inhoud opnieuw te verversen.", tone: "critical" as const };
  if (input.itemCount > 0) return { label: "Inhoud beschikbaar", detail: `${input.itemCount} ${input.itemCount === 1 ? "item" : "items"} in de huidige weergave.`, tone: "success" as const };
  if (input.pending) return { label: "Wordt bijgewerkt", detail: "De inhoud wordt verwerkt. De vorige beschikbare versie blijft op de schermen staan.", tone: "warning" as const };
  const reasons: Record<string, string> = {
    COMPETITION_CONTEXT_UNRESOLVED: "De actuele competitie is nog niet eenduidig. Kies bij bewerken een competitie en poule, of ververs de Sportlink-gegevens.",
    STANDINGS_NOT_PUBLISHED: "Sportlink heeft voor dit team en deze competitie nog geen openbare stand. Zodra die beschikbaar is, verschijnt de inhoud automatisch.",
    RESULTS_NOT_PUBLISHED: "Er zijn geen gestarte wedstrijden binnen deze periode en selectie.",
    NO_ITEMS_IN_PERIOD: "Er zijn geen wedstrijden binnen deze periode en selectie. Gestarte wedstrijden staan alleen bij uitslagen.",
    NO_ARRIVALS_IN_WINDOW: "Er zijn geen aankomsten binnen de ingestelde periode.",
    NO_BIRTHDAYS_IN_WINDOW: "Er zijn geen jarigen binnen de ingestelde periode."
  };
  return {
    label: code === "COMPETITION_CONTEXT_UNRESOLVED" ? "Competitie kiezen" : "Nu geen inhoud",
    detail: typeof code === "string" && reasons[code] ? reasons[code]! : "Er is nu geen inhoud voor deze selectie. Controleer de bron en de instellingen; nieuwe inhoud verschijnt automatisch.",
    tone: "warning" as const
  };
}

export function slidePurpose(configuration: unknown) {
  const value = slideRecord(configuration);
  const key = value?.blueprintKey;
  const blueprint = typeof key === "string" && key in sportlinkSlideBlueprints
    ? sportlinkSlideBlueprints[key as keyof typeof sportlinkSlideBlueprints] : null;
  return blueprint?.label ?? null;
}
