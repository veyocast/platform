"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantCapability } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";

const path = "/dashboard/settings/billing";

export async function createBillingAccount(formData: FormData) {
  const session = await requireTenantCapability("tenant.billing.manage");
  if (session.assuranceLevel !== "aal2") redirect(`/auth/mfa?reden=billing&terug=${encodeURIComponent(path)}`);
  const supabase = await createControlSupabaseClient();
  if (!session.tenantId || !supabase) fail("Beveiligde billingconfiguratie ontbreekt.");
  const legalName = text(formData, "legalName", 2, 180);
  const email = text(formData, "invoiceEmail", 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Vul een geldig factuuradres in.");
  if (formData.get("termsAccepted") !== "on") fail("Accepteer prijs en voorwaarden voordat je de trial gereedmaakt.");
  const { error } = await supabase.rpc("ensure_billing_account_v1", { p_country_code: "NL", p_expected_absent: true, p_invoice_email: email, p_legal_name: legalName, p_tenant_id: session.tenantId, p_terms_version: "launch-2026-08-24" });
  if (error) fail("Het billingaccount kon niet transactioneel worden aangemaakt.");
  done("Billingaccount gereed. Mollie wordt in testmodus voorbereid.");
}

export async function startPaymentMethodSetup(formData: FormData) {
  const session = await requireTenantCapability("tenant.billing.manage");
  if (session.assuranceLevel !== "aal2") redirect(`/auth/mfa?reden=billing&terug=${encodeURIComponent(path)}`);
  const supabase = await createControlSupabaseClient();
  if (!session.tenantId || !supabase) fail("Beveiligde billingconfiguratie ontbreekt.");
  const revision = Number.parseInt(String(formData.get("rowVersion") ?? ""), 10);
  if (!Number.isSafeInteger(revision) || revision < 1) fail("De billingversie is verouderd. Vernieuw de pagina.");
  const { error } = await supabase.rpc("enqueue_first_payment_v1", { p_expected_row_version: revision, p_tenant_id: session.tenantId });
  if (error) fail(error.message.includes("not ready") ? "Mollie Customer wordt nog voorbereid. Probeer zo opnieuw." : "De betaalmethodeflow kon niet veilig starten.");
  done("Betaalmethodeflow staat klaar. Open de beveiligde Mollie-link zodra de worker hem heeft verwerkt.");
}

function text(data: FormData, name: string, min: number, max: number) { const value=String(data.get(name)??"").trim(); if(value.length<min||value.length>max) fail("Controleer de ingevulde factuurgegevens."); return value; }
function fail(message:string):never { redirect(`${path}?fout=${encodeURIComponent(message)}`); }
function done(message:string):never { revalidatePath(path); redirect(`${path}?succes=${encodeURIComponent(message)}`); }
