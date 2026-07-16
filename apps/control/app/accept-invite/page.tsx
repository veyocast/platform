import Link from "next/link";

export default function AcceptInvitePage() {
  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="invite-title">
        <div>
          <p className="auth-kicker">Nieuwe gebruiker</p>
          <h1 className="auth-title" id="invite-title">
            Invite accepteren
          </h1>
        </div>
        <p className="auth-copy">
          De acceptatiestap bewaart straks de uitnodigingscontext voordat de
          auth-callback de tenantrol activeert.
        </p>
        <form className="auth-form" action="/auth/callback" method="get">
          <div className="field">
            <label htmlFor="invite">Invitecode</label>
            <input
              autoComplete="one-time-code"
              id="invite"
              name="invite"
              placeholder="CV-INVITE-1234"
              required
              type="text"
            />
          </div>
          <button className="auth-button" type="submit">
            Invite controleren
          </button>
        </form>
        <Link className="button-link button-link--secondary" href="/login">
          Terug naar inloggen
        </Link>
      </section>
    </main>
  );
}
