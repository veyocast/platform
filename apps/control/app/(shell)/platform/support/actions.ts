"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireControlCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function createPlatformSupportRole(formData: FormData) {
  await requireControlCapability("platform.ticket.admin", {
    aal2: true,
    returnTo: "/platform/support/settings"
  });
  const capabilities = formData.getAll("capabilities").map(String);
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail("configuratie");
  const { error } = await supabase.rpc("create_platform_support_role_v1", {
    p_capabilities: capabilities,
    p_description: String(formData.get("description") ?? "").trim() || null,
    p_name: String(formData.get("name") ?? "").trim()
  });
  if (error) fail("rol");
  done("rol");
}

export async function createSupportDepartment(formData: FormData) {
  await requireControlCapability("platform.ticket.admin", {
    aal2: true,
    returnTo: "/platform/support/settings"
  });
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail("configuratie");
  const { error } = await supabase.rpc("create_support_department_v1", {
    p_description: String(formData.get("description") ?? "").trim() || null,
    p_name: String(formData.get("name") ?? "").trim(),
    p_role_ids: formData.getAll("roleIds").map(String)
  });
  if (error) fail("afdeling");
  done("afdeling");
}

export async function assignPlatformSupportRole(formData: FormData) {
  await requireControlCapability("platform.ticket.admin", {
    aal2: true,
    returnTo: "/platform/support/settings"
  });
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail("configuratie");
  const { error } = await supabase.rpc("assign_platform_support_role_v1", {
    p_role_id: String(formData.get("roleId") ?? ""),
    p_user_id: String(formData.get("userId") ?? "")
  });
  if (error) fail("toewijzing");
  done("toewijzing");
}

function done(code: string): never {
  revalidatePath("/platform/support/settings");
  redirect(`/platform/support/settings?succes=${code}`);
}
function fail(code: string): never {
  redirect(`/platform/support/settings?fout=${code}`);
}
