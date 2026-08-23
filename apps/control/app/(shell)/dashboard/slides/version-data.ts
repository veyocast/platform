import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import type { DynamicSlideVersionSummary } from "./version-history";

export async function loadDynamicSlideVersionState(tenantId: string, slideId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return null;
  const [slideResult, versionsResult] = await Promise.all([
    supabase
      .from("dynamic_slides")
      .select("id,current_published_version_id,active_draft_version_id")
      .eq("tenant_id", tenantId)
      .eq("id", slideId)
      .neq("status", "archived")
      .maybeSingle(),
    supabase
      .from("dynamic_slide_versions")
      .select("id,version_number,status,created_at,published_at")
      .eq("tenant_id", tenantId)
      .eq("dynamic_slide_id", slideId)
      .order("version_number", { ascending: false })
  ]);
  if (slideResult.error || versionsResult.error || !slideResult.data) return null;
  const slide = slideResult.data;
  return {
    activeDraftVersionId: slide.active_draft_version_id,
    currentVersionId: slide.current_published_version_id,
    versions: (versionsResult.data ?? []).flatMap((version) =>
      isVersionStatus(version.status) ? [{
        createdAt: version.created_at,
        id: version.id,
        isCurrent: version.id === slide.current_published_version_id,
        publishedAt: version.published_at,
        status: version.status,
        versionNumber: version.version_number
      } satisfies DynamicSlideVersionSummary] : []
    )
  };
}

function isVersionStatus(value: string): value is DynamicSlideVersionSummary["status"] {
  return ["archived", "draft", "published", "publishing"].includes(value);
}
