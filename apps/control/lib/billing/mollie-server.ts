import "server-only";

import { MollieClient } from "@veyocast/integrations/server";

export function getMollieClient() {
  const apiKey = process.env.MOLLIE_API_KEY?.trim();
  if (!apiKey) throw new Error("Mollie testconfiguratie ontbreekt.");
  const expectedMode = process.env.BILLING_PROVIDER_MODE === "live" ? "live" : "test";
  if (!apiKey.startsWith(`${expectedMode}_`)) throw new Error("Mollie key en provider mode komen niet overeen.");
  return { client: new MollieClient(apiKey), mode: expectedMode } as const;
}

export function requireBillingWorker(request: Request) {
  const configured = process.env.BILLING_WORKER_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(configured && provided && configured === provided);
}

export function billingPublicUrl(path: string) {
  const root = process.env.NEXT_PUBLIC_CONTROL_URL?.trim();
  if (!root) throw new Error("Control public URL ontbreekt.");
  const url = new URL(path, root);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Billing URLs vereisen HTTPS.");
  return url.toString();
}
