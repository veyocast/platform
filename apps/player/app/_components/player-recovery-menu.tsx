"use client";

import { useEffect, useRef } from "react";

type PlayerRecoveryMenuProps = {
  installationId: string;
  lastErrorCode: string;
  networkStatus: string;
  onClose: () => void;
  onNewPairing: () => void;
  onRetry: () => void;
  playerVersion: string;
  transportDiagnostic: string;
};

export function PlayerRecoveryMenu({
  installationId,
  lastErrorCode,
  networkStatus,
  onClose,
  onNewPairing,
  onRetry,
  playerVersion,
  transportDiagnostic
}: PlayerRecoveryMenuProps) {
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstActionRef.current?.focus();

    function handleKeydown(event: KeyboardEvent) {
      if (
        event.key === "Escape" ||
        event.key === "BrowserBack" ||
        event.key === "GoBack" ||
        event.keyCode === 461
      ) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const buttons = [
        ...document.querySelectorAll<HTMLButtonElement>(
          ".player-recovery-menu button"
        )
      ];
      const currentIndex = buttons.indexOf(
        document.activeElement as HTMLButtonElement
      );
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        (Math.max(0, currentIndex) + direction + buttons.length) %
        buttons.length;
      event.preventDefault();
      buttons[nextIndex]?.focus();
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onClose]);

  return (
    <div
      aria-labelledby="player-recovery-menu-title"
      aria-modal="true"
      className="player-recovery-menu"
      role="dialog"
    >
      <section className="player-recovery-menu__panel">
        <p className="runtime-kicker">Lokaal beheer</p>
        <h1 id="player-recovery-menu-title">VeyoCast Player herstellen</h1>
        <p>
          Kies één gerichte actie. Een tijdelijke storing verwijdert nooit
          automatisch een geldige koppeling.
        </p>
        <div className="player-recovery-menu__actions">
          <button onClick={onRetry} ref={firstActionRef} type="button">
            Opnieuw proberen
          </button>
          <button onClick={onNewPairing} type="button">
            Nieuwe koppelcode aanvragen
          </button>
          <button onClick={() => window.location.reload()} type="button">
            Player opnieuw laden
          </button>
          <button
            onClick={() => window.location.assign("/lg/recover")}
            type="button"
          >
            Lokale cache herstellen
          </button>
          <button onClick={onClose} type="button">
            Sluiten
          </button>
        </div>
        <dl className="player-recovery-menu__diagnostics">
          <div><dt>Netwerkstatus</dt><dd>{networkStatus}</dd></div>
          <div><dt>Installatie-ID</dt><dd>{installationId}</dd></div>
          <div><dt>Player-versie</dt><dd>{playerVersion}</dd></div>
          <div><dt>Laatste foutcode</dt><dd>{lastErrorCode}</dd></div>
          <div><dt>Laatste API-aanvraag</dt><dd>{transportDiagnostic}</dd></div>
        </dl>
      </section>
    </div>
  );
}
