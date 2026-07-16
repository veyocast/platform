import { CASTIVO_APPS, getLocalUrl } from "@castivo/config";

export default function PlayerPage() {
  return (
    <main className="runtime-shell">
      <section className="runtime-panel" aria-labelledby="player-title">
        <p className="runtime-kicker">{getLocalUrl("player")}</p>
        <h1 className="runtime-title" id="player-title">
          {CASTIVO_APPS.player.name}
        </h1>
        <p className="runtime-copy">
          Lokale S00-runtime voor de player-PWA. Pairing, manifests en offline
          playback blijven expliciet latere player-taken.
        </p>
      </section>
    </main>
  );
}
