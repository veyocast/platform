"use client";

import { useFormStatus } from "react-dom";

export function LoginSubmit() {
  const { pending } = useFormStatus();
  return (
    <>
      <button aria-busy={pending} className="auth-button" disabled={pending} type="submit">
        {pending ? "Aanmelden…" : "Doorgaan"}
      </button>
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? "Je aanmelding wordt gecontroleerd. Even geduld." : ""}
      </span>
    </>
  );
}
