import {
  mobileApiErrorEnvelopeSchema,
  mobileCockpitEnvelopeSchema,
  mobileContentEnvelopeSchema,
  mobileDeletionRequestsEnvelopeSchema,
  mobileNotificationPreferencesEnvelopeSchema,
  mobilePairingClaimSchema,
  mobilePlayerCommandSchema,
  mobileScreensEnvelopeSchema,
  mobileSessionEnvelopeSchema,
  type MobilePairingClaimRequest,
  type MobilePlayerCommandRequest,
  type MobileDeviceRegistration,
  type MobileNotificationPreferences,
  type MobileCreatePlaylistRequest,
  type MobileCreateScreenRequest,
  type MobilePlaylistMutationRequest,
  type MobilePlaylistPublishRequest,
  mobilePlaylistDetailSchema,
  mobilePlaylistMutationResultSchema,
  mobilePlaylistPublishResultSchema
} from "@veyocast/contracts";
import { z } from "zod";

import { readMobileRuntimeConfig } from "../config/runtime";
import { mobileSupabase } from "../auth/supabase";

export class MobileApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly recovery: string,
    readonly requestId: string | null,
    readonly status: number
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

const dataEnvelope = <T extends z.ZodType>(schema: T) =>
  z.object({
    data: schema,
    meta: z.object({
      requestId: z.string(),
      version: z.string()
    })
  });

export const mobileApi = {
  cockpit(tenantId: string) {
    return request(
      "/api/mobile/v1/cockpit",
      mobileCockpitEnvelopeSchema,
      { tenantId }
    ).then((response) => response.data);
  },
  createPlaylist(tenantId: string, input: MobileCreatePlaylistRequest) {
    return request(
      "/api/mobile/v1/playlists",
      dataEnvelope(z.object({ playlistId: z.string().uuid() })),
      { body: input, method: "POST", tenantId }
    ).then((response) => response.data);
  },
  createScreen(tenantId: string, input: MobileCreateScreenRequest) {
    return request(
      "/api/mobile/v1/screens",
      dataEnvelope(z.object({ screenId: z.string().uuid() })),
      { body: input, method: "POST", tenantId }
    ).then((response) => response.data);
  },
  content(tenantId: string) {
    return request(
      "/api/mobile/v1/content",
      mobileContentEnvelopeSchema,
      { tenantId }
    ).then((response) => response.data);
  },
  deletionRequests() {
    return request(
      "/api/mobile/v1/account/deletion",
      mobileDeletionRequestsEnvelopeSchema
    ).then((response) => response.data);
  },
  notificationPreferences(tenantId: string) {
    return request(
      "/api/mobile/v1/notifications/preferences",
      mobileNotificationPreferencesEnvelopeSchema,
      { tenantId }
    ).then((response) => response.data);
  },
  playlist(tenantId: string, playlistId: string) {
    return request(
      `/api/mobile/v1/playlists/${playlistId}`,
      dataEnvelope(mobilePlaylistDetailSchema),
      { tenantId }
    ).then((response) => response.data);
  },
  mutatePlaylist(
    tenantId: string,
    playlistId: string,
    input: MobilePlaylistMutationRequest
  ) {
    return request(
      `/api/mobile/v1/playlists/${playlistId}`,
      dataEnvelope(mobilePlaylistMutationResultSchema),
      { body: input, method: "POST", tenantId }
    ).then((response) => response.data);
  },
  publishPlaylist(
    tenantId: string,
    playlistId: string,
    input: MobilePlaylistPublishRequest
  ) {
    return request(
      `/api/mobile/v1/playlists/${playlistId}/publish`,
      dataEnvelope(mobilePlaylistPublishResultSchema),
      { body: input, method: "POST", tenantId }
    ).then((response) => response.data);
  },
  registerNotificationDevice(
    input: MobileDeviceRegistration
  ) {
    return request(
      "/api/mobile/v1/notifications/device",
      dataEnvelope(z.object({ deviceId: z.string().uuid() })),
      { body: input, method: "POST" }
    ).then((response) => response.data);
  },
  revokeNotificationDevice(deviceId: string) {
    return request(
      "/api/mobile/v1/notifications/device",
      dataEnvelope(z.object({ revoked: z.boolean() })),
      { body: { deviceId }, method: "DELETE" }
    ).then((response) => response.data);
  },
  requestAccountDeletion(reason?: string) {
    return request(
      "/api/mobile/v1/account/deletion",
      dataEnvelope(
        z.object({
          requestId: z.string().uuid().nullable(),
          requestNumber: z.number().int().positive().nullable(),
          status: z.literal("requested")
        })
      ),
      { body: { reason }, method: "POST" }
    ).then((response) => response.data);
  },
  updateNotificationPreferences(
    tenantId: string,
    input: MobileNotificationPreferences
  ) {
    return request(
      "/api/mobile/v1/notifications/preferences",
      mobileNotificationPreferencesEnvelopeSchema,
      { body: input, method: "PUT", tenantId }
    ).then((response) => response.data);
  },
  async uploadImage(
    tenantId: string,
    input: {
      fileName: string;
      mimeType: "image/jpeg" | "image/png" | "image/webp";
      title: string;
      uri: string;
    }
  ) {
    const runtime = readMobileRuntimeConfig();
    if (!runtime.config || !mobileSupabase) {
      throw new MobileApiError(
        "APP_CONFIGURATION_INVALID",
        runtime.error ?? "De beveiligde appconfiguratie ontbreekt.",
        "Installeer een geldige VeyoCast Control-build.",
        null,
        503
      );
    }
    const {
      data: { session }
    } = await mobileSupabase.auth.getSession();
    if (!session?.access_token) {
      throw new MobileApiError(
        "UNAUTHENTICATED",
        "Je sessie is verlopen.",
        "Log opnieuw in.",
        null,
        401
      );
    }
    const form = new FormData();
    form.append("title", input.title);
    form.append(
      "media",
      {
        name: input.fileName,
        type: input.mimeType,
        uri: input.uri
      } as unknown as Blob
    );
    const response = await fetch(
      `${runtime.config.controlOrigin}/api/mobile/v1/media/images`,
      {
        body: form,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-VeyoCast-Tenant-Id": tenantId
        },
        method: "POST"
      }
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = mobileApiErrorEnvelopeSchema.safeParse(payload);
      throw new MobileApiError(
        parsed.success ? parsed.data.error.code : "UPLOAD_FAILED",
        parsed.success
          ? parsed.data.error.message
          : "De afbeelding kon niet worden geüpload.",
        parsed.success
          ? parsed.data.error.recovery
          : "Controleer je verbinding en probeer opnieuw.",
        parsed.success ? parsed.data.error.requestId ?? null : null,
        response.status
      );
    }
    return dataEnvelope(
      z.object({
        assetId: z.string().uuid(),
        title: z.string()
      })
    ).parse(payload).data;
  },
  claimPairing(tenantId: string, input: MobilePairingClaimRequest) {
    return request(
      "/api/mobile/v1/pairing/claim",
      dataEnvelope(mobilePairingClaimSchema),
      { body: input, method: "POST", tenantId }
    ).then((response) => response.data);
  },
  command(tenantId: string, input: MobilePlayerCommandRequest) {
    return request(
      "/api/mobile/v1/screens/commands",
      dataEnvelope(mobilePlayerCommandSchema),
      { body: input, method: "POST", tenantId }
    ).then((response) => response.data);
  },
  screens(tenantId: string) {
    return request(
      "/api/mobile/v1/screens",
      mobileScreensEnvelopeSchema,
      { tenantId }
    ).then((response) => response.data);
  },
  session() {
    return request("/api/mobile/v1/session", mobileSessionEnvelopeSchema).then(
      (response) => response.data
    );
  }
};

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    body?: unknown;
    method?: "DELETE" | "GET" | "POST" | "PUT";
    tenantId?: string;
  } = {}
): Promise<T> {
  const runtime = readMobileRuntimeConfig();
  if (!runtime.config || !mobileSupabase) {
    throw new MobileApiError(
      "APP_CONFIGURATION_INVALID",
      runtime.error ?? "De beveiligde appconfiguratie ontbreekt.",
      "Installeer een geldige VeyoCast Control-build.",
      null,
      503
    );
  }
  const {
    data: { session }
  } = await mobileSupabase.auth.getSession();
  if (!session?.access_token) {
    throw new MobileApiError(
      "UNAUTHENTICATED",
      "Je sessie is verlopen.",
      "Log opnieuw in.",
      null,
      401
    );
  }
  const response = await fetch(`${runtime.config.controlOrigin}${path}`, {
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.tenantId
        ? { "X-VeyoCast-Tenant-Id": options.tenantId }
        : {})
    },
    method: options.method ?? "GET"
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsedError = mobileApiErrorEnvelopeSchema.safeParse(payload);
    if (parsedError.success) {
      throw new MobileApiError(
        parsedError.data.error.code,
        parsedError.data.error.message,
        parsedError.data.error.recovery,
        parsedError.data.error.requestId ?? null,
        response.status
      );
    }
    throw new MobileApiError(
      "API_RESPONSE_INVALID",
      "De VeyoCast API gaf geen geldige reactie.",
      "Controleer je verbinding en probeer het opnieuw.",
      response.headers.get("x-request-id"),
      response.status
    );
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new MobileApiError(
      "API_CONTRACT_MISMATCH",
      "De app en VeyoCast API gebruiken niet dezelfde gegevensversie.",
      "Werk de app bij en probeer het opnieuw.",
      null,
      503
    );
  }
  return parsed.data;
}
