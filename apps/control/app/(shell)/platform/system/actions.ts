"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireControlCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function configureStagingPlayerDemo(formData: FormData) {
  await requireControlCapability("platform.user.manage", {
    aal2: true,
    returnTo: "/platform/system#player-demo"
  });

  if (process.env.VEYOCAST_ENVIRONMENT !== "staging") {
    fail("omgeving");
  }

  const selection = String(formData.get("demoPlaylist") ?? "");
  const [tenantId, playlistId, ...rest] = selection.split(":");
  if (
    rest.length ||
    !tenantId ||
    !playlistId ||
    !uuidPattern.test(tenantId) ||
    !uuidPattern.test(playlistId)
  ) {
    fail("invoer");
  }

  const supabase = await createControlSupabaseClient();
  if (!supabase) fail("configuratie");

  const { error } = await supabase.rpc("set_staging_player_demo_playlist", {
    p_playlist_id: playlistId,
    p_tenant_id: tenantId
  });

  if (error) {
    if (error.code === "42501") fail("rechten");
    if (error.code === "23514") fail("playlist");
    fail("onverwacht");
  }

  revalidatePath("/platform/system");
  redirect("/platform/system?demo=opgeslagen#player-demo");
}

function fail(code: string): never {
  redirect(`/platform/system?demoFout=${encodeURIComponent(code)}#player-demo`);
}

