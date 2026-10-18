import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readInquiryMailConfig, runInquiryMailOnce } from "../src/inquiry-mail-runner";

const config = { apiKey: "SG.local-test-only", from: "noreply@example.test", recipient: "inbox@example.test" };
function backend() {
  const rpc = vi.fn().mockImplementation((name: string) => ({ abortSignal: () => Promise.resolve({ error: null, data: name === "claim_marketing_inquiry_mail_v1" ? { id: "inquiry-id", leaseId: "lease-id", name: "Test operator", email: "applicant@example.test", organization: "Test club", screens: "2", message: "A new screen" } : true }) }));
  return { rpc, client: { rpc } as unknown as Pick<SupabaseClient, "rpc"> };
}
describe("SendGrid inquiry outbox", () => {
  it("does no claim or send after worker shutdown has started", async () => {
    const { client, rpc } = backend(); const fetcher = vi.fn();
    const controller = new AbortController(); controller.abort();
    expect(await runInquiryMailOnce(client, config, fetcher, controller.signal)).toBe("cancelled");
    expect(rpc).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("aborts an in-flight provider request on drain and preserves the uncertain lease", async () => {
    const { client, rpc } = backend(); const controller = new AbortController();
    let started!: () => void;
    const sending = new Promise<void>(resolve => { started = resolve; });
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      expect(init?.signal?.aborted).toBe(false);
      init!.signal!.addEventListener("abort", () => reject(new Error("Worker draining")), { once: true });
      started();
    }));
    const result = runInquiryMailOnce(client, config, fetcher, controller.signal);
    await sending; controller.abort();
    expect(await result).toBe("cancelled");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.map(call => call[0])).toEqual(["claim_marketing_inquiry_mail_v1"]);
  });
  it("does no database polling or network work without complete configuration", async () => {
    const { client, rpc } = backend(); const fetcher = vi.fn();
    expect(readInquiryMailConfig({})).toBeNull();
    expect(await runInquiryMailOnce(client, null, fetcher)).toBe("unconfigured");
    expect(rpc).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("sends only to the configured inbox and records provider acceptance separately", async () => {
    const { client, rpc } = backend();
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202, headers: { "x-message-id": "provider-receipt" } }));
    expect(await runInquiryMailOnce(client, config, fetcher)).toBe("accepted");
    const body = JSON.parse(fetcher.mock.calls[0]![1].body);
    expect(body.personalizations[0].to).toEqual([{ email: config.recipient }]);
    expect(body.reply_to.email).toBe("applicant@example.test");
    expect(rpc).toHaveBeenLastCalledWith("complete_marketing_inquiry_mail_v1", expect.objectContaining({ p_status: "accepted", p_provider_id: "provider-receipt", p_lease_id: "lease-id" }));
  });
  it("keeps an ambiguous timeout out of automatic resend", async () => {
    const { client, rpc } = backend(); const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    expect(await runInquiryMailOnce(client, config, fetcher)).toBe("unknown");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenLastCalledWith("complete_marketing_inquiry_mail_v1", expect.objectContaining({ p_status: "unknown" }));
  });
  it("honors a bounded Retry-After for an explicit rate-limit rejection", async () => {
    const { client, rpc } = backend(); const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 429, headers: { "retry-after": "999999999" } }));
    expect(await runInquiryMailOnce(client, config, fetcher)).toBe("failed");
    expect(rpc).toHaveBeenLastCalledWith("complete_marketing_inquiry_mail_v1", expect.objectContaining({ p_status: "failed", p_retry_seconds: 86400 }));
  });
});
