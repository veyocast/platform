import { readFile } from "node:fs/promises";
import { inspectGoalMedia } from "./goal-media-probe";
import { createConfiguredMediaWorkerClient } from "./worker-backend";

/** Read-only operator diagnostic. Runs only inside the deployed worker image.
 * Storage credentials never leave that boundary; no URLs or member data in output.
 */
async function main() {
  const [tenantId, releaseSha, environment] = process.argv.slice(2);
  if (!tenantId || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(tenantId) ||
    !releaseSha || !/^[0-9a-f]{40}$/.test(releaseSha) ||
    !["staging", "production"].includes(environment ?? "") ||
    process.env.DEPLOYMENT_SHA !== releaseSha || process.env.VEYOCAST_ENVIRONMENT !== environment) {
    throw new Error("PROBE_SCOPE_INVALID");
  }
  const readiness = JSON.parse(await readFile("/tmp/veyocast-media-worker-ready.json", "utf8"));
  if (readiness.revision !== releaseSha || readiness.environment !== environment ||
    Date.now() - readiness.lastPollAt > 75_000) throw new Error("WORKER_NOT_READY");
  const client = createConfiguredMediaWorkerClient();
  const alerts = await client.from("ledscores_goal_alerts")
    .select("id,current_published_version_id").eq("tenant_id", tenantId).eq("status", "published").limit(50);
  if (alerts.error) throw new Error("ALERT_READ_FAILED");
  for (const alert of alerts.data ?? []) {
    if (!alert.current_published_version_id) continue;
    const version = await client.from("ledscores_goal_alert_versions").select("id,version,config_snapshot")
      .eq("tenant_id", tenantId).eq("id", alert.current_published_version_id).single();
    if (version.error) throw new Error("VERSION_READ_FAILED");
    const configuration = version.data.config_snapshot?.goalOverlay;
    if (!configuration) continue;
    for (const orientation of ["landscape", "portrait"] as const) {
      const assetId = configuration[orientation === "portrait" ? "introPortraitMediaId" : "introLandscapeMediaId"];
      if (!assetId) continue;
      const result = await client.from("ledscores_goal_alert_version_assets")
        .select("media_asset_id,storage_bucket,storage_path,mime_type,checksum_sha256")
        .eq("tenant_id", tenantId).eq("alert_version_id", version.data.id).eq("media_asset_id", assetId).single();
      if (result.error) throw new Error("VERSION_ASSET_READ_FAILED");
      const original = await client.from("media_variants")
        .select("storage_bucket,storage_path,mime_type,checksum_sha256")
        .eq("tenant_id", tenantId).eq("asset_id", assetId).eq("variant_type", "original").single();
      if (original.error) throw new Error("ORIGINAL_ASSET_READ_FAILED");
      for (const [sourceKind, asset] of [["published", result.data], ["original", original.data]] as const) {
        const inspection = await inspectGoalMedia({ tenantId, assetId, asset, orientation,
          download: async (bucket, path) => {
            const response = await client.storage.from(bucket).download(path);
            if (response.error || !response.data) throw new Error("ASSET_DOWNLOAD_FAILED");
            return response.data;
          }
        });
        console.info(JSON.stringify({ event: "published_goal_media_probe", tenantId, releaseSha,
          alertId: alert.id, versionId: version.data.id, version: version.data.version,
          orientation, assetId, sourceKind, ...inspection }));
      }
    }
  }
}
main().catch((error: unknown) => {
  const code = error instanceof Error && /^[A-Z_]{3,80}$/.test(error.message) ? error.message : "MEDIA_PROBE_FAILED";
  console.error(JSON.stringify({ event: "published_goal_media_probe_failed", code })); process.exitCode = 1;
});
