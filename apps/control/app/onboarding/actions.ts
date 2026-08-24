"use server";

import { verifySetupIntentToken } from "@veyocast/auth/setup-intent";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  isOnboardingOrganizationType,
  isOnboardingUseCase,
  normalizeOnboardingSlug,
  onboardingSetupCookieName,
  onboardingTermsVersion,
  parseOnboardingSourceKeys
} from "../../lib/onboarding-contract";
import { tenantContextCookieName } from "../../lib/tenant-context";
import { createControlSupabaseClient } from "../../lib/supabase/server";
import { setupIntentSigningSecret } from "../../lib/setup-intent.server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function provisionOnboardingTenant(formData: FormData) {
  const { cookieStore, supabase } = await requireOnboardingActor();
  const name = String(formData.get("organizationName") ?? "").trim();
  const organizationType = String(formData.get("organizationType") ?? "");
  const useCase = String(formData.get("useCase") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (
    name.length < 2 || name.length > 120 ||
    !isOnboardingOrganizationType(organizationType) ||
    !isOnboardingUseCase(useCase) ||
    !uuidPattern.test(idempotencyKey) ||
    formData.get("termsAccepted") !== "yes"
  ) {
    redirect("/onboarding?fout=gegevens");
  }

  const setupToken = cookieStore.get(onboardingSetupCookieName)?.value;
  const signingSecret = setupIntentSigningSecret();
  const setupIntent = setupToken && signingSecret
    ? await verifySetupIntentToken(setupToken, signingSecret)
    : null;
  const sourceKeys = setupIntent?.modules ?? [];
  const { data, error } = await supabase.rpc("provision_self_service_tenant_v1", {
    p_idempotency_key: idempotencyKey,
    p_name: name,
    p_organization_type: organizationType,
    p_setup_intent: setupIntent ?? {},
    p_slug: normalizeOnboardingSlug(name, idempotencyKey),
    p_source_keys: sourceKeys,
    p_terms_version: onboardingTermsVersion,
    p_use_case: useCase
  });
  if (error || !data || typeof data !== "object") {
    const reason = error?.code === "23505" ? "naam" : error?.code === "42501" ? "rechten" : "opslaan";
    redirect(`/onboarding?fout=${reason}`);
  }

  const tenantId = "tenantId" in data && typeof data.tenantId === "string"
    ? data.tenantId
    : null;
  const tenantResult = tenantId
    ? await supabase.from("tenants").select("slug").eq("id", tenantId).maybeSingle()
    : { data: null, error: new Error("missing tenant") };
  if (tenantResult.error || !tenantResult.data?.slug) {
    redirect("/onboarding?fout=context");
  }

  cookieStore.set(tenantContextCookieName, tenantResult.data.slug, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  cookieStore.delete(onboardingSetupCookieName);
  revalidatePath("/", "layout");
  redirect("/onboarding?status=organisatie");
}

export async function updateOnboardingPreferences(formData: FormData) {
  const { supabase } = await requireOnboardingActor();
  const tenantId = String(formData.get("tenantId") ?? "");
  const organizationType = String(formData.get("organizationType") ?? "");
  const useCase = String(formData.get("useCase") ?? "");
  const sourceKeys = parseOnboardingSourceKeys(formData.getAll("sourceKeys"));
  if (
    !uuidPattern.test(tenantId) ||
    !isOnboardingOrganizationType(organizationType) ||
    !isOnboardingUseCase(useCase)
  ) {
    redirect("/onboarding?fout=gegevens");
  }
  const { error } = await supabase.rpc("update_tenant_onboarding_preferences_v1", {
    p_organization_type: organizationType,
    p_source_keys: sourceKeys,
    p_tenant_id: tenantId,
    p_use_case: useCase
  });
  if (error) redirect(`/onboarding?fout=${error.code === "42501" ? "rechten" : "opslaan"}`);
  revalidatePath("/onboarding");
  redirect("/onboarding?status=bronnen");
}

export async function refreshOnboardingProgress(formData: FormData) {
  const { supabase } = await requireOnboardingActor();
  const tenantId = String(formData.get("tenantId") ?? "");
  if (!uuidPattern.test(tenantId)) redirect("/onboarding?fout=gegevens");
  const { error } = await supabase.rpc("refresh_tenant_onboarding_progress_v1", {
    p_tenant_id: tenantId
  });
  if (error) redirect(`/onboarding?fout=${error.code === "42501" ? "rechten" : "opslaan"}`);
  revalidatePath("/onboarding");
  redirect("/onboarding?status=ververst");
}

async function requireOnboardingActor() {
  const supabase = await createControlSupabaseClient();
  const cookieStore = await cookies();
  if (!supabase) redirect("/login?reden=sessie");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?reden=sessie");
  return { cookieStore, supabase, user: data.user };
}
