import { hasCapability } from "@veyocast/auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
const hub = "/dashboard/sponsors";

/** Browser POST/303 makes a rejected four-eyes action visible independently of Flight. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try {
    const supplied = new URL(origin ?? "");
    sameOrigin = supplied.origin === origin && supplied.host === request.headers.get("host") && supplied.protocol === new URL(request.url).protocol;
  } catch { /* Malformed/opaque origins cannot authorize a cookie-based write. */ }
  if (!sameOrigin) return failure(403);
  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length <= 0 || length > 8192) return failure(413);
  const session = await getControlSession();
  if (!session?.isLive || !session.tenantId || session.tenantStatus !== "active" || !hasCapability(session.capabilities, "tenant.sponsor.approve")) return failure(403);
  const form = await request.formData().catch(() => null);
  const campaignId = form?.get("campaignId");
  if (typeof campaignId !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(campaignId)) return failure(400);
  const client = await createControlSupabaseClient();
  if (!client) return failure(503);
  const { error } = await client.rpc("approve_sponsor_campaign_v1", { p_tenant_id: session.tenantId, p_campaign_id: campaignId, p_approve: true });
  // Preserve the validated browser host; Next may use its listen host in request.url.
  const target = new URL(hub, origin!);
  if (error) target.searchParams.set("fout", "campagneactie");
  else {
    revalidatePath(hub);
    target.searchParams.set("succes", "goedgekeurd");
  }
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
function failure(status: number) {
  return NextResponse.json({ error: "De beoordeling kon niet veilig worden verwerkt. Open Sponsorbeheer opnieuw en controleer je sessie, rechten en de actuele campagnestatus." }, { status, headers: { "Cache-Control": "no-store" } });
}
