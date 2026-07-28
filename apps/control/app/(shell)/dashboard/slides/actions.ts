"use server";

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
  const maxItems = Math.min(40, Math.max(1, Number(formData.get("maxItems")) || 8));
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
  const { data, error } = await supabase.rpc("create_dynamic_slide_v1", {
    p_configuration_json: {
      ...(category ? { category } : {}),
      maxItems,
      ...(title ? { title } : {})
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
    redirect("/dashboard/slides/new?fout=De+slide+kon+niet+worden+gemaakt.+Controleer+of+de+databron+bruikbare+inhoud+bevat.");
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
  await requireTenantControlSession("tenant.playlist.write");
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
  const { error } = await supabase.rpc("add_dynamic_slide_to_playlist_v1", {
    p_duration_seconds: duration,
    p_dynamic_slide_id: slideId,
    p_playlist_id: playlistId
  });
  if (error) {
    redirect(`/dashboard/slides/${slideId}?fout=De+slide+is+nog+niet+gereed+of+kon+niet+aan+de+playlist+worden+toegevoegd.`);
  }
  revalidatePath(`/dashboard/playlists/${playlistId}`);
  redirect(`/dashboard/playlists/${playlistId}?succes=Dynamische+snapshot+is+aan+het+concept+toegevoegd.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
