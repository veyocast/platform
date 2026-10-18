import { mobileSupabase } from "./supabase";
import { runNativeSessionOperation } from "./session-operations";

export type NativeTotpFactor = { id: string; name: string };
export type NativeMfaState = { currentLevel: "aal1" | "aal2"; verified: NativeTotpFactor[]; unverified: NativeTotpFactor[] };
export type NativeTotpSetup = { factorId: string; secret: string; qrSvg: string | null };

function client() {
  if (!mobileSupabase) throw Error("De beveiligde verbinding ontbreekt. Er is geen instelling gewijzigd; open een geldig geconfigureerde Control-app.");
  return mobileSupabase;
}
async function requireActor(userId: string) {
  const { data, error } = await client().auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw Error("Je account of sessie is gewijzigd. Er is geen volgende beveiligingsstap uitgevoerd; meld je opnieuw aan met het juiste account.");
  return data.session;
}
function failed(error: unknown, fallback: string): never {
  if (error && typeof error === "object" && "status" in error && Number(error.status) === 429) throw Error("Er zijn te veel bevestigingspogingen gedaan. Je beveiliging is niet bevestigd; wacht even en probeer het opnieuw.");
  throw Error(fallback);
}
async function readState(userId: string): Promise<NativeMfaState> {
  const session = await requireActor(userId);
  const [factors, assurance] = await Promise.all([client().auth.mfa.listFactors(), client().auth.mfa.getAuthenticatorAssuranceLevel(session.access_token)]);
  await requireActor(userId);
  if (factors.error || assurance.error || !factors.data || !assurance.data?.currentLevel) failed(factors.error ?? assurance.error, "Je accountbeveiliging kon niet worden gelezen. Er is niets ingesteld; controleer de verbinding en vraag de status opnieuw op.");
  const present = (factor: { id: string; friendly_name?: string }) => ({ id: factor.id, name: factor.friendly_name?.trim().slice(0, 120) || "Authenticator" });
  return { currentLevel: assurance.data.currentLevel === "aal2" ? "aal2" : "aal1", verified: factors.data.totp.map(present), unverified: factors.data.all.filter(factor => factor.factor_type === "totp" && factor.status === "unverified").map(present) };
}
export function readNativeMfa(userId: string) { return runNativeSessionOperation(() => readState(userId)); }

/** The SDK prefixes TOTP QR SVGs; reject external references before native rendering. */
export function nativeTotpQrSvg(value: string): string | null {
  let svg = value.startsWith("data:image/svg+xml;utf-8,") ? value.slice("data:image/svg+xml;utf-8,".length) : value;
  try { if (svg.trimStart().startsWith("%3C")) svg = decodeURIComponent(svg); } catch { return null; }
  if (svg.length > 131072 || !svg.includes("<svg") || !svg.includes("</svg>") || /<(?:script|foreignObject|image|use)\b|(?:xlink:)?href\s*=|\bon[a-z]+\s*=|<!DOCTYPE|<!ENTITY/i.test(svg)) return null;
  return svg;
}

/** Called only by the explicit setup button; no enrollment runs during a read or render. */
export function beginNativeTotpSetup(userId: string): Promise<NativeTotpSetup> {
  return runNativeSessionOperation(async () => {
    const state = await readState(userId);
    if (state.verified.length) throw Error("Je hebt al een authenticator. Gebruik de huidige code om deze sessie te bevestigen.");
    if (state.unverified.length) throw Error("Er staat een onafgeronde authenticatorinstelling bij je account. Rond die af of verwijder haar hier bewust voordat je opnieuw begint.");
    await requireActor(userId);
    const result = await client().auth.mfa.enroll({ factorType: "totp", friendlyName: "VeyoCast Control", issuer: "VeyoCast" });
    await requireActor(userId);
    if (result.error || !result.data?.totp?.secret || !/^[A-Z2-7]+=*$/i.test(result.data.totp.secret)) failed(result.error, "De nieuwe instelling kon niet worden bevestigd. Vraag eerst de accountstatus opnieuw op voordat je opnieuw instelt.");
    return { factorId: result.data.id, secret: result.data.totp.secret, qrSvg: nativeTotpQrSvg(result.data.totp.qr_code) };
  });
}
export function verifyNativeTotp(userId: string, factorId: string, code: string): Promise<NativeMfaState> {
  return runNativeSessionOperation(async () => {
    if (!/^\d{6}$/.test(code)) throw Error("Vul de zes cijfers uit je authenticator in. Er is nog geen code verstuurd.");
    const state = await readState(userId);
    if (![...state.verified, ...state.unverified].some(factor => factor.id === factorId)) throw Error("Deze authenticator hoort niet bij de huidige accountstatus. Vraag de status opnieuw op; er is geen code verstuurd.");
    await requireActor(userId);
    const challenge = await client().auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data?.id) failed(challenge.error, "Er kon geen nieuwe bevestiging worden gestart. Je sessie is niet verhoogd; controleer de verbinding en probeer opnieuw.");
    await requireActor(userId);
    const verified = await client().auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
    if (verified.error) failed(verified.error, "De authenticatorcode is ongeldig of verlopen. Deze sessie is niet bevestigd; gebruik de actuele code en probeer opnieuw.");
    const current = await readState(userId);
    if (current.currentLevel !== "aal2") throw Error("De extra accountbevestiging is nog niet vastgesteld. Je beheeractie blijft geblokkeerd; vraag de status opnieuw op.");
    return current;
  });
}
export function removeUnverifiedNativeTotp(userId: string, factorId: string): Promise<NativeMfaState> {
  return runNativeSessionOperation(async () => {
    const state = await readState(userId);
    if (!state.unverified.some(factor => factor.id === factorId)) throw Error("Alleen een onafgeronde instelling kan hier worden verwijderd. Je bestaande authenticator is niet gewijzigd.");
    await requireActor(userId);
    const result = await client().auth.mfa.unenroll({ factorId });
    if (result.error) failed(result.error, "De onafgeronde instelling kon niet worden verwijderd. Vraag de accountstatus opnieuw op voordat je verdergaat.");
    return readState(userId);
  });
}
