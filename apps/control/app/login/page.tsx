import { CASTIVO_APPS, getLocalUrl } from "@castivo/config";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="login-title">
        <div>
          <p className="auth-kicker">{getLocalUrl("control")}</p>
          <h1 className="auth-title" id="login-title">
            Inloggen bij {CASTIVO_APPS.control.name}
          </h1>
        </div>
        <p className="auth-copy">
          Deze route staat klaar voor Supabase Auth. S03 levert de shell en
          callback, S04/S05 koppelen de sessie aan tenantdata en domeinrechten.
        </p>
        <form className="auth-form" action="/auth/callback" method="get">
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
          <div className="field">
            <label htmlFor="tenant">Tenant</label>
            <input
              autoComplete="organization"
              id="tenant"
              name="tenant"
              placeholder="bijvoorbeeld centrum-noord"
              type="text"
            />
            <p>Laat leeg voor platformrollen.</p>
          </div>
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
