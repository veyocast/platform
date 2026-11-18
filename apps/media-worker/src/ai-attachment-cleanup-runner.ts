import type { createConfiguredMediaWorkerClient } from "./worker-backend";
import { queueDelay } from "./queue-wakeup";

type Client = Pick<ReturnType<typeof createConfiguredMediaWorkerClient>, "rpc" | "storage">;
export type AiAttachmentCleanupResult = { status: "completed" | "idle" } | { status: "failed"; errorCode: "ai_attachment_cleanup_failed" };

export class AiAttachmentCleanupRunner {
  constructor(private readonly client: Client) {}

  async runOnce(signal?: AbortSignal): Promise<AiAttachmentCleanupResult> {
    if (signal?.aborted) return { status: "idle" };
    try {
      const request = this.client.rpc("claim_ai_attachment_cleanup_v1");
      const claimed = await (signal ? request.abortSignal(signal) : request);
      if (claimed.error) throw Error();
      if (claimed.data === null) return { status: "idle" };
      const lease = claimed.data as { outcome?: string; attachmentId?: string; tenantId?: string; token?: string; paths?: Array<{ bucket: string; path: string }> };
      if (["empty", "protected", "deferred"].includes(String(lease.outcome))) return { status: "completed" };
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (lease.outcome !== "claimed" || !uuid.test(lease.attachmentId ?? "") || !uuid.test(lease.tenantId ?? "") || !uuid.test(lease.token ?? "") || !Array.isArray(lease.paths) || !lease.paths.length) throw Error();
      const prefix = `tenants/${lease.tenantId}/assets/${lease.attachmentId}/`;
      if (lease.paths.some(item => item.bucket !== "tenant-media" || typeof item.path !== "string" || !item.path.startsWith(prefix) || item.path.split("/").some(segment => segment === ".." || segment === "."))) throw Error();
      if (signal?.aborted) return { status: "idle" };
      const removed = await this.client.storage.from("tenant-media").remove([...new Set(lease.paths.map(item => item.path))]);
      if (removed.error) throw Error();
      const completed = await this.client.rpc("complete_ai_attachment_cleanup_v1", { p_attachment_id: lease.attachmentId, p_token: lease.token });
      if (completed.error || completed.data !== true) throw Error();
      return { status: "completed" };
    } catch { return { status: "failed", errorCode: "ai_attachment_cleanup_failed" }; }
  }

  async loop({ signal, onSettled = () => undefined }: { signal: AbortSignal; onSettled?: (result: AiAttachmentCleanupResult) => void }) {
    while (!signal.aborted) {
      let result: AiAttachmentCleanupResult = { status: "idle" };
      let processed = 0;
      do {
        result = await this.runOnce(signal);
        try { onSettled(result); } catch { onSettled = () => undefined; }
        processed++;
      } while (result.status === "completed" && processed < 20 && !signal.aborted);
      await queueDelay(result.status === "failed" ? 15 * 60_000 : result.status === "idle" ? 60 * 60_000 : 60_000, signal);
    }
  }
}
