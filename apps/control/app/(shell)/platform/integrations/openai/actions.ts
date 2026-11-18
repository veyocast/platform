"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireControlCapability } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { aiEnvironment } from "../../../../../lib/agent/access";
import { encryptAiKey, readAiProviderConfiguration, testAiProviderConnection } from "../../../../../lib/agent/provider";

const path = "/platform/integrations/openai";

export async function saveOpenAiConfiguration(form: FormData) {
  await requireControlCapability("platform.tenant.lifecycle", { aal2: true, returnTo: path });
  let success = false;
  try {
    const client = await createControlSupabaseClient();
    const revision = Number(form.get("revision"));
    const chatModel = String(form.get("chatModel") ?? "").trim();
    const imageModel = String(form.get("imageModel") ?? "").trim();
    const key = String(form.get("projectKey") ?? "").trim();
    const revoke = form.get("intent") === "revoke";
    if (!client || !Number.isSafeInteger(revision) || revision < 0 || ![chatModel, imageModel].every(model => /^[A-Za-z0-9][A-Za-z0-9._:-]{1,119}$/.test(model))) throw Error("invalid");
    const result = await client.rpc("set_platform_ai_config_v1", {
      p_environment: aiEnvironment(), p_expected_revision: revision, p_encrypted_key: key && !revoke ? encryptAiKey(key) : null,
      p_chat_model: chatModel, p_image_model: imageModel, p_revoke: revoke
    });
    success = !result.error && Boolean(result.data);
  } catch { success = false; }
  revalidatePath(path);
  redirect(`${path}?result=${success ? "saved" : "save_failed"}`);
}

export async function testOpenAiConfiguration() {
  await requireControlCapability("platform.tenant.lifecycle", { aal2: true, returnTo: path });
  let connected = false;
  try { connected = await testAiProviderConnection(await readAiProviderConfiguration()); } catch { connected = false; }
  revalidatePath(path);
  redirect(`${path}?result=${connected ? "connected" : "test_failed"}`);
}
