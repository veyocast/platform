import { VEYOCAST_APPS } from "@veyocast/config";
import Link from "next/link";

import { getControlRuntimeMode } from "../../lib/supabase/config";
import { signIn } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ fout?: string; reden?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const runtimeMode = getControlRuntimeMode();
  const live = runtimeMode === "live";
  const demo = runtimeMode === "demo";
  const { fout, reden } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="login-title">
        <div>
          <p className="auth-kicker">
            {demo ? "Lokale demoomgeving" : "Beveiligde beheeromgeving"}
          </p>
          <h1 className="auth-title" id="login-title">
            Inloggen bij {VEYOCAST_APPS.control.name}
          </h1>
        </div>
        <p className="auth-copy">
          {live
            ? "Log in met je VeyoCast-account. Je tenant- en platformrollen worden na het inloggen server-side geladen."
            : demo
              ? "De lokale demo draait zonder Supabase-account. Configureer Supabase om de live pilotflow te gebruiken."
              : "Inloggen is tijdelijk niet beschikbaar. De beheerconfiguratie kon niet veilig worden geladen."}
        </p>
        {fout && loginErrors[fout] ? (
          <div className="notice notice--warning" role="alert">{loginErrors[fout]}</div>
        ) : null}
        {reden ? (
          <div className="notice" role="status">
            {loginReasons[reden] ?? loginReasons.sessie}
          </div>
        ) : null}
        {runtimeMode !== "unavailable" ? <form
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
        </form> : (
          <div className="notice notice--critical" role="alert">
            De dienst weigert toegang totdat de serverconfiguratie is hersteld. Probeer later opnieuw.
          </div>
        )}
        {live ? <p className="auth-footnote">
          Uitgenodigd?{" "}
          <Link className="button-link button-link--secondary" href="/accept-invite">
            Invite accepteren
          </Link>
        </p> : null}
      </section>
    </main>
  );
}

const loginErrors: Record<string, string> = {
  gegevens: "Vul je e-mailadres en wachtwoord in.",
  inloggen: "Inloggen is mislukt. Controleer je gegevens en probeer opnieuw."
};

const loginReasons: Record<string, string> = {
  "geen-toegang": "Dit account heeft nog geen toegang tot VeyoCast Control. Vraag een beheerder om een rol toe te wijzen.",
  sessie: "Je sessie ontbreekt of is verlopen. Log opnieuw in.",
  uitgenodigd: "Je account is ingesteld. Log in met je nieuwe wachtwoord."
};
