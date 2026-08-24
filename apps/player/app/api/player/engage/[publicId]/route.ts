import { engagePublicCampaignSchema } from "@veyocast/contracts";
import { NextResponse } from "next/server";

import { createPlayerAdminClient } from "../../../../_lib/player-supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }
  try {
    const result = await createPlayerAdminClient().rpc(
      "get_engage_campaign_public_v1",
      { p_public_id: publicId }
    );
    const parsed = engagePublicCampaignSchema.safeParse(result.data);
    if (result.error || !parsed.success) {
      return NextResponse.json(
        { error: "Campagne niet actief." },
        { headers: { "cache-control": "no-store" }, status: 404 }
      );
    }
    return NextResponse.json(parsed.data, {
      headers: { "cache-control": "no-store" }
    });
  } catch {
    return NextResponse.json(
      { error: "Live resultaten tijdelijk niet beschikbaar." },
      { headers: { "cache-control": "no-store" }, status: 503 }
    );
  }
}
