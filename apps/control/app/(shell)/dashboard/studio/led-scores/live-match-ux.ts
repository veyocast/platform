export const overlayStepIds = ["moments", "design", "media", "targets", "review"] as const;

export type OverlayStepId = (typeof overlayStepIds)[number];
export type OverlayDesignKey =
  | "lineupHome"
  | "lineupAway"
  | "matchStart"
  | "halfTime"
  | "matchEnd";
export type OverlayTriggerKey = "lineup" | "start" | "halfTime" | "end";

export type OverlayDesignValue = {
  animation: string;
  headline: string;
  logoPosition: string;
  logoScale: string;
  palette: string;
  secondaryText: string;
  showClock: boolean;
  showPreviousScore: boolean;
  showScorer: boolean;
  template: string;
  typography: string;
};

export type OverlayTriggers = Record<OverlayTriggerKey, boolean>;

export type LineupBehavior = {
  activeFallback: boolean;
  includeOpponent: boolean;
  pageDurationMs: number;
  selectedOnly: boolean;
};

export const overlayTriggerDefaults: OverlayTriggers = {
  end: false,
  halfTime: false,
  lineup: false,
  start: false
};

export const lineupBehaviorDefaults: LineupBehavior = {
  activeFallback: false,
  includeOpponent: false,
  pageDurationMs: 6_000,
  selectedOnly: true
};

export const overlayDesignDefaults: Record<OverlayDesignKey, OverlayDesignValue> = {
  lineupHome: {
    animation: "slide",
    headline: "Onze opstelling",
    logoPosition: "left",
    logoScale: "medium",
    palette: "ink-black",
    secondaryText: "Klaar voor de wedstrijd",
    showClock: false,
    showPreviousScore: false,
    showScorer: true,
    template: "team-grid",
    typography: "display"
  },
  lineupAway: {
    animation: "slide",
    headline: "Opstelling tegenstander",
    logoPosition: "left",
    logoScale: "medium",
    palette: "white",
    secondaryText: "De bezoekers van vandaag",
    showClock: false,
    showPreviousScore: false,
    showScorer: true,
    template: "team-grid",
    typography: "display"
  },
  matchStart: {
    animation: "impact",
    headline: "De wedstrijd begint",
    logoPosition: "center",
    logoScale: "large",
    palette: "electric-orange",
    secondaryText: "Samen voor de winst",
    showClock: true,
    showPreviousScore: false,
    showScorer: false,
    template: "matchday-impact",
    typography: "display"
  },
  halfTime: {
    animation: "pulse",
    headline: "Rust",
    logoPosition: "left",
    logoScale: "medium",
    palette: "ink-black",
    secondaryText: "De tussenstand",
    showClock: true,
    showPreviousScore: true,
    showScorer: false,
    template: "score-focus",
    typography: "display"
  },
  matchEnd: {
    animation: "impact",
    headline: "Eindstand",
    logoPosition: "center",
    logoScale: "large",
    palette: "ink-black",
    secondaryText: "Bedankt voor jullie support",
    showClock: false,
    showPreviousScore: true,
    showScorer: false,
    template: "final-score",
    typography: "display"
  }
};

export const overlaySteps: Array<{
  description: string;
  id: OverlayStepId;
  label: string;
}> = [
  { description: "Bron en live momenten", id: "moments", label: "Momenten" },
  { description: "Templates en databinding", id: "design", label: "Vormgeving" },
  { description: "Veilige visuele fallback", id: "media", label: "Media" },
  { description: "Schermgroepen en bereik", id: "targets", label: "Schermen" },
  { description: "Controle voor opslaan", id: "review", label: "Controleren" }
];

export function readOverlayTriggers(config: Record<string, unknown>): OverlayTriggers {
  const value = record(config.overlayTriggers);
  return {
    end: boolean(value?.end, overlayTriggerDefaults.end),
    halfTime: boolean(value?.halfTime, overlayTriggerDefaults.halfTime),
    lineup: boolean(value?.lineup, overlayTriggerDefaults.lineup),
    start: boolean(value?.start, overlayTriggerDefaults.start)
  };
}

export function readLineupBehavior(config: Record<string, unknown>): LineupBehavior {
  const value = record(config.lineupBehavior);
  return {
    activeFallback: boolean(value?.activeFallback, lineupBehaviorDefaults.activeFallback),
    includeOpponent: boolean(value?.includeOpponent, lineupBehaviorDefaults.includeOpponent),
    pageDurationMs: allowedNumber(value?.pageDurationMs, [4_000, 6_000, 8_000, 10_000], lineupBehaviorDefaults.pageDurationMs),
    selectedOnly: boolean(value?.selectedOnly, lineupBehaviorDefaults.selectedOnly)
  };
}

export function lineupBehaviorFromForm(
  formData: Pick<FormData, "get">,
  pageDurationMs: number
): LineupBehavior {
  return {
    activeFallback: formData.get("lineupActiveFallback") === "on",
    includeOpponent: formData.get("lineupIncludeOpponent") === "on",
    pageDurationMs,
    selectedOnly: formData.get("lineupSelectedOnly") === "on"
  };
}

export function normalizeProviderTeamKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function readOverlayDesign(
  config: Record<string, unknown>,
  key: OverlayDesignKey
): OverlayDesignValue {
  const designs = record(config.overlayDesigns);
  const value = record(designs?.[key]);
  const fallback = overlayDesignDefaults[key];
  return {
    animation: text(value?.animation) || fallback.animation,
    headline: text(value?.headline) || fallback.headline,
    logoPosition: text(value?.logoPosition) || fallback.logoPosition,
    logoScale: text(value?.logoScale) || fallback.logoScale,
    palette: text(value?.palette) || fallback.palette,
    secondaryText: text(value?.secondaryText) || fallback.secondaryText,
    showClock: boolean(value?.showClock, fallback.showClock),
    showPreviousScore: boolean(value?.showPreviousScore, fallback.showPreviousScore),
    showScorer: boolean(value?.showScorer, fallback.showScorer),
    template: text(value?.template) || fallback.template,
    typography: text(value?.typography) || fallback.typography
  };
}

export function enabledMomentCount(
  triggerOwn: boolean,
  triggerOpponent: boolean,
  triggers: OverlayTriggers
) {
  return Number(triggerOwn || triggerOpponent)
    + Number(triggers.lineup)
    + Number(triggers.start)
    + Number(triggers.halfTime)
    + Number(triggers.end);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function boolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function allowedNumber(value: unknown, allowed: number[], fallback: number) {
  return typeof value === "number" && allowed.includes(value) ? value : fallback;
}
