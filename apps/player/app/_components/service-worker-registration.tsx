"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegistration() {
  const [updateStatus, setUpdateStatus] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function handleMessage(event: MessageEvent) {
      const data = event.data as { cacheVersion?: string; type?: string } | null;
      if (data?.type === "CASTIVO_SW_ACTIVATED") {
        setUpdateStatus(`Player-shell ${data.cacheVersion ?? "actief"} is bijgewerkt.`);
      }
    }

    navigator.serviceWorker.addEventListener("message", handleMessage);
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => registration.update())
      .catch(() => {
        setUpdateStatus("Service-workerupdate kon niet worden gecontroleerd.");
      });

    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []);

  return updateStatus ? (
    <span className="sr-only" aria-live="polite">
      {updateStatus}
    </span>
  ) : null;
}
