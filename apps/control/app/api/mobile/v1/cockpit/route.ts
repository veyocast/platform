import {
  getMobileRequestContext,
  requireMobileTenant
} from "../../../../../lib/mobile-api/context";
import { mobileCockpitMediaStatuses } from "../../../../../lib/mobile-api/cockpit";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../lib/mobile-api/response";

const offlineAfterMs = 5 * 60_000;

export async function GET(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.overview.read"
    );
    const [screensResult, devicesResult, mediaResult, playlistResult] =
      await Promise.all([
        context.supabase
          .from("screens")
          .select("id, name, status, created_at")
          .eq("tenant_id", tenant.id)
          .is("deleted_at", null),
        context.supabase
          .from("player_devices")
          .select("screen_id, status, last_seen_at, last_error_code, last_error_at")
          .eq("tenant_id", tenant.id)
          .eq("status", "paired"),
        context.supabase
          .from("media_assets")
          .select("id, title, status, created_at, validation_error")
          .eq("tenant_id", tenant.id)
          .in("status", [...mobileCockpitMediaStatuses]),
        context.supabase
          .from("playlists")
          .select("id, name, status, updated_at")
          .eq("tenant_id", tenant.id)
          .neq("status", "archived")
      ]);
    const queryError = [
      screensResult.error,
      devicesResult.error,
      mediaResult.error,
      playlistResult.error
    ].find(Boolean);
    if (queryError) {
      console.error("Mobile cockpit query failed", {
        code: queryError.code,
        requestId: context.requestId
      });
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Vandaag kon niet volledig worden bijgewerkt.",
        recovery: "Je laatst opgeslagen overzicht blijft beschikbaar. Probeer opnieuw.",
        requestId: context.requestId,
        status: 503
      });
    }

    const now = new Date();
    const devices = new Map(
      (devicesResult.data ?? []).map((device) => [device.screen_id, device])
    );
    const activeScreens = (screensResult.data ?? []).filter(
      (screen) => screen.status === "active"
    );
    const signals: MobileCockpit["signals"][number][] = [];
    for (const screen of activeScreens) {
      const device = devices.get(screen.id);
      if (!device) {
        signals.push({
          actionHref: `/screens/${screen.id}`,
          actionLabel: "Koppelen",
          id: `screen-unpaired:${screen.id}`,
          message: "Dit scherm heeft nog geen gekoppelde Player.",
          occurredAt: screen.created_at,
          title: screen.name,
          tone: "warning"
        });
        continue;
      }
      if (device.last_error_code) {
        signals.push({
          actionHref: `/screens/${screen.id}`,
          actionLabel: "Diagnose openen",
          id: `player-error:${screen.id}:${device.last_error_code}`,
          message: `De Player rapporteerde foutcode ${device.last_error_code}.`,
          occurredAt: device.last_error_at ?? device.last_seen_at,
          title: screen.name,
          tone: "critical"
        });
        continue;
      }
      const lastSeen = device.last_seen_at
        ? Date.parse(device.last_seen_at)
        : Number.NaN;
      if (!Number.isFinite(lastSeen) || now.getTime() - lastSeen >= offlineAfterMs) {
        signals.push({
          actionHref: `/screens/${screen.id}`,
          actionLabel: "Scherm bekijken",
          id: `screen-offline:${screen.id}`,
          message: "De laatste heartbeat is ouder dan vijf minuten. Lokale content blijft beschikbaar.",
          occurredAt: device.last_seen_at ?? screen.created_at,
          title: screen.name,
          tone: "warning"
        });
      }
    }
    const failedMediaSignals = (mediaResult.data ?? [])
      .filter((asset) => asset.status === "validation_failed")
      .map((asset) => ({
        actionHref: `/content/media/${asset.id}`,
        actionLabel: "Media bekijken",
        id: `media-failed:${asset.id}`,
        message: asset.validation_error
          ? `Validatie stopte met foutcode ${asset.validation_error}.`
          : "Het bestand kon niet veilig worden gevalideerd.",
        occurredAt: asset.created_at,
        title: asset.title,
        tone: "critical" as const
      }));
    const screensOnline = activeScreens.filter((screen) => {
      const device = devices.get(screen.id);
      const lastSeen = device?.last_seen_at
        ? Date.parse(device.last_seen_at)
        : Number.NaN;
      return (
        device?.status === "paired" &&
        !device.last_error_code &&
        Number.isFinite(lastSeen) &&
        now.getTime() - lastSeen < offlineAfterMs
      );
    }).length;

    return mobileData(
      {
        generatedAt: now.toISOString(),
        mediaProcessing: (mediaResult.data ?? []).filter(
          (asset) => asset.status !== "validation_failed"
        ).length,
        pendingPublications: (playlistResult.data ?? []).filter(
          (playlist) => playlist.status === "draft"
        ).length,
        screensAttention: activeScreens.length - screensOnline,
        screensOnline,
        signals: [...signals, ...failedMediaSignals].slice(0, 20)
      },
      context.requestId
    );
  } catch (error) {
    return mobileContextFailure(error);
  }
}
import type { MobileCockpit } from "@veyocast/contracts";
