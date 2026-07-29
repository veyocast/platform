"use client";

/* eslint-disable @next/next/no-img-element -- The locked compact SVG is rendered without transformation. */

import { useEffect, useState } from "react";

import {
  playerConnectivityEventName,
  readPlayerConnectivity,
  type PlayerConnectivityEvent
} from "../_lib/player-connectivity";
import { isAndroidPwaInstallEligible } from "../_lib/player-install-eligibility";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type AndroidInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

const installDismissedSessionKey = "veyocast.player.installPromptDismissed";

export function PlayerPwaControls() {
  return (
    <>
      <AndroidInstallPrompt />
      <OfflineStatusChip />
    </>
  );
}

function AndroidInstallPrompt() {
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<AndroidInstallPromptEvent | null>(null);
  const online = usePlayerOnlineStatus();

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      document.referrer.startsWith("android-app://");
    const androidBrowser = isAndroidPwaInstallEligible({
      referrer: document.referrer,
      standalone,
      userAgent: navigator.userAgent
    });

    setDismissed(readInstallDismissal());
    setEligible(androidBrowser && !standalone);
    function handleBeforeInstallPrompt(event: Event) {
      if (!androidBrowser || standalone) return;
      event.preventDefault();
      setInstallPrompt(event as AndroidInstallPromptEvent);
    }

    function handleInstalled() {
      dismissInstallPrompt();
      setInstallPrompt(null);
      void requestPersistentStorage();
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!eligible || dismissed || !online) return null;

  async function installPlayer() {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") {
        dismissInstallPrompt();
        void requestPersistentStorage();
      }
    } catch {
      setInstallPrompt(null);
    }
  }

  return (
    <aside className="pwa-install-card" aria-labelledby="pwa-install-title">
      <img
        alt=""
        className="pwa-install-card__icon"
        src="/brand/veyocast-icon-primary.svg"
      />
      <div className="pwa-install-card__content">
        <strong id="pwa-install-title">Installeer de Player</strong>
        <span>
          Start fullscreen vanaf je beginscherm en speel lokaal opgeslagen content
          ook zonder internet.
        </span>
        {installPrompt ? (
          <button className="pwa-install-card__action" onClick={installPlayer} type="button">
            Player installeren
          </button>
        ) : (
          <span className="pwa-install-card__instruction">
            Open het browsermenu en kies App installeren of Toevoegen aan startscherm.
          </span>
        )}
      </div>
      <button
        aria-label="Installatiemelding sluiten"
        className="pwa-install-card__close"
        onClick={dismissInstallPrompt}
        type="button"
      >
        ×
      </button>
    </aside>
  );

  function dismissInstallPrompt() {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(installDismissedSessionKey, "1");
    } catch {
      // A dismissal still applies to the current render when storage is unavailable.
    }
  }
}

function OfflineStatusChip() {
  const online = usePlayerOnlineStatus();

  if (online) return null;

  return (
    <div className="player-offline-chip" role="status">
      <span className="player-offline-chip__mark" aria-hidden="true" />
      Geen internetverbinding
    </div>
  );
}

function usePlayerOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    function updatePlayerConnection(event: Event) {
      setOnline((event as PlayerConnectivityEvent).detail.online);
    }

    setOnline(readPlayerConnectivity());
    window.addEventListener(playerConnectivityEventName, updatePlayerConnection);
    return () => {
      window.removeEventListener(playerConnectivityEventName, updatePlayerConnection);
    };
  }, []);

  return online;
}

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    // Cache Storage and IndexedDB remain available when persistence is not granted.
  }
}

function readInstallDismissal() {
  try {
    return window.sessionStorage.getItem(installDismissedSessionKey) === "1";
  } catch {
    return false;
  }
}
