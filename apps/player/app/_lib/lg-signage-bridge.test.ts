import { describe, expect, it } from "vitest";

import {
  isLgSignageCapabilities,
  isTrustedLgWrapperMessage,
  lgSignageBridgeProtocolVersion,
  resolveLgRemoteCommand
} from "./lg-signage-bridge";

const capabilities = {
  adapter: "web-standard",
  appId: "nl.veyocast.player.webos",
  appVersion: "1.0.0",
  features: {
    idcapDetected: false,
    indexedDb: true,
    mediaCapabilities: true,
    networkEvents: true,
    pageVisibility: true,
    scapDetected: false,
    serviceWorker: true,
    storageEstimate: true
  },
  platform: "lg-webos-signage",
  platformInfo: {
    displayHeight: 1080,
    displayWidth: 1920,
    firmwareVersion: null,
    language: "nl-NL",
    orientation: "landscape",
    webOsDetected: true,
    webOsVersion: null
  },
  protocolVersion: lgSignageBridgeProtocolVersion
} as const;

describe("LG Signage bridge", () => {
  it("accepts only the expected local wrapper source and capability contract", () => {
    const source = {} as Window;
    expect(
      isTrustedLgWrapperMessage(
        {
          data: { capabilities, type: "VEYOCAST_LG_CAPABILITIES" },
          origin: "null",
          source
        },
        source
      )
    ).toBe(true);
    expect(
      isTrustedLgWrapperMessage(
        {
          data: { capabilities, type: "VEYOCAST_LG_CAPABILITIES" },
          origin: "https://example.org",
          source
        },
        source
      )
    ).toBe(false);
    expect(isLgSignageCapabilities({ ...capabilities, appId: "other.app" })).toBe(
      false
    );
  });

  it("maps standard and LG remote key events without treating unknown keys as commands", () => {
    expect(resolveLgRemoteCommand({ key: "Enter" })).toBe("enter");
    expect(resolveLgRemoteCommand({ key: "ArrowLeft" })).toBe("left");
    expect(resolveLgRemoteCommand({ keyCode: 461 })).toBe("back");
    expect(resolveLgRemoteCommand({ key: "MediaPlayPause" })).toBe("play-pause");
    expect(resolveLgRemoteCommand({ key: "a" })).toBeNull();
  });
});
