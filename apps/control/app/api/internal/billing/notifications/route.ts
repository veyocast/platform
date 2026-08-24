import { NextResponse } from "next/server";

import { requireBillingWorker } from "../../../../../lib/billing/mollie-server";
import { createControlAdminClient } from "../../../../../lib/supabase/admin";

type BillingStage = "d0" | "d1" | "d3" | "d6" | "paid" | "recovered";

export async function POST(request: Request) {
  if (!requireBillingWorker(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createControlAdminClient();
  const { data: candidate } = await admin.from("billing_notifications").select("id,billing_account_id,stage,attempts").eq("channel", "email").in("state", ["pending", "failed"]).lte("next_attempt_at", new Date().toISOString()).order("scheduled_at").limit(1).maybeSingle();
  if (!candidate) return new NextResponse(null, { status: 204 });
  const { data: claimed } = await admin.from("billing_notifications").update({ attempts: candidate.attempts + 1, state: "processing" }).eq("id", candidate.id).in("state", ["pending", "failed"]).select("id,billing_account_id,stage,attempts").maybeSingle();
  if (!claimed) return new NextResponse(null, { status: 204 });
  try {
    const { data: account, error } = await admin.from("billing_accounts").select("invoice_email,legal_name").eq("id", claimed.billing_account_id).single();
    if (error || !account) throw new Error("BillingNotificationAccountError");
    await deliverBillingEmail({ email: account.invoice_email, legalName: account.legal_name, stage: claimed.stage as BillingStage });
    await admin.from("billing_notifications").update({ delivered_at: new Date().toISOString(), last_error_code: null, state: "delivered" }).eq("id", claimed.id);
    return NextResponse.json({ ok: true, stage: claimed.stage });
  } catch (error) {
    const next = new Date(Date.now() + Math.min(3_600_000, 60_000 * 2 ** Math.min(claimed.attempts, 6))).toISOString();
    await admin.from("billing_notifications").update({ last_error_code: error instanceof Error ? error.name : "BillingNotificationDeliveryError", next_attempt_at: next, state: "failed" }).eq("id", claimed.id);
    return NextResponse.json({ error: "notification_delivery_unavailable" }, { status: 503 });
  }
}

async function deliverBillingEmail(input: { email: string; legalName: string; stage: BillingStage }) {
  const endpoint = process.env.BILLING_EMAIL_DELIVERY_URL?.trim();
  const secret = process.env.BILLING_EMAIL_DELIVERY_SECRET?.trim();
  if (!endpoint || !secret) throw new Error("BillingEmailProviderNotConfigured");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("BillingEmailProviderUrlError");
  const copy = stageCopy(input.stage);
  const response = await fetch(url, { body: JSON.stringify({ template: `veyocast-billing-${input.stage}`, to: input.email, variables: { actionUrl: `${process.env.NEXT_PUBLIC_CONTROL_URL}/dashboard/settings/billing`, body: copy.body, legalName: input.legalName, subject: copy.subject } }), headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, method: "POST", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`BillingEmailProvider${response.status}`);
}

function stageCopy(stage: BillingStage) {
  if (stage === "paid") return { body: "Je betaalmethode is bevestigd. Je VeyoCast-trial en schermen blijven beschikbaar.", subject: "Betaalmethode bevestigd" };
  if (stage === "recovered") return { body: "De betaling is bevestigd en normale Player-toegang is automatisch hersteld.", subject: "VeyoCast-toegang hersteld" };
  if (stage === "d6") return { body: "De herstelperiode verloopt binnen ongeveer 24 uur. Werk de betaalmethode bij om onderbreking te voorkomen.", subject: "Actie nodig: herstelperiode verloopt" };
  if (stage === "d3") return { body: "De betaling is nog niet bevestigd. Je content blijft tijdens de herstelperiode spelen.", subject: "Herinnering over je VeyoCast-betaling" };
  if (stage === "d1") return { body: "De betaling is nog niet bevestigd. Controleer je betaalmethode in VeyoCast Control.", subject: "Controleer je VeyoCast-betaling" };
  return { body: "De betaling kon niet worden bevestigd. Je content blijft voorlopig spelen; herstel de betaalmethode in Control.", subject: "Betaling heeft aandacht nodig" };
}
