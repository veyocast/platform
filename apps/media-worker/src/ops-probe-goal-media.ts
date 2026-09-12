import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probeVideoFile } from "./video-normalization";
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
  const directory = await mkdtemp(join(tmpdir(), "goal-media-probe-"));
  try {
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
        const asset = result.data;
        if (asset.storage_bucket !== "tenant-media" ||
          !asset.storage_path.startsWith(`tenants/${tenantId}/assets/${assetId}/`) ||
          asset.storage_path.includes("..")) throw new Error("ASSET_SCOPE_INVALID");
        const download = await client.storage.from(asset.storage_bucket).download(asset.storage_path);
        if (download.error || !download.data || download.data.size > 128 * 1024 * 1024) throw new Error("ASSET_DOWNLOAD_FAILED");
        const bytes = Buffer.from(await download.data.arrayBuffer());
        const checksum = createHash("sha256").update(bytes).digest("hex");
        if (checksum !== asset.checksum_sha256) throw new Error("ASSET_CHECKSUM_FAILED");
        const filename = join(directory, `${orientation}.mp4`);
        await writeFile(filename, bytes);
        const probe = await probeVideoFile(filename);
        // MP4 box order, including extended sizes; no payload or frame data logged.
        const boxes: string[] = [];
        for (let offset = 0; offset + 8 <= bytes.length;) {
          const size32 = bytes.readUInt32BE(offset);
          const size = size32 === 1 && offset + 16 <= bytes.length ? Number(bytes.readBigUInt64BE(offset + 8)) : size32 || bytes.length - offset;
          if (size < 8 || offset + size > bytes.length) break;
          boxes.push(bytes.toString("ascii", offset + 4, offset + 8)); offset += size;
        }
        console.info(JSON.stringify({ event: "published_goal_media_probe", tenantId, releaseSha,
          alertId: alert.id, versionId: version.data.id, version: version.data.version,
          orientation, assetId, mimeType: asset.mime_type, bytes: bytes.length, checksum, probe,
          fastStart: boxes.includes("moov") && boxes.indexOf("moov") < boxes.indexOf("mdat"),
          rasterMatchesSlot: orientation === "portrait" ? probe.height > probe.width : probe.width > probe.height }));
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
}
main().catch((error: unknown) => {
  const code = error instanceof Error && /^[A-Z_]{3,80}$/.test(error.message) ? error.message : "MEDIA_PROBE_FAILED";
  console.error(JSON.stringify({ event: "published_goal_media_probe_failed", code })); process.exitCode = 1;
});
