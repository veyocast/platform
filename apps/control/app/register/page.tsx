import Image from "next/image";
import Link from "next/link";

import { getControlRuntimeMode } from "../../lib/supabase/config";
import { registerAccount } from "./actions";

type RegisterPageProps = Readonly<{
  searchParams: Promise<{ fout?: string; setup?: string; status?: string }>;
}>;

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { fout, setup = "", status } = await searchParams;
  const live = getControlRuntimeMode() === "live";

  return (
    <main className="auth-shell auth-shell--vector">
      <section className="auth-panel" aria-labelledby="register-title">
        <Image
          alt="VeyoCast"
          className="auth-brand"
          height={34}
          priority
          src="/brand/veyocast-logo-primary.svg"
          width={142}
        />
        <div>
          <p className="auth-kicker">14 dagen gratis · daarna € 5,95 incl. btw per actief scherm</p>
          <h1 className="auth-title" id="register-title">Maak je VeyoCast-account</h1>
        </div>
        <p className="auth-copy">
          Bevestig eerst je e-mailadres. Daarna richten we je organisatie,
          bronnen, eerste scherm en veilige release stap voor stap in.
        </p>
        {status === "bevestigen" ? (
          <div className="notice notice--success" role="status">
            Controleer je inbox en spammap. De bevestigingslink opent je
            persoonlijke onboarding; we tonen bewust niet of een adres al bestond.
          </div>
        ) : null}
        {fout ? (
          <div className="notice notice--warning" role="alert">
            {registrationErrors[fout] ?? registrationErrors.registratie}
          </div>
        ) : null}
        {live && status !== "bevestigen" ? (
          <form action={registerAccount} className="auth-form">
            <input name="setup" type="hidden" value={setup} />
            <div className="field">
              <label htmlFor="displayName">Jouw naam</label>
              <input autoComplete="name" id="displayName" maxLength={120} name="displayName" required />
            </div>
            <div className="field">
              <label htmlFor="registrationEmail">Zakelijk e-mailadres</label>
              <input autoComplete="email" id="registrationEmail" maxLength={320} name="email" required type="email" />
            </div>
            <div className="field">
              <label htmlFor="registrationPassword">Wachtwoord</label>
              <input autoComplete="new-password" id="registrationPassword" maxLength={128} minLength={12} name="password" required type="password" />
              <p>Minimaal 12 tekens. Gebruik een uniek wachtwoord.</p>
            </div>
            <div className="field">
              <label htmlFor="passwordConfirmation">Herhaal wachtwoord</label>
              <input autoComplete="new-password" id="passwordConfirmation" maxLength={128} minLength={12} name="passwordConfirmation" required type="password" />
            </div>
            <label className="auth-consent">
              <input name="accepted" required type="checkbox" value="yes" />
              <span>Ik ga akkoord met de <Link href="https://veyocast.nl/voorwaarden">voorwaarden</Link> en heb de <Link href="https://veyocast.nl/privacy">privacyinformatie</Link> gelezen.</span>
            </label>
            <button className="auth-button" type="submit">Account aanmaken</button>
          </form>
        ) : null}
        {!live ? (
          <div className="notice notice--critical" role="alert">
            Registratie is niet beschikbaar zolang de beveiligde accountservice niet is geconfigureerd.
          </div>
        ) : null}
        <p className="auth-footnote">Al een account? <Link href="/login">Log in</Link></p>
      </section>
    </main>
  );
}

const registrationErrors: Record<string, string> = {
  configuratie: "Registratie is tijdelijk niet beschikbaar. Probeer later opnieuw.",
  gegevens: "Controleer je naam, e-mailadres, wachtwoorden en akkoord en probeer opnieuw.",
  opstelling: "De bewaarde locatie-opstelling is ongeldig of verlopen. Je kunt wel zonder opstelling registreren.",
  registratie: "De aanvraag kon niet veilig worden verwerkt. Probeer later opnieuw of log in als je al een account hebt."
};
