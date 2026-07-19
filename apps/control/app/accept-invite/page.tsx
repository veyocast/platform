import Link from "next/link";

import { getControlRuntimeMode } from "../../lib/supabase/config";
import { createControlSupabaseClient } from "../../lib/supabase/server";
import { completeInvitation } from "./actions";

type AcceptInvitePageProps = {
  searchParams: Promise<{ fout?: string }>;
};

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  searchParams
}: AcceptInvitePageProps) {
  const { fout } = await searchParams;
  const runtimeMode = getControlRuntimeMode();
  const supabase = runtimeMode === "live" ? await createControlSupabaseClient() : null;
  const { data } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="invite-title">
        <div>
          <p className="auth-kicker">Nieuwe gebruiker</p>
          <h1 className="auth-title" id="invite-title">
            Uitnodiging afronden
          </h1>
        </div>
        {data.user ? (
          <>
            <p className="auth-copy">
              Kies een uniek wachtwoord. Je toegang wordt daarna uitsluitend uit de server-side toegewezen rollen geladen.
            </p>
            {fout && invitationErrors[fout] ? (
              <div className="notice notice--warning" role="alert">
                {invitationErrors[fout]}
              </div>
            ) : null}
            <form action={completeInvitation} className="auth-form">
              <div className="field">
                <label htmlFor="display-name">Naam</label>
                <input
                  autoComplete="name"
                  defaultValue={String(data.user.user_metadata.display_name ?? "")}
                  id="display-name"
                  maxLength={100}
                  minLength={2}
                  name="displayName"
                  required
                  type="text"
                />
              </div>
              <div className="field">
                <label htmlFor="password">Nieuw wachtwoord</label>
                <input
                  autoComplete="new-password"
                  id="password"
                  maxLength={128}
                  minLength={12}
                  name="password"
                  required
                  type="password"
                />
                <p>Gebruik minimaal 12 tekens en bewaar het wachtwoord in een wachtwoordmanager.</p>
              </div>
              <div className="field">
                <label htmlFor="password-confirmation">Herhaal wachtwoord</label>
                <input
                  autoComplete="new-password"
                  id="password-confirmation"
                  maxLength={128}
                  minLength={12}
                  name="passwordConfirmation"
                  required
                  type="password"
                />
              </div>
              <button className="auth-button" type="submit">
                Account instellen
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="auth-copy">
              Open de persoonlijke uitnodigingslink uit de e-mail. Een losse of verlopen link geeft geen toegang.
            </p>
            <div className="notice" role="status">
              Er is geen geldige uitnodigingssessie gevonden. Vraag een beheerder zo nodig om een nieuwe uitnodiging.
            </div>
          </>
        )}
        <Link className="button-link button-link--secondary" href="/login">
          Terug naar inloggen
        </Link>
      </section>
    </main>
  );
}

const invitationErrors: Record<string, string> = {
  account: "Het account kon niet veilig worden ingesteld. Vraag een beheerder om een nieuwe uitnodiging.",
  naam: "Vul een naam van minimaal 2 tekens in.",
  wachtwoord: "Gebruik tweemaal hetzelfde wachtwoord van minimaal 12 tekens."
};
