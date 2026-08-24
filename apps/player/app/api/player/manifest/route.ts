import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  getPlayerManifestForToken,
  type PlayerManifestProblem,
  type PlayerWaitingContentEnvelope
} from "../../../_lib/player-manifest";
import { loadPlayerReleaseEnvelope } from "../../../_lib/player-release-envelope";
import { signPlayerEntitlement } from "../../../_lib/player-entitlement-server";
import {
  createPlayerAnonClient,
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
  return response;
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

  const { data, error } = await anon.rpc("get_player_device_bootstrap", {
    p_token_hash: createHash("sha256").update(token.trim()).digest("hex")
  });
  const bootstrap = (data?.[0] ?? null) as BootstrapRow | null;

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

  if (!bootstrap.desired_release_id) {
    const fetchedAt = new Date().toISOString();
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

  try {
    const body = await loadPlayerReleaseEnvelope({
      device: {
        activeReleaseId: bootstrap.active_release_id ?? "",
        desiredReleaseId: bootstrap.desired_release_id,
        id: bootstrap.device_id,
        screenId: bootstrap.screen_id,
        screenName: bootstrap.screen_name
      },
      releaseId: bootstrap.desired_release_id,
      tenantId: bootstrap.tenant_id
    });
    const { data: entitlementData, error: entitlementError } = await anon.rpc("get_player_entitlement_v1", { p_token_hash: createHash("sha256").update(token.trim()).digest("hex") });
    const entitlementRow = (entitlementData?.[0] ?? null) as EntitlementRow | null;
    if (entitlementError) throw new Error("entitlement unavailable");
    if (entitlementRow) {
      const capabilities = entitlementRow.capabilities_json;
      body.entitlement = signPlayerEntitlement({ billingState: entitlementRow.billing_state as never, canActivateNetNewScreen:Boolean(capabilities.canActivateNetNewScreen), canManageBilling:Boolean(capabilities.canManageBilling), canPairReplacement:Boolean(capabilities.canPairReplacement), canPublish:Boolean(capabilities.canPublish), canRecoverPlayer:Boolean(capabilities.canRecoverPlayer), deviceId:entitlementRow.device_id, hardStopAt:entitlementRow.hard_stop_at, issuedAt:entitlementRow.issued_at, playbackMode:entitlementRow.playback_mode, reason:entitlementRow.reason, revision:Number(entitlementRow.revision), screenId:entitlementRow.screen_id, tenantId:entitlementRow.tenant_id, validUntil:entitlementRow.valid_until });
    }
    const etag = deliveryEtag(body.manifest.releaseId, body.manifest.sponsorPlan?.revisionId);
    if (requestHasEtag(request, etag)) {
      return new NextResponse(null, {
        headers: { "Cache-Control": "no-store", ETag: etag },
        status: 304
      });
    }

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "no-store",
        ETag: etag
      }
    });
  } catch {
    return manifestProblem(503, "ERROR_RECOVERABLE", {
      cause: "Niet alle release-assets konden veilig worden ontsloten.",
      code: "RELEASE_ASSETS_UNAVAILABLE",
      effect: "De Player activeert deze release niet.",
      recovery: "Controleer storage en publiceer zo nodig een nieuwe release."
    });
  }
}

function deliveryEtag(releaseId: string, sponsorRevisionId?: string) {
  return `"delivery-${releaseId}-${sponsorRevisionId ?? "none"}"`;
}

function requestHasEtag(request: Request, etag: string) {
  return (request.headers.get("if-none-match") ?? "")
    .split(",")
    .some((value) => value.trim().replace(/^W\//, "") === etag);
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
