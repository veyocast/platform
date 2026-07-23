"use client";

import { CloudOff, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

import styles from "./control-pwa-runtime.module.css";

type UpdateState = "idle" | "ready";

export function ControlPwaRuntime() {
  const [isOnline, setIsOnline] = useState(true);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>("idle");

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((nextRegistration) => {
          setRegistration(nextRegistration);
          if (nextRegistration.waiting) setUpdateState("ready");
          nextRegistration.addEventListener("updatefound", () => {
            const installing = nextRegistration.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setUpdateState("ready");
              }
            });
          });
          return nextRegistration.update();
        })
        .catch(() => {
          // The authenticated product remains usable online without a service worker.
        });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    function handleControllerChange() {
      window.location.reload();
    }
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);
    return () => navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
  }, []);

  function activateUpdate() {
    registration?.waiting?.postMessage({ type: "VEYOCAST_CONTROL_SKIP_WAITING" });
  }

  if (!isOnline) {
    return (
      <div className={styles.toast} data-kind="offline" role="status">
        <CloudOff aria-hidden="true" />
        <span>
          <strong>Geen internetverbinding</strong>
          <small>Bekijken kan beperkt doorgaan. Wijzigingen en publicaties wachten op een bevestigde verbinding.</small>
        </span>
      </div>
    );
  }

  if (updateState === "ready") {
    return (
      <div className={styles.toast} data-kind="update" role="status">
        <RefreshCw aria-hidden="true" />
        <span>
          <strong>VeyoCast is bijgewerkt</strong>
          <small>Herlaad om de nieuwste veilige versie te gebruiken.</small>
        </span>
        <button onClick={activateUpdate} type="button">Nu herladen</button>
        <button
          aria-label="Updatemelding sluiten"
          onClick={() => setUpdateState("idle")}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    );
  }

  return null;
}
