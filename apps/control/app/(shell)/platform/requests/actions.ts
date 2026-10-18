"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireControlCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function updateInquiry(form: FormData) {
  await requireControlCapability("platform.ticket.write", { aal2: true, returnTo: "/platform/requests" });
  const client = await createControlSupabaseClient();
  const id = String(form.get("id") ?? "");
  const revision = Number(form.get("revision"));
  const status = String(form.get("status") ?? "");
  const notes = String(form.get("notes") ?? "");
  if (!client || !/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(revision) || revision < 1 || !["new", "contacted", "closed"].includes(status) || notes.length > 4000) redirect("/platform/requests?error=invalid");
  const { error } = await client.rpc("update_marketing_inquiry_v1", { p_id: id, p_revision: revision, p_status: status, p_notes: notes });
  if (error) redirect(`/platform/requests?error=${["40001","PT409"].includes(error.code ?? "") ? "conflict" : "save"}`);
  revalidatePath("/platform/requests");
  redirect("/platform/requests?saved=1");
}

export async function retryInquiryMail(form: FormData) {
  await requireControlCapability("platform.ticket.write", { aal2: true, returnTo: "/platform/requests" });
  const client = await createControlSupabaseClient();
  const id = String(form.get("id") ?? "");
  const revision = Number(form.get("revision"));
  if (!client || !/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(revision)) redirect("/platform/requests?error=invalid");
  const { error } = await client.rpc("retry_marketing_inquiry_mail_v1", { p_id: id, p_revision: revision, p_confirm_uncertain: form.get("confirmUncertain") === "on" });
  if (error) redirect(`/platform/requests?error=${["40001","PT409"].includes(error.code ?? "") ? "conflict" : "retry"}`);
  revalidatePath("/platform/requests");
  redirect("/platform/requests?saved=1");
}
