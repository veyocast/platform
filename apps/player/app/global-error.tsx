"use client";

import { playerClientFallbackCode } from "./_lib/player-client-fallback";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="nl">
      <body>
        <main
          aria-labelledby="global-player-error-title"
          style={{
            alignItems: "center",
            background: "var(--vc-brand-ink-black, Canvas)",
            color: "var(--vc-brand-paper-white, CanvasText)",
            display: "flex",
            fontFamily: "system-ui, sans-serif",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "6vw"
          }}
        >
          <section style={{ maxWidth: 760, width: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- locked brand fallback */}
            <img
              alt="VeyoCast"
              src="/brand/veyocast-logo-inverse.svg"
              style={{ marginBottom: 32, maxWidth: 230, width: "46%" }}
            />
            <h1 id="global-player-error-title">De Player kon niet veilig starten</h1>
            <p>Foutcode: {playerClientFallbackCode}</p>
            <p>De bestaande koppeling en lokale release zijn niet verwijderd.</p>
            <button onClick={reset} type="button">Opnieuw proberen</button>{" "}
            <a href="/lg/recover">Player herstellen</a>
          </section>
        </main>
      </body>
    </html>
  );
}
