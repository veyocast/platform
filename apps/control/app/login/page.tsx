import { VEYOCAST_APPS, getLocalUrl } from "@veyocast/config";
import Link from "next/link";

import { isLiveSupabaseConfigured } from "../../lib/supabase/config";
import { signIn } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ fout?: string; reden?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const live = isLiveSupabaseConfigured();
  const { fout, reden } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="login-title">
        <div>
          <p className="auth-kicker">{getLocalUrl("control")}</p>
          <h1 className="auth-title" id="login-title">
            Inloggen bij {VEYOCAST_APPS.control.name}
          </h1>
        </div>
        <p className="auth-copy">
          {live
            ? "Log in met je VeyoCast-account. Je tenant- en platformrollen worden na het inloggen server-side geladen."
            : "De demo draait zonder lokale Supabase-configuratie. Start de database en vul de lokale omgevingswaarden in om de live pilotflow te gebruiken."}
        </p>
        {fout ? <div className="notice notice--warning" role="alert">{fout}</div> : null}
        {reden ? (
          <div className="notice" role="status">
            Je sessie ontbreekt of is verlopen. Log opnieuw in.
          </div>
        ) : null}
        <form
          className="auth-form"
          action={live ? signIn : "/auth/callback"}
          method={live ? undefined : "get"}
        >
          <div className="field">
            <label htmlFor="email">E-mailadres</label>
            <input
              autoComplete="email"
              id="email"
              name="email"
              placeholder="naam@organisatie.nl"
              required
              type="email"
            />
          </div>
          {live ? (
            <div className="field">
              <label htmlFor="password">Wachtwoord</label>
              <input
                autoComplete="current-password"
                id="password"
                name="password"
                required
                type="password"
              />
            </div>
          ) : <div className="field">
            <label htmlFor="tenant">Tenant</label>
            <input
              autoComplete="organization"
              id="tenant"
              name="tenant"
              placeholder="bijvoorbeeld centrum-noord"
              type="text"
            />
            <p>Laat leeg voor platformrollen.</p>
          </div>}
          <button className="auth-button" type="submit">
            Doorgaan
          </button>
        </form>
        <p className="auth-footnote">
          Uitgenodigd?{" "}
          <Link className="button-link button-link--secondary" href="/accept-invite">
            Invite accepteren
          </Link>
        </p>
      </section>
    </main>
  );
}
