import "server-only";

import { cache } from "react";

import {
  demoVectorTenantFeatures,
  emptyVectorTenantFeatures,
  resolveVectorTenantFeatures,
  vectorTenantFeatureKeys
} from "../app/(shell)/_lib/vector-features";
import { createControlSupabaseClient } from "./supabase/server";

export const loadVectorTenantFeatures = cache(async (
  tenantId: string | null,
  isLive: boolean
) => {
  if (!isLive) return demoVectorTenantFeatures;
  if (!tenantId) return emptyVectorTenantFeatures;

  const supabase = await createControlSupabaseClient();
  if (!supabase) return emptyVectorTenantFeatures;

  const { data, error } = await supabase
    .from("tenant_feature_flags")
    .select("flag_key, enabled")
    .eq("tenant_id", tenantId)
    .in("flag_key", [...vectorTenantFeatureKeys]);

  if (error) {
    console.error("Vector tenantuitrol laden mislukt", { code: error.code });
    return emptyVectorTenantFeatures;
  }

  return resolveVectorTenantFeatures(data ?? []);
});
