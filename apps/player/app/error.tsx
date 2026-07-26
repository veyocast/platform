"use client";

import { useEffect } from "react";

import { playerClientFallbackCode } from "./_lib/player-client-fallback";

export default function PlayerError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("VeyoCast Player client boundary", {
      code: playerClientFallbackCode,
      digest: error.digest
    });
  }, [error]);

  return (
    <main className="runtime-shell runtime-shell--setup" aria-label="VeyoCast player herstel">
      <section className="runtime-panel runtime-panel--branded">
        {/* eslint-disable-next-line @next/next/no-img-element -- locked brand fallback */}
        <img alt="VeyoCast" className="pairing-logo" src="/brand/veyocast-logo-inverse.svg" />
        <p className="runtime-kicker">Playerherstel</p>
        <h1 className="runtime-title">De Player kon niet veilig starten</h1>
        <div className="runtime-problem" role="alert">
          <p><strong>Foutcode:</strong> {playerClientFallbackCode}</p>
          <p>De bestaande koppeling en last-known-good release zijn niet verwijderd.</p>
        </div>
        <div className="player-recovery-menu__actions">
          <button onClick={reset} type="button">Opnieuw proberen</button>
          <button onClick={() => window.location.assign("/lg/recover")} type="button">
            Player herstellen
          </button>
        </div>
      </section>
    </main>
  );
}
