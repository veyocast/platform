import "server-only";

import { randomUUID } from "node:crypto";
import { decryptSportlinkClientId, encryptSportlinkClientId } from "@veyocast/integrations/server";
import { createControlAdminClient } from "../supabase/admin";
import { aiEnvironment, requireAgentActor } from "./access";
import { createControlSupabaseClient } from "../supabase/server";

export type AiProviderConfiguration = { encryptedKey: { ciphertext: string; iv: string; tag: string }; chatModel: string; imageModel: string; revision: number };

function encryptionMaterial() {
  const material = process.env.SPORTLINK_CONFIG_ENCRYPTION_KEY;
  if (!material || material.length < 32) throw Error("De beveiligde geheimenopslag is niet ingericht. De sleutel is niet opgeslagen; laat de platformconfiguratie controleren.");
  return `${material}:veyocast-openai-v1`;
}

export function encryptAiKey(key: string) {
  if (!/^sk-[A-Za-z0-9_-]{16,}$/.test(key) || key.length > 1024) throw Error("De projectsleutel heeft geen geldig formaat. Er is niets opgeslagen; gebruik een OpenAI-projectsleutel.");
  return encryptSportlinkClientId(key, encryptionMaterial());
}

export async function readAiProviderConfiguration(): Promise<AiProviderConfiguration> {
  const result = await createControlAdminClient().rpc("read_ai_provider_config_v1", { p_environment: aiEnvironment() });
  if (result.error || !result.data?.encryptedKey) throw Error("OpenAI is niet ingesteld voor deze omgeving. Een platformbeheerder kan de projectsleutel veilig invoeren bij Integraties → OpenAI.");
  return result.data as AiProviderConfiguration;
}

async function boundedJson(response: Response, maximumBytes: number) {
  if (!response.body) throw Error("provider_response_missing");
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      received += part.value.byteLength;
      if (received > maximumBytes) throw Error("provider_response_too_large");
      parts.push(part.value);
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8")) as Record<string, unknown>;
  } finally { await reader.cancel().catch(() => {}); }
}

export function providerUsage(value: unknown): Record<string, number | Record<string, number>> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const allowed = ["input_tokens", "output_tokens", "total_tokens", "cached_tokens", "reasoning_tokens", "image_tokens", "text_tokens"];
  const result: Record<string, number | Record<string, number>> = {};
  for (const [key, units] of Object.entries(value)) {
    if (allowed.includes(key) && typeof units === "number" && Number.isSafeInteger(units) && units >= 0) result[key] = units;
    if (["input_tokens_details", "output_tokens_details"].includes(key)) {
      const detail = providerUsage(units);
      if (detail) result[key] = detail as Record<string, number>;
    }
  }
  return Object.keys(result).length ? result : null;
}

export async function testAiProviderConnection(configuration: AiProviderConfiguration) {
  let connected = false;
  try {
    const key = decryptSportlinkClientId(configuration.encryptedKey, encryptionMaterial());
    const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error" });
    const data = await boundedJson(response, 1024 * 1024);
    const available = Array.isArray(data.data) ? data.data.map(model => model && typeof model === "object" ? (model as { id?: string }).id : null) : [];
    connected = response.ok && available.includes(configuration.chatModel) && available.includes(configuration.imageModel);
  } catch { connected = false; }
  const client = await createControlSupabaseClient();
  const saved = await client?.rpc("record_ai_connection_test_v1", { p_environment: aiEnvironment(), p_expected_revision: configuration.revision, p_connected: connected });
  if (!saved || saved.error || saved.data !== true) throw Error("De sleutel of rechten zijn tijdens de test gewijzigd. Test de actuele configuratie opnieuw.");
  return connected;
}

export async function callAiProvider(input: { operationId: string; operation: "chat" | "image_generation" | "image_edit"; body: Record<string, unknown> | FormData }) {
  const configuration = await readAiProviderConfiguration();
  const actor = await requireAgentActor(input.operation === "chat" ? undefined : "tenant.media.write");
  const model = input.operation === "chat" ? configuration.chatModel : configuration.imageModel;
  const requestId = randomUUID();
  const admitted = await actor.client.rpc("begin_ai_provider_request_v1", {
    p_tenant_id: actor.session.tenantId, p_request_id: requestId, p_operation_id: input.operationId,
    p_environment: aiEnvironment(), p_operation: input.operation, p_model: model, p_config_revision: configuration.revision
  });
  if (admitted.error || admitted.data !== true) throw Error("De betaalde aanvraag is niet toegelaten. Controleer de agentvrijgave en OpenAI-configuratie; er is geen providerverzoek gestart.");
  let status = "unknown", providerRequestId: string | null = null, units: ReturnType<typeof providerUsage> = null;
  let output: Record<string, unknown> | null = null;
  let failure: Error | null = null;
  try {
    const key = decryptSportlinkClientId(configuration.encryptedKey, encryptionMaterial());
    const multipart = input.body instanceof FormData;
    if (input.body instanceof FormData) input.body.set("model", model);
    const endpoint = input.operation === "chat" ? "responses" : input.operation === "image_edit" ? "images/edits" : "images/generations";
    const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, ...(multipart ? {} : { "Content-Type": "application/json" }), "X-Client-Request-Id": requestId },
      body: multipart ? input.body as FormData : JSON.stringify({ ...input.body, model }),
      signal: AbortSignal.timeout(input.operation === "chat" ? 45000 : 150000), cache: "no-store", redirect: "error"
    });
    providerRequestId = response.headers.get("x-request-id")?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 200) || null;
    const data = await boundedJson(response, input.operation === "chat" ? 1024 * 1024 : 32 * 1024 * 1024);
    units = providerUsage(data.usage);
    if (response.ok && input.operation !== "chat" && Array.isArray(data.data)) units = { ...units, returned_images: data.data.length };
    if (!response.ok) { status = "failed"; throw Error("provider_rejected"); }
    try { await requireAgentActor(); } catch { status = "disabled_after_request"; throw Error("disabled_after_request"); }
    status = "succeeded";
    output = data;
  } catch {
    failure = Error(status === "disabled_after_request"
      ? "De agent is tijdens de aanvraag uitgeschakeld. Het resultaat wordt niet gebruikt of gepubliceerd; de verstuurde aanvraag kan wel kosten hebben veroorzaakt."
      : "OpenAI kon de aanvraag niet bevestigd afronden. Je voorstel en uitzending blijven behouden. Een nieuwe poging kan opnieuw kosten veroorzaken.");
  }
  const saved = await createControlAdminClient().rpc("finish_ai_provider_request_v1", { p_request_id: requestId, p_status: status, p_provider_request_id: providerRequestId, p_units: units });
  if (saved.error || saved.data !== true) throw Error("De provideruitkomst kon niet volledig worden geregistreerd. Er wordt niets gepubliceerd; controleer de aanvraagreferentie in het verbruiksoverzicht.");
  if (failure) throw failure;
  if (!output) throw Error("De provider gaf geen bevestigd resultaat. Er is niets gepubliceerd.");
  return output;
}
