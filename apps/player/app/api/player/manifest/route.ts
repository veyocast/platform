import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  getPlayerManifestForToken,
  type PlayerManifestProblem,
  type PlayerWaitingContentEnvelope
} from "../../../_lib/player-manifest";
import { loadPlayerReleaseEnvelope } from "../../../_lib/player-release-envelope";
import {
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
