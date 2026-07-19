"use server";

import { redirect } from "next/navigation";

import { createControlSupabaseClient } from "../../lib/supabase/server";

export async function completeInvitation(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? ""
  );

  if (displayName.length < 2 || displayName.length > 100) {
    redirect("/accept-invite?fout=naam");
  }

  if (
    password.length < 12 ||
    password.length > 128 ||
    password !== passwordConfirmation
  ) {
    redirect("/accept-invite?fout=wachtwoord");
  }

  const supabase = await createControlSupabaseClient();
  const { data: userData, error: userError } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null }, error: new Error("unavailable") };

  if (userError || !userData.user || !supabase) {
    redirect("/accept-invite?fout=account");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    data: { display_name: displayName },
    password
  });

  if (updateError) {
    redirect("/accept-invite?fout=account");
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      display_name: displayName,
      id: userData.user.id
    },
    { onConflict: "id" }
  );

  if (profileError) {
    redirect("/accept-invite?fout=account");
  }

  await supabase.auth.signOut();
  redirect("/login?reden=uitgenodigd");
}
