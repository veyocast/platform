"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseRssOrAtom } from "@veyocast/integrations";
import {
  SafeRssFetchError,
  fetchSafeRss
} from "@veyocast/integrations/server";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function createRssSource(formData: FormData) {
  const session = await requireTenantControlSession("tenant.data_source.manage");
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const supabase = await createControlSupabaseClient();
  if (!supabase || name.length < 2 || name.length > 120 || !isHttpUrl(url)) {
    redirect("/dashboard/data-sources?fout=Controleer+de+naam+en+publieke+feed-URL.");
  }
  const { data, error } = await supabase.rpc("create_dynamic_data_source_v1", {
    p_config_json: { refreshMinutes: 5, url },
    p_kind: "rss",
    p_name: name,
    p_tenant_id: session.tenantId!
  });
  if (error || typeof data !== "string") {
    redirect("/dashboard/data-sources?fout=De+RSS-databron+kon+niet+veilig+worden+gemaakt.");
  }
  try {
    await syncRss(data, supabase);
  } catch (syncError) {
    revalidatePath("/dashboard/data-sources");
    const message = rssErrorMessage(syncError);
    redirect(
      `/dashboard/data-sources?fout=${encodeURIComponent(
        `De RSS-databron is opgeslagen, maar de eerste synchronisatie mislukte. ${message}`
      )}`
    );
  }
  revalidatePath("/dashboard/data-sources");
  redirect(`/dashboard/data-sources?succes=RSS-databron+is+gekoppeld+en+gecontroleerd.`);
}

export async function createProductSource(formData: FormData) {
  const session = await requireTenantControlSession("tenant.data_source.manage");
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const supabase = await createControlSupabaseClient();
  if (
    !supabase ||
    name.length < 2 ||
    name.length > 120 ||
    (kind !== "manual_products" && kind !== "twelve_excel")
  ) {
    redirect("/dashboard/data-sources?fout=Controleer+de+productdatabron.");
  }
  const { error } = await supabase.rpc("create_dynamic_data_source_v1", {
    p_config_json: {},
    p_kind: kind,
    p_name: name,
    p_tenant_id: session.tenantId!
  });
  if (error) {
    redirect("/dashboard/data-sources?fout=De+productdatabron+kon+niet+worden+gemaakt.");
  }
  revalidatePath("/dashboard/data-sources");
  redirect("/dashboard/data-sources?succes=Productdatabron+is+beschikbaar.");
}

export async function createManualProduct(formData: FormData) {
  await requireTenantControlSession("tenant.product.write");
  const sourceId = String(formData.get("sourceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const price = Number(String(formData.get("price") ?? "").replace(",", "."));
  const supabase = await createControlSupabaseClient();
  if (
    !supabase ||
    !uuidPattern.test(sourceId) ||
    name.length < 1 ||
    name.length > 160 ||
    !Number.isFinite(price) ||
    price < 0 ||
    price > 1_000_000
  ) {
    redirect("/dashboard/data-sources?fout=Controleer+productnaam,+bron+en+prijs.");
  }
  const { error } = await supabase.rpc("create_manual_product_v1", {
    p_category: category || null,
    p_currency: "EUR",
    p_data_source_id: sourceId,
    p_description: description || null,
    p_name: name,
    p_price_minor: Math.round(price * 100)
  });
  if (error) {
    redirect("/dashboard/data-sources?fout=Het+handmatige+product+kon+niet+worden+opgeslagen.");
  }
  revalidatePath("/dashboard/data-sources");
  revalidatePath("/dashboard/integrations/twelve-products");
  redirect("/dashboard/data-sources?succes=Product+is+toegevoegd+aan+de+databron.");
}

export async function syncRssSource(formData: FormData) {
  await requireTenantControlSession("tenant.data_source.manage");
  const sourceId = String(formData.get("sourceId") ?? "");
  const supabase = await createControlSupabaseClient();
  if (!supabase || !uuidPattern.test(sourceId)) {
    redirect("/dashboard/data-sources?fout=De+databron+is+ongeldig.");
  }
  try {
    await syncRss(sourceId, supabase);
  } catch (error) {
    const message = rssErrorMessage(error);
    redirect(`/dashboard/data-sources?fout=${encodeURIComponent(message)}`);
  }
  revalidatePath("/dashboard/data-sources");
  revalidatePath("/dashboard/slides");
  redirect("/dashboard/data-sources?succes=De+RSS-snapshot+is+bijgewerkt.");
}

async function syncRss(
  sourceId: string,
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>
) {
  const sourceResult = await supabase
    .from("dynamic_data_sources")
    .select("config_json")
    .eq("id", sourceId)
    .eq("kind", "rss")
    .single();
  const config = sourceResult.data?.config_json;
  const url = isRecord(config) && typeof config.url === "string"
    ? config.url
    : null;
  if (sourceResult.error || !url) {
    throw new Error("De RSS-configuratie kon niet veilig worden gelezen.");
  }
  try {
    const response = await fetchSafeRss(url);
    const feed = parseRssOrAtom(response.body, response.finalUrl);
    const result = await supabase.rpc("record_rss_sync_v1", {
      p_articles: feed.articles,
      p_data_source_id: sourceId
    });
    if (result.error) {
      throw new Error("De genormaliseerde RSS-snapshot kon niet worden opgeslagen.");
    }
    const mediaSyncResult = await supabase.rpc("request_rss_media_sync_v1", {
      p_data_source_id: sourceId
    });
    if (mediaSyncResult.error) {
      throw new Error(
        "De RSS-inhoud is opgeslagen, maar de mediasynchronisatie kon niet worden ingepland."
      );
    }
  } catch (error) {
    const code = error instanceof SafeRssFetchError
      ? error.code
      : "rss_sync_failed";
    const message = error instanceof Error
      ? error.message
      : "De RSS-feed kon niet worden verwerkt.";
    await supabase.rpc("record_data_source_failure_v1", {
      p_data_source_id: sourceId,
      p_error_code: code,
      p_error_detail: message
    });
    throw error;
  }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function rssErrorMessage(error: unknown) {
  if (error instanceof SafeRssFetchError) {
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : "De RSS-feed kon niet worden bijgewerkt.";
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
