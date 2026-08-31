import { createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const LED_SCORES_PLAYER_MEDIA_HOST = "api.ledscores.score.tel";
const MAX_PLAYER_PHOTO_BYTES = 8_000_000;
const MAX_PLAYER_PHOTO_DIMENSION = 4_096;
export const LED_SCORES_PLAYER_PHOTO_REVALIDATE_MS = 6 * 60 * 60_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PLAYER_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

type ProviderAssetDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      provider_asset_cache: {
        Insert: {
          asset_role: string;
          current_version_id?: string | null;
          entity_type: string;
          external_entity_id: string;
          id?: string;
          last_checked_at?: string | null;
          last_error_code?: string | null;
          last_success_at?: string | null;
          provider: string;
          source_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
        Row: {
          asset_role: string;
          current_version_id: string | null;
          entity_type: string;
          external_entity_id: string;
          id: string;
          last_checked_at: string;
          provider: string;
          source_url: string | null;
        };
        Update: {
          current_version_id?: string | null;
          last_checked_at?: string | null;
          last_error_code?: string | null;
          last_success_at?: string | null;
          source_url?: string | null;
          updated_at?: string;
        };
      };
      provider_asset_versions: {
        Insert: {
          cache_id: string;
          checksum_sha256: string;
          file_size_bytes: number;
          height: number;
          id?: string;
          mime_type: string;
          storage_bucket: string;
          storage_path: string;
          width: number;
        };
        Relationships: [];
        Row: {
          cache_id: string;
          checksum_sha256: string;
          id: string;
        };
        Update: {
          file_size_bytes?: number;
          height?: number;
          mime_type?: string;
          storage_bucket?: string;
          storage_path?: string;
          width?: number;
        };
      };
    };
    Views: Record<string, never>;
  };
};

export type LedScoresPlayerPhotoArtifact = {
  assetVersionId: string;
  bytes: Uint8Array;
  checksumSha256: string;
  externalId: string;
  fileSizeBytes: number;
  height: number;
  mimeType: "image/webp";
  sourceUrl: string;
  storagePath: string;
  width: number;
};

export interface LedScoresPlayerAssetRegistry {
  findCurrent(externalId: string, sourceUrl: string): Promise<string | null>;
  save(artifact: LedScoresPlayerPhotoArtifact): Promise<string>;
}

export class LedScoresPlayerAssetError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "LedScoresPlayerAssetError";
  }
}

export class LedScoresPlayerAssetImporter {
  constructor(
    private readonly registry: LedScoresPlayerAssetRegistry,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async importPlayerPhoto(input: {
    connectionId: string;
    playerKey: string;
    sourceUrl: string;
    teamKey: string;
    tenantId: string;
  }) {
    const tenantId = normalizeTenantId(input.tenantId);
    const sourceUrl = normalizeLedScoresPlayerPhotoUrl(input.sourceUrl);
    const identityParts = [input.connectionId, input.teamKey, input.playerKey]
      .map((part) => part.trim());
    if (identityParts.some((part) => !part)) {
      throw new LedScoresPlayerAssetError("ledscores_player_photo_identity_invalid");
    }
    const externalId = JSON.stringify(identityParts);
    if (externalId.length > 512) {
      throw new LedScoresPlayerAssetError("ledscores_player_photo_identity_invalid");
    }
    const current = await this.registry.findCurrent(externalId, sourceUrl);
    if (current) return current;
    const bytes = await fetchLedScoresPlayerPhoto(sourceUrl, this.fetchImpl);
    const artifact = await prepareLedScoresPlayerPhoto(
      tenantId,
      externalId,
      sourceUrl,
      bytes
    );
    return this.registry.save(artifact);
  }
}

export class SupabaseLedScoresPlayerAssetRegistry implements LedScoresPlayerAssetRegistry {
  private readonly client: SupabaseClient<ProviderAssetDatabase>;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.client = createClient<ProviderAssetDatabase>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }

  async findCurrent(externalId: string, sourceUrl: string) {
    const result = await this.client
      .from("provider_asset_cache")
      .select("current_version_id, last_checked_at, source_url")
      .eq("provider", "ledscores")
      .eq("entity_type", "player")
      .eq("external_entity_id", externalId)
      .eq("asset_role", "player_photo")
      .maybeSingle();
    if (result.error) {
      throw new LedScoresPlayerAssetError("ledscores_player_photo_cache_lookup_failed");
    }
    const row = result.data as {
      current_version_id?: string | null;
      last_checked_at?: string | null;
      source_url?: string | null;
    } | null;
    return reusableLedScoresPlayerAssetVersion(row, sourceUrl);
  }

  async save(artifact: LedScoresPlayerPhotoArtifact) {
    const upload = await this.client.storage
      .from("provider-assets")
      .upload(artifact.storagePath, artifact.bytes, {
        cacheControl: "31536000",
        contentType: artifact.mimeType,
        upsert: true
      });
    if (upload.error) {
      throw new LedScoresPlayerAssetError("ledscores_player_photo_upload_failed");
    }

    const cacheResult = await this.client
      .from("provider_asset_cache")
      .upsert({
        asset_role: "player_photo",
        entity_type: "player",
        external_entity_id: artifact.externalId,
        last_checked_at: new Date().toISOString(),
        last_error_code: null,
        last_success_at: new Date().toISOString(),
        provider: "ledscores",
        source_url: artifact.sourceUrl,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "provider,entity_type,external_entity_id,asset_role"
      })
      .select("id")
      .single();
    if (cacheResult.error || !cacheResult.data?.id) {
      throw new LedScoresPlayerAssetError("ledscores_player_photo_cache_write_failed");
    }
    const cacheId = String(cacheResult.data.id);
    const versionResult = await this.client
      .from("provider_asset_versions")
      .upsert({
        cache_id: cacheId,
        checksum_sha256: artifact.checksumSha256,
        file_size_bytes: artifact.fileSizeBytes,
        height: artifact.height,
        id: artifact.assetVersionId,
        mime_type: artifact.mimeType,
        storage_bucket: "provider-assets",
        storage_path: artifact.storagePath,
        width: artifact.width
      }, { onConflict: "cache_id,checksum_sha256" })
      .select("id")
      .single();
    if (versionResult.error || !versionResult.data?.id) {
      throw new LedScoresPlayerAssetError("ledscores_player_photo_version_write_failed");
    }
    const assetVersionId = String(versionResult.data.id);
    const currentResult = await this.client
      .from("provider_asset_cache")
      .update({ current_version_id: assetVersionId, updated_at: new Date().toISOString() })
      .eq("id", cacheId);
    if (currentResult.error) {
      throw new LedScoresPlayerAssetError("ledscores_player_photo_activation_failed");
    }
    return assetVersionId;
  }
}

export function reusableLedScoresPlayerAssetVersion(
  row: {
    current_version_id?: string | null;
    last_checked_at?: string | null;
    source_url?: string | null;
  } | null,
  sourceUrl: string,
  now = Date.now()
) {
  if (row?.source_url !== sourceUrl || !row.current_version_id || !row.last_checked_at) {
    return null;
  }
  const checkedAt = Date.parse(row.last_checked_at);
  const age = now - checkedAt;
  return Number.isFinite(checkedAt)
    && age >= 0
    && age <= LED_SCORES_PLAYER_PHOTO_REVALIDATE_MS
    ? row.current_version_id
    : null;
}

export function normalizeLedScoresPlayerPhotoUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new LedScoresPlayerAssetError("ledscores_player_photo_url_invalid");
  }
  if (
    url.protocol !== "https:"
    || url.hostname !== LED_SCORES_PLAYER_MEDIA_HOST
    || url.port
    || url.username
    || url.password
  ) {
    throw new LedScoresPlayerAssetError("ledscores_player_photo_url_invalid");
  }
  url.hash = "";
  return url.toString();
}

export async function fetchLedScoresPlayerPhoto(
  sourceUrl: string,
  fetchImpl: typeof fetch = fetch
) {
  const url = normalizeLedScoresPlayerPhotoUrl(sourceUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "image/webp,image/png,image/jpeg" },
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new LedScoresPlayerAssetError("ledscores_player_photo_fetch_failed");
    }
    const contentType = response.headers.get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (!contentType || !PLAYER_PHOTO_MIME_TYPES.has(contentType)) {
      throw new LedScoresPlayerAssetError("ledscores_player_photo_type_invalid");
    }
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PLAYER_PHOTO_BYTES) {
      throw new LedScoresPlayerAssetError("ledscores_player_photo_too_large");
    }
    if (!response.body) {
      throw new LedScoresPlayerAssetError("ledscores_player_photo_fetch_failed");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteLength += chunk.value.byteLength;
      if (byteLength > MAX_PLAYER_PHOTO_BYTES) {
        await reader.cancel();
        throw new LedScoresPlayerAssetError("ledscores_player_photo_too_large");
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch (error) {
    if (error instanceof LedScoresPlayerAssetError) throw error;
    throw new LedScoresPlayerAssetError("ledscores_player_photo_fetch_failed");
  } finally {
    clearTimeout(timer);
  }
}

export async function prepareLedScoresPlayerPhoto(
  tenantIdValue: string,
  externalId: string,
  sourceUrl: string,
  input: Uint8Array
): Promise<LedScoresPlayerPhotoArtifact> {
  const tenantId = normalizeTenantId(tenantIdValue);
  if (!input.byteLength || input.byteLength > MAX_PLAYER_PHOTO_BYTES) {
    throw new LedScoresPlayerAssetError("ledscores_player_photo_too_large");
  }
  let output: {
    data: Uint8Array;
    info: { height: number; width: number };
  };
  try {
    const image = sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_PLAYER_PHOTO_DIMENSION * MAX_PLAYER_PHOTO_DIMENSION
    });
    const metadata = await image.metadata();
    if (
      !metadata.width
      || !metadata.height
      || metadata.width > MAX_PLAYER_PHOTO_DIMENSION
      || metadata.height > MAX_PLAYER_PHOTO_DIMENSION
      || !metadata.format
      || !["jpeg", "png", "webp"].includes(metadata.format)
    ) {
      throw new LedScoresPlayerAssetError("ledscores_player_photo_dimensions_invalid");
    }
    output = await image
      .rotate()
      .webp({ effort: 4, quality: 90 })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    if (error instanceof LedScoresPlayerAssetError) throw error;
    throw new LedScoresPlayerAssetError("ledscores_player_photo_decode_failed");
  }
  if (
    !output.info.width
    || !output.info.height
    || output.info.width > MAX_PLAYER_PHOTO_DIMENSION
    || output.info.height > MAX_PLAYER_PHOTO_DIMENSION
    || !output.data.byteLength
    || output.data.byteLength > MAX_PLAYER_PHOTO_BYTES
  ) {
    throw new LedScoresPlayerAssetError("ledscores_player_photo_output_invalid");
  }
  const checksumSha256 = createHash("sha256").update(output.data).digest("hex");
  const assetVersionId = contentAddressedUuid(
    `ledscores\0player\0${tenantId}\0${externalId}\0${checksumSha256}`
  );
  return {
    assetVersionId,
    bytes: output.data,
    checksumSha256,
    externalId,
    fileSizeBytes: output.data.byteLength,
    height: output.info.height,
    mimeType: "image/webp",
    sourceUrl: normalizeLedScoresPlayerPhotoUrl(sourceUrl),
    storagePath: `tenants/${tenantId}/assets/${assetVersionId}/player.webp`,
    width: output.info.width
  };
}

function normalizeTenantId(value: string) {
  const tenantId = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(tenantId)) {
    throw new LedScoresPlayerAssetError("ledscores_player_photo_tenant_invalid");
  }
  return tenantId;
}

function contentAddressedUuid(value: string) {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
}
