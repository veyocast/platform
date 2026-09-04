import type { ReactNode } from "react";

import { requireControlSession } from "../../lib/control-session";
import { createControlSupabaseClient } from "../../lib/supabase/server";
import { ControlShell } from "./_components/control-shell";
import type { GlobalUploadTrayItem } from "./_components/global-upload-tray";
import { getNavigationGroupsForRoles } from "./_lib/control-navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ShellLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  const session = await requireControlSession();
  const navigationGroups = getNavigationGroupsForRoles(
    session.capabilities,
    Boolean(session.tenantId) || !session.isLive
  );
  const uploadQueue = await loadGlobalUploadQueue(
    session.tenantId,
    session.isLive
  );
  return (
    <ControlShell
      key={session.tenantId ?? "platform"}
      navigationGroups={navigationGroups}
      session={session}
      uploadQueue={uploadQueue}
      visualQaEnabled={
        process.env.NODE_ENV !== "production" &&
        process.env.FIELDFLOW_VISUAL_QA === "1"
      }
    >
      {children}
    </ControlShell>
  );
}

async function loadGlobalUploadQueue(
  tenantId: string | null,
  isLive: boolean
): Promise<GlobalUploadTrayItem[]> {
  if (!isLive || !tenantId) return [];

  const supabase = await createControlSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("media_assets")
    .select("id, title, original_file_name, status")
    .eq("tenant_id", tenantId)
    .eq("source_kind", "user")
    .in("status", ["uploading", "processing"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Globale uploadstatus laden mislukt", error);
    return [];
  }

  return (data ?? []).map((item) => ({
    fileName: item.original_file_name,
    id: item.id,
    status: item.status,
    title: item.title
  }));
}
