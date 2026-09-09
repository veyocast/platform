"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

type TenantCreateSubmitProps = Readonly<{
  canCreate: boolean;
  requiresAal2: boolean;
}>;

export function TenantCreateSubmit({
  canCreate,
  requiresAal2
}: TenantCreateSubmitProps) {
  const { pending } = useFormStatus();
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    if (!pending) {
      setShowRecovery(false);
      return;
    }

    const timer = window.setTimeout(() => setShowRecovery(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  if (requiresAal2) {
    return (
      <Link
        className="button-link button-link--primary"
        href="/auth/mfa?reden=aal2&terug=%2Fplatform%2Ftenants%23nieuwe-tenant"
      >
        Tweestapsverificatie openen
      </Link>
    );
  }

  return (
    <div className="tenant-create-submit">
      <button
        aria-busy={pending}
        className="button-link button-link--primary"
        disabled={!canCreate || pending}
        type="submit"
      >
        {tenantCreateSubmitLabel(pending)}
      </button>
      {showRecovery ? (
        <p className="tenant-create-submit__recovery" role="status">
          Dit duurt langer dan verwacht. De opdracht kan al zijn afgerond;
          vernieuw de pagina om de status te controleren voordat je opnieuw
          klikt.
        </p>
      ) : null}
    </div>
  );
}

export function tenantCreateSubmitLabel(pending: boolean) {
  return pending ? "Vereniging wordt aangemaakt…" : "Vereniging aanmaken";
}
