"use server";

import { hasCapability } from "@veyocast/auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireControlSession } from "../../../lib/control-session";
import {
  resolveTenantContext,
  safeControlReturnPath,
  tenantContextCookieName
} from "../../../lib/tenant-context";

export async function switchTenantContext(formData: FormData) {
  const session = await requireControlSession();
  const slug = String(formData.get("tenantSlug") ?? "").trim();
  const returnTo = safeControlReturnPath(formData.get("returnTo"));
  const cookieStore = await cookies();

  if (!slug) {
    if (!hasCapability(session.roles, "platform.system.read")) {
      redirect("/context?fout=platformcontext");
    }
    cookieStore.delete(tenantContextCookieName);
    revalidatePath("/", "layout");
    redirect("/platform");
  }

  const resolution = resolveTenantContext(session.tenantMemberships, slug);
  if (!resolution.context) {
    cookieStore.delete(tenantContextCookieName);
    redirect(`/context?fout=${encodeURIComponent(resolution.reason)}`);
  }

  cookieStore.set(tenantContextCookieName, resolution.context.slug, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  revalidatePath("/", "layout");
  redirect(returnTo.startsWith("/platform") ? "/dashboard" : returnTo);
}
