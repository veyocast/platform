import { CASTIVO_APPS } from "@castivo/config";

const pairingCode = "CTV 482";

export default function PlayerPage() {
  return (
    <main className="runtime-shell">
      <section className="runtime-panel" aria-labelledby="player-title">
        <p className="runtime-kicker">Device boot shell</p>
        <h1 className="runtime-title" id="player-title">
          {CASTIVO_APPS.player.name} pairing
        </h1>
        <p className="runtime-copy">
          Deze player is nog niet gekoppeld. Voer de pairingcode in Castivo
          Control in om een revocable device session aan dit scherm te koppelen.
        </p>
        <div className="player-pairing-code" aria-label="Pairingcode">
          {pairingCode}
        </div>
        <dl className="player-diagnostics" aria-label="Device setupstatus">
          <div>
            <dt>State</dt>
            <dd>UNPAIRED</dd>
          </div>
          <div>
            <dt>Sessie</dt>
            <dd>Geen Supabase Auth-user</dd>
          </div>
          <div>
            <dt>Volgende stap</dt>
            <dd>Wachten op `claim_pairing_session`</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
