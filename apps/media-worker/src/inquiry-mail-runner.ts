import { setTimeout } from "node:timers/promises";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InquiryMailConfig = { apiKey: string; from: string; recipient: string };
export function readInquiryMailConfig(environment = process.env): InquiryMailConfig | null {
  const apiKey = environment.SENDGRID_API_KEY?.trim();
  const from = environment.SENDGRID_FROM_EMAIL?.trim();
  const recipient = environment.VEYOCAST_INQUIRY_EMAIL?.trim();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return apiKey && apiKey.startsWith("SG.") && from && recipient && email.test(from) && email.test(recipient) ? { apiKey, from, recipient } : null;
}

export async function runInquiryMailOnce(client: Pick<SupabaseClient, "rpc">, config: InquiryMailConfig | null, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  if (signal?.aborted) return "cancelled";
  if (!config) return "unconfigured";
  const deadline = (ms: number) => signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);
  const claim = await client.rpc("claim_marketing_inquiry_mail_v1").abortSignal(deadline(8000));
  if (signal?.aborted) return "cancelled";
  if (claim.error) return "failed";
  const job = claim.data as { id: string; leaseId: string; name: string; email: string; organization: string; screens: string; message: string } | null;
  if (!job) return "idle";
  let status = "unknown";
  let providerId: string | null = null;
  let retrySeconds = 60;
  try {
    const response = await fetcher("https://api.sendgrid.com/v3/mail/send", {
      method: "POST", signal: deadline(10000),
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: config.recipient }], custom_args: { inquiry_id: job.id } }],
        from: { email: config.from, name: "VeyoCast" }, reply_to: { email: job.email, name: job.name },
        subject: "Nieuwe VeyoCast-aanvraag",
        content: [{ type: "text/plain", value: `Aanvraag: ${job.id}\nNaam: ${job.name}\nE-mail: ${job.email}\nOrganisatie: ${job.organization}\nSchermen: ${job.screens}\n\n${job.message}` }],
        tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } }
      })
    });
    if (response.status === 202) {
      status = "accepted";
      providerId = response.headers.get("x-message-id")?.slice(0, 200) ?? null;
    } else if (response.status === 429 || response.status >= 500) {
      status = "failed";
      const seconds = Number(response.headers.get("retry-after"));
      if (Number.isFinite(seconds)) retrySeconds = Math.min(86400, Math.max(60, Math.ceil(seconds)));
    } else status = "unconfigured";
    await response.body?.cancel();
  } catch {
    // The request may have reached SendGrid. Preserve uncertainty until an
    // operator reconciles it; automatically resending could duplicate the mail.
  }
  // On drain, leave a possibly sent job leased. The existing expiry path
  // reconciles it to unknown and never automatically sends it again.
  if (signal?.aborted) return "cancelled";
  const result = await client.rpc("complete_marketing_inquiry_mail_v1", {
    p_id: job.id, p_lease_id: job.leaseId, p_status: status, p_provider_id: providerId, p_retry_seconds: retrySeconds
  }).abortSignal(deadline(8000));
  return result.error || result.data !== true ? "unknown" : status;
}

export async function runInquiryMailLoop(client: Pick<SupabaseClient, "rpc">, signal: AbortSignal) {
  while (!signal.aborted) {
    await runInquiryMailOnce(client, readInquiryMailConfig(), fetch, signal);
    try { await setTimeout(60000, undefined, { signal }); } catch { return; }
  }
}
