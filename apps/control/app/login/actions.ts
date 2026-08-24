"use server";

import { redirect } from "next/navigation";

import {
  getControlLandingPath,
  getControlSession
} from "../../lib/control-session";
import { getControlRuntimeMode } from "../../lib/supabase/config";
import { createControlSupabaseClient } from "../../lib/supabase/server";

export async function signIn(formData: FormData) {
  const runtimeMode = getControlRuntimeMode();

  if (runtimeMode === "demo") {
    redirect("/auth/callback");
  }

  if (runtimeMode !== "live") {
    redirect("/login");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const supabase = await createControlSupabaseClient();

  if (!supabase || !email || !password) {
    redirect("/login?fout=gegevens");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?fout=inloggen");
  }

  // Reuse the client that performed the login. Creating a second SSR client in
  // the same server action can observe an intermediate cookie-chunk state.
  const session = await getControlSession(supabase);

  if (!session) {
    await supabase.auth.signOut();
    redirect("/login?fout=inloggen");
  }

  redirect(getControlLandingPath(session));
}

export async function signOut() {
  const supabase = await createControlSupabaseClient();
  await supabase?.auth.signOut();
  redirect("/login");
}
