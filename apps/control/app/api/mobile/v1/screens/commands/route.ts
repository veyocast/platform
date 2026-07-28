import {
  mobilePlayerCommandRequestSchema,
  mobilePlayerCommandSchema
} from "@veyocast/contracts";

import {
  getMobileRequestContext,
  requireMobileTenant
} from "../../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../../lib/mobile-api/response";

export async function POST(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.screen.manage"
    );
    const parsed = mobilePlayerCommandRequestSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return mobileFailure({
        code: "VALIDATION",
        message: "De Playeractie is niet geldig.",
        recovery: "Controleer de actie en probeer het opnieuw.",
        requestId: context.requestId,
        status: 422
      });
    }
    const input = parsed.data;
    const { data, error } = await context.supabase.rpc(
      "queue_player_command_v1",
      {
        p_command_type: input.commandType,
        p_nonce: input.idempotencyKey,
        p_payload: {},
        p_screen_id: input.screenId,
        p_tenant_id: tenant.id,
        p_ttl_seconds: input.ttlSeconds
      }
    );
    if (error) {
      return mobileFailure({
        code: error.code === "42501" ? "FORBIDDEN" : "CONFLICT",
        message: "De Playeractie kon niet veilig worden klaargezet.",
        recovery: "Vernieuw de schermstatus en probeer het daarna opnieuw.",
        requestId: context.requestId,
        status: error.code === "42501" ? 403 : 409
      });
    }
    const result = asCommandResult(data);
    if (!result.ok || !result.commandId) {
      return mobileFailure({
        code: "CONFLICT",
        message: commandFailureMessage(result.code),
        recovery: "Controleer de koppeling en actuele schermstatus.",
        requestId: context.requestId,
        status: 409
      });
    }
    const commandResult = await context.supabase
      .from("player_commands")
      .select("id, command_type, created_at, expires_at, delivered_at, acknowledged_at, completed_at, failed_at")
      .eq("tenant_id", tenant.id)
      .eq("id", result.commandId)
      .maybeSingle();
    if (commandResult.error || !commandResult.data) {
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "De opdracht is opgeslagen, maar de status kon niet worden bevestigd.",
        recovery: "Vernieuw de schermstatus; voer dezelfde opdracht niet opnieuw uit.",
        requestId: context.requestId,
        status: 503
      });
    }
    const command = commandResult.data;
    return mobileData(
      mobilePlayerCommandSchema.parse({
        commandType: command.command_type,
        createdAt: command.created_at,
        expiresAt: command.expires_at,
        id: command.id,
        status: command.failed_at
          ? "failed"
          : command.completed_at
            ? "completed"
            : command.acknowledged_at
              ? "acknowledged"
              : command.delivered_at
                ? "delivered"
                : Date.parse(command.expires_at) <= Date.now()
                  ? "expired"
                  : "waiting"
      }),
      context.requestId,
      202
    );
  } catch (error) {
    return mobileContextFailure(error);
  }
}

function asCommandResult(value: unknown): {
  code: string | null;
  commandId: string | null;
  ok: boolean;
} {
  if (!value || typeof value !== "object") {
    return { code: "UNKNOWN", commandId: null, ok: false };
  }
  const record = value as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : null,
    commandId:
      typeof record.commandId === "string" ? record.commandId : null,
    ok: record.ok === true
  };
}

function commandFailureMessage(code: string | null) {
  if (code === "PLAYER_UNPAIRED") return "Dit scherm heeft geen gekoppelde Player.";
  if (code === "PLAYER_INSTALLATION_UNAVAILABLE") {
    return "De Playerinstallatie is niet bereikbaar voor beheer.";
  }
  return "Dit scherm is niet beschikbaar voor de gekozen Playeractie.";
}
