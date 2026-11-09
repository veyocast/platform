import {syncOnzeTrotsCurrentHeader,syncOnzeTrotsCurrentVersion} from '../../../_lib/sync-player-capabilities';
import {syncOnzeTrotsV9Header,syncOnzeTrotsV9Version,syncOnzeTrotsHeader,syncOnzeTrotsVersion,syncPlayerRendererHeader,syncPlayerRendererVersion,syncEngagePagingHeader,syncEngagePagingVersion,syncBackgroundsHeader,syncBackgroundsVersion,syncDynamicRendererHeader,readSyncDynamicMode} from "../../../_lib/sync-player-capabilities";
import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  getPlayerManifestForToken,
  type PlayerWaitingBranding,
  type PlayerManifestProblem,
  type PlayerWaitingContentEnvelope
} from "../../../_lib/player-manifest";
import {loadAuthorizedScreenComposition} from "../../../_lib/player-screen-composition";
import { loadPlayerReleaseEnvelope } from "../../../_lib/player-release-envelope";
import {matchdayExpiryHeader,matchdayExpiryVersion,matchdayRequestHeader} from "../../../_lib/player-matchday-window";
import {bindMatchdayWindow,canUseMatchdayWindow,matchdayBootstrapKey,readMatchdayBootstrapWindow,type MatchdayBootstrapWindow} from "../../../_lib/player-matchday-window-server";
import { signPlayerEntitlement } from "../../../_lib/player-entitlement-server";
import {
  createPlayerAnonClient,
  createPlayerAdminClient,
  isLivePlayerConfigured
} from "../../../_lib/player-supabase";
import {
  currentPlayerApplicationVersion,
  playerVersionHeader
} from "../../../_lib/player-app-update";

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
  let response: Response;

  if (isLivePlayerConfigured()) {
    response = await getLiveManifest(request, bearerToken);
  } else {
    const token = bearerToken ?? requestUrl.searchParams.get("deviceToken");
    const lookup = getPlayerManifestForToken(token);

    if (
      lookup.ok &&
      requestHasReleaseEtag(request, lookup.body.manifest.releaseId)
    ) {
      response = unchangedRelease(lookup.body.manifest.releaseId);
    } else {
      response = NextResponse.json(lookup.body, {
        status: lookup.status,
        headers: {
          "Cache-Control": "no-store",
          ...(lookup.ok
            ? { ETag: releaseEtag(lookup.body.manifest.releaseId) }
            : {})
        }
      });
    }
  }

  response.headers.set(playerVersionHeader, currentPlayerApplicationVersion());
  response.headers.set("Vary",[response.headers.get("Vary"),syncPlayerRendererHeader,syncDynamicRendererHeader,syncBackgroundsHeader,syncEngagePagingHeader,syncOnzeTrotsHeader,syncOnzeTrotsV9Header,syncOnzeTrotsCurrentHeader,matchdayExpiryHeader,matchdayRequestHeader].filter(Boolean).join(", "));
  return response;
}

type BootstrapRow = {
  target_revision: string;
  target_changed_at: string;
  assignment_source: string;
  publication_id: string;
  config_revision: string;
  data_key: string;
  sponsor_key: string;
  active_release_id: string | null;
  desired_release_id: string | null;
  device_id: string;
  device_status: string;
  screen_id: string;
  screen_name: string;
  screen_status: string;
  tenant_id: string;
  composition?:unknown;
  desired_composition_id?:string|null;
  active_composition_id?:string|null;
  matchday_window?:unknown;
};

type TenantRow = { name: string };
type TenantSettingsRow = { theme_mode_policy: unknown; timezone_name: string | null };
type BrandKitRow = { logo_media_asset_id: string };
type SportsClubRow = { logo_media_asset_id: string | null };
type MediaAssetRow = { storage_bucket: string; storage_path: string };
type VenueRow = { name: string };

type EntitlementRow = { billing_state:string; capabilities_json:Record<string,boolean>; device_id:string; hard_stop_at:string|null; issued_at:string; playback_mode:"tenant_content"|"tenant_content_with_warning"|"veyocast_billing_splash"|"system_suspended"; reason:string; revision:number; screen_id:string; tenant_id:string; valid_until:string };

async function getLiveManifest(request: Request, token: string | null) {
  if (!token?.trim()) {
    return manifestProblem(401, "UNPAIRED", {
      cause: "Er is nog geen device-token aanwezig.",
      code: "INVALID_DEVICE_TOKEN",
      effect: "De Player kan geen toegewezen release ophalen.",
      recovery: "Maak een koppelcode en koppel de Player in VeyoCast Control."
    });
  }

  const anon = createPlayerAnonClient();
  if (!anon) {
    return manifestProblem(503, "ERROR_RECOVERABLE", {
      cause: "De publieke Supabase-configuratie is niet beschikbaar.",
      code: "PLAYER_API_UNAVAILABLE",
      effect: "Online synchronisatie kan niet starten.",
      recovery: "Herstel de Player-configuratie; een lokale release blijft actief."
    });
  }

  const admin = createPlayerAdminClient();
  const { data, error } = await admin.rpc("get_player_effective_target_v1", {
    p_token_hash: createHash("sha256").update(token.trim()).digest("hex")
  });
  const bootstrap = (data ?? null) as BootstrapRow | null;

  if (error) {
    return manifestProblem(503, "ERROR_RECOVERABLE", {
      cause: "Device-validatie bij Supabase is mislukt.",
      code: "PLAYER_API_UNAVAILABLE",
      effect: "De Player kan de gewenste release niet bepalen.",
      recovery: "Controleer de verbinding; een lokale release blijft actief."
    });
  }

  if (!bootstrap) {
    const tokenHash = createHash("sha256").update(token.trim()).digest("hex");
    const { data: credentialState, error: credentialError } = await anon.rpc(
      "inspect_player_device_credential_v1",
      { p_token_hash: tokenHash }
    );
    if (credentialError) {
      return manifestProblem(503, "ERROR_RECOVERABLE", {
        cause: "Device-validatie bij Supabase is tijdelijk niet beschikbaar.",
        code: "PLAYER_API_UNAVAILABLE",
        effect: "De Player kan de gewenste release niet bepalen.",
        recovery: "De Player probeert dit automatisch opnieuw; lokale content blijft actief."
      });
    }
    const errorCode =
      credentialState === "DEVICE_REVOKED"
        ? "DEVICE_REVOKED"
        : "INVALID_DEVICE_TOKEN";
    return manifestProblem(
      errorCode === "DEVICE_REVOKED" ? 403 : 401,
      "UNPAIRED",
      {
      cause:
        errorCode === "DEVICE_REVOKED"
          ? "De schermcredential is ingetrokken."
          : "De schermcredential is ongeldig of de koppeling is nog niet geclaimd.",
      code: errorCode,
      effect: "Er is nog geen scherm- en releasecontext beschikbaar.",
      recovery: "Voer de zichtbare koppelcode in VeyoCast Control in."
      }
    );
  }

  let matchday:MatchdayBootstrapWindow|null;
  try{matchday=readMatchdayBootstrapWindow(bootstrap.matchday_window);}catch{
    return manifestProblem(503,"ERROR_RECOVERABLE",{cause:"Het tijdelijke schermvenster kon niet veilig worden gecontroleerd.",code:"MATCHDAY_WINDOW_UNAVAILABLE",effect:"Bestaande geldige lokale inhoud blijft beschikbaar.",recovery:"Controleer het draaiboek en de geverifieerde herstelpublicatie."});
  }
  const matchdayRequestId=request.headers.get(matchdayRequestHeader);
  const matchdayCapable=request.headers.get(matchdayExpiryHeader)===matchdayExpiryVersion;
  const useMatchday=canUseMatchdayWindow(matchday,matchdayCapable,matchdayRequestId,Date.now());
  // A legacy/downgraded client receives the ordinary winner NOW. The verified
  // end-of-window fallback may be a different future ordinary publication.
  const desiredReleaseId=matchday&&!useMatchday?matchday.unsupported_release_id:bootstrap.desired_release_id;
  const desiredComposition=matchday&&!useMatchday?matchday.unsupported_composition:bootstrap.composition;
  const matchdayKey=matchdayBootstrapKey(matchday,useMatchday);

  if (!desiredReleaseId) {
    const fetchedAt = new Date().toISOString();
    const branding = await loadPlayerWaitingBranding(bootstrap.tenant_id);
    return NextResponse.json(
      {
        device: {
          activeReleaseId: bootstrap.active_release_id,
          desiredReleaseId: null,
          id: bootstrap.device_id,
          screenId: bootstrap.screen_id,
          screenName: bootstrap.screen_name
        },
        diagnostics: {
          lastSuccessfulSyncAt: fetchedAt,
          nextSyncReason: "waiting for first release",
          syncStatus: "online"
        },
        branding,
        fetchedAt,
        state: "READY"
      } satisfies PlayerWaitingContentEnvelope,
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const { data: entitlementData, error: entitlementError } = await anon.rpc("get_player_entitlement_v1", { p_token_hash: createHash("sha256").update(token.trim()).digest("hex") });
  const entitlementRow = (entitlementData?.[0] ?? null) as EntitlementRow | null;
  if (entitlementError) return manifestProblem(503, "ERROR_RECOVERABLE", { cause: "Toegangsstatus kon niet worden gecontroleerd.", code: "PLAYER_API_UNAVAILABLE", effect: "Lokale inhoud blijft beschikbaar.", recovery: "De Player probeert de controle opnieuw." });

  // Authorization precedes every conditional response. Signed access rotates
  // independently of publication/data identity, at most every 30 minutes.
  const enableSyncOnzeTrots=request.headers.get(syncOnzeTrotsHeader)===syncOnzeTrotsVersion;
  const enableSyncOnzeTrotsCurrent=request.headers.get(syncOnzeTrotsCurrentHeader)===syncOnzeTrotsCurrentVersion;
  const enableSyncOnzeTrotsV9=request.headers.get(syncOnzeTrotsV9Header)===syncOnzeTrotsV9Version;
  const enableSyncStudio=request.headers.get(syncPlayerRendererHeader)===syncPlayerRendererVersion;
  const enableSyncEngagePaging=enableSyncStudio&&request.headers.get(syncEngagePagingHeader)===syncEngagePagingVersion;
  const enableSyncBackgrounds=request.headers.get(syncBackgroundsHeader)===syncBackgroundsVersion;
  const syncDynamicMode=readSyncDynamicMode(request.headers.get(syncDynamicRendererHeader));
  const targetEtag = `"target-${createHash("sha256").update(JSON.stringify([
    bootstrap.tenant_id, bootstrap.device_id, bootstrap.screen_id, bootstrap.target_revision, bootstrap.desired_release_id,
    entitlementRow?.revision, entitlementRow?.billing_state, entitlementRow?.playback_mode, entitlementRow?.hard_stop_at,
    bootstrap.data_key, bootstrap.sponsor_key, Math.floor(Date.now() / 1_800_000),
    ...(matchday?[matchdayKey,desiredReleaseId]:[]),
    currentPlayerApplicationVersion(),...(enableSyncOnzeTrotsCurrent?[syncOnzeTrotsCurrentVersion]:[]),...(enableSyncOnzeTrotsV9?[syncOnzeTrotsV9Version]:[]),...(enableSyncOnzeTrots?[syncOnzeTrotsVersion]:[]),...(enableSyncBackgrounds?[syncBackgroundsVersion]:[]),...(enableSyncStudio?[syncPlayerRendererVersion]:[]),...(enableSyncEngagePaging?[syncEngagePagingVersion]:[]),...(syncDynamicMode?[`sync-dynamic:${syncDynamicMode}`]:[])
  ])).digest("hex")}"`;
  if (request.headers.get("if-none-match") === targetEtag) {
    return new NextResponse(null, { status: 304, headers: { ETag: targetEtag, "Cache-Control": "private, no-cache", Vary: "Authorization" } });
  }
  let releaseStage = "release";
  try {
    let body = await loadPlayerReleaseEnvelope({
      device: {
        activeReleaseId: bootstrap.active_release_id ?? "",
        desiredReleaseId,
        id: bootstrap.device_id,
        screenId: bootstrap.screen_id,
        screenName: bootstrap.screen_name
      },
      releaseId: desiredReleaseId,
      tenantId: bootstrap.tenant_id,
      enableSyncStudio,syncDynamicMode,enableSyncBackgrounds,enableSyncOnzeTrots,enableSyncOnzeTrotsV9,enableSyncOnzeTrotsCurrent,enableSyncEngagePaging,
    });
    releaseStage = "composition";
    body.composition=await loadAuthorizedScreenComposition({candidate:desiredComposition,main:body,load:releaseId=>loadPlayerReleaseEnvelope({device:body.device,releaseId,tenantId:bootstrap.tenant_id,enableSyncStudio,syncDynamicMode,enableSyncBackgrounds,enableSyncOnzeTrots,enableSyncOnzeTrotsV9,enableSyncOnzeTrotsCurrent,enableSyncEngagePaging})});
    body.target = { revision: bootstrap.target_revision, publicationId: matchday&&!useMatchday?desiredReleaseId:bootstrap.publication_id,
      configRevision: bootstrap.config_revision, assignmentSource: matchday&&!useMatchday?"matchday_restore":bootstrap.assignment_source,
      committedAt: bootstrap.target_changed_at };
    body.branding = await loadPlayerWaitingBranding(bootstrap.tenant_id);
    if (entitlementRow) {
      releaseStage = "entitlement";
      const capabilities = entitlementRow.capabilities_json;
      body.entitlement = signPlayerEntitlement({ billingState: entitlementRow.billing_state as never, canActivateNetNewScreen:Boolean(capabilities.canActivateNetNewScreen), canManageBilling:Boolean(capabilities.canManageBilling), canPairReplacement:Boolean(capabilities.canPairReplacement), canPublish:Boolean(capabilities.canPublish), canRecoverPlayer:Boolean(capabilities.canRecoverPlayer), deviceId:entitlementRow.device_id, hardStopAt:entitlementRow.hard_stop_at, issuedAt:entitlementRow.issued_at, playbackMode:entitlementRow.playback_mode, reason:entitlementRow.reason, revision:Number(entitlementRow.revision), screenId:entitlementRow.screen_id, tenantId:entitlementRow.tenant_id, validUntil:entitlementRow.valid_until });
    }
    if(matchday&&useMatchday&&matchdayRequestId){
      releaseStage="matchday-recovery";
      const loadOrdinary=async(releaseId:string,composition:unknown)=>{
        const device={...body.device,desiredReleaseId:releaseId};
        const ordinary=await loadPlayerReleaseEnvelope({device,releaseId,tenantId:bootstrap.tenant_id,enableSyncStudio,syncDynamicMode,enableSyncBackgrounds,enableSyncOnzeTrots,enableSyncOnzeTrotsV9,enableSyncOnzeTrotsCurrent,enableSyncEngagePaging});
        ordinary.composition=await loadAuthorizedScreenComposition({candidate:composition,main:ordinary,load:child=>loadPlayerReleaseEnvelope({device,releaseId:child,tenantId:bootstrap.tenant_id,enableSyncStudio,syncDynamicMode,enableSyncBackgrounds,enableSyncOnzeTrots,enableSyncOnzeTrotsV9,enableSyncOnzeTrotsCurrent,enableSyncEngagePaging})});
        ordinary.target={revision:bootstrap.target_revision,publicationId:releaseId,configRevision:bootstrap.config_revision,assignmentSource:"matchday_restore",committedAt:bootstrap.target_changed_at};
        ordinary.branding=body.branding;ordinary.entitlement=body.entitlement;
        return ordinary;
      };
      const fallback=await loadOrdinary(matchday.fallback_release_id,matchday.fallback_composition);
      const ordinary=matchday.unsupported_release_id===matchday.fallback_release_id&&JSON.stringify(matchday.unsupported_composition)===JSON.stringify(matchday.fallback_composition)?fallback:await loadOrdinary(matchday.unsupported_release_id,matchday.unsupported_composition);
      body=bindMatchdayWindow(body,fallback,ordinary,matchday,matchdayRequestId);
    }
    releaseStage = "target";
    const checked = await admin.rpc("get_player_effective_target_v1", {
      p_token_hash: createHash("sha256").update(token.trim()).digest("hex")
    });
    const current = checked.data as BootstrapRow | null;
    if (checked.error || !current || current.target_revision !== bootstrap.target_revision ||
      current.desired_release_id !== bootstrap.desired_release_id || current.data_key !== bootstrap.data_key || current.sponsor_key !== bootstrap.sponsor_key || current.desired_composition_id!==bootstrap.desired_composition_id||
      matchdayBootstrapKey(readMatchdayBootstrapWindow(current.matchday_window),canUseMatchdayWindow(readMatchdayBootstrapWindow(current.matchday_window),matchdayCapable,matchdayRequestId,Date.now()))!==matchdayKey) {
      return manifestProblem(409, "ERROR_RECOVERABLE", { cause: "De schermopdracht wijzigde tijdens het ophalen.",
        code: "TARGET_CHANGED", effect: "De huidige inhoud blijft spelen.", recovery: "De Player haalt direct de actuele opdracht op." });
    }
    if(body.matchdayWindow&&matchday){
      releaseStage='matchday-offer';
      const composition=body.matchdayWindow.fallback.composition?.published;
      const offered=await admin.rpc('record_player_matchday_window_offer_s300_v1',{
        p_token_hash:createHash('sha256').update(token.trim()).digest('hex'),
        p_input:{publicationId:matchday.publication_id,targetId:matchday.target_id,windowId:matchday.window_id,contentHash:matchday.content_hash,fallbackReleaseId:body.matchdayWindow.fallback.manifest.releaseId,fallbackCompositionId:composition?.id??null,fallbackCompositionRevision:composition?.revision??null,fallbackCompositionHash:composition?matchday.fallback_composition_hash:null}
      });
      if(offered.error||offered.data!==true)throw Error('MATCHDAY_FALLBACK_OFFER_UNAVAILABLE');
    }
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "no-store",
        ETag: targetEtag,
        Vary: "Authorization"
      }
    });
  } catch {
    console.error(JSON.stringify({event:"player_manifest_failed",code:"RELEASE_ASSETS_UNAVAILABLE",stage:releaseStage,releaseId:bootstrap.desired_release_id}));
    return manifestProblem(503, "ERROR_RECOVERABLE", {
      cause: "Niet alle release-assets konden veilig worden ontsloten.",
      code: "RELEASE_ASSETS_UNAVAILABLE",
      effect: "De Player activeert deze release niet.",
      recovery: "Controleer de media en verbinding; de Player probeert dezelfde actuele opdracht opnieuw."
    });
  }
}

async function loadPlayerWaitingBranding(tenantId: string): Promise<PlayerWaitingBranding> {
  const fallback: PlayerWaitingBranding = {
    sportparkName: "ons sportpark",
    tenantLogoUrl: null,
    tenantName: "VeyoCast",
    themeMode: "dark",
    timezone: "Europe/Amsterdam"
  };

  try {
    const admin = createPlayerAdminClient();
    const [tenantResult, settingsResult, kitResult, venueResult] = await Promise.all([
      admin.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
      admin.from("tenant_settings").select("theme_mode_policy,timezone_name").eq("tenant_id", tenantId).maybeSingle(),
      admin.from("studio_tenant_brand_kits").select("logo_media_asset_id").eq("tenant_id", tenantId).maybeSingle(),
      admin.from("venues").select("name").eq("tenant_id", tenantId).eq("status", "active").order("name").limit(1).maybeSingle()
    ]);
    const tenant = tenantResult.data as TenantRow | null;
    const settings = settingsResult.data as TenantSettingsRow | null;
    const kit = kitResult.data as BrandKitRow | null;
    const venue = venueResult.data as VenueRow | null;
    const tenantName = tenant?.name?.trim() || fallback.tenantName;
    const sportparkName = venue?.name?.trim() || tenantName;
    const timezone = settings?.timezone_name?.trim() || fallback.timezone;
    const policy = settings?.theme_mode_policy;
    const themeMode = isRecord(policy) && policy.kind === "fixed" &&
      (policy.mode === "light" || policy.mode === "dark")
      ? policy.mode
      : fallback.themeMode;
    let tenantLogoUrl: string | null = null;
    let logoMediaAssetId = kit?.logo_media_asset_id ?? null;
    if (!logoMediaAssetId) {
      const clubResult = await admin
        .from("sports_clubs")
        .select("logo_media_asset_id")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .not("logo_media_asset_id", "is", null)
        .order("last_synced_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      logoMediaAssetId = (clubResult.data as SportsClubRow | null)?.logo_media_asset_id ?? null;
    }
    if (logoMediaAssetId) {
      const assetResult = await admin
        .from("media_assets")
        .select("storage_bucket,storage_path")
        .eq("tenant_id", tenantId)
        .eq("id", logoMediaAssetId)
        .eq("status", "ready")
        .is("deleted_at", null)
        .maybeSingle();
      const asset = assetResult.data as MediaAssetRow | null;
      if (asset) {
        const signed = await admin.storage
          .from(asset.storage_bucket)
          .createSignedUrl(asset.storage_path, 60 * 60);
        tenantLogoUrl = signed.data?.signedUrl ?? null;
      }
    }
    return { sportparkName, tenantLogoUrl, tenantName, themeMode, timezone };
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function releaseEtag(releaseId: string) {
  return `"release-${releaseId}"`;
}

function requestHasReleaseEtag(request: Request, releaseId: string) {
  const expected = releaseEtag(releaseId);
  return (request.headers.get("if-none-match") ?? "")
    .split(",")
    .some((value) => value.trim().replace(/^W\//, "") === expected);
}

function unchangedRelease(releaseId: string) {
  return new NextResponse(null, {
    headers: {
      "Cache-Control": "no-store",
      ETag: releaseEtag(releaseId)
    },
    status: 304
  });
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
