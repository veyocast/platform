import { engagePublicCampaignSchema, engageVoteRequestSchema, engageVoteResultSchema } from "@veyocast/contracts";
import { type NextRequest, NextResponse } from "next/server";

import {
  createEngageVisitorId,
  deriveEngageVoterHashes,
  getEngageVisitorCookieName,
  getEngageVisitorCookieOptions
} from "../../../../lib/engage-voter-identity";
import { createControlAdminClient } from "../../../../lib/supabase/admin";

type RouteContext = { params: Promise<{ publicId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return handle(request, context, null);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const payload = engageVoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: "Ongeldige stem." }, { status: 400 });
  return handle(request, context, payload.data.optionId);
}

async function handle(request: NextRequest, context: RouteContext, optionId: string | null) {
  const { publicId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  const cookieName = getEngageVisitorCookieName();
  const existingVisitor = request.cookies.get(cookieName)?.value;
  const visitorId = existingVisitor && /^[0-9a-f-]{36}$/i.test(existingVisitor) ? existingVisitor : createEngageVisitorId();
  let hashes: ReturnType<typeof deriveEngageVoterHashes>;
  try {
    hashes = deriveEngageVoterHashes({
      campaignId: publicId,
      forwardedFor: request.headers.get("x-forwarded-for"),
      secret: process.env.ENGAGE_ABUSE_SIGNING_SECRET ?? "",
      userAgent: request.headers.get("user-agent"),
      visitorId
    });
  } catch {
    return NextResponse.json({ error: "Stemmen is tijdelijk niet beschikbaar." }, { status: 503 });
  }
  const admin = createControlAdminClient();
  const result = optionId
    ? await admin.rpc("submit_engage_vote_v1", { p_identity_hash: hashes.identityHash, p_network_hash: hashes.networkHash, p_option_id: optionId, p_public_id: publicId })
    : await admin.rpc("get_engage_campaign_for_identity_v1", { p_identity_hash: hashes.identityHash, p_public_id: publicId });
  if (result.error || !result.data) return NextResponse.json({ error: "Campagne niet beschikbaar." }, { status: optionId ? 409 : 404 });
  const parsed = optionId ? engageVoteResultSchema.safeParse(result.data) : engagePublicCampaignSchema.safeParse(result.data);
  if (!parsed.success) return NextResponse.json({ error: "Campagnedata is ongeldig." }, { status: 502 });
  const response = NextResponse.json(parsed.data, { headers: { "cache-control": "private, no-store" } });
  if (!existingVisitor) {
    response.cookies.set(
      cookieName,
      visitorId,
      getEngageVisitorCookieOptions(process.env.NODE_ENV === "production")
    );
  }
  return response;
}
