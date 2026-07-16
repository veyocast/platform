import Link from "next/link";

export default function AuthCallbackPage() {
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
            Sessiecontrole voorbereid
          </h1>
        </div>
        <p className="auth-copy">
          De callback-route is beschikbaar voor Supabase Auth. Tot de echte
          sessieadapter landt, stuurt deze route door naar de Control-shell met
          expliciete platform- en tenantplaceholderrechten.
        </p>
        <div className="notice" role="status">
          Oorzaak: authprovider is nog niet aangesloten. Effect: de shell draait
          met vaste ontwikkelrollen. Herstel: S04 koppelt deze route aan de
          server-side sessie en RLS-claims.
        </div>
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
