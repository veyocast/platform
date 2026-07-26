import Link from "next/link";

import { requestPasswordReset } from "./actions";

type ForgotPasswordPageProps = Readonly<{
  searchParams: Promise<{ status?: string }>;
}>;

export default async function ForgotPasswordPage({
  searchParams
}: ForgotPasswordPageProps) {
  const { status } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="forgot-password-title">
        <div>
          <p className="auth-kicker">Account herstellen</p>
          <h1 className="auth-title" id="forgot-password-title">
            Nieuw wachtwoord aanvragen
          </h1>
        </div>
        <p className="auth-copy">
          Vul het e-mailadres van je VeyoCast-account in. Als het account
          bestaat, ontvang je een persoonlijke herstelmail.
        </p>
        {status === "verwerkt" ? (
          <div className="notice notice--success" role="status">
            De aanvraag is verwerkt. Controleer je inbox en spammap. Om
            accountinformatie te beschermen tonen we niet of het adres bestaat.
          </div>
        ) : (
          <form action={requestPasswordReset} className="auth-form">
            <div className="field">
              <label htmlFor="recovery-email">E-mailadres</label>
              <input
                autoComplete="email"
                id="recovery-email"
                maxLength={320}
                name="email"
                required
                type="email"
              />
            </div>
            <button className="auth-button" type="submit">
              Herstelmail aanvragen
            </button>
          </form>
        )}
        <p className="auth-footnote">
          <Link href="/login">Terug naar inloggen</Link>
        </p>
      </section>
    </main>
  );
}
