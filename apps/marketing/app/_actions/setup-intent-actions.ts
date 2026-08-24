"use server";

import { redirect } from "next/navigation";

import {
  createSetupIntentToken,
  parseSetupIntentJson,
  setupIntentSigningSecret
} from "../_lib/setup-intent";

export async function continueWithSetup(formData: FormData) {
  const raw = formData.get("setup");
  const input = typeof raw === "string" ? parseSetupIntentJson(raw) : null;
  const secret = setupIntentSigningSecret();

  if (!input || !secret) {
    redirect("/demo?setup_status=unavailable");
  }

  const token = createSetupIntentToken(input, secret);
  redirect(`/demo?setup=${encodeURIComponent(token)}`);
}
