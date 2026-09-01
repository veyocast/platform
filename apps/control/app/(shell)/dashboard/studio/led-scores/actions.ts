"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ledScoresCanvasAssetIds,
  ledScoresCanvasExperienceSchema,
  ledScoresCanvasMaximumAssets,
  type LedScoresCanvasExperience
} from "@veyocast/contracts";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { lineupBehaviorFromForm } from "./live-match-ux";

const returnPath = "/dashboard/studio/led-scores";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const palettes = new Set(["electric-orange", "ink-black", "signal-red", "white"]);
const animations = new Set(["impact", "pulse", "slide", "none"]);
const overlayTemplates = {
  halfTime: new Set(["score-focus"]),
  lineupAway: new Set(["team-grid"]),
  lineupHome: new Set(["team-grid"]),
  matchEnd: new Set(["final-score"]),
  matchStart: new Set(["matchday-impact"])
} as const;
type OverlayDesignKey = keyof typeof overlayTemplates;

export async function saveLedScoresGoalAlert(formData: FormData) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const alertId = optionalUuid(formData, "alertId");
  const connectionId = requiredUuid(formData, "connectionId");
  const expectedRevision = integer(formData, "expectedRevision", 0, 1_000_000);
  const priority = integer(formData, "priority", 0, 1_000);
  const durationMs = integer(formData, "durationMs", 2_000, 30_000);
  const name = String(formData.get("name") ?? "").trim();
  const underlayPolicy = String(formData.get("underlayPolicy") ?? "continue");
  const targetGroupIds = uniqueUuids(formData.getAll("targetGroupIds"));
  if (
    name.length < 2
    || name.length > 120
    || !["continue", "pause"].includes(underlayPolicy)
    || targetGroupIds.length < 1
    || targetGroupIds.length > 50
  ) fail("Controleer naam, doelgroep, duur, prioriteit en onderliggend afspeelgedrag.");

  const ownDesign = designFrom(formData, "own");
  const opponentDesign = designFrom(formData, "opponent");
  const unknownDesign = designFrom(formData, "unknown");
  const triggerOwn = formData.get("triggerOwn") === "on";
  const triggerOpponent = formData.get("triggerOpponent") === "on";
  const overlayTriggers = {
    end: formData.get("triggerEnd") === "on",
    halfTime: formData.get("triggerHalfTime") === "on",
    lineup: formData.get("triggerLineup") === "on",
    start: formData.get("triggerStart") === "on"
  };
  const overlayDesigns = {
    halfTime: overlayDesignFrom(formData, "halfTime", 8_000),
    lineupAway: overlayDesignFrom(formData, "lineupAway", 12_000),
    lineupHome: overlayDesignFrom(formData, "lineupHome", 12_000),
    matchEnd: overlayDesignFrom(formData, "matchEnd", 12_000),
    matchStart: overlayDesignFrom(formData, "matchStart", 8_000)
  };
  const lineupBehavior = lineupBehaviorFromForm(
    formData,
    integer(formData, "lineupPageDurationMs", 4_000, 10_000)
  );
  const unknownPolicy = String(formData.get("unknownPolicy") ?? "suppress");
  const ownTeamKeys = uniqueTexts(formData.getAll("ownTeamKeys"), 200, 50);
  const activeFrom = utcDateTimeOrNull(formData, "activeFrom");
  const activeUntil = utcDateTimeOrNull(formData, "activeUntil");
  const ownSoundVolume = integer(formData, "ownSoundVolume", 0, 100);
  const opponentSoundVolume = integer(formData, "opponentSoundVolume", 0, 100);
  if (
    !["generic", "suppress"].includes(unknownPolicy)
    || (
      !triggerOwn
      && !triggerOpponent
      && !Object.values(overlayTriggers).some(Boolean)
    )
    || (activeFrom && activeUntil && Date.parse(activeFrom) >= Date.parse(activeUntil))
  ) fail("Kies minimaal één trigger en controleer het optionele actieve tijdvenster.");
  const sponsorCreativeId = optionalUuid(formData, "sponsorCreativeId");
  const canvasExperience = canvasExperienceFrom(formData);
  const assetIds = uniqueUuids([
    ...optionalAssetValues(formData, [
      "logoMediaAssetId", "ownMediaAssetId", "opponentMediaAssetId",
      "unknownMediaAssetId", "ownSoundMediaAssetId", "opponentSoundMediaAssetId"
    ]),
    ...(canvasExperience ? ledScoresCanvasAssetIds(canvasExperience) : [])
  ]);
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail("De beveiligde datasessie ontbreekt. Er is niets opgeslagen.");
  let sponsorMediaAssetId: string | null = null;
  if (sponsorCreativeId) {
    const creative = await supabase.from("sponsor_creatives")
      .select("media_asset_id")
      .eq("tenant_id", session.tenantId!)
      .eq("id", sponsorCreativeId)
      .eq("status", "approved")
      .maybeSingle();
    if (creative.error || !creative.data?.media_asset_id) {
      fail("Het gekozen sponsorblok is niet meer goedgekeurd of beschikbaar.");
    }
    sponsorMediaAssetId = creative.data.media_asset_id;
    assetIds.push(creative.data.media_asset_id);
  }
  if (new Set(assetIds).size > ledScoresCanvasMaximumAssets) {
    fail(`Deze experience gebruikt meer dan ${ledScoresCanvasMaximumAssets} media-items. Verwijder ongebruikte canvasmedia en probeer opnieuw.`);
  }
  const config = {
    activeFrom,
    activeUntil,
    ...(canvasExperience ? { canvasExperience } : {}),
    logoMediaAssetId: optionalUuid(formData, "logoMediaAssetId"),
    lineupBehavior,
    opponentDesign,
    opponentMediaAssetId: optionalUuid(formData, "opponentMediaAssetId"),
    opponentSoundMediaAssetId: optionalUuid(formData, "opponentSoundMediaAssetId"),
    opponentSoundVolume,
    ownDesign,
    ownMediaAssetId: optionalUuid(formData, "ownMediaAssetId"),
    ownSoundMediaAssetId: optionalUuid(formData, "ownSoundMediaAssetId"),
    ownSoundVolume,
    ownTeamKeys,
    overlayDesigns,
    overlayTriggers,
    schemaVersion: 1,
    sponsorCreativeId,
    sponsorMediaAssetId,
    sponsorOnlyOwn: formData.get("sponsorOnlyOwn") === "on",
    triggerOpponent,
    triggerOwn,
    unknownDesign,
    unknownMediaAssetId: optionalUuid(formData, "unknownMediaAssetId"),
    unknownPolicy
  };
  const result = await supabase.rpc("save_ledscores_goal_alert_v1", {
    p_alert_id: alertId,
    p_asset_ids: [...new Set(assetIds)],
    p_config: config,
    p_connection_id: connectionId,
    p_duration_ms: durationMs,
    p_expected_revision: expectedRevision,
    p_name: name,
    p_priority: priority,
    p_target_group_ids: targetGroupIds,
    p_tenant_id: session.tenantId!,
    p_underlay_policy: underlayPolicy
  });
  if (result.error) fail(alertError(result.error.code));
  if (isRecord(result.data) && result.data.outcome === "conflict") {
    fail("Iemand anders wijzigde deze Goal Alert. Vernieuw en pas je ontwerp opnieuw toe.");
  }
  const savedId = isRecord(result.data) && typeof result.data.alertId === "string"
    ? result.data.alertId
    : alertId;
  complete(
    alertId ? "Overlay experienceconcept is bijgewerkt." : "Overlay experienceconcept is gemaakt.",
    savedId ?? undefined
  );
}

function canvasExperienceFrom(formData: FormData): LedScoresCanvasExperience | null {
  const serialized = String(formData.get("canvasExperience") ?? "").trim();
  if (!serialized) return null;
  if (Buffer.byteLength(serialized, "utf8") > 240_000) {
    fail("Het canvasdocument is te groot. Verwijder ongebruikte lagen of media en probeer opnieuw.");
  }
  let input: unknown;
  try {
    input = JSON.parse(serialized);
  } catch {
    fail("Het canvasdocument kon niet veilig worden gelezen. Vernieuw de editor en probeer opnieuw.");
  }
  const parsed = ledScoresCanvasExperienceSchema.safeParse(input);
  if (!parsed.success) {
    fail("Een canvascompositie is onvolledig. Controleer liggend én staand en herstel de gemarkeerde laag.");
  }
  return parsed.data;
}

export async function publishLedScoresGoalAlert(formData: FormData) {
  const session = await requireTenantControlSession("tenant.playlist.publish");
  const alertId = requiredUuid(formData, "alertId");
  const expectedRevision = integer(formData, "expectedRevision", 1, 1_000_000);
  const supabase = await createControlSupabaseClient();
  const result = supabase
    ? await supabase.rpc("publish_ledscores_goal_alert_v1", {
        p_alert_id: alertId,
        p_expected_revision: expectedRevision,
        p_idempotency_key: randomUUID(),
        p_tenant_id: session.tenantId!
      })
    : null;
  if (!result || result.error) fail(alertError(result?.error?.code));
  if (isRecord(result.data) && result.data.outcome === "conflict") {
    fail("Het concept is sinds het openen gewijzigd. Vernieuw voordat je publiceert.");
  }
  const version = isRecord(result.data) ? result.data.version : null;
  complete(`Immutable overlay experienceversie ${String(version ?? "")} is gepubliceerd.`);
}

export async function setLedScoresGoalAlertStatus(formData: FormData) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const alertId = requiredUuid(formData, "alertId");
  const expectedRevision = integer(formData, "expectedRevision", 1, 1_000_000);
  const status = String(formData.get("status") ?? "");
  if (!["published", "paused", "archived"].includes(status)) fail("Kies een geldige alertstatus.");
  const supabase = await createControlSupabaseClient();
  const result = supabase
    ? await supabase.rpc("set_ledscores_goal_alert_status_v1", {
        p_alert_id: alertId,
        p_expected_revision: expectedRevision,
        p_status: status,
        p_tenant_id: session.tenantId!
      })
    : null;
  if (!result || result.error) fail(alertError(result?.error?.code));
  if (isRecord(result.data) && result.data.outcome === "conflict") {
    fail("De alertstatus is al gewijzigd. Vernieuw de pagina.");
  }
  complete(status === "published" ? "Overlay experience is hervat." : status === "paused" ? "Overlay experience is gepauzeerd." : "Overlay experience is gearchiveerd.");
}

export async function testLedScoresGoalAlert(formData: FormData) {
  const session = await requireTenantControlSession("tenant.playlist.publish");
  const alertId = requiredUuid(formData, "alertId");
  const scoringSide = String(formData.get("scoringSide") ?? "own");
  const homeScore = integer(formData, "homeScore", 0, 999);
  const awayScore = integer(formData, "awayScore", 0, 999);
  const scorerName = String(formData.get("scorerName") ?? "").trim();
  if (!new Set(["own", "opponent"]).has(scoringSide)) fail("Kies een geldige testvariant.");
  if (
    scorerName.length > 160
    || (scoringSide === "own" && homeScore < 1)
    || (scoringSide === "opponent" && awayScore < 1)
  ) fail("Controleer de voorbeeldscore en optionele doelpuntenmaker.");
  const supabase = await createControlSupabaseClient();
  const result = supabase
    ? await supabase.rpc("run_ledscores_synthetic_goal_v1", {
        p_alert_id: alertId,
        p_away_score: awayScore,
        p_home_score: homeScore,
        p_scorer_name: scorerName || null,
        p_scoring_side: scoringSide,
        p_tenant_id: session.tenantId!
      })
    : null;
  if (!result || result.error) {
    if (result?.error?.code === "P0004") fail("Er liep net een live-test. Wacht 15 seconden om onbedoelde herhaling te voorkomen.");
    fail(alertError(result?.error?.code));
  }
  const count = isRecord(result.data) ? Number(result.data.deliveryCount ?? 0) : 0;
  const eventId = isRecord(result.data) && typeof result.data.eventId === "string"
    && uuidPattern.test(result.data.eventId)
    ? result.data.eventId
    : undefined;
  complete(
    `Synthetische ${scoringSide === "own" ? "eigen" : "tegenstander"}-goal is voor ${count} uniek${count === 1 ? " scherm" : "e schermen"} klaargezet. Ontvangst en weergave volgen afzonderlijk.`,
    undefined,
    eventId
  );
}

export async function createLedScoresLiveMatchSlide(formData: FormData) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const connectionId = requiredUuid(formData, "connectionId");
  const idempotencyKey = requiredUuid(formData, "idempotencyKey");
  const name = String(formData.get("name") ?? "").trim();
  const orientation = String(formData.get("orientation") ?? "landscape");
  const template = String(formData.get("template") ?? "match_center");
  const timelineLimit = integer(formData, "timelineLimit", 0, 10);
  const outsideMatchBehavior = String(formData.get("outsideMatchBehavior") ?? "last_known");
  const accentMode = String(formData.get("accentMode") ?? "club");
  if (
    name.length < 2
    || name.length > 120
    || !["landscape", "portrait"].includes(orientation)
    || !["match_center", "scoreboard"].includes(template)
    || !["last_known", "skip"].includes(outsideMatchBehavior)
    || !["club", "contrast", "neutral"].includes(accentMode)
  ) {
    fail("Controleer de naam, schermstand en instellingen van de live wedstrijdslide.");
  }
  const supabase = await createControlSupabaseClient();
  const result = supabase
    ? await supabase.rpc("create_ledscores_live_match_slide_v1", {
        p_configuration: {
          liveMatch: {
            accentMode,
            outsideMatchBehavior,
            showClock: formData.get("showClock") === "on",
            showTimeline: formData.get("showTimeline") === "on",
            staleBehavior: "freeze",
            template,
            timelineLimit
          }
        },
        p_connection_id: connectionId,
        p_idempotency_key: idempotencyKey,
        p_name: name,
        p_orientation: orientation,
        p_tenant_id: session.tenantId!
      })
    : null;
  if (!result || result.error || !isRecord(result.data) || typeof result.data.slideId !== "string") {
    fail(liveSlideError(result?.error?.code));
  }
  revalidatePath("/dashboard/slides");
  revalidatePath(returnPath);
  redirect(`/dashboard/slides/${result.data.slideId}?succes=${encodeURIComponent("Live wedstrijdslide is aangemaakt. De slide volgt voortaan de laatst gevalideerde wedstrijdinformatie.")}`);
}

function designFrom(formData: FormData, prefix: "opponent" | "own" | "unknown") {
  const palette = String(formData.get(`${prefix}Palette`) ?? "ink-black");
  const animation = String(formData.get(`${prefix}Animation`) ?? "impact");
  const headline = String(formData.get(`${prefix}Headline`) ?? "").trim();
  const secondaryText = String(formData.get(`${prefix}SecondaryText`) ?? "").trim();
  const scorerFallback = String(formData.get(`${prefix}ScorerFallback`) ?? "").trim();
  if (
    !palettes.has(palette)
    || !animations.has(animation)
    || headline.length < 1
    || headline.length > 80
    || secondaryText.length > 160
    || scorerFallback.length > 120
  ) fail("Controleer de teksten, kleuren en animatie van beide alertvarianten.");
  return {
    animation,
    headline,
    logoPosition: String(formData.get(`${prefix}LogoPosition`) ?? "left") === "center" ? "center" : "left",
    logoScale: ["small", "medium", "large"].includes(String(formData.get(`${prefix}LogoScale`) ?? "medium"))
      ? String(formData.get(`${prefix}LogoScale`))
      : "medium",
    palette,
    scorerFallback: scorerFallback || "Doelpunt!",
    secondaryText,
    showClock: formData.get(`${prefix}ShowClock`) === "on",
    showPreviousScore: formData.get(`${prefix}ShowPreviousScore`) === "on",
    showScorer: formData.get(`${prefix}ShowScorer`) === "on",
    typography: String(formData.get(`${prefix}Typography`) ?? "display") === "body" ? "body" : "display"
  };
}

function overlayDesignFrom(
  formData: FormData,
  prefix: OverlayDesignKey,
  durationMs: number
) {
  const template = String(formData.get(`${prefix}Template`) ?? "");
  const palette = String(formData.get(`${prefix}Palette`) ?? "ink-black");
  const animation = String(formData.get(`${prefix}Animation`) ?? "impact");
  const headline = String(formData.get(`${prefix}Headline`) ?? "").trim();
  const secondaryText = String(formData.get(`${prefix}SecondaryText`) ?? "").trim();
  const logoPosition = String(formData.get(`${prefix}LogoPosition`) ?? "left");
  const logoScale = String(formData.get(`${prefix}LogoScale`) ?? "medium");
  const typography = String(formData.get(`${prefix}Typography`) ?? "display");
  if (
    !overlayTemplates[prefix].has(template)
    || !palettes.has(palette)
    || !animations.has(animation)
    || !["left", "center"].includes(logoPosition)
    || !["small", "medium", "large"].includes(logoScale)
    || !["body", "display"].includes(typography)
    || headline.length < 1
    || headline.length > 80
    || secondaryText.length > 160
  ) {
    fail("Controleer de tekst, animatie en vormgeving van de wedstrijdoverlays.");
  }
  return {
    animation,
    durationMs,
    headline,
    logoPosition,
    logoScale,
    palette,
    secondaryText,
    showClock: formData.get(`${prefix}ShowClock`) === "on",
    showPreviousScore: formData.get(`${prefix}ShowPreviousScore`) === "on",
    showScorer: formData.get(`${prefix}ShowScorer`) === "on",
    template,
    typography
  };
}

function optionalAssetValues(formData: FormData, keys: string[]) {
  return keys.flatMap((key) => {
    const value = String(formData.get(key) ?? "");
    if (!value) return [];
    if (!uuidPattern.test(value)) fail("Een gekozen media-item is ongeldig.");
    return [value];
  });
}
function uniqueUuids(values: FormDataEntryValue[] | string[]) {
  const result = [...new Set(values.map(String).filter(Boolean))];
  if (result.some((value) => !uuidPattern.test(value))) fail("Een gekozen doelgroep of media-item is ongeldig.");
  return result;
}
function uniqueTexts(values: FormDataEntryValue[], maximumLength: number, maximumItems: number) {
  const result = [...new Set(values.map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
  if (
    result.length > maximumItems
    || result.some((value) => value.length > maximumLength || hasControlCharacter(value))
  ) fail("Een gekozen teamfilter is ongeldig.");
  return result;
}
function hasControlCharacter(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}
function requiredUuid(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  if (!uuidPattern.test(value)) fail("De gekozen resource is ongeldig.");
  return value;
}
function optionalUuid(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  if (!value) return null;
  if (!uuidPattern.test(value)) fail("Een gekozen resource is ongeldig.");
  return value;
}
function integer(formData: FormData, key: string, minimum: number, maximum: number) {
  const value = Number.parseInt(String(formData.get(key) ?? ""), 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) fail("Een numerieke instelling valt buiten de toegestane grenzen.");
  return value;
}
function utcDateTimeOrNull(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    fail("Het actieve tijdvenster heeft geen geldige UTC-datum en -tijd.");
  }
  const parsed = new Date(`${value}:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) fail("Het actieve tijdvenster bevat een ongeldige datum.");
  return parsed.toISOString();
}
function alertError(code: string | undefined) {
  if (code === "42501") return "Je rol, tenantstatus of featureflag staat deze overlay experience-actie niet toe.";
  if (code === "23505") return "Er bestaat al een overlay experience met deze naam.";
  if (code === "23514") return "Een doelgroep, verbinding, media-item of ontwerpinstelling is niet meer geldig.";
  if (code === "P0002") return "De overlay experience of verbinding bestaat niet meer.";
  if (code === "55000") return "Een immutable publicatie kan niet worden gewijzigd. Maak een nieuwe versie.";
  return "De overlay experience kon niet transactioneel worden opgeslagen.";
}
function liveSlideError(code: string | undefined) {
  if (code === "42501") return "Je rol, tenantstatus of featureflag staat het maken van deze live wedstrijdslide niet toe.";
  if (code === "P0002") return "De actieve LED Scores-verbinding of ingebouwde live template is niet meer beschikbaar.";
  if (code === "23505") return "Er bestaat al een slide met deze naam. Kies een herkenbare andere naam.";
  return "De live wedstrijdslide kon niet veilig worden aangemaakt. Controleer de bronstatus en probeer opnieuw.";
}
function complete(message: string, edit?: string, resultEventId?: string): never {
  revalidatePath(returnPath);
  revalidatePath("/dashboard/studio");
  revalidatePath("/dashboard/data-sources/led-scores");
  redirect(`${returnPath}?succes=${encodeURIComponent(message)}${edit ? `&edit=${edit}` : ""}${resultEventId ? `&resultaat=${resultEventId}` : ""}`);
}
function fail(message: string): never { redirect(`${returnPath}?fout=${encodeURIComponent(message)}`); }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
