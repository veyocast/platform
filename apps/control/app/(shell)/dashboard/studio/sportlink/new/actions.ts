"use server";

import { redirect } from "next/navigation";

import { createSportlinkSlideBatchSchema } from "@veyocast/contracts";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";

export async function createSportlinkSlideBatch(formData: FormData) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const parsedJson = safeJson(String(formData.get("payload") ?? ""));
  const parsed = createSportlinkSlideBatchSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const durationInvalid = parsed.error.issues.some((issue) =>
      issue.path.includes("minutesBefore") || issue.path.includes("minutesAfter")
    );
    const message = durationInvalid
      ? "De gekozen periode is niet geldig. Kies een waarde van 0 minuten tot en met 42 dagen en probeer opnieuw."
      : "De selectie is niet meer volledig. Kies opnieuw ten minste één team en slidetype en controleer de competitiecontext.";
    redirect(`/dashboard/studio/sportlink/new?fout=${encodeURIComponent(message)}`);
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase || !session.tenantId) {
    redirect("/dashboard/studio/sportlink/new?fout=De+veilige+verbinding+is+niet+beschikbaar.");
  }
  const { data, error } = await supabase.rpc("create_sportlink_slide_batch_v2", {
    p_data_source_id: parsed.data.dataSourceId,
    p_drafts: parsed.data.drafts,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_tenant_id: session.tenantId
  });
  if (error || !data) {
    console.error("Sportlink batch maken mislukt", { code: error?.code ?? "empty_result" });
    const message = error?.code === "42501"
      ? "Je+hebt+geen+toestemming+om+Sportlink-slides+te+maken."
      : "De+batch+kon+niet+veilig+worden+gemaakt.+Er+zijn+geen+gedeeltelijke+slides+bewaard.";
    redirect(`/dashboard/studio/sportlink/new?fout=${message}`);
  }
  redirect("/dashboard/slides?succes=De+Sportlink-slides+zijn+gemaakt+en+de+eerste+immutable+snapshots+staan+in+de+renderwachtrij.");
}

function safeJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return null; }
}
