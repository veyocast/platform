"use server";

import { redirect } from "next/navigation";

import { createPasswordRecoveryRedirectUrl } from "../../lib/invitations";
import { getControlRuntimeMode } from "../../lib/supabase/config";
import { createControlSupabaseClient } from "../../lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  if (getControlRuntimeMode() !== "live") {
    redirect("/forgot-password?status=verwerkt");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const supabase = await createControlSupabaseClient();

  if (supabase && email && email.length <= 320) {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: createPasswordRecoveryRedirectUrl()
    });
  }

  redirect("/forgot-password?status=verwerkt");
}
