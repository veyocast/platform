import Link from "next/link";

import { getControlSession } from "../../../lib/control-session";
import { isLiveSupabaseConfigured } from "../../../lib/supabase/config";

export default async function AuthCallbackPage() {
  const live = isLiveSupabaseConfigured();
  const session = live ? await getControlSession() : null;

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="callback-title">
        <div className="status-row">
          <span className="status-pill status-pill--success">
            <span className="status-pill__dot" aria-hidden="true" />
            Callback gereed
          </span>
        </div>
        <div>
          <p className="auth-kicker">Authenticatie</p>
          <h1 className="auth-title" id="callback-title">
            {live ? "Sessie gecontroleerd" : "Sessiecontrole voorbereid"}
          </h1>
        </div>
        <p className="auth-copy">
          {live
            ? `Je bent aangemeld als ${session?.email ?? "VeyoCast-gebruiker"}. Rollen en tenantcontext worden op de server gecontroleerd.`
            : "De callback-route is beschikbaar voor Supabase Auth. Zonder lokale configuratie gebruikt Control expliciete demorechten."}
        </p>
        {!live ? (
          <div className="notice" role="status">
            Oorzaak: authprovider is nog niet aangesloten. Effect: de shell draait
            met vaste ontwikkelrollen. Herstel: configureer de lokale Supabase-URL
            en anon key.
          </div>
        ) : null}
        <div className="page-actions">
          <Link className="button-link button-link--primary" href="/dashboard">
            Naar dashboard
          </Link>
          <Link className="button-link button-link--secondary" href="/login">
            Terug naar login
          </Link>
        </div>
      </section>
    </main>
  );
}
