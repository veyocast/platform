import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { getMollieClient } from "./mollie-server";
import { createControlAdminClient } from "../supabase/admin";

type VerificationChannel = "classic" | "reconcile" | "return";

export async function verifyMolliePayment(input: {
  attemptId?: string;
  channel: VerificationChannel;
  paymentId?: string;
  requestBody: string;
  requestId?: string;
  tenantId?: string;
}) {
  const admin = createControlAdminClient();
  let query = admin
    .from("billing_payment_attempts")
    .select("id,tenant_id,billing_account_id,mollie_payment_id,sequence_type");
  query = input.attemptId ? query.eq("id", input.attemptId) : query.eq("mollie_payment_id", input.paymentId ?? "");
  if (input.tenantId) query = query.eq("tenant_id", input.tenantId);
  const { data: attempt, error: attemptError } = await query.maybeSingle();
  if (attemptError) throw new Error("BillingPaymentLookupError");
  if (!attempt?.mollie_payment_id) return { found: false as const };

  const { client, mode } = getMollieClient();
  const payment = await client.getPayment(attempt.mollie_payment_id);
  const chargebacks = payment.status === "paid" ? await client.listPaymentChargebacks(payment.id) : [];
  const effectiveStatus = chargebacks.length ? "charged_back" : payment.status;
  const amountCents = parseMollieCents(payment.amount.value);
  const { error: applyError } = await admin.rpc("apply_verified_billing_payment_v1", {
    p_amount_cents: amountCents,
    p_attempt_id: attempt.id,
    p_body_hash: createHash("sha256").update(input.requestBody).digest("hex"),
    p_channel: input.channel,
    p_currency: payment.amount.currency,
    p_customer_id: payment.customerId,
    p_mandate_id: payment.mandateId ?? null,
    p_payment_id: payment.id,
    p_provider_mode: mode,
    p_request_id: input.requestId ?? randomUUID(),
    p_status: effectiveStatus
  });
  if (applyError) throw new Error("BillingPaymentApplyError");

  if (effectiveStatus === "paid" && payment.sequenceType === "first") {
    const mandates = await client.listMandates(payment.customerId);
    const primaryId = mandates.find((mandate) => mandate.status === "valid")?.id ?? null;
    await admin.from("billing_mandates").update({ is_primary: false }).eq("billing_account_id", attempt.billing_account_id);
    for (const mandate of mandates) {
      const { error } = await admin.from("billing_mandates").upsert({
        billing_account_id: attempt.billing_account_id,
        is_primary: mandate.id === primaryId,
        last_synced_at: new Date().toISOString(),
        method: mandate.method,
        mollie_mandate_id: mandate.id,
        provider_mode: mode,
        status: mandate.status,
        tenant_id: attempt.tenant_id
      }, { onConflict: "provider_mode,mollie_mandate_id" });
      if (error) throw new Error("BillingMandateSyncError");
    }
  }
  return { found: true as const, status: effectiveStatus };
}

function parseMollieCents(value: string) {
  const match = /^(\d+)\.(\d{2})$/.exec(value);
  if (!match) throw new Error("BillingProviderAmountError");
  const cents = Number(match[1]) * 100 + Number(match[2]);
  if (!Number.isSafeInteger(cents)) throw new Error("BillingProviderAmountError");
  return cents;
}
