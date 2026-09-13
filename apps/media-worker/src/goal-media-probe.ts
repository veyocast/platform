import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probeVideoFile } from "./video-normalization";

type ProbeAsset = {
  storage_bucket: string;
  storage_path: string;
  checksum_sha256: string;
  mime_type: string;
};

/** Operator-only inspection of the exact published file or its original upload.
 * Never returns media bytes, storage paths, signed URLs or credentials.
 */
export async function inspectGoalMedia({
  tenantId, assetId, asset, orientation, download, probe = probeVideoFile
}: {
  tenantId: string;
  assetId: string;
  asset: ProbeAsset;
  orientation: "landscape" | "portrait";
  download: (bucket: string, path: string) => Promise<Blob>;
  probe?: typeof probeVideoFile;
}) {
  if (asset.storage_bucket !== "tenant-media" ||
    !asset.storage_path.startsWith(`tenants/${tenantId}/assets/${assetId}/`) ||
    asset.storage_path.includes("..")) throw new Error("ASSET_SCOPE_INVALID");
  const blob = await download(asset.storage_bucket, asset.storage_path);
  if (blob.size > 128 * 1024 * 1024) throw new Error("ASSET_DOWNLOAD_FAILED");
  const bytes = Buffer.from(await blob.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (checksum !== asset.checksum_sha256) throw new Error("ASSET_CHECKSUM_FAILED");
  const directory = await mkdtemp(join(tmpdir(), "goal-media-probe-"));
  try {
    const filename = join(directory, "video");
    await writeFile(filename, bytes);
    const metadata = await probe(filename);
    const quarterTurn = Math.abs(metadata.rotationDegrees % 180 - 90) < 0.01;
    const [sarWidth, sarHeight] = (metadata.sampleAspectRatio ?? "1:1").split(":").map(Number);
    const pixelRatio = sarWidth && sarHeight && Number.isFinite(sarWidth / sarHeight) ? sarWidth / sarHeight : 1;
    const unrotatedWidth = metadata.width * pixelRatio;
    const displayWidth = quarterTurn ? metadata.height : unrotatedWidth;
    const displayHeight = quarterTurn ? unrotatedWidth : metadata.height;
    // MP4 box order, including extended sizes; no payload or frame data logged.
    const boxes: string[] = [];
    for (let offset = 0; offset + 8 <= bytes.length;) {
      const size32 = bytes.readUInt32BE(offset);
      const size = size32 === 1 && offset + 16 <= bytes.length
        ? Number(bytes.readBigUInt64BE(offset + 8)) : size32 || bytes.length - offset;
      if (size < 8 || offset + size > bytes.length) break;
      boxes.push(bytes.toString("ascii", offset + 4, offset + 8)); offset += size;
    }
    return {
      mimeType: asset.mime_type, bytes: bytes.length, checksum, probe: metadata,
      displayWidth, displayHeight,
      fastStart: boxes.includes("moov") && boxes.includes("mdat") && boxes.indexOf("moov") < boxes.indexOf("mdat"),
      rasterMatchesSlot: orientation === "portrait" ? metadata.height > metadata.width : metadata.width > metadata.height,
      displayMatchesSlot: orientation === "portrait" ? displayHeight > displayWidth : displayWidth > displayHeight
    };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
