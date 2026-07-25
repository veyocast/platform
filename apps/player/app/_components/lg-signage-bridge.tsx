"use client";

import { useEffect } from "react";

import {
  isTrustedLgWrapperMessage,
  lgSignageBridgeProtocolVersion,
  lgSignageCapabilitiesStorageKey,
  resolveLgRemoteCommand,
  type LgSignagePlayerMessage
} from "../_lib/lg-signage-bridge";
import {
  playerConnectivityEventName,
  readPlayerConnectivity,
  type PlayerConnectivityEvent
} from "../_lib/player-connectivity";

export function LgSignageBridge() {
  useEffect(() => {
    if (window.parent === window) return;

    const wrapper = window.parent;
    postToWrapper({
      path: "/lg",
      protocolVersion: lgSignageBridgeProtocolVersion,
      type: "VEYOCAST_LG_PLAYER_READY"
    });
    postConnectivity(readPlayerConnectivity());

    function handleWrapperMessage(event: MessageEvent) {
      if (!isTrustedLgWrapperMessage(event, wrapper)) return;

      if (event.data.type === "VEYOCAST_LG_CAPABILITIES") {
        try {
          window.sessionStorage.setItem(
            lgSignageCapabilitiesStorageKey,
            JSON.stringify(event.data.capabilities)
          );
        } catch {
          // Runtime capability delivery remains available through the custom event.
        }
        window.dispatchEvent(
          new CustomEvent("veyocast:lg-capabilities", {
            detail: event.data.capabilities
          })
        );
        return;
      }

      window.dispatchEvent(
        new CustomEvent("veyocast:lg-resume", {
          detail: { reason: event.data.reason }
        })
      );
      resumeMarkedMedia();
    }

    function handleRemoteInput(event: KeyboardEvent) {
      const command = resolveLgRemoteCommand(event);
      if (!command) return;

      postToWrapper({
        command,
        type: "VEYOCAST_LG_REMOTE_INPUT"
      });

      if (command === "back") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (
        (command === "enter" ||
          command === "play" ||
          command === "play-pause") &&
        document.querySelector(".playback-shell")
      ) {
        const media = findActiveMedia();
        if (!media) return;
        event.preventDefault();
        if (command === "play") {
          void media.play().catch(() => undefined);
        } else if (media.paused) {
          void media.play().catch(() => undefined);
        } else {
          media.pause();
        }
      }
    }

    function handleConnectivity(event: Event) {
      postConnectivity((event as PlayerConnectivityEvent).detail.online);
    }

    function handleVisibility() {
      if (document.visibilityState !== "visible") {
        markPlayingMediaForResume();
        return;
      }
      resumeMarkedMedia();
      postConnectivity(readPlayerConnectivity());
    }

    window.addEventListener("message", handleWrapperMessage);
    window.addEventListener("keydown", handleRemoteInput, true);
    window.addEventListener(playerConnectivityEventName, handleConnectivity);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("message", handleWrapperMessage);
      window.removeEventListener("keydown", handleRemoteInput, true);
      window.removeEventListener(playerConnectivityEventName, handleConnectivity);
      document.removeEventListener("visibilitychange", handleVisibility);
    };

    function postConnectivity(online: boolean) {
      postToWrapper({
        online,
        type: "VEYOCAST_LG_PLAYER_CONNECTIVITY"
      });
    }

    function postToWrapper(message: LgSignagePlayerMessage) {
      wrapper.postMessage(message, "*");
    }
  }, []);

  return null;
}

function findActiveMedia() {
  return [...document.querySelectorAll<HTMLMediaElement>("video, audio")].find(
    (candidate) =>
      candidate.isConnected &&
      !candidate.ended &&
      candidate.getClientRects().length > 0
  );
}

function markPlayingMediaForResume() {
  document.querySelectorAll<HTMLMediaElement>("video, audio").forEach((media) => {
    if (!media.paused && !media.ended) {
      media.dataset.veyocastLgResume = "1";
      media.pause();
    }
  });
}

function resumeMarkedMedia() {
  document
    .querySelectorAll<HTMLMediaElement>(
      'video[data-veyocast-lg-resume="1"], audio[data-veyocast-lg-resume="1"]'
    )
    .forEach((media) => {
      delete media.dataset.veyocastLgResume;
      void media.play().catch(() => undefined);
    });
}
