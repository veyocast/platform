"use server";

import { hasCapability } from "@veyocast/auth";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { loadEffectivePlanning } from "./effective-planning-data.server";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import type { PlanningPreviewResult, PlanningProposal } from "./effective-planning";
import { zonedLocalDateTimeToIso } from "./schedule-time";

export async function previewDefaultPublication(input: { screenIds: string[]; playlistId: string }): Promise<PlanningPreviewResult> {
  const session = await requireTenantControlSession("tenant.release.read");
  if (!session.isLive || !session.tenantId || !hasCapability(session.capabilities, "tenant.screen.read")) {
    return { report: null, error: "De planning kan met deze sessie niet worden gecontroleerd. Er is niets gepubliceerd." };
  }
  return loadEffectivePlanning(session.tenantId, { screenIds: input.screenIds, defaultPlaylistId: input.playlistId });
}

export async function previewScheduleProposal(values: FormData): Promise<PlanningPreviewResult> {
  const session = await requireTenantControlSession("tenant.release.read");
  const supabase = session.isLive && session.tenantId && hasCapability(session.capabilities, "tenant.screen.read")
    ? await createControlSupabaseClient() : null;
  if (!supabase || !session.tenantId) return { report: null, error: "De beveiligde planningcontrole is niet beschikbaar." };
  const playlistId = String(values.get("playlistId") ?? "");
  const [kind, targetId] = String(values.get("target") ?? "").split(":");
  if (!uuidPattern.test(playlistId) || !["all", "screen", "screen_group"].includes(kind ?? "")
    || kind !== "all" && !uuidPattern.test(targetId ?? "")) return { report: null, error: "Kies een geldige playlist en bestemming." };
  const [settings, release, targets] = await Promise.all([
    supabase.from("tenant_settings").select("timezone_name").eq("tenant_id", session.tenantId).maybeSingle(),
    supabase.from("playlist_releases").select("id").eq("tenant_id", session.tenantId).eq("playlist_id", playlistId).order("version", { ascending: false }).limit(1).maybeSingle(),
    kind === "screen_group" ? supabase.from("screen_group_memberships").select("screen_id").eq("tenant_id", session.tenantId).eq("screen_group_id", targetId).order("screen_id").limit(51)
      : kind === "all" ? supabase.from("screens").select("id").eq("tenant_id", session.tenantId).is("deleted_at", null).eq("status", "active").order("id").limit(51)
      : Promise.resolve({ data: [{ id: targetId! }], error: null })
  ]);
  if (settings.error || release.error || targets.error || !release.data?.id) return { report: null, error: "De publicatie, doelen of verenigingstijdzone konden niet volledig worden gecontroleerd." };
  const screenIds = (targets.data ?? []).map(row => "screen_id" in row ? String(row.screen_id) : String(row.id));
  if (!screenIds.length || screenIds.length > 50) return { report: null, error: "Kies voor deze vooruitblik één tot en met vijftig schermen." };
  const timezone = settings.data?.timezone_name ?? "Europe/Amsterdam";
  const scheduleId = String(values.get("scheduleId") ?? "");
  const scheduleKind = String(values.get("scheduleKind") ?? "");
  const source = String(values.get("source") ?? "publisher");
  if (!["once", "daily", "weekly", "custom"].includes(scheduleKind) || !["publisher", "override"].includes(source)
    || scheduleId && !uuidPattern.test(scheduleId)) return { report: null, error: "De voorgestelde planning is ongeldig." };
  try {
    const startsAt = zonedLocalDateTimeToIso(String(values.get("startsAtLocal") ?? ""), timezone);
    const end = String(values.get("endsAtLocal") ?? "");
    const proposal: PlanningProposal = {
      ...(scheduleId ? { scheduleId, expectedRevision: Number(values.get("expectedRevision")) } : {}),
      name: String(values.get("name") ?? ""), releaseId: release.data.id,
      targetKind: kind as PlanningProposal["targetKind"], targetId: targetId ?? "",
      startsAt, endsAt: end ? zonedLocalDateTimeToIso(end, timezone) : null,
      source: source as PlanningProposal["source"], priority: Number(values.get("priority") ?? 100),
      scheduleKind: scheduleKind as PlanningProposal["scheduleKind"],
      recurrence: scheduleKind === "once" ? {} : {
        startTime: String(values.get("windowStartTime") ?? ""), endTime: String(values.get("windowEndTime") ?? ""),
        ...(scheduleKind === "daily" ? {} : { weekdays: values.getAll("weekdays").map(Number) })
      }
    };
    return loadEffectivePlanning(session.tenantId, { screenIds, at: startsAt, proposal });
  } catch (cause) {
    return { report: null, error: cause instanceof Error ? cause.message : "De gekozen periode is ongeldig. Er is niets opgeslagen." };
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
