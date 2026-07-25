export const lgSignageBridgeProtocolVersion = 1;
export const lgSignageWrapperOrigin = "null";
export const lgSignageCapabilitiesStorageKey =
  "veyocast.player.lgSignageCapabilities";

export type LgSignageCapabilities = {
  adapter: "web-standard" | "webos-signage";
  appId: string;
  appVersion: string;
  features: {
    idcapDetected: boolean;
    indexedDb: boolean;
    mediaCapabilities: boolean;
    networkEvents: boolean;
    pageVisibility: boolean;
    scapDetected: boolean;
    serviceWorker: boolean;
    storageEstimate: boolean;
  };
  platform: "lg-webos-signage";
  platformInfo: {
    displayHeight: number;
    displayWidth: number;
    firmwareVersion: string | null;
    language: string | null;
    orientation: "landscape" | "portrait" | "unknown";
    webOsDetected: boolean;
    webOsVersion: string | null;
  };
  protocolVersion: number;
};

export type LgSignageWrapperMessage =
  | {
      capabilities: LgSignageCapabilities;
      type: "VEYOCAST_LG_CAPABILITIES";
    }
  | {
      reason: "app-resume" | "network-recovery";
      type: "VEYOCAST_LG_RESUME";
    };

export type LgSignagePlayerMessage =
  | {
      path: "/lg";
      protocolVersion: number;
      type: "VEYOCAST_LG_PLAYER_READY";
    }
  | {
      command:
        | "back"
        | "down"
        | "enter"
        | "left"
        | "play"
        | "play-pause"
        | "right"
        | "up";
      type: "VEYOCAST_LG_REMOTE_INPUT";
    }
  | {
      online: boolean;
      type: "VEYOCAST_LG_PLAYER_CONNECTIVITY";
    };

export type LgSignageRemoteCommand = Extract<
  LgSignagePlayerMessage,
  { type: "VEYOCAST_LG_REMOTE_INPUT" }
>["command"];

export function isTrustedLgWrapperMessage(
  event: Pick<MessageEvent, "data" | "origin" | "source">,
  expectedSource: Window
): event is MessageEvent<LgSignageWrapperMessage> {
  if (event.origin !== lgSignageWrapperOrigin || event.source !== expectedSource) {
    return false;
  }

  if (!isRecord(event.data) || typeof event.data.type !== "string") {
    return false;
  }

  if (event.data.type === "VEYOCAST_LG_RESUME") {
    return (
      event.data.reason === "app-resume" ||
      event.data.reason === "network-recovery"
    );
  }

  return (
    event.data.type === "VEYOCAST_LG_CAPABILITIES" &&
    isLgSignageCapabilities(event.data.capabilities)
  );
}

export function isLgSignageCapabilities(
  value: unknown
): value is LgSignageCapabilities {
  if (
    !isRecord(value) ||
    !isRecord(value.features) ||
    !isRecord(value.platformInfo)
  ) {
    return false;
  }

  const features = value.features;
  const platformInfo = value.platformInfo;
  return (
    (value.adapter === "web-standard" || value.adapter === "webos-signage") &&
    value.appId === "nl.veyocast.player.webos" &&
    typeof value.appVersion === "string" &&
    value.platform === "lg-webos-signage" &&
    value.protocolVersion === lgSignageBridgeProtocolVersion &&
    typeof platformInfo.displayHeight === "number" &&
    typeof platformInfo.displayWidth === "number" &&
    (platformInfo.firmwareVersion === null ||
      typeof platformInfo.firmwareVersion === "string") &&
    (platformInfo.language === null ||
      typeof platformInfo.language === "string") &&
    (platformInfo.orientation === "landscape" ||
      platformInfo.orientation === "portrait" ||
      platformInfo.orientation === "unknown") &&
    typeof platformInfo.webOsDetected === "boolean" &&
    (platformInfo.webOsVersion === null ||
      typeof platformInfo.webOsVersion === "string") &&
    [
      "idcapDetected",
      "indexedDb",
      "mediaCapabilities",
      "networkEvents",
      "pageVisibility",
      "scapDetected",
      "serviceWorker",
      "storageEstimate"
    ].every((key) => typeof features[key] === "boolean")
  );
}

export function resolveLgRemoteCommand(event: {
  code?: string;
  key?: string;
  keyCode?: number;
}): LgSignageRemoteCommand | null {
  const key = event.key ?? "";
  const code = event.code ?? "";
  const keyCode = event.keyCode ?? 0;

  if (
    key === "GoBack" ||
    key === "BrowserBack" ||
    code === "BrowserBack" ||
    keyCode === 461
  ) {
    return "back";
  }
  if (key === "Enter" || code === "Enter" || keyCode === 13) return "enter";
  if (key === "ArrowLeft" || keyCode === 37) return "left";
  if (key === "ArrowUp" || keyCode === 38) return "up";
  if (key === "ArrowRight" || keyCode === 39) return "right";
  if (key === "ArrowDown" || keyCode === 40) return "down";
  if (key === "MediaPlayPause" || keyCode === 179) return "play-pause";
  if (key === "MediaPlay" || keyCode === 415) return "play";
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
