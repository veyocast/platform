import { mobileCreateScreenRequestSchema } from "@veyocast/contracts";

import {
  getMobileRequestContext,
  requireMobileTenant
} from "../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../lib/mobile-api/response";

import { syncPlaybackEvidence } from "../../../../../lib/sync-playback-evidence";

const pageLimit = 100;

export async function GET(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.screen.read"
    );
    const screensResult = await context.supabase.from("screens")
      .select("id, name, location, status, assigned_release_id")
      .eq("tenant_id", tenant.id).is("deleted_at", null).order("name").order("id").limit(pageLimit);
    if (screensResult.error) throw new Error("screen read unavailable");
    const screens = screensResult.data ?? [];
    const devicesResult = screens.length ? await context.supabase.from("player_devices")
      .select("screen_id,status,app_version,last_seen_at,last_error_code,active_release_id,desired_release_id,current_sync_detail")
      .eq("tenant_id", tenant.id).eq("status", "paired").in("screen_id", screens.map(screen => screen.id))
      .order("paired_at", { ascending: false }) : { data: [], error: null };
    if (devicesResult.error) throw new Error("device read unavailable");
    const devices = new Map((devicesResult.data ?? []).map(device => [device.screen_id, device]));
    const referenceIds = [...new Set(screens.flatMap(screen => {
      const device = devices.get(screen.id);
      return [screen.assigned_release_id, device?.active_release_id, device?.desired_release_id]
        .filter((id): id is string => Boolean(id));
    }))];
    const releases = new Map<string, string>();
    for (let offset = 0; offset < referenceIds.length; offset += 100) {
      const result = await context.supabase.from("playlist_releases")
        .select("id,version,playlist:playlists(name)").eq("tenant_id", tenant.id)
        .in("id", referenceIds.slice(offset, offset + 100));
      if (result.error) throw new Error("release read unavailable");
      for (const release of result.data ?? []) {
        const playlist = Array.isArray(release.playlist) ? release.playlist[0] : release.playlist;
        releases.set(release.id, `${playlist?.name ?? "Playlist"} · versie ${release.version}`);
      }
    }
    const now = Date.now();
    const items = screens.map(screen => {
      const device = devices.get(screen.id);
      const proof = syncPlaybackEvidence(device, now);
      return {
        activeReleaseLabel: proof.confirmedReleaseId ? releases.get(proof.confirmedReleaseId) ?? null : null,
        appVersion: device?.app_version ?? null,
        id: screen.id,
        lastErrorCode: device?.last_error_code ?? null,
        lastSeenAt: device?.last_seen_at ?? null,
        location: screen.location,
        name: screen.name,
        status: mapScreenStatus(screen.status, device, now)
      };
    });

    return mobileData(
      { items, nextCursor: null, total: items.length },
      context.requestId
    );
  } catch (error) {
    return mobileContextFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.screen.manage"
    );
    const parsed = mobileCreateScreenRequestSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return mobileFailure({
        code: "VALIDATION",
        message: "De schermgegevens zijn niet geldig.",
        recovery: "Controleer naam, locatie, oriëntatie en resolutie.",
        requestId: context.requestId,
        status: 422
      });
    }
    const input = parsed.data;
    const { data, error } = await context.supabase.rpc("create_screen_v1", {
      p_initial_release_id: null,
      p_location: input.location,
      p_name: input.name,
      p_orientation: input.orientation,
      p_resolution_height: input.resolutionHeight,
      p_resolution_width: input.resolutionWidth,
      p_tenant_id: tenant.id
    });
    if (error || typeof data !== "string") {
      return mobileFailure({
        code: error?.code === "42501" ? "FORBIDDEN" : "CONFLICT",
        message: "Het scherm kon niet veilig worden aangemaakt.",
        recovery:
          error?.code === "53100"
            ? "De schermlimiet is bereikt. Deactiveer een scherm of verhoog de limiet."
            : "Controleer je rechten en probeer het opnieuw.",
        requestId: context.requestId,
        status: error?.code === "42501" ? 403 : 409
      });
    }
    return mobileData({ screenId: data }, context.requestId, 201);
  } catch (error) {
    return mobileContextFailure(error);
  }
}

function mapScreenStatus(
  status: string,
  device:
    | {
        last_error_code: string | null;
        last_seen_at: string | null;
        status: string;
      }
    | undefined,
  now: number
) {
  if (!device) return "pairing" as const;
  if (device.last_error_code) return "attention" as const;
  const lastSeen = device.last_seen_at
    ? Date.parse(device.last_seen_at)
    : Number.NaN;
  if (!Number.isFinite(lastSeen) || lastSeen > now || now - lastSeen >= 5 * 60_000) {
    return "offline" as const;
  }
  if (status === "active" && device.status === "paired") {
    return "online" as const;
  }
  return "unknown" as const;
}
