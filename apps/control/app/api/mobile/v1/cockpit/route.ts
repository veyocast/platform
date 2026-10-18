import {
  getMobileRequestContext,
  requireMobileTenant
} from "../../../../../lib/mobile-api/context";
import { mobileCockpitMediaStatuses } from "../../../../../lib/mobile-api/cockpit";
import { syncPlaybackEvidence } from "../../../../../lib/sync-playback-evidence";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../lib/mobile-api/response";

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
          .select("screen_id,status,last_seen_at,last_error_code,last_error_at,active_release_id,desired_release_id,current_sync_detail")
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
      const proof = syncPlaybackEvidence(device, now.getTime());
      if (proof.contact === "online" && device.desired_release_id && !proof.desiredConfirmed) {
        signals.push({ actionHref: `/screens/${screen.id}`, actionLabel: "Synchronisatie bekijken",
          id: `publication-pending:${screen.id}`, message: "De gewenste publicatie is nog niet met een zichtbaar frame bevestigd.",
          occurredAt: device.last_seen_at ?? screen.created_at, title: screen.name, tone: "warning" });
      }
      if (proof.contact !== "online") {
        signals.push({
          actionHref: `/screens/${screen.id}`,
          actionLabel: "Scherm bekijken",
          id: `screen-offline:${screen.id}`,
          message: "Recent contact is niet bevestigd. Een geldige lokale release blijft beschikbaar. Controleer de verbinding en de apparaatklok.",
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
    const screensOnline = activeScreens.filter(screen => syncPlaybackEvidence(devices.get(screen.id), now.getTime()).contact === "online").length;
    const screensAttention = activeScreens.filter(screen => syncPlaybackEvidence(devices.get(screen.id), now.getTime()).needsAttention).length;

    return mobileData(
      {
        generatedAt: now.toISOString(),
        mediaProcessing: (mediaResult.data ?? []).filter(
          (asset) => asset.status !== "validation_failed"
        ).length,
        pendingPublications: (playlistResult.data ?? []).filter(
          (playlist) => playlist.status === "draft"
        ).length,
        screensAttention,
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
