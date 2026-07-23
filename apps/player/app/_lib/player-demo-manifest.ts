import "server-only";

import type { PlayerManifestEnvelope } from "./player-manifest";
import { loadPlayerReleaseEnvelope } from "./player-release-envelope";
import { createPlayerAdminClient } from "./player-supabase";

const fallbackTenantId = "d3000000-0000-4000-8000-000000000001";
const fallbackPlaylistId = "d3000000-0000-4000-8000-000000000002";
const fallbackReleaseId = "d3000000-0000-4000-8000-000000000003";
const demoScreenId = "d3000000-0000-4000-8000-000000000004";
const demoDeviceId = "d3000000-0000-4000-8000-000000000005";

type DemoConfiguration = {
  playlist_id: string;
  tenant_id: string;
};

type DemoPlaylistLifecycle = {
  id: string;
  status: string;
  tenant_id: string;
};

type DemoTenantLifecycle = {
  id: string;
  status: string;
};

export async function loadPlayerDemoManifest(): Promise<PlayerManifestEnvelope> {
  try {
    const admin = createPlayerAdminClient();
    const configuration = await admin
      .from("platform_player_demo_playlists")
      .select("tenant_id, playlist_id")
      .eq("environment", "staging")
      .maybeSingle();

    if (configuration.error || !configuration.data) {
      return fallbackPlayerDemoManifest();
    }

    const [tenant, playlist] = await Promise.all([
      admin
        .from("tenants")
        .select("id, status")
        .eq("id", configuration.data.tenant_id)
        .maybeSingle(),
      admin
        .from("playlists")
        .select("id, tenant_id, status")
        .eq("id", configuration.data.playlist_id)
        .eq("tenant_id", configuration.data.tenant_id)
        .maybeSingle()
    ]);
    if (
      tenant.error ||
      playlist.error ||
      !isEligiblePlayerDemoConfiguration({
        configuration: configuration.data,
        playlist: playlist.data,
        tenant: tenant.data
      })
    ) {
      return fallbackPlayerDemoManifest();
    }

    const release = await admin
      .from("playlist_releases")
      .select("id")
      .eq("tenant_id", configuration.data.tenant_id)
      .eq("playlist_id", configuration.data.playlist_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (release.error || !release.data) {
      return fallbackPlayerDemoManifest();
    }

    return await loadPlayerReleaseEnvelope({
      device: demoDevice(release.data.id),
      releaseId: release.data.id,
      tenantId: configuration.data.tenant_id
    });
  } catch {
    return fallbackPlayerDemoManifest();
  }
}

export function isEligiblePlayerDemoConfiguration({
  configuration,
  playlist,
  tenant
}: {
  configuration: DemoConfiguration | null;
  playlist: DemoPlaylistLifecycle | null;
  tenant: DemoTenantLifecycle | null;
}) {
  return Boolean(
    configuration &&
      tenant &&
      playlist &&
      tenant.id === configuration.tenant_id &&
      tenant.status === "active" &&
      playlist.id === configuration.playlist_id &&
      playlist.tenant_id === configuration.tenant_id &&
      playlist.status !== "archived"
  );
}

export function fallbackPlayerDemoManifest(
  fetchedAt = new Date().toISOString()
): PlayerManifestEnvelope {
  return {
    device: demoDevice(fallbackReleaseId),
    diagnostics: {
      lastSuccessfulSyncAt: fetchedAt,
      nextSyncReason: "safe staging review fallback",
      syncStatus: "online"
    },
    fetchedAt,
    manifest: {
      items: [
        {
          durationSeconds: 5,
          fitMode: "cover",
          id: "demo-clubhuis-entree",
          kind: "image",
          muted: true,
          source: {
            bytes: 1_729,
            checksumSha256:
              "67ca5eafb9902da217ba9ae461d851f94c916a46db3ffddc824dc674f12f425c",
            mimeType: "image/svg+xml",
            url: "/player-demo/clubhuis-entree.svg"
          },
          title: "VeyoCast reviewintro"
        },
        {
          durationSeconds: 10,
          fitMode: "cover",
          id: "demo-veyocast-video",
          kind: "video",
          muted: true,
          source: {
            bytes: 12_346_112,
            checksumSha256:
              "204a5193f7a94fa84dbea0f45a37e30bc2d7796f0a917083fc676140202c7396",
            mimeType: "video/mp4",
            url: "/api/player/demo/media"
          },
          title: "VeyoCast productdemo"
        },
        {
          durationSeconds: 5,
          fitMode: "contain",
          id: "demo-kantine-nieuws",
          kind: "image",
          muted: true,
          source: {
            bytes: 1_320,
            checksumSha256:
              "b65be753a723dd4398f37bded1c5b8239be1b96e00b490647db1e5a3ea80190a",
            mimeType: "image/svg+xml",
            url: "/player-demo/kantine-nieuws.svg"
          },
          title: "VeyoCast reviewafsluiting"
        }
      ],
      label: "Veilige Android reviewdemo",
      manifestHash:
        "f277e4a9cb568b4cf4bb4df774f23d4ba4a9051fc85345ad30d8d454564ad318",
      playlistId: fallbackPlaylistId,
      publishedAt: "2026-07-23T00:00:00.000Z",
      releaseId: fallbackReleaseId,
      schemaVersion: 1,
      tenantId: fallbackTenantId,
      totalBytes: 12_349_161,
      totalDurationSeconds: 20,
      version: 1
    },
    state: "PLAYING"
  };
}

function demoDevice(releaseId: string) {
  return {
    activeReleaseId: releaseId,
    desiredReleaseId: releaseId,
    id: demoDeviceId,
    screenId: demoScreenId,
    screenName: "Google Play reviewdemo"
  };
}
