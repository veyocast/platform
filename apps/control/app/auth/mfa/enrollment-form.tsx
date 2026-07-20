"use client";

import Image from "next/image";
import { useActionState } from "react";

import {
  startMfaEnrollment,
  verifyMfaFactor,
  type MfaEnrollmentState
} from "./actions";

type MfaEnrollmentFormProps = Readonly<{ returnTo: string }>;

const initialMfaEnrollmentState: MfaEnrollmentState = {
  error: null,
  factorId: null,
  qrCode: null,
  secret: null
};

export function MfaEnrollmentForm({ returnTo }: MfaEnrollmentFormProps) {
  const [state, action, pending] = useActionState(
    startMfaEnrollment,
    initialMfaEnrollmentState
  );

  if (state.factorId && state.qrCode && state.secret) {
    return (
      <div className="mfa-enrollment" role="region" aria-labelledby="mfa-scan-title">
        <div>
          <h2 className="work-panel__title" id="mfa-scan-title">Authenticator koppelen</h2>
          <p className="auth-copy">Scan de QR-code met je authenticator-app. Je kunt de sleutel ook handmatig invoeren.</p>
        </div>
        <Image
          alt="QR-code om de VeyoCast-authenticator te koppelen"
          className="mfa-qr"
          height={240}
          src={state.qrCode.trimEnd()}
          unoptimized
          width={240}
        />
        <details>
          <summary>Handmatige sleutel tonen</summary>
          <code className="mfa-secret">{state.secret}</code>
        </details>
        <form action={verifyMfaFactor} className="auth-form">
          <input name="factorId" type="hidden" value={state.factorId} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <div className="field">
            <label htmlFor="enrollment-code">Zescijferige code</label>
            <input autoComplete="one-time-code" id="enrollment-code" inputMode="numeric" maxLength={6} name="code" pattern="[0-9]{6}" required />
          </div>
          <button className="auth-button" type="submit">Authenticator verifiëren</button>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="auth-form">
      <div className="field">
        <label htmlFor="friendly-name">Naam van authenticator</label>
        <input autoComplete="off" id="friendly-name" maxLength={50} minLength={2} name="friendlyName" placeholder="Bijvoorbeeld telefoon van Daan" required />
      </div>
      {state.error ? <p className="notice notice--critical" role="alert">{state.error}</p> : null}
      <button className="auth-button" disabled={pending} type="submit">
        {pending ? "Authenticator voorbereiden…" : "Nieuwe authenticator toevoegen"}
      </button>
    </form>
  );
}
