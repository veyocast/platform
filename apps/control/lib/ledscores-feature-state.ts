export type LedScoresFeatureAvailability =
  | "available"
  | "definition_missing"
  | "globally_blocked"
  | "not_released"
  | "tenant_blocked"
  | "unavailable";

export type LedScoresEffectiveState = Readonly<{
  configuredEnabled: boolean;
  definitionAvailable: boolean;
  enabled: boolean;
  flagKey: "ledscores_realtime";
  killSwitchActive: boolean;
  revision: number;
  tenantId: string;
}>;

export const ledScoresFeatureAvailabilityMessages: Readonly<
  Record<Exclude<LedScoresFeatureAvailability, "available">, Readonly<{
    detail: string;
    title: string;
  }>>
> = {
  definition_missing: {
    detail:
      "De featuredefinitie ontbreekt in deze omgeving. Beheer blijft veilig geblokkeerd totdat de deployment is hersteld.",
    title: "Featuredefinitie ontbreekt."
  },
  globally_blocked: {
    detail:
      "De configuratie blijft bewaard, maar bewerken, testen en realtime verwerking zijn tijdelijk geblokkeerd.",
    title: "LED Scores is globaal gepauzeerd."
  },
  not_released: {
    detail:
      "Een platformbeheerder moet de experimentele feature eerst met reden en AAL2 inschakelen. Bestaande playback blijft ongewijzigd.",
    title: "Niet vrijgegeven voor deze tenant."
  },
  tenant_blocked: {
    detail:
      "Het tenantbesluit blijft bewaard, maar de tenantstatus blokkeert bewerken, testen en realtime verwerking.",
    title: "Tenantstatus blokkeert LED Scores."
  },
  unavailable: {
    detail:
      "Vernieuw de pagina. Blijft dit gebeuren, laat dan de deploymentstatus controleren; er worden geen beheeracties aangeboden.",
    title: "Vrijgavestatus tijdelijk niet beschikbaar."
  }
};

export function deriveLedScoresFeatureAvailability(
  state: LedScoresEffectiveState | null
): LedScoresFeatureAvailability {
  if (!state) return "unavailable";
  if (!state.definitionAvailable) return "definition_missing";
  if (state.killSwitchActive) return "globally_blocked";
  if (!state.configuredEnabled) return "not_released";
  return state.enabled ? "available" : "tenant_blocked";
}

export function parseLedScoresEffectiveState(
  value: unknown,
  tenantId: string
): LedScoresEffectiveState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  if (
    state.tenantId !== tenantId ||
    state.flagKey !== "ledscores_realtime" ||
    typeof state.definitionAvailable !== "boolean" ||
    typeof state.killSwitchActive !== "boolean" ||
    typeof state.configuredEnabled !== "boolean" ||
    typeof state.enabled !== "boolean" ||
    typeof state.revision !== "number" ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 0 ||
    (state.enabled && (
      !state.definitionAvailable ||
      state.killSwitchActive ||
      !state.configuredEnabled
    ))
  ) return null;

  return {
    configuredEnabled: state.configuredEnabled,
    definitionAvailable: state.definitionAvailable,
    enabled: state.enabled,
    flagKey: "ledscores_realtime",
    killSwitchActive: state.killSwitchActive,
    revision: state.revision,
    tenantId
  };
}
