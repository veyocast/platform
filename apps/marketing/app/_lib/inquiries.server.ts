import "server-only";
import { readSupabaseAdminSecret } from "@veyocast/config/server";

export async function receiveInquiry(requestId: string, payload: Record<string, unknown>, environment: Readonly<Record<string, string | undefined>> = process.env) {
  // The same image is promoted; resolve the environment's database at runtime.
  const origin = environment.SUPABASE_URL || environment.NEXT_PUBLIC_SUPABASE_URL;
  const secret = readSupabaseAdminSecret(environment);
  if (!origin || !secret) return { received: false };
  try {
    const response = await fetch(new URL("/rest/v1/rpc/submit_marketing_inquiry_v1", origin), {
      method: "POST",
      headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_request_id: requestId, p_payload: payload }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store"
    });
    if (!response.ok) return { received: false };
    const receipt: unknown = await response.json();
    return { received: Boolean(receipt && typeof receipt === "object" && "received" in receipt && receipt.received === true) };
  } catch {
    // A lost response must never be represented as confirmed receipt.
    // Retrying with the same request ID recovers the durable receipt.
    return { received: false };
  }
}
