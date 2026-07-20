import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getControlPostMfaLandingPath,
  requireControlSession
} from "../../../lib/control-session";
import { createControlSupabaseClient } from "../../../lib/supabase/server";
import { safeControlReturnPath } from "../../../lib/tenant-context";
import { removeMfaFactor, verifyMfaFactor } from "./actions";
import { MfaEnrollmentForm } from "./enrollment-form";

type MfaPageProps = Readonly<{
  searchParams: Promise<{ fout?: string; reden?: string; succes?: string; terug?: string }>;
}>;

export const dynamic = "force-dynamic";

export default async function MfaPage({ searchParams }: MfaPageProps) {
  const session = await requireControlSession();
  const params = await searchParams;
  const returnTo = safeControlReturnPath(params.terug, getControlPostMfaLandingPath(session));
  const supabase = await createControlSupabaseClient();

  if (!supabase) {
    redirect("/login?reden=sessie");
  }

  const { data, error } = await supabase.auth.mfa.listFactors();
  const verifiedFactors = (data?.totp ?? []).filter((factor) => factor.status === "verified");
  const canEnrollFactor =
    verifiedFactors.length === 0 || session.assuranceLevel === "aal2";

  return (
    <main className="auth-shell">
      <section className="auth-panel auth-panel--wide" aria-labelledby="mfa-title">
        <div>
          <p className="auth-kicker">Accountbeveiliging</p>
          <h1 className="auth-title" id="mfa-title">Tweestapsverificatie</h1>
        </div>
        <p className="auth-copy">
          Bevestig gevoelige platformwijzigingen met een authenticator-app. Registreer bij voorkeur twee factoren, zodat een tweede apparaat als herstelroute beschikbaar blijft.
        </p>
        {params.reden ? <p className="notice notice--warning" role="status">Voor deze actie is tweestapsverificatie op betrouwbaarheidsniveau AAL2 vereist.</p> : null}
        {params.fout ? <p className="notice notice--critical" role="alert">{mfaErrors[params.fout] ?? mfaErrors.factor}</p> : null}
        {params.succes === "verwijderd" ? <p className="notice notice--success" role="status">De authenticator is verwijderd.</p> : null}
        {error ? <p className="notice notice--critical" role="alert">De geregistreerde authenticators konden niet veilig worden geladen. Vernieuw de pagina.</p> : null}

        <section className="mfa-section" aria-labelledby="registered-factors-title">
          <div>
            <h2 className="work-panel__title" id="registered-factors-title">Geregistreerde authenticators</h2>
            <p className="auth-copy">Huidige sessie: {session.assuranceLevel === "aal2" ? "AAL2 bevestigd" : "extra verificatie nodig"}.</p>
          </div>
          {verifiedFactors.length ? (
            <ul className="mfa-factor-list">
              {verifiedFactors.map((factor, index) => (
                <li className="mfa-factor" key={factor.id}>
                  <div><strong>{factor.friendly_name || `Authenticator ${index + 1}`}</strong><span>Geverifieerd</span></div>
                  {session.assuranceLevel === "aal2" ? (
                    <form action={removeMfaFactor}>
                      <input name="factorId" type="hidden" value={factor.id} />
                      <input name="returnTo" type="hidden" value="/auth/mfa" />
                      <button className="button-link button-link--secondary" type="submit">Verwijderen</button>
                    </form>
                  ) : (
                    <form action={verifyMfaFactor} className="mfa-challenge-form">
                      <input name="factorId" type="hidden" value={factor.id} />
                      <input name="returnTo" type="hidden" value={returnTo} />
                      <label className="sr-only" htmlFor={`factor-code-${factor.id}`}>Code voor {factor.friendly_name || `authenticator ${index + 1}`}</label>
                      <input autoComplete="one-time-code" id={`factor-code-${factor.id}`} inputMode="numeric" maxLength={6} name="code" pattern="[0-9]{6}" placeholder="000000" required />
                      <button className="auth-button" type="submit">Verifiëren</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="notice notice--warning" role="status">Er is nog geen geverifieerde authenticator. Voeg er nu een toe om gevoelige platformacties te kunnen uitvoeren.</p>}
        </section>

        <section className="mfa-section" aria-labelledby="new-factor-title">
          <div>
            <h2 className="work-panel__title" id="new-factor-title">Authenticator toevoegen</h2>
            <p className="auth-copy">Een tweede geregistreerde factor is de herstelroute wanneer je één apparaat verliest. VeyoCast toont geen herstelcodes die de onderliggende provider niet ondersteunt.</p>
          </div>
          {canEnrollFactor ? (
            <MfaEnrollmentForm returnTo={returnTo} />
          ) : (
            <p className="notice notice--warning" role="status">
              Verifieer hierboven eerst met een bestaande authenticator. Daarna kun
              je vanuit deze beveiligde sessie een extra herstelapparaat toevoegen.
            </p>
          )}
        </section>

        <Link className="button-link button-link--secondary" href={returnTo}>Terug zonder wijziging</Link>
      </section>
    </main>
  );
}

const mfaErrors: Record<string, string> = {
  code: "De code is ongeldig of verlopen. Controleer de tijd op je apparaat en probeer opnieuw.",
  factor: "Deze authenticator hoort niet bij de huidige sessie. Vernieuw de pagina en probeer opnieuw.",
  verwijderen: "De authenticator kon niet worden verwijderd. Bevestig eerst een andere factor en probeer opnieuw."
};
