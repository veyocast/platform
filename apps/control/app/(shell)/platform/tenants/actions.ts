"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireControlRole } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function createTenant(formData: FormData) {
  const session = await requireControlRole("platform_admin");
  const supabase = await createControlSupabaseClient();

  if (!session.isLive || !supabase) {
    fail("configuratie");
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const screenLimit = Number.parseInt(
    String(formData.get("screenLimit") ?? ""),
    10
  );

  if (name.length < 2 || name.length > 120) {
    fail("naam");
  }
  if (
    slug.length > 64 ||
    !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)
  ) {
    fail("slug");
  }
  if (!Number.isInteger(screenLimit) || screenLimit < 1 || screenLimit > 10000) {
    fail("schermlimiet");
  }

  const { error } = await supabase.rpc("create_platform_tenant", {
    p_name: name,
    p_screen_limit: screenLimit,
    p_slug: slug
  });

  if (error) {
    if (error.code === "23505") fail("slug-bestaat");
    if (error.code === "42501") fail("rechten");

    console.error("Tenant aanmaken mislukt", { code: error.code });
    fail("onverwacht");
  }

  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  redirect("/platform/tenants?succes=aangemaakt");
}

function fail(code: string): never {
  redirect(`/platform/tenants?fout=${encodeURIComponent(code)}#nieuwe-tenant`);
}
