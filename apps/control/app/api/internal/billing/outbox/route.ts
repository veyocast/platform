import { NextResponse } from "next/server";

import { billingPublicUrl, getMollieClient, requireBillingWorker } from "../../../../../lib/billing/mollie-server";
import { createControlAdminClient } from "../../../../../lib/supabase/admin";

type OutboxRow = { aggregate_id: string; attempts: number; id: string; operation: "create_mollie_customer" | "create_first_payment" | "create_recurring_payment"; semantic_key: string; tenant_id: string };

export async function POST(request: Request) {
  if (!requireBillingWorker(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createControlAdminClient();
  const { data: candidate } = await admin.from("billing_outbox").select("id,tenant_id,aggregate_id,operation,semantic_key,attempts").in("state", ["pending", "failed"]).lte("next_attempt_at", new Date().toISOString()).order("created_at").limit(1).maybeSingle();
  if (!candidate) return new NextResponse(null, { status: 204 });
  const { data: claimed } = await admin.from("billing_outbox").update({ attempts: candidate.attempts + 1, state: "processing" }).eq("id", candidate.id).in("state", ["pending", "failed"]).select("id,tenant_id,aggregate_id,operation,semantic_key,attempts").maybeSingle();
  if (!claimed) return new NextResponse(null, { status: 204 });
  try {
    const result = await processOutbox(admin, claimed as OutboxRow);
    await admin.from("billing_outbox").update({ completed_at: new Date().toISOString(), provider_result_id: result, state: "completed" }).eq("id", claimed.id);
    return NextResponse.json({ ok: true, operation: claimed.operation });
  } catch (error) {
    const next = new Date(Date.now() + Math.min(3_600_000, 30_000 * 2 ** Math.min(claimed.attempts, 6))).toISOString();
    await admin.from("billing_outbox").update({ last_error_code: error instanceof Error ? error.name : "ProviderError", next_attempt_at: next, state: "failed" }).eq("id", claimed.id);
    return NextResponse.json({ error: "provider_temporarily_unavailable" }, { status: 503 });
  }
}

async function processOutbox(admin: ReturnType<typeof createControlAdminClient>, row: OutboxRow) {
  const { client, mode } = getMollieClient();
  if (row.operation === "create_mollie_customer") {
    const { data: account, error } = await admin.from("billing_accounts").select("id,legal_name,invoice_email,provider_mode,row_version").eq("id", row.aggregate_id).eq("tenant_id", row.tenant_id).single();
    if (error || !account || account.provider_mode !== mode) throw new Error("BillingProviderIdentityError");
    const customer = await client.createCustomer({ email: account.invoice_email, idempotencyKey: row.semantic_key, metadataId: account.id, name: account.legal_name });
    await admin.from("billing_accounts").update({ mollie_customer_id: customer.id, row_version: account.row_version + 1, updated_at: new Date().toISOString() }).eq("id", account.id).is("mollie_customer_id", null);
    return customer.id;
  }
  const { data: attempt, error } = await admin.from("billing_payment_attempts").select("id,tenant_id,billing_account_id,expected_amount_cents,expected_customer_id,expected_mandate_id,provider_mode,sequence_type,semantic_key").eq("id", row.aggregate_id).eq("tenant_id", row.tenant_id).single();
  if (error || !attempt || attempt.provider_mode !== mode) throw new Error("BillingProviderIdentityError");
  const payment = await client.createPayment({ amountCents: Number(attempt.expected_amount_cents), customerId: attempt.expected_customer_id, description: attempt.sequence_type === "first" ? "VeyoCast betaalmethode bevestigen" : "VeyoCast schermabonnement", idempotencyKey: attempt.semantic_key, ...(attempt.expected_mandate_id ? { mandateId: attempt.expected_mandate_id } : {}), metadata: { attemptId: attempt.id, billingAccountId: attempt.billing_account_id }, ...(attempt.sequence_type === "first" ? { redirectUrl: billingPublicUrl(`/dashboard/settings/billing/return?attempt=${attempt.id}`) } : {}), sequenceType: attempt.sequence_type, webhookUrl: billingPublicUrl("/api/billing/mollie/webhook") });
  await admin.from("billing_payment_attempts").update({ checkout_url: payment._links.checkout?.href ?? payment._links.changePaymentState?.href ?? null, mollie_payment_id: payment.id, provider_status: payment.status, updated_at: new Date().toISOString() }).eq("id", attempt.id).is("mollie_payment_id", null);
  return payment.id;
}
