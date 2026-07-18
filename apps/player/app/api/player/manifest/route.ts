import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  getPlayerManifestForToken,
  type PlayerManifestEnvelope,
  type PlayerManifestItem,
  type PlayerManifestProblem
} from "../../../_lib/player-manifest";
import {
  createPlayerAdminClient,
  createPlayerAnonClient,
  isLivePlayerConfigured
} from "../../../_lib/player-supabase";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice("bearer ".length);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const bearerToken = getBearerToken(request);

  if (isLivePlayerConfigured()) {
    return getLiveManifest(bearerToken);
  }

  const token = bearerToken ?? requestUrl.searchParams.get("deviceToken");
  const lookup = getPlayerManifestForToken(token);

  return NextResponse.json(lookup.body, {
    status: lookup.status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

type BootstrapRow = {
  active_release_id: string | null;
  desired_release_id: string | null;
  device_id: string;
  device_status: string;
  screen_id: string;
  screen_name: string;
  screen_status: string;
  tenant_id: string;
};

type ReleaseRow = {
  id: string;
  manifest_hash: string;
  playlist_id: string;
  published_at: string;
  tenant_id: string;
  total_bytes: number;
  total_duration_seconds: number;
  version: number;
};

type ReleaseItemRow = {
  asset_kind: "image" | "video";
  asset_title: string;
  checksum_sha256: string;
  duration_seconds: number;
  file_size_bytes: number;
  fit_mode: "contain" | "cover";
  id: string;
  mime_type: string;
  muted: boolean;
  storage_bucket: string;
  storage_path: string;
};

async function getLiveManifest(token: string | null) {
  if (!token?.trim()) {
    return manifestProblem(401, "UNPAIRED", {
      cause: "Er is nog geen device-token aanwezig.",
      effect: "De Player kan geen toegewezen release ophalen.",
      recovery: "Maak een koppelcode en koppel de Player in VeyoCast Control."
    });
  }

  const anon = createPlayerAnonClient();
  if (!anon) {
    return manifestProblem(503, "ERROR_RECOVERABLE", {
      cause: "De publieke Supabase-configuratie is niet beschikbaar.",
      effect: "Online synchronisatie kan niet starten.",
      recovery: "Herstel de Player-configuratie; een lokale release blijft actief."
    });
  }

  const { data, error } = await anon.rpc("get_player_device_bootstrap", {
    p_token_hash: createHash("sha256").update(token.trim()).digest("hex")
  });
  const bootstrap = (data?.[0] ?? null) as BootstrapRow | null;

  if (error) {
    return manifestProblem(503, "ERROR_RECOVERABLE", {
      cause: "Device-validatie bij Supabase is mislukt.",
      effect: "De Player kan de gewenste release niet bepalen.",
      recovery: "Controleer de verbinding; een lokale release blijft actief."
    });
  }

  if (!bootstrap) {
    return manifestProblem(401, "UNPAIRED", {
      cause: "De koppelcode is nog niet geclaimd of het device is ingetrokken.",
      effect: "Er is nog geen scherm- en releasecontext beschikbaar.",
      recovery: "Voer de zichtbare koppelcode in VeyoCast Control in."
    });
  }

  if (!bootstrap.desired_release_id) {
    return manifestProblem(404, "ERROR_RECOVERABLE", {
      cause: "Aan dit scherm is nog geen release toegewezen.",
      effect: "De Player heeft nog geen content om te activeren.",
      recovery: "Publiceer in Control een playlist naar dit scherm."
    });
  }

  try {
    const admin = createPlayerAdminClient();
    const [releaseResult, itemResult] = await Promise.all([
      admin
        .from("playlist_releases")
        .select("id, tenant_id, playlist_id, version, manifest_hash, published_at, total_duration_seconds, total_bytes")
        .eq("id", bootstrap.desired_release_id)
        .eq("tenant_id", bootstrap.tenant_id)
        .single(),
      admin
        .from("playlist_release_items")
        .select("id, asset_kind, asset_title, duration_seconds, fit_mode, muted, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256")
        .eq("release_id", bootstrap.desired_release_id)
        .eq("tenant_id", bootstrap.tenant_id)
        .order("sort_order", { ascending: true })
    ]);

    if (releaseResult.error || itemResult.error || !releaseResult.data) {
      return manifestProblem(503, "ERROR_RECOVERABLE", {
        cause: "De immutable release kon niet volledig worden gelezen.",
        effect: "De Player activeert geen mogelijk incomplete release.",
        recovery: "Controleer de release in Control; de last-known-good release blijft actief."
      });
    }

    const release = releaseResult.data as ReleaseRow;
    const releaseItems = (itemResult.data ?? []) as ReleaseItemRow[];
    const items = await Promise.all(
      releaseItems.map(async (item): Promise<PlayerManifestItem> => {
        const { data: signed, error: signedError } = await admin.storage
          .from(item.storage_bucket)
          .createSignedUrl(item.storage_path, 60 * 60);

        if (signedError || !signed?.signedUrl) {
          throw new Error("signed asset URL unavailable");
        }

        return {
          durationSeconds: item.duration_seconds,
          fitMode: item.fit_mode,
          id: item.id,
          kind: item.asset_kind,
          muted: item.muted,
          source: {
            bytes: item.file_size_bytes,
            checksumSha256: item.checksum_sha256,
            mimeType: item.mime_type,
            url: signed.signedUrl
          },
          title: item.asset_title
        };
      })
    );

    const fetchedAt = new Date().toISOString();
    const body: PlayerManifestEnvelope = {
      device: {
        activeReleaseId: bootstrap.active_release_id ?? "",
        desiredReleaseId: bootstrap.desired_release_id,
        id: bootstrap.device_id,
        screenId: bootstrap.screen_id,
        screenName: bootstrap.screen_name
      },
      diagnostics: {
        lastSuccessfulSyncAt: fetchedAt,
        nextSyncReason:
          bootstrap.active_release_id === bootstrap.desired_release_id
            ? "desired release already active"
            : "desired release must be verified",
        syncStatus: "online"
      },
      fetchedAt,
      manifest: {
        items,
        label: `Pilotplaylist v${release.version}`,
        manifestHash: release.manifest_hash,
        playlistId: release.playlist_id,
        publishedAt: release.published_at,
        releaseId: release.id,
        schemaVersion: 1,
        tenantId: release.tenant_id,
        totalBytes: release.total_bytes,
        totalDurationSeconds: release.total_duration_seconds,
        version: release.version
      },
      state:
        bootstrap.active_release_id === bootstrap.desired_release_id
          ? "PLAYING"
          : "READY"
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return manifestProblem(503, "ERROR_RECOVERABLE", {
      cause: "Niet alle release-assets konden veilig worden ontsloten.",
      effect: "De Player activeert deze release niet.",
      recovery: "Controleer storage en publiceer zo nodig een nieuwe release."
    });
  }
}

function manifestProblem(
  status: number,
  state: PlayerManifestProblem["state"],
  error: PlayerManifestProblem["error"]
) {
  return NextResponse.json(
    { error, state } satisfies PlayerManifestProblem,
    {
      headers: {
        "Cache-Control": "no-store"
      },
      status
    }
  );
}
