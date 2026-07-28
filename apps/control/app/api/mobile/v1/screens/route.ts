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

const pageLimit = 100;

export async function GET(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.screen.read"
    );
    const [screensResult, devicesResult, releasesResult, playlistsResult] =
      await Promise.all([
        context.supabase
          .from("screens")
          .select("id, name, location, status, assigned_release_id")
          .eq("tenant_id", tenant.id)
          .is("deleted_at", null)
          .order("name")
          .limit(pageLimit),
        context.supabase
          .from("player_devices")
          .select("screen_id, status, app_version, last_seen_at, last_error_code")
          .eq("tenant_id", tenant.id)
          .eq("status", "paired")
          .order("paired_at", { ascending: false }),
        context.supabase
          .from("playlist_releases")
          .select("id, playlist_id, version")
          .eq("tenant_id", tenant.id),
        context.supabase
          .from("playlists")
          .select("id, name")
          .eq("tenant_id", tenant.id)
      ]);
    const queryError = [
      screensResult.error,
      devicesResult.error,
      releasesResult.error,
      playlistsResult.error
    ].find(Boolean);
    if (queryError) {
      console.error("Mobile screen list failed", {
        code: queryError.code,
        requestId: context.requestId
      });
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "De schermen konden niet worden geladen.",
        recovery: "Controleer je verbinding en probeer het opnieuw.",
        requestId: context.requestId,
        status: 503
      });
    }

    const devices = new Map(
      (devicesResult.data ?? []).map((device) => [device.screen_id, device])
    );
    const playlistNames = new Map(
      (playlistsResult.data ?? []).map((playlist) => [playlist.id, playlist.name])
    );
    const releases = new Map(
      (releasesResult.data ?? []).map((release) => [
        release.id,
        `${playlistNames.get(release.playlist_id) ?? "Playlist"} · versie ${release.version}`
      ])
    );
    const now = Date.now();
    const items = (screensResult.data ?? []).map((screen) => {
      const device = devices.get(screen.id);
      return {
        activeReleaseLabel: screen.assigned_release_id
          ? releases.get(screen.assigned_release_id) ?? null
          : null,
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
  if (!Number.isFinite(lastSeen) || now - lastSeen > 5 * 60_000) {
    return "offline" as const;
  }
  if (status === "active" && device.status === "paired") {
    return "online" as const;
  }
  return "unknown" as const;
}
