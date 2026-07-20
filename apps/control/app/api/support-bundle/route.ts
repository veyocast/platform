import { hasCapability } from "@veyocast/auth";
import { createSupportBundle } from "@veyocast/observability";
import { NextResponse } from "next/server";

import { getControlSession } from "../../../lib/control-session";
import { createControlSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getControlSession();
  if (!session) return error("Sessie vereist.", 401);
  if (!hasCapability(session.roles, "tenant.support.export")) {
    return error("Je mist de capability om een supportbundel te exporteren.", 403);
  }
  if (!session.isLive || !session.tenantId) {
    return error("Supportbundels zijn alleen beschikbaar voor een actieve live tenant.", 409);
  }

  const supabase = await createControlSupabaseClient();
  if (!supabase) return error("De beveiligde datasessie ontbreekt.", 503);

  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1_000);
  const [eventsResult, releasesResult] = await Promise.all([
    supabase
      .from("audit_events")
      .select("action, created_at, result")
      .eq("tenant_id", session.tenantId)
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("playlist_releases")
      .select("id")
      .eq("tenant_id", session.tenantId)
      .order("published_at", { ascending: false })
      .limit(100)
  ]);

  if (eventsResult.error || releasesResult.error) {
    return error("De toegestane supportstatus kon niet veilig worden verzameld.", 503);
  }

  const bundle = createSupportBundle({
    appVersion: process.env.npm_package_version ?? "0.0.0",
    environment: process.env.VEYOCAST_ENVIRONMENT ?? "development",
    events: (eventsResult.data ?? []).map((event) => ({
      code: event.action,
      occurredAt: event.created_at,
      result: event.result
    })),
    generatedAt: to.toISOString(),
    releaseIds: (releasesResult.data ?? []).map((release) => release.id),
    revision: process.env.DEPLOYMENT_SHA ?? "development",
    service: "control",
    window: { from: from.toISOString(), to: to.toISOString() }
  });

  const auditResult = await supabase.from("audit_events").insert({
    action: "support.bundle.exported",
    actor_user_id: session.userId,
    metadata: {
      event_count: bundle.events.length,
      release_count: bundle.release_ids.length,
      schema_version: bundle.schema_version,
      window_from: bundle.window.from,
      window_to: bundle.window.to
    },
    result: "success",
    target_type: "support_bundle",
    tenant_id: session.tenantId
  });
  if (auditResult.error) return error("De export kon niet in het auditlog worden vastgelegd.", 503);

  return new NextResponse(`${JSON.stringify(bundle, null, 2)}\n`, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="veyocast-support-${to.toISOString().slice(0, 10)}.json"`,
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff"
    }
  });
}

function error(message: string, status: number) {
  return NextResponse.json({ code: "support_bundle_unavailable", message }, {
    headers: { "cache-control": "no-store" },
    status
  });
}
