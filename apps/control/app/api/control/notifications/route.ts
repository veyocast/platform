import { hasCapability } from "@veyocast/auth";
import { NextResponse } from "next/server";

import type { ControlNotification } from "../../../(shell)/_lib/control-notifications-contract";
import { getControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const titles: Readonly<Record<string, string>> = {
  "playlist.release.published": "Playlist gepubliceerd",
  "screen.created": "Scherm aangemaakt",
  "screen.deactivated": "Scherm gepauzeerd",
  "screen.reactivated": "Scherm geactiveerd",
  "tenant.settings.updated": "Instellingen bijgewerkt"
};

export async function GET() {
  try {
    const session = await getControlSession();
    if (!session?.isLive || !session.userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401, headers });
    if (!session.tenantId || session.tenantStatus !== "active" || !hasCapability(session.capabilities, "tenant.audit.read")) {
      return NextResponse.json({ error: "NOTIFICATIONS_UNAVAILABLE" }, { status: 403, headers });
    }
    // Authenticated session client: RLS remains enforced even for platform users;
    // the explicit tenant filter also excludes their other permitted audit scopes.
    const supabase = await createControlSupabaseClient();
    if (!supabase) return NextResponse.json({ error: "NOTIFICATIONS_UNAVAILABLE" }, { status: 503, headers });
    const result = await supabase.from("audit_events")
      .select("id, action, result, created_at")
      .eq("tenant_id", session.tenantId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(20);
    if (result.error) return NextResponse.json({ error: "NOTIFICATIONS_UNAVAILABLE" }, { status: 503, headers });
    const notifications: ControlNotification[] = [];
    for (const row of (result.data ?? []).slice(0, 20)) {
      if (typeof row.id !== "string" || typeof row.action !== "string"
        || typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at))
        || !["success", "denied", "failed"].includes(row.result)) continue;
      notifications.push({
        id: row.id,
        title: row.result === "success" ? titles[row.action] ?? "Activiteit vastgelegd" : row.result === "denied" ? "Actie geweigerd" : "Actie mislukt",
        result: row.result,
        createdAt: row.created_at,
        href: "/dashboard/activity"
      });
    }
    return NextResponse.json({ tenantId: session.tenantId, notifications }, { headers });
  } catch {
    return NextResponse.json({ error: "NOTIFICATIONS_UNAVAILABLE" }, { status: 503, headers });
  }
}
