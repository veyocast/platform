import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createPlayerAnonClient,
  isLivePlayerConfigured
} from "../../../_lib/player-supabase";
import { normalizePlayerTimestamp } from "../../../_lib/player-time";

const maximumRequestBytes = 384;

export async function GET(request: Request) {
  const installationCredential = getBearerToken(request);
  if (!isOpaqueCredential(installationCredential)) {
    return commandFailure("INVALID_INSTALLATION_CREDENTIAL", 401);
  }
  if (!isLivePlayerConfigured()) {
    return noStore({
      commands: [],
      live: false,
      ok: true,
      serverTime: new Date().toISOString()
    });
  }

  const supabase = createPlayerAnonClient();
  if (!supabase) return commandFailure("COMMAND_API_UNAVAILABLE", 503);
  const { data, error } = await supabase.rpc("poll_player_commands_v1", {
    p_installation_credential_hash: sha256(installationCredential)
  });
  const result = parsePollResult(data);
  if (error) return commandFailure("COMMAND_API_UNAVAILABLE", 503);
  if (!result.ok) {
    return commandFailure(
      result.code ?? "INVALID_INSTALLATION_CREDENTIAL",
      401
    );
  }
  return noStore({
    commands: result.commands,
    live: true,
    ok: true,
    serverTime: new Date().toISOString()
  });
}

export async function POST(request: Request) {
  const installationCredential = getBearerToken(request);
  if (!isOpaqueCredential(installationCredential)) {
    return commandFailure("INVALID_INSTALLATION_CREDENTIAL", 401);
  }
  const rawBody = await readBoundedBody(request);
  if (rawBody === null) return commandFailure("COMMAND_REQUEST_INVALID", 413);
  const body = parseCompletionBody(rawBody);
  if (!body) return commandFailure("COMMAND_REQUEST_INVALID", 400);

  if (!isLivePlayerConfigured()) {
    return noStore({
      commandType: body.commandType ?? null,
      live: false,
      ok: true
    });
  }

  const supabase = createPlayerAnonClient();
  if (!supabase) return commandFailure("COMMAND_API_UNAVAILABLE", 503);
  if (body.phase === "acknowledged") {
    const { data, error } = await supabase.rpc(
      "acknowledge_player_command_v1",
      {
        p_command_id: body.commandId,
        p_installation_credential_hash: sha256(installationCredential)
      }
    );
    const result = parseCompletionResult(data);
    if (error) return commandFailure("COMMAND_API_UNAVAILABLE", 503);
    if (!result.ok) {
      return commandFailure(
        result.code ?? "COMMAND_EXECUTION_FAILED",
        result.code === "COMMAND_EXPIRED" ? 410 : 409
      );
    }
    return noStore({
      alreadyCompleted: result.alreadyCompleted,
      live: true,
      ok: true
    });
  }

  const nextDeviceToken = deterministicDeviceToken(
    body.commandId,
    installationCredential
  );
  const { data, error } = await supabase.rpc("complete_player_command_v1", {
    p_command_id: body.commandId,
    p_failure_code: body.failureCode,
    p_installation_credential_hash: sha256(installationCredential),
    p_new_device_token_hash: body.failureCode
      ? null
      : sha256(nextDeviceToken)
  });
  const result = parseCompletionResult(data);
  if (error) return commandFailure("COMMAND_API_UNAVAILABLE", 503);
  if (!result.ok) {
    return commandFailure(
      result.code ?? "COMMAND_EXECUTION_FAILED",
      result.code === "COMMAND_EXPIRED" ? 410 : 409
    );
  }
  return noStore({
    alreadyCompleted: result.alreadyCompleted,
    commandType: result.commandType,
    ...(result.commandType === "RECOVER_PAIRING"
      ? { deviceToken: nextDeviceToken }
      : {}),
    live: true,
    ok: true
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : null;
}

function isOpaqueCredential(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{20,200}$/.test(value)
  );
}

async function readBoundedBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    contentLength < 0 ||
    (Number.isFinite(contentLength) && contentLength > maximumRequestBytes)
  ) {
    return null;
  }
  const rawBody = await request.text().catch(() => "");
  return new TextEncoder().encode(rawBody).byteLength <= maximumRequestBytes
    ? rawBody
    : null;
}

function parseCompletionBody(value: string) {
  try {
    const body = JSON.parse(value) as Record<string, unknown>;
    const commandId =
      typeof body.commandId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.commandId
      )
        ? body.commandId
        : null;
    const commandType =
      typeof body.commandType === "string" ? body.commandType : null;
    const failureCode =
      typeof body.failureCode === "string" &&
      /^[A-Z0-9_]{3,80}$/.test(body.failureCode)
        ? body.failureCode
        : null;
    const phase =
      body.phase === "acknowledged" ? "acknowledged" : "completed";
    return commandId
      ? { commandId, commandType, failureCode, phase }
      : null;
  } catch {
    return null;
  }
}

function parsePollResult(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { code: null, commands: [], ok: false };
  }
  const result = value as Record<string, unknown>;
  const commands = Array.isArray(result.commands)
    ? result.commands.flatMap((command) => {
        const normalized = normalizePlayerCommand(command);
        return normalized ? [normalized] : [];
      })
    : [];
  return {
    code: typeof result.code === "string" ? result.code : null,
    commands,
    ok: result.ok === true
  };
}

function normalizePlayerCommand(value: unknown): {
  commandType: string;
  createdAt: string;
  expiresAt: string;
  id: string;
  nonce: string;
  payload: Record<string, unknown>;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const command = value as Record<string, unknown>;
  const createdAt =
    typeof command.createdAt === "string"
      ? normalizePlayerTimestamp(command.createdAt)
      : null;
  const expiresAt =
    typeof command.expiresAt === "string"
      ? normalizePlayerTimestamp(command.expiresAt)
      : null;
  if (
    typeof command.id === "string" &&
    typeof command.nonce === "string" &&
    typeof command.commandType === "string" &&
    createdAt &&
    expiresAt &&
    Boolean(
      command.payload &&
      typeof command.payload === "object" &&
      !Array.isArray(command.payload)
    )
  ) {
    return {
      commandType: command.commandType,
      createdAt,
      expiresAt,
      id: command.id,
      nonce: command.nonce,
      payload: command.payload as Record<string, unknown>
    };
  }
  return null;
}

function parseCompletionResult(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      alreadyCompleted: false,
      code: null,
      commandType: null,
      ok: false
    };
  }
  const result = value as Record<string, unknown>;
  return {
    alreadyCompleted: result.alreadyCompleted === true,
    code: typeof result.code === "string" ? result.code : null,
    commandType:
      typeof result.commandType === "string" ? result.commandType : null,
    ok: result.ok === true
  };
}

function deterministicDeviceToken(
  commandId: string,
  installationCredential: string
) {
  return createHash("sha256")
    .update(`remote-recovery:${commandId}:${installationCredential}`)
    .digest("base64url");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function noStore(body: object) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" }
  });
}

function commandFailure(code: string, status: number) {
  return NextResponse.json(
    {
      error: {
        cause:
          code === "COMMAND_EXPIRED"
            ? "De Playeropdracht is verlopen."
            : code === "INVALID_INSTALLATION_CREDENTIAL"
              ? "De installatiecredential is ongeldig."
              : "De Playeropdracht kon niet veilig worden verwerkt.",
        code,
        effect: "Er is geen gedeeltelijke opdracht uitgevoerd.",
        recovery: "Control kan zo nodig een nieuwe eenmalige opdracht sturen."
      },
      ok: false
    },
    {
      headers: { "Cache-Control": "no-store" },
      status
    }
  );
}
