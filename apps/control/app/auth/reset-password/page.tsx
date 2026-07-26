import { redirect } from "next/navigation";

import { createControlSupabaseClient } from "../../../lib/supabase/server";
import { updateRecoveredPassword } from "./actions";

type ResetPasswordPageProps = Readonly<{
  searchParams: Promise<{ fout?: string }>;
}>;

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams
}: ResetPasswordPageProps) {
  const supabase = await createControlSupabaseClient();
  const user = supabase ? await supabase.auth.getUser() : null;
  if (!supabase || user?.error || !user?.data.user) {
    redirect("/login?fout=herstel");
  }

  const { fout } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="reset-password-title">
        <div>
          <p className="auth-kicker">Beveiligd accountherstel</p>
          <h1 className="auth-title" id="reset-password-title">
            Kies een nieuw wachtwoord
          </h1>
        </div>
        <p className="auth-copy">
          Gebruik minimaal twaalf tekens en een wachtwoord dat je nergens
          anders gebruikt.
        </p>
        {fout ? (
          <div className="notice notice--warning" role="alert">
            {fout === "wachtwoord"
              ? "De wachtwoorden moeten gelijk zijn en 12–128 tekens bevatten."
              : "Het wachtwoord kon niet veilig worden opgeslagen. Vraag zo nodig een nieuwe herstelmail aan."}
          </div>
        ) : null}
        <form action={updateRecoveredPassword} className="auth-form">
          <div className="field">
            <label htmlFor="new-password">Nieuw wachtwoord</label>
            <input
              autoComplete="new-password"
              id="new-password"
              maxLength={128}
              minLength={12}
              name="password"
              required
              type="password"
            />
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
            Wachtwoord opslaan
          </button>
        </form>
      </section>
    </main>
  );
}
