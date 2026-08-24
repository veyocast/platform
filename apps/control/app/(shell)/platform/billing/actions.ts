"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { requireControlCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

const path = "/platform/billing";

export async function createBillingOverride(formData: FormData) {
  const session = await requireControlCapability("platform.tenant.lifecycle");
  if (session.assuranceLevel !== "aal2") redirect(`/auth/mfa?reden=billing-override&terug=${encodeURIComponent(path)}`);
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const type = String(formData.get("overrideType") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const durationHours = Number.parseInt(String(formData.get("durationHours") ?? ""), 10);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(tenantId) || !["trial_extension","temporary_entitlement","collection_pause"].includes(type) || !Number.isInteger(durationHours) || durationHours < 1 || durationHours > 744 || reason.length < 8 || reason.length > 1000) fail("Controleer tenant, duur, type en motivatie.");
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail("De beveiligde Control-sessie is niet beschikbaar.");
  const { error } = await supabase.rpc("create_billing_override_v1", { p_duration_hours: durationHours, p_override_type: type, p_reason: reason, p_request_id: `control-${randomUUID()}`, p_tenant_id: tenantId });
  if (error) fail("De override is niet toegepast. Controleer of de tenant een billingaccount heeft.");
  redirect(`${path}?succes=${encodeURIComponent("Tijdgebonden override is geaudit en direct als nieuwe entitlementrevision gepubliceerd.")}`);
}

export async function promoteBillingAccountLive(formData: FormData) {
  const session = await requireControlCapability("platform.user.manage");
  if (session.assuranceLevel !== "aal2") redirect(`/auth/mfa?reden=billing-live&terug=${encodeURIComponent(path)}`);
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(tenantId) || reason.length < 8 || reason.length > 1000) fail("Controleer tenant en motivatie voor live-promotie.");
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail("De beveiligde Control-sessie is niet beschikbaar.");
  const { error } = await supabase.rpc("promote_billing_account_live_v1", { p_reason: reason, p_request_id: `control-${randomUUID()}`, p_tenant_id: tenantId });
  if (error) fail("Live-promotie is geweigerd. Alleen een AAL2 platform owner kan deze gecontroleerde stap uitvoeren.");
  redirect(`${path}?succes=${encodeURIComponent("Billingaccount staat in live modus. Verwerk de nieuwe live Customer-outbox pas na providerreadback.")}`);
}

function fail(message: string): never { redirect(`${path}?fout=${encodeURIComponent(message)}`); }
