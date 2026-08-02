"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function createDynamicSlide(formData: FormData) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const name = String(formData.get("name") ?? "").trim();
  const templateVersionId = String(formData.get("templateVersionId") ?? "");
  const dataSourceId = String(formData.get("dataSourceId") ?? "");
  const selectionMode = String(formData.get("selectionMode") ?? "latest");
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const requestedMaxItems = Math.min(
    40,
    Math.max(1, Number(formData.get("maxItems")) || 8)
  );
  const requestedSecondsPerSlide = Math.min(
    120,
    Math.max(5, Number(formData.get("secondsPerSlide")) || 5)
  );
  const supabase = await createControlSupabaseClient();
  if (
    !supabase ||
    name.length < 2 ||
    name.length > 120 ||
    !uuidPattern.test(templateVersionId) ||
    !uuidPattern.test(dataSourceId) ||
    (selectionMode !== "latest" && selectionMode !== "pinned")
  ) {
    redirect("/dashboard/slides/new?fout=Controleer+de+naam,+template+en+databron.");
  }
  const [templateResult, sourceResult] = await Promise.all([
    supabase
      .from("dynamic_templates")
      .select("slide_type")
      .eq("current_published_version_id", templateVersionId)
      .eq("status", "published")
      .maybeSingle(),
    supabase
      .from("dynamic_data_sources")
      .select("kind")
      .eq("id", dataSourceId)
      .eq("tenant_id", session.tenantId!)
      .neq("status", "archived")
      .maybeSingle()
  ]);
  const templateSlideType = templateResult.data?.slide_type;
  const sourceKind = sourceResult.data?.kind;
  if (templateResult.error || !templateSlideType) {
    redirect(
      "/dashboard/slides/new?fout=Het+gekozen+template+is+niet+meer+gepubliceerd.+Kies+een+ander+template."
    );
  }
  if (sourceResult.error || !sourceKind) {
    redirect(
      "/dashboard/slides/new?fout=De+gekozen+databron+is+niet+meer+beschikbaar."
    );
  }
  if (!sourceMatchesSlideType(sourceKind, templateSlideType)) {
    redirect(
      "/dashboard/slides/new?fout=Template+en+databron+horen+niet+bij+hetzelfde+slidetype.+Kies+de+combinatie+opnieuw."
    );
  }
  const maxItems = isSingleMatchSlide(templateSlideType)
    ? 1
    : templateSlideType === "news"
      ? Math.min(requestedMaxItems, 12)
      : requestedMaxItems;
  const { data, error } = await supabase.rpc("create_dynamic_slide_v1", {
    p_configuration_json: {
      ...(templateSlideType === "menu" && category ? { category } : {}),
      maxItems,
      ...(templateSlideType === "news"
        ? { secondsPerSlide: requestedSecondsPerSlide }
        : {}),
      ...(templateSlideType === "news"
        ? { title: title || "Voetbalnieuws" }
        : title
          ? { title }
          : {})
    },
    p_data_source_id: dataSourceId,
    p_name: name,
    p_selection_mode: selectionMode,
    p_template_version_id: templateVersionId,
    p_tenant_id: session.tenantId!
  });
  const slideId = isRecord(data) && typeof data.slideId === "string"
    ? data.slideId
    : null;
  if (error || !slideId) {
    console.error("Dynamische slide maken mislukt", {
      code: error?.code ?? "slide_result_invalid"
    });
    const message = error?.code === "23514"
      ? "De gekozen databron bevat nog geen bruikbare inhoud. Synchroniseer de bron en probeer het opnieuw."
      : error?.code === "42501"
        ? "Je hebt geen toestemming om deze dynamische slide te maken."
        : "De slide kon tijdelijk niet worden gemaakt. Je bestaande slides en publicaties zijn niet gewijzigd.";
    redirect(`/dashboard/slides/new?fout=${encodeURIComponent(message)}`);
  }
  revalidatePath("/dashboard/slides");
  redirect(`/dashboard/slides/${slideId}?succes=De+eerste+immutable+snapshot+wordt+gerenderd.`);
}

export async function refreshDynamicSlide(formData: FormData) {
  await requireTenantControlSession("tenant.dynamic_slide.write");
  const slideId = String(formData.get("slideId") ?? "");
  const supabase = await createControlSupabaseClient();
  if (!supabase || !uuidPattern.test(slideId)) {
    redirect("/dashboard/slides?fout=De+slide+is+ongeldig.");
  }
  const { error } = await supabase.rpc("refresh_dynamic_slide_v1", {
    p_slide_id: slideId
  });
  if (error) {
    redirect(`/dashboard/slides/${slideId}?fout=Er+kon+geen+nieuwe+snapshot+worden+gemaakt.+De+laatste+goede+versie+blijft+beschikbaar.`);
  }
  revalidatePath(`/dashboard/slides/${slideId}`);
  revalidatePath("/dashboard/slides");
  redirect(`/dashboard/slides/${slideId}?succes=Nieuwe+snapshot+staat+in+de+renderqueue.`);
}

export async function addDynamicSlideToPlaylist(formData: FormData) {
  const session = await requireTenantControlSession("tenant.playlist.write");
  const slideId = String(formData.get("slideId") ?? "");
  const playlistId = String(formData.get("playlistId") ?? "");
  const duration = Math.min(3600, Math.max(5, Number(formData.get("duration")) || 10));
  const supabase = await createControlSupabaseClient();
  if (
    !supabase ||
    !uuidPattern.test(slideId) ||
    !uuidPattern.test(playlistId)
  ) {
    redirect(`/dashboard/slides/${slideId}?fout=Kies+een+geldige+playlist.`);
  }
  const playlist = await supabase
    .from("playlists")
    .select("revision")
    .eq("id", playlistId)
    .eq("tenant_id", session.tenantId!)
    .maybeSingle();
  if (
    playlist.error ||
    !playlist.data ||
    !Number.isInteger(Number(playlist.data.revision))
  ) {
    redirect(`/dashboard/slides/${slideId}?fout=De+playlist+kon+niet+veilig+worden+geladen.`);
  }
  const { data, error } = await supabase.rpc("add_dynamic_slide_to_playlist_v2", {
    p_duration_seconds: duration,
    p_dynamic_slide_id: slideId,
    p_expected_revision: Number(playlist.data.revision),
    p_idempotency_key: randomUUID(),
    p_playlist_id: playlistId
  });
  if (
    error ||
    !isRecord(data) ||
    (data.outcome !== "applied" && data.outcome !== "conflict")
  ) {
    redirect(`/dashboard/slides/${slideId}?fout=De+slide+is+nog+niet+gereed+of+kon+niet+aan+de+playlist+worden+toegevoegd.`);
  }
  if (data.outcome === "conflict") {
    redirect(
      `/dashboard/slides/${slideId}?fout=De+playlist+is+ondertussen+gewijzigd.+Open+de+slide+opnieuw+en+probeer+nogmaals.`
    );
  }
  revalidatePath(`/dashboard/playlists/${playlistId}`);
  redirect(`/dashboard/playlists/${playlistId}?succes=De+dynamische+HTML%2FCSS-slide+is+aan+het+concept+toegevoegd.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sourceMatchesSlideType(kind: string, slideType: string) {
  if (slideType === "menu") {
    return kind === "manual_products" || kind === "twelve_excel";
  }
  if (slideType === "news") return kind === "rss";
  return kind === "sportlink" && slideType.startsWith("sport_");
}

function isSingleMatchSlide(slideType: string) {
  return [
    "sport_match_of_the_day",
    "sport_next_match"
  ].includes(slideType);
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
