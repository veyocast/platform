import Link from "next/link";

import { AuthBrand } from "../../_components/auth-brand";
import {
  getControlLandingPath,
  getControlSession
} from "../../../lib/control-session";
import { getControlRuntimeMode } from "../../../lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function AuthCallbackPage() {
  const runtimeMode = getControlRuntimeMode();
  const live = runtimeMode === "live";
  const session = live ? await getControlSession() : null;

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="callback-title">
        <AuthBrand />
        <div className="status-row">
          <span className="status-pill status-pill--success">
            <span className="status-pill__dot" aria-hidden="true" />
            Callback gereed
          </span>
        </div>
        <div>
          <p className="auth-kicker">Authenticatie</p>
          <h1 className="auth-title" id="callback-title">
            {live ? "Sessie gecontroleerd" : runtimeMode === "demo" ? "Sessiecontrole voorbereid" : "Sessie niet beschikbaar"}
          </h1>
        </div>
        <p className="auth-copy">
          {live
            ? `Je bent aangemeld als ${session?.email ?? "VeyoCast-gebruiker"}. Rollen en tenantcontext worden op de server gecontroleerd.`
            : runtimeMode === "demo"
              ? "De callback-route is beschikbaar voor Supabase Auth. Deze ontwikkelserver gebruikt expliciete demorechten."
              : "De serverconfiguratie ontbreekt. Er is geen demosessie aangemaakt."}
        </p>
        {runtimeMode === "demo" ? (
          <div className="notice" role="status">
            Oorzaak: authprovider is nog niet aangesloten. Effect: de shell draait
            met vaste ontwikkelrollen. Herstel: configureer de lokale Supabase-URL
            en anon key.
          </div>
        ) : null}
        <div className="page-actions">
          <Link className="button-link button-link--primary" href={session ? getControlLandingPath(session) : runtimeMode === "demo" ? "/dashboard" : "/login"}>
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
