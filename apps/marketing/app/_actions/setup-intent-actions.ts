"use server";

import { redirect } from "next/navigation";

import {
  createSetupIntentToken,
  parseSetupIntentJson
} from "../_lib/setup-intent";
import { setupIntentSigningSecret } from "../_lib/setup-intent.server";

export async function continueWithSetup(formData: FormData) {
  const raw = formData.get("setup");
  const input = typeof raw === "string" ? parseSetupIntentJson(raw) : null;
  const secret = setupIntentSigningSecret();

  if (!input || !secret) {
    redirect("/demo?setup_status=unavailable");
  }

  const token = await createSetupIntentToken(input, secret);
  redirect(`/demo?setup=${encodeURIComponent(token)}`);
}
