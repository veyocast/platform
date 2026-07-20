"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireControlCapability } from "../../../../lib/control-session";
import { sendPlatformInvitationEmail } from "../../../../lib/invitations";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function setPlatformUserRole(formData: FormData) {
  await requireControlCapability("platform.user.manage", {
    aal2: true,
    returnTo: "/platform/users"
  });
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email) || !isPlatformRole(role)) fail("invoer");
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail("configuratie");

  let { error } = await supabase.rpc("set_platform_user_role", {
    p_email: email,
    p_role: role
  });
  let invited = false;

  if (error?.code === "P0002") {
    const delivery = await sendPlatformInvitationEmail(email);
    if (!delivery.delivered) fail("bezorging");
    invited = true;
    ({ error } = await supabase.rpc("set_platform_user_role", {
      p_email: email,
      p_role: role
    }));
  }

  if (error) fail(platformError(error.code, error.message));
  done(invited ? "uitgenodigd" : "rol");
}

export async function removePlatformUser(formData: FormData) {
  const session = await requireControlCapability("platform.user.manage", {
    aal2: true,
    returnTo: "/platform/users"
  });
  const userId = String(formData.get("userId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) fail("invoer");
  if (formData.get("confirmRemove") !== "on") fail("bevestiging");
  if (userId === session.userId) fail("zelf");
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail("configuratie");

  const { error } = await supabase.rpc("remove_platform_user_access", {
    p_user_id: userId
  });
  if (error) fail(platformError(error.code, error.message));
  done("verwijderd");
}

function platformError(code: string, message: string) {
  if (code === "42501" && message.includes("self lockout")) return "zelf";
  if (code === "23514" && message.includes("last platform owner")) return "laatste-eigenaar";
  if (code === "P0002") return "niet-gevonden";
  return code === "42501" ? "rechten" : "onverwacht";
}

function isPlatformRole(value: string): value is "platform_owner" | "platform_admin" | "platform_support" | "platform_viewer" {
  return ["platform_owner", "platform_admin", "platform_support", "platform_viewer"].includes(value);
}

function done(code: string): never {
  revalidatePath("/platform/users");
  redirect(`/platform/users?succes=${code}`);
}

function fail(code: string): never {
  redirect(`/platform/users?fout=${encodeURIComponent(code)}`);
}
