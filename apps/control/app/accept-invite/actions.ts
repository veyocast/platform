"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import {
  accountInvitationCookieName,
  invitationContextCookieName,
  parseInvitationContext
} from "../../lib/invitations";
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

  const cookieStore = await cookies();
  const isAccountInvitation =
    cookieStore.get(accountInvitationCookieName)?.value === "platform";
  const invitationContext = parseInvitationContext(
    cookieStore.get(invitationContextCookieName)?.value
  );
  if (!invitationContext && !isAccountInvitation) {
    redirect("/accept-invite?fout=uitnodiging");
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

  const { error: acceptanceError } = invitationContext
    ? await supabase.rpc("accept_tenant_invitation", {
        p_invitation_id: invitationContext.invitationId,
        p_invitation_token: invitationContext.token,
        p_tenant_id: invitationContext.tenantId
      })
    : { error: null };

  if (acceptanceError) {
    const reason = acceptanceError.code === "22023"
      ? "verlopen"
      : acceptanceError.code === "42501"
        ? "uitnodiging"
        : acceptanceError.code === "23514" || acceptanceError.code === "23505"
          ? "gebruikt"
          : "account";
    redirect(`/accept-invite?fout=${reason}`);
  }

  cookieStore.delete(invitationContextCookieName);
  cookieStore.delete(accountInvitationCookieName);
  await supabase.auth.signOut();
  redirect("/login?reden=uitgenodigd");
}
