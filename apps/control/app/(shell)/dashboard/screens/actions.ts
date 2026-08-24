"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { loadReleaseDetail } from "../releases/data";

type ScreenCommandContext = Awaited<ReturnType<typeof requireScreenManagement>>;

export async function createScreen(formData: FormData) {
  const context = await requireScreenManagement("mutate");
  const screenId = await runCreateScreen(context, formData);
  complete(
    `/dashboard/screens/${screenId}`,
    "Het scherm is transactioneel aangemaakt en staat klaar voor onboarding.",
    screenId
  );
}

export async function createScreenOnboarding(formData: FormData) {
  const context = await requireScreenManagement("mutate");
  const screenId = await runCreateScreen(context, formData);
  const pairingCode = normalizePairingCode(String(formData.get("pairingCode") ?? ""));
  complete(
    `/dashboard/screens/new?screen=${screenId}${pairingCode.length === 6 ? `&code=${encodeURIComponent(pairingCode)}` : ""}`,
    "Schermdetails zijn opgeslagen. Voeg nu de fysieke Player toe.",
    screenId
  );
}

export async function claimScreenPairing(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("pair");
  const screenId = requiredUuid(formData, "screenId");
  const returnPath = formData.get("flow") === "onboarding"
    ? `/dashboard/screens/new?screen=${screenId}`
    : `/dashboard/screens/${screenId}?tab=player`;
  const deviceName = String(formData.get("deviceName") ?? "").trim();
  const pairingCode = normalizePairingCode(String(formData.get("pairingCode") ?? ""));

  if (pairingCode.length !== 6) {
    fail(returnPath, "Neem alle zes tekens van de Player over.");
  }
  if (deviceName.length > 120) {
    fail(returnPath, "De apparaatnaam mag maximaal 120 tekens bevatten.");
  }

  const { data, error } = await supabase.rpc("claim_pairing_session_v4", {
    p_code_hash: createHash("sha256").update(pairingCode).digest("hex"),
    p_device_name: deviceName || "LG webOS Signage",
    p_screen_id: screenId,
    p_tenant_id: session.tenantId
  });
  if (error) fail(returnPath, pairingDatabaseFailure(error.code));
  const result = commandResult(data);
  if (!result.ok) fail(returnPath, pairingResultFailure(result.code));

  complete(
    returnPath,
    "De Player is gekoppeld. Het geheime device-token blijft uitsluitend op de Player.",
    screenId
  );
}

export async function updateScreen(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const screenId = requiredUuid(formData, "screenId");
  const input = screenInput(formData, `/dashboard/screens/${screenId}?tab=overview`);
  const status = String(formData.get("status") ?? "active");
  if (!new Set(["active", "maintenance", "disabled"]).has(status)) {
    fail(`/dashboard/screens/${screenId}?tab=overview`, "Kies een geldige schermstatus.");
  }

  const { error } = await supabase.rpc("update_screen_v1", {
    p_location: input.location,
    p_name: input.name,
    p_orientation: input.orientation,
    p_resolution_height: input.resolutionHeight,
    p_resolution_width: input.resolutionWidth,
    p_screen_id: screenId,
    p_status: status,
    p_tenant_id: session.tenantId
  });
  if (error) fail(`/dashboard/screens/${screenId}?tab=overview`, screenMutationFailure(error.code));
  const message = status === "disabled"
    ? "Het scherm is uitgeschakeld en de gekoppelde Player is ingetrokken. Een offline Player stopt pas bij de eerstvolgende serververbinding."
    : status === "maintenance"
      ? "Onderhoudsmodus is actief. Lokale last-known-good content blijft beschikbaar; nieuwe sync en pairing wachten."
      : "Schermdetails en lifecycle zijn veilig bijgewerkt.";
  complete(`/dashboard/screens/${screenId}?tab=overview`, message, screenId);
}

export async function deactivateScreen(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const screenId = requiredUuid(formData, "screenId");
  const returnPath = `/dashboard/screens/${screenId}?tab=overview`;
  if (formData.get("confirmOffline") !== "yes") {
    fail(returnPath, "Bevestig eerst dat een offline Player pas bij zijn volgende serververbinding stopt.");
  }

  const { error } = await supabase.rpc("deactivate_screen_v1", {
    p_screen_id: screenId,
    p_tenant_id: session.tenantId
  });
  if (error) fail(returnPath, screenMutationFailure(error.code));
  complete(
    returnPath,
    "Het scherm is gedeactiveerd en de gekoppelde Player is ingetrokken. Een offline Player stopt zodra die opnieuw verbinding maakt.",
    screenId
  );
}

export async function removeScreen(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const screenId = requiredUuid(formData, "screenId");
  const confirmationName = String(formData.get("confirmationName") ?? "").trim();
  const returnPath = `/dashboard/screens/${screenId}?tab=overview`;
  if (!confirmationName) {
    fail(returnPath, "Vul de volledige schermnaam in om verwijdering te bevestigen.");
  }

  const { error } = await supabase.rpc("remove_screen_v1", {
    p_confirmation_name: confirmationName,
    p_screen_id: screenId,
    p_tenant_id: session.tenantId
  });
  if (error?.code === "P0003") {
    fail(returnPath, "Deactiveer het scherm eerst. Daarna kan het veilig uit het actieve beheer worden verwijderd.");
  }
  if (error?.code === "P0004") {
    fail(returnPath, "De ingevoerde schermnaam komt niet exact overeen. Controleer de naam en probeer opnieuw.");
  }
  if (error) fail(returnPath, screenMutationFailure(error.code));
  complete(
    "/dashboard/screens",
    "Het scherm is verwijderd uit het actieve beheer en het schermslot is vrijgegeven. Release- en auditgeschiedenis blijven bewaard.",
    screenId
  );
}

export async function renamePlayerDevice(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const screenId = requiredUuid(formData, "screenId");
  const deviceId = requiredUuid(formData, "deviceId");
  const deviceName = String(formData.get("deviceName") ?? "").trim();
  if (deviceName.length < 2 || deviceName.length > 120) {
    fail(`/dashboard/screens/${screenId}?tab=player`, "Geef de Player een naam van 2 tot en met 120 tekens.");
  }
  const { error } = await supabase.rpc("rename_player_device_v1", {
    p_device_id: deviceId,
    p_device_name: deviceName,
    p_tenant_id: session.tenantId
  });
  if (error) fail(`/dashboard/screens/${screenId}?tab=player`, deviceMutationFailure(error.code));
  complete(`/dashboard/screens/${screenId}?tab=player`, "De Playernaam is bijgewerkt.", screenId);
}

export async function revokePlayerDevice(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const screenId = requiredUuid(formData, "screenId");
  const deviceId = requiredUuid(formData, "deviceId");
  const rePair = formData.get("rePair") === "true";
  if (formData.get("confirmOffline") !== "yes") {
    fail(`/dashboard/screens/${screenId}?tab=player`, "Bevestig eerst het gevolg voor een Player die nu offline is.");
  }
  const { error } = await supabase.rpc("revoke_player_device_v1", {
    p_device_id: deviceId,
    p_tenant_id: session.tenantId
  });
  if (error) fail(`/dashboard/screens/${screenId}?tab=player`, deviceMutationFailure(error.code));
  const path = rePair
    ? `/dashboard/screens/new?screen=${screenId}`
    : `/dashboard/screens/${screenId}?tab=player`;
  complete(
    path,
    rePair
      ? "De oude Player is ingetrokken. Voer nu een nieuwe tijdelijke code in."
      : "De Player is ingetrokken. Offline content kan zichtbaar blijven tot het apparaat opnieuw verbinding maakt.",
    screenId
  );
}

export async function requestScreenSyncRetry(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const screenId = requiredUuid(formData, "screenId");
  const { error } = await supabase.rpc("request_screen_sync_retry_v1", {
    p_screen_id: screenId,
    p_tenant_id: session.tenantId
  });
  if (error) fail(`/dashboard/screens/${screenId}?tab=sync`, deviceMutationFailure(error.code));
  complete(
    `/dashboard/screens/${screenId}?tab=sync`,
    "Het retryverzoek is vastgelegd. De Player pakt dit op bij de eerstvolgende verbinding; de huidige release blijft spelen.",
    screenId
  );
}

export async function queuePlayerRecoveryCommand(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const screenId = requiredUuid(formData, "screenId");
  const commandType = String(formData.get("commandType") ?? "").trim();
  const allowedCommands = new Set([
    "RELOAD_PLAYER",
    "RECOVER_PAIRING",
    "FORCE_UNPAIR",
    "CLEAR_PLAYER_CACHE"
  ]);
  const returnPath = `/dashboard/screens/${screenId}?tab=health`;
  if (!allowedCommands.has(commandType)) {
    fail(returnPath, "Kies een geldige Playeractie.");
  }
  if (
    commandType === "RECOVER_PAIRING" &&
    formData.get("confirmPreserve") !== "yes"
  ) {
    fail(
      returnPath,
      "Bevestig dat scherm, tenant, planning en playlist behouden moeten blijven."
    );
  }
  if (
    commandType === "FORCE_UNPAIR" &&
    formData.get("confirmUnpair") !== "yes"
  ) {
    fail(
      returnPath,
      "Bevestig wat wordt losgekoppeld voordat je een nieuwe code aanvraagt."
    );
  }

  const { data, error } = await supabase.rpc("queue_player_command_v1", {
    p_command_type: commandType,
    p_nonce: optionalUuid(formData, "nonce") ?? randomUUID(),
    p_payload: {},
    p_screen_id: screenId,
    p_tenant_id: session.tenantId,
    p_ttl_seconds: commandType === "RELOAD_PLAYER" ? 300 : 900
  });
  if (error) fail(returnPath, deviceMutationFailure(error.code));
  const result = commandResult(data);
  if (!result.ok) {
    fail(returnPath, playerCommandFailure(result.code));
  }

  const message =
    commandType === "RECOVER_PAIRING"
      ? "Herstelopdracht staat klaar. Scherm, tenant, playlist en planning blijven behouden; de Player haalt een nieuwe schermcredential op."
      : commandType === "FORCE_UNPAIR"
        ? "Ontkoppelopdracht staat klaar. Het schermobject, content en historie blijven behouden; de Player toont daarna een nieuwe code."
        : commandType === "CLEAR_PLAYER_CACHE"
          ? "Cacheherstel staat klaar. De koppeling en scherminstellingen blijven behouden."
          : "Herlaadopdracht staat klaar. Koppeling en lokale opslag blijven ongewijzigd.";
  complete(returnPath, message, screenId);
}

export async function requestBulkScreenSyncRetry(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const rawScreenIds = formData.getAll("screenIds").map(String);
  const screenIds = [...new Set(rawScreenIds.filter(isUuid))];
  if (
    screenIds.length === 0 ||
    screenIds.length > 250 ||
    screenIds.length !== rawScreenIds.length
  ) {
    fail(
      "/dashboard/screens",
      "Selecteer één tot en met 250 geldige, actieve schermen met een gekoppelde Player."
    );
  }
  const idempotencyKey = requiredUuid(formData, "idempotencyKey");
  const { data, error } = await supabase.rpc("request_screen_sync_retries_v2", {
    p_idempotency_key: idempotencyKey,
    p_screen_ids: screenIds,
    p_tenant_id: session.tenantId
  });
  const result =
    data && typeof data === "object"
      ? data as { outcome?: unknown; targetCount?: unknown }
      : null;
  if (
    error ||
    result?.outcome !== "applied" ||
    Number(result.targetCount) !== screenIds.length
  ) {
    console.error("Bulk synchronisatieverzoek mislukt", error);
    fail("/dashboard/screens", deviceMutationFailure(error?.code));
  }

  revalidatePath("/dashboard/screens");
  for (const screenId of screenIds) {
    revalidatePath(`/dashboard/screens/${screenId}`);
  }
  redirect(withMessage(
    "/dashboard/screens",
    "succes",
    `Het synchronisatieverzoek staat klaar voor ${screenIds.length} ${screenIds.length === 1 ? "scherm" : "schermen"}. De huidige release blijft spelen tot de Player het verzoek oppakt.`
  ));
}

export async function addBulkScreensToGroup(formData: FormData) {
  const { session, supabase } = await requireScreenManagement("mutate");
  const screenIds = bulkScreenIds(formData);
  const groupId = requiredUuid(formData, "groupId");
  const { data: group, error: groupError } = await supabase
    .from("screen_groups")
    .select("revision")
    .eq("tenant_id", session.tenantId)
    .eq("id", groupId)
    .eq("status", "active")
    .maybeSingle();
  const { data: memberships, error: membershipError } = await supabase
    .from("screen_group_memberships")
    .select("screen_id")
    .eq("tenant_id", session.tenantId)
    .eq("screen_group_id", groupId);
  if (groupError || membershipError || !group) {
    fail("/dashboard/screens", "De gekozen schermgroep bestaat niet meer. Vernieuw de vloot en probeer opnieuw.");
  }
  const memberIds = [
    ...new Set([...(memberships ?? []).map((membership) => membership.screen_id), ...screenIds])
  ];
  const { data, error } = await supabase.rpc("mutate_screen_group_v1", {
    p_expected_revision: Number(group.revision),
    p_group_id: groupId,
    p_idempotency_key: requiredUuid(formData, "idempotencyKey"),
    p_operation: "set_members",
    p_payload: { screenIds: memberIds },
    p_tenant_id: session.tenantId
  });
  const outcome = data && typeof data === "object" && !Array.isArray(data)
    ? data as { outcome?: unknown }
    : null;
  if (error || outcome?.outcome !== "applied") {
    console.error("Schermen aan groep toevoegen mislukt", error);
    fail(
      "/dashboard/screens",
      outcome?.outcome === "conflict"
        ? "De schermgroep is intussen gewijzigd. Vernieuw de vloot en voeg de schermen daarna opnieuw toe."
        : "De schermen konden niet samen aan de groep worden toegevoegd. Er is niets gedeeltelijk gewijzigd."
    );
  }
  revalidatePath("/dashboard/screens");
  revalidatePath("/dashboard/screen-groups");
  revalidatePath("/dashboard/planning");
  redirect(withMessage(
    "/dashboard/screens",
    "succes",
    `${screenIds.length} ${screenIds.length === 1 ? "scherm is" : "schermen zijn"} aan de schermgroep toegevoegd.`
  ));
}

export async function assignBulkScreenRelease(formData: FormData) {
  const session = await requireTenantCapability(
    "tenant.playlist.publish",
    "publish"
  );
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    fail("/dashboard/screens", "Live Supabase is niet beschikbaar. De bestaande toewijzingen zijn ongewijzigd.");
  }
  const screenIds = bulkScreenIds(formData);
  const playlistId = requiredUuid(formData, "playlistId");
  if (formData.get("confirmReleaseAssignment") !== "yes") {
    fail("/dashboard/screens", "Bevestig eerst dat de actuele publicatie van deze playlist naar de geselecteerde schermen mag worden uitgerold.");
  }
  const latestRelease = await supabase
    .from("playlist_releases")
    .select("id")
    .eq("tenant_id", session.tenantId)
    .eq("playlist_id", playlistId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestRelease.error || !latestRelease.data?.id) {
    fail("/dashboard/screens", "Deze playlist heeft nog geen geldige publicatie. Publiceer de playlist eerst en probeer het daarna opnieuw.");
  }
  const releaseId = latestRelease.data.id;
  const detail = await loadReleaseDetail(session.tenantId, releaseId);
  const targets = detail.screenStates.filter((state) =>
    screenIds.includes(state.screen.id)
  );
  if (
    targets.length !== screenIds.length ||
    targets.some((state) => state.preflight.status === "blocked")
  ) {
    fail("/dashboard/screens", "Minimaal één geselecteerd scherm is niet gekoppeld, uitgeschakeld, incompatibel of heeft onvoldoende opslag.");
  }
  if (targets.some((state) =>
    state.preflight.status === "warning" ||
    state.preflight.status === "unknown"
  )) {
    fail("/dashboard/screens", "Minimaal één scherm heeft een preflightwaarschuwing. Wijs deze release vanuit Release Center toe om de risico's afzonderlijk te beoordelen.");
  }
  const { data, error } = await supabase.rpc("reassign_playlist_release_v2", {
    p_idempotency_key: requiredUuid(formData, "idempotencyKey"),
    p_release_id: releaseId,
    p_screen_ids: screenIds
  });
  const outcome = data && typeof data === "object" && !Array.isArray(data)
    ? data as { outcome?: unknown; targetCount?: unknown }
    : null;
  if (
    error ||
    outcome?.outcome !== "reassigned" ||
    Number(outcome.targetCount) !== screenIds.length
  ) {
    console.error("Bulk releasetoewijzing mislukt", error);
    fail("/dashboard/screens", "De release kon niet atomair aan alle geselecteerde schermen worden toegewezen. Bestaande toewijzingen blijven geldig.");
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/releases");
  revalidatePath("/dashboard/screens");
  redirect(withMessage(
    "/dashboard/screens",
    "succes",
    `De immutable release is aan ${screenIds.length} ${screenIds.length === 1 ? "scherm" : "schermen"} toegewezen. Players schakelen pas na volledige download en verificatie.`
  ));
}

async function runCreateScreen(context: ScreenCommandContext, formData: FormData) {
  const input = screenInput(formData);
  const initialReleaseId = optionalUuid(formData, "initialReleaseId");
  const { data, error } = await context.supabase.rpc("create_screen_v1", {
    p_initial_release_id: initialReleaseId,
    p_location: input.location,
    p_name: input.name,
    p_orientation: input.orientation,
    p_resolution_height: input.resolutionHeight,
    p_resolution_width: input.resolutionWidth,
    p_tenant_id: context.session.tenantId
  });
  if (error || typeof data !== "string") {
    fail("/dashboard/screens/new", screenMutationFailure(error?.code));
  }
  return data;
}

function bulkScreenIds(formData: FormData) {
  const rawScreenIds = formData.getAll("screenIds").map(String);
  const screenIds = [...new Set(rawScreenIds.filter(isUuid))];
  if (
    screenIds.length === 0 ||
    screenIds.length > 250 ||
    screenIds.length !== rawScreenIds.length
  ) {
    fail("/dashboard/screens", "Selecteer één tot en met 250 geldige schermen.");
  }
  return screenIds;
}

function screenInput(formData: FormData, failurePath = "/dashboard/screens/new") {
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const orientation = String(formData.get("orientation") ?? "landscape");
  const resolutionWidth = Number.parseInt(String(formData.get("resolutionWidth") ?? "1920"), 10);
  const resolutionHeight = Number.parseInt(String(formData.get("resolutionHeight") ?? "1080"), 10);
  if (name.length < 2 || name.length > 120) {
    fail(failurePath, "Geef het scherm een naam van 2 tot en met 120 tekens.");
  }
  if (location.length > 160) {
    fail(failurePath, "De locatie mag maximaal 160 tekens bevatten.");
  }
  if (orientation !== "landscape" && orientation !== "portrait") {
    fail(failurePath, "Kies liggende of staande oriëntatie.");
  }
  if (!Number.isInteger(resolutionWidth) || resolutionWidth < 320 || resolutionWidth > 7680 || !Number.isInteger(resolutionHeight) || resolutionHeight < 240 || resolutionHeight > 4320) {
    fail(failurePath, "De schermresolutie valt buiten het ondersteunde bereik.");
  }
  return { location, name, orientation, resolutionHeight, resolutionWidth };
}

async function requireScreenManagement(operation: "mutate" | "pair") {
  const session = await requireTenantCapability("tenant.screen.manage", operation);
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    fail("/dashboard/screens", "Live Supabase is niet beschikbaar. Er is niets gewijzigd; herstel de configuratie en log opnieuw in.");
  }
  return { session, supabase };
}

function normalizePairingCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function screenMutationFailure(code: string | undefined) {
  if (code === "P0001") return "De schermlimiet is bereikt. Er is niets aangemaakt; verhoog eerst de limiet of beheer een bestaand scherm.";
  if (code === "23514") return "De schermgegevens zijn niet geldig. Er is niets gewijzigd; controleer naam, oriëntatie, resolutie en content.";
  if (code === "42501") return "Deze schermmutatie is niet toegestaan. Er is niets gewijzigd; controleer je beheerrechten en de verenigingsstatus.";
  if (code === "P0002") return "Het scherm bestaat niet meer binnen deze vereniging. Vernieuw de schermvloot.";
  return "Het scherm kon niet veilig worden opgeslagen. Er is niets gewijzigd; probeer opnieuw.";
}

function pairingDatabaseFailure(code: string | undefined) {
  return code === "42501"
    ? "Je mag deze Player niet koppelen. Er is niets gewijzigd; gebruik een beheerder binnen dezelfde vereniging."
    : "Koppelen is niet voltooid. De Player blijft ongekoppeld; probeer met een nieuwe code opnieuw.";
}

function pairingResultFailure(code: string | null) {
  if (code === "RATE_LIMITED") return "Er zijn te veel koppelcodes geprobeerd. De Player blijft ongekoppeld; wacht vijf minuten en probeer daarna één nieuwe code.";
  if (code === "EXPIRED") return "De koppelcode is verlopen. De Player blijft ongekoppeld; vernieuw de Player en voer de nieuwe code in.";
  if (code === "SCREEN_UNAVAILABLE") return "Dit scherm staat niet actief. Activeer het scherm voordat je een Player koppelt.";
  return "De code is ongeldig of al gebruikt. De Player blijft ongekoppeld; vernieuw de Player voor een nieuwe code.";
}

function deviceMutationFailure(code: string | undefined) {
  if (code === "42501") return "Deze deviceactie is niet toegestaan. Er is niets gewijzigd; controleer je beheerrechten en de verenigingsstatus.";
  if (code === "P0002") return "Er is geen actieve gekoppelde Player voor deze actie. Controleer de Playerstatus of koppel opnieuw.";
  if (code === "23514") return "De Playergegevens zijn niet geldig. Er is niets gewijzigd.";
  return "De deviceactie kon niet veilig worden uitgevoerd. Er is niets gewijzigd; probeer opnieuw.";
}

function playerCommandFailure(code: string | null) {
  if (code === "SCREEN_UNAVAILABLE") {
    return "Dit scherm is niet beschikbaar voor remote herstel. Activeer het scherm en probeer opnieuw.";
  }
  if (code === "PLAYER_UNPAIRED") {
    return "Dit scherm heeft geen actieve Player. Gebruik onboarding om een nieuwe code te koppelen.";
  }
  if (code === "PLAYER_INSTALLATION_UNAVAILABLE") {
    return "Deze oudere Player heeft nog geen afzonderlijke installatiecredential. Laat hem eenmaal de actuele Player laden en probeer daarna opnieuw.";
  }
  return "De Playeropdracht kon niet veilig worden klaargezet. De bestaande koppeling is ongewijzigd.";
}

function commandResult(value: unknown) {
  if (!value || typeof value !== "object") return { code: null, ok: false };
  const result = value as { code?: unknown; ok?: unknown };
  return {
    code: typeof result.code === "string" ? result.code : null,
    ok: result.ok === true
  };
}

function requiredUuid(formData: FormData, name: string) {
  const value = optionalUuid(formData, name);
  if (!value) fail("/dashboard/screens", "De gekozen scherm- of Playerreferentie is ongeldig. Vernieuw de pagina.");
  return value;
}

function optionalUuid(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return isUuid(value)
    ? value
    : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function fail(path: string, message: string): never {
  redirect(withMessage(path, "fout", message));
}

function complete(path: string, message: string, screenId: string): never {
  revalidatePath("/dashboard/screens");
  revalidatePath(`/dashboard/screens/${screenId}`);
  revalidatePath("/dashboard/screens/new");
  redirect(withMessage(path, "succes", message));
}

function withMessage(path: string, key: "fout" | "succes", message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(message)}`;
}
