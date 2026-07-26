"use server";

import { redirect } from "next/navigation";

import { createControlSupabaseClient } from "../../../lib/supabase/server";

export async function updateRecoveredPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");

  if (
    password.length < 12 ||
    password.length > 128 ||
    password !== confirmation
  ) {
    redirect("/auth/reset-password?fout=wachtwoord");
  }

  const supabase = await createControlSupabaseClient();
  const user = supabase ? await supabase.auth.getUser() : null;
  if (!supabase || user?.error || !user?.data.user) {
    redirect("/login?fout=herstel");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect("/auth/reset-password?fout=opslaan");
  }

  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?reden=wachtwoord-gewijzigd");
}
