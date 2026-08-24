"use server";

import { verifySetupIntentToken } from "@veyocast/auth/setup-intent";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  onboardingSetupCookieName,
  validateRegistrationInput
} from "../../lib/onboarding-contract";
import { setupIntentSigningSecret } from "../../lib/setup-intent.server";
import { getControlRuntimeMode } from "../../lib/supabase/config";
import { createControlSupabaseClient } from "../../lib/supabase/server";

export async function registerAccount(formData: FormData) {
  if (getControlRuntimeMode() !== "live") {
    redirect("/register?fout=configuratie");
  }

  const registration = validateRegistrationInput({
    accepted: formData.get("accepted") === "yes",
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirmation: String(formData.get("passwordConfirmation") ?? "")
  });
  if (!registration) redirect("/register?fout=gegevens");

  const cookieStore = await cookies();
  const setupToken = String(formData.get("setup") ?? "").trim();
  const signingSecret = setupIntentSigningSecret();
  if (setupToken) {
    if (!signingSecret || !await verifySetupIntentToken(setupToken, signingSecret)) {
      redirect("/register?fout=opstelling");
    }
    cookieStore.set(onboardingSetupCookieName, setupToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
  }

  const supabase = await createControlSupabaseClient();
  if (!supabase) redirect("/register?fout=configuratie");
  const redirectUrl = registrationRedirectUrl();
  const { data, error } = await supabase.auth.signUp({
    email: registration.email,
    password: registration.password,
    options: {
      data: { display_name: registration.displayName },
      emailRedirectTo: redirectUrl
    }
  });

  if (error) redirect("/register?fout=registratie");
  if (data.session) redirect("/onboarding");
  redirect("/register?status=bevestigen");
}

function registrationRedirectUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const url = new URL(configuredUrl || "http://127.0.0.1:3000");
  if (
    url.protocol !== "https:" &&
    !["127.0.0.1", "localhost"].includes(url.hostname)
  ) {
    throw new Error("De publieke Control-URL is niet veilig geconfigureerd.");
  }
  url.pathname = "/auth/confirm";
  url.search = "";
  url.searchParams.set("registration", "account");
  return url.toString();
}
