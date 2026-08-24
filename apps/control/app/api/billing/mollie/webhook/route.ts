import { NextResponse } from "next/server";

import { verifyMolliePayment } from "../../../../../lib/billing/verify-mollie-payment";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";")[0];
  const raw = await request.text();
  if (contentType !== "application/x-www-form-urlencoded" || raw.length > 256) return NextResponse.json({ error: "invalid_webhook" }, { status: 400 });
  const paymentId = new URLSearchParams(raw).get("id") ?? "";
  if (!/^tr_[A-Za-z0-9]+$/.test(paymentId)) return NextResponse.json({ error: "invalid_webhook" }, { status: 400 });
  try {
    await verifyMolliePayment({ channel: "classic", paymentId, requestBody: raw, requestId: request.headers.get("x-request-id") ?? undefined });
  } catch {
    return NextResponse.json({ error: "verification_temporarily_unavailable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
