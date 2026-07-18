"use server";

import { redirect } from "next/navigation";

import { isLiveSupabaseConfigured } from "../../lib/supabase/config";
import { createControlSupabaseClient } from "../../lib/supabase/server";

export async function signIn(formData: FormData) {
  if (!isLiveSupabaseConfigured()) {
    redirect("/auth/callback");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const supabase = await createControlSupabaseClient();

  if (!supabase || !email || !password) {
    redirect("/login?fout=Vul+je+e-mailadres+en+wachtwoord+in.");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      `/login?fout=${encodeURIComponent(
        "Inloggen is mislukt. Controleer je gegevens en probeer opnieuw."
      )}`
    );
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createControlSupabaseClient();
  await supabase?.auth.signOut();
  redirect("/login");
}
