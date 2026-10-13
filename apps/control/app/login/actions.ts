"use server";

import { redirect } from "next/navigation";

import { getControlRuntimeMode } from "../../lib/supabase/config";
import { createControlSupabaseClient } from "../../lib/supabase/server";
import { createRequestDeadline } from "../../lib/supabase/request-deadline";
import { runControlLogin } from "./login-flow";

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
  if (!email || !password) {
    redirect("/login?fout=gegevens");
  }

  const deadline = createRequestDeadline();
  let outcome;
  try {
    const supabase = await createControlSupabaseClient({ deadline });
    outcome = supabase
      ? await runControlLogin(supabase, { email, password }, deadline)
      : { kind: "unavailable" as const };
  } finally {
    deadline.dispose();
  }
  redirect(outcome.kind === "success" ? outcome.path : `/login?fout=${outcome.kind === "invalid_credentials" ? "inloggen" : "dienst"}`);
}

export async function signOut() {
  const supabase = await createControlSupabaseClient();
  await supabase?.auth.signOut();
  redirect("/login");
}
