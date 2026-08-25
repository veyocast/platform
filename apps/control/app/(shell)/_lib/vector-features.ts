export const vectorTenantFeatureKeys = [
  "vector_v2_design_system",
  "vector_v2_control_shell",
  "unified_resource_picker",
  "unified_filter_dock",
  "venue_twin",
  "screen_health_view",
  "engage",
  "youtube_integration"
] as const;

export type VectorTenantFeatureKey = (typeof vectorTenantFeatureKeys)[number];

export const vectorPilotCoreFeatureKeys = [
  "vector_v2_design_system",
  "vector_v2_control_shell",
  "unified_resource_picker",
  "unified_filter_dock",
  "venue_twin",
  "screen_health_view",
  "engage"
] as const satisfies readonly VectorTenantFeatureKey[];

export type VectorTenantFeatures = Readonly<Record<VectorTenantFeatureKey, boolean>>;

export const emptyVectorTenantFeatures: VectorTenantFeatures = Object.freeze(
  Object.fromEntries(vectorTenantFeatureKeys.map((key) => [key, false])) as Record<
    VectorTenantFeatureKey,
    boolean
  >
);

export const demoVectorTenantFeatures: VectorTenantFeatures = Object.freeze({
  ...emptyVectorTenantFeatures,
  engage: true,
  screen_health_view: true,
  unified_filter_dock: true,
  unified_resource_picker: true,
  vector_v2_control_shell: true,
  vector_v2_design_system: true,
  venue_twin: true
});

export function resolveVectorTenantFeatures(
  rows: readonly Readonly<{ enabled: boolean; flag_key: string }>[]
): VectorTenantFeatures {
  const enabled = new Set(
    rows
      .filter((row) => row.enabled)
      .map((row) => row.flag_key)
      .filter((key): key is VectorTenantFeatureKey =>
        vectorTenantFeatureKeys.includes(key as VectorTenantFeatureKey)
      )
  );

  return Object.freeze(
    Object.fromEntries(
      vectorTenantFeatureKeys.map((key) => [key, enabled.has(key)])
    ) as Record<VectorTenantFeatureKey, boolean>
  );
}

export function isVectorControlEnabled(features: VectorTenantFeatures) {
  return features.vector_v2_design_system && features.vector_v2_control_shell;
}
