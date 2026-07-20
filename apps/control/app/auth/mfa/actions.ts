"use server";

import { redirect } from "next/navigation";

import {
  getControlPostMfaLandingPath,
  requireControlSession
} from "../../../lib/control-session";
import { createControlSupabaseClient } from "../../../lib/supabase/server";
import { safeControlReturnPath } from "../../../lib/tenant-context";

export type MfaEnrollmentState = Readonly<{
  error: string | null;
  factorId: string | null;
  qrCode: string | null;
  secret: string | null;
}>;

export async function startMfaEnrollment(
  _previousState: MfaEnrollmentState,
  formData: FormData
): Promise<MfaEnrollmentState> {
  const session = await requireControlSession();
  const friendlyName = String(formData.get("friendlyName") ?? "").trim();
  const supabase = await createControlSupabaseClient();

  if (!supabase) {
    return { ...emptyEnrollmentState(), error: "De beveiligde sessie is niet beschikbaar. Log opnieuw in." };
  }

  if (friendlyName.length < 2 || friendlyName.length > 50) {
    return { ...emptyEnrollmentState(), error: "Geef deze authenticator een herkenbare naam van 2 tot 50 tekens." };
  }

  if (
    session.nextAssuranceLevel === "aal2" &&
    session.assuranceLevel !== "aal2"
  ) {
    return {
      ...emptyEnrollmentState(),
      error: "Verifieer eerst met een bestaande authenticator voordat je een extra factor toevoegt."
    };
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName
  });

  if (error) {
    return {
      ...emptyEnrollmentState(),
      error: error.code === "mfa_totp_enroll_not_enabled"
        ? "TOTP is niet ingeschakeld in dit Supabase-project. Er is niets gekoppeld; laat een platformbeheerder MFA in Auth activeren en probeer daarna opnieuw."
        : "De authenticator kon niet veilig worden gestart. Er is niets gekoppeld; vernieuw de pagina en probeer opnieuw."
    };
  }

  return {
    error: null,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret
  };
}

function emptyEnrollmentState(): MfaEnrollmentState {
  return { error: null, factorId: null, qrCode: null, secret: null };
}

export async function verifyMfaFactor(formData: FormData) {
  const session = await requireControlSession();
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const returnTo = safeControlReturnPath(
    String(formData.get("returnTo") ?? ""),
    getControlPostMfaLandingPath(session)
  );
  const supabase = await createControlSupabaseClient();

  if (!supabase || !factorId || !/^\d{6}$/.test(code)) {
    redirect(`/auth/mfa?fout=code&terug=${encodeURIComponent(returnTo)}`);
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

  if (error) {
    redirect(`/auth/mfa?fout=code&terug=${encodeURIComponent(returnTo)}`);
  }

  redirect(returnTo);
}

export async function removeMfaFactor(formData: FormData) {
  const session = await requireControlSession();
  const factorId = String(formData.get("factorId") ?? "");
  const returnTo = safeControlReturnPath(
    String(formData.get("returnTo") ?? ""),
    "/auth/mfa"
  );

  if (session.assuranceLevel !== "aal2") {
    redirect(`/auth/mfa?reden=aal2&terug=${encodeURIComponent(returnTo)}`);
  }

  const supabase = await createControlSupabaseClient();
  const { data: factors, error: factorsError } = supabase
    ? await supabase.auth.mfa.listFactors()
    : { data: null, error: new Error("missing session") };
  const factorBelongsToUser = factors?.totp.some((factor) => factor.id === factorId);

  if (!supabase || factorsError || !factorBelongsToUser) {
    redirect("/auth/mfa?fout=factor");
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId });

  if (error) {
    redirect("/auth/mfa?fout=verwijderen");
  }

  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}succes=verwijderd`);
}
