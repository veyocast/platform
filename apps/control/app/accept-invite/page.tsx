import Link from "next/link";
import { cookies } from "next/headers";

import { AuthBrand } from "../_components/auth-brand";
import {
  accountInvitationCookieName,
  invitationContextCookieName,
  parseInvitationContext
} from "../../lib/invitations";
import { getControlRuntimeMode } from "../../lib/supabase/config";
import { createControlSupabaseClient } from "../../lib/supabase/server";
import { completeInvitation } from "./actions";

type AcceptInvitePageProps = {
  searchParams: Promise<{ fout?: string; type?: string }>;
};

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  searchParams
}: AcceptInvitePageProps) {
  const { fout, type } = await searchParams;
  const runtimeMode = getControlRuntimeMode();
  const supabase = runtimeMode === "live" ? await createControlSupabaseClient() : null;
  const { data } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  const cookieStore = await cookies();
  const invitationContext = parseInvitationContext(
    cookieStore.get(invitationContextCookieName)?.value
  );
  const isAccountInvitation =
    type === "account" &&
    cookieStore.get(accountInvitationCookieName)?.value === "platform";
  const invitation = data.user && invitationContext && supabase
    ? await supabase.rpc("get_tenant_invitation_preview", {
        p_invitation_id: invitationContext.invitationId,
        p_invitation_token: invitationContext.token,
        p_tenant_id: invitationContext.tenantId
      })
    : { data: null, error: null };
  const invitationPreview = invitation.data?.[0] ?? null;

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="invite-title">
        <AuthBrand />
        <div>
          <p className="auth-kicker">Nieuwe gebruiker</p>
          <h1 className="auth-title" id="invite-title">
            Uitnodiging afronden
          </h1>
        </div>
        {data.user && (invitationPreview || isAccountInvitation) ? (
          <>
            <p className="auth-copy">
              {invitationPreview ? (
                <>Je accepteert toegang tot <strong>{invitationPreview.tenant_name}</strong> als {roleLabel(invitationPreview.invitation_role)}. Kies een uniek wachtwoord; de rol wordt daarna één keer server-side toegewezen.</>
              ) : (
                <>Je rondt een persoonlijk VeyoCast-platformaccount af. De vooraf toegewezen platformrol wordt na het inloggen opnieuw server-side gecontroleerd.</>
              )}
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
  gebruikt: "Deze uitnodiging is al gebruikt of ingetrokken. Vraag een beheerder om een nieuwe uitnodiging.",
  naam: "Vul een naam van minimaal 2 tekens in.",
  uitnodiging: "De uitnodiging hoort niet bij dit account of is ongeldig. Er is geen toegang toegewezen.",
  verlopen: "Deze uitnodiging is verlopen. Vraag een beheerder om een nieuwe link.",
  wachtwoord: "Gebruik tweemaal hetzelfde wachtwoord van minimaal 12 tekens."
};

function roleLabel(role: string) {
  if (role === "tenant_owner") return "eigenaar";
  if (role === "tenant_admin") return "beheerder";
  if (role === "tenant_editor") return "editor";
  return "kijker";
}
