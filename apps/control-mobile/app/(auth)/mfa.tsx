import { AppShell, AppText, Button, InlineAlert, ScreenScrollView, Skeleton, SurfaceCard, TextField, mobilePalette, mobileSpacing } from "@veyocast/mobile-design-system";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useAuth } from "../../src/auth/auth-provider";
import { beginNativeTotpSetup, readNativeMfa, removeUnverifiedNativeTotp, verifyNativeTotp, type NativeMfaState, type NativeTotpSetup } from "../../src/auth/mfa";
import { nativeMfaReturnPath } from "../../src/auth/mfa-navigation";
import { BrandMark } from "../../src/components/brand-mark";
import { AppError } from "../../src/components/app-error";

export default function MfaRoute() {
  const { session } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  if (!session) return <Redirect href="/(auth)/login" />;
  return <MfaScreen key={session.user.id} userId={session.user.id} email={session.user.email ?? "Je account"} returnTo={nativeMfaReturnPath(returnTo)} />;
}
function MfaScreen({ userId, email, returnTo }: { userId: string; email: string; returnTo: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<NativeMfaState | null>(null);
  const [setup, setSetup] = useState<NativeTotpSetup | null>(null);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [revealSecret, setRevealSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const live = useRef(true);
  const actionRunning = useRef(false);
  useEffect(() => {
    live.current = true;
    void readNativeMfa(userId).then(value => { if (live.current) { setState(value); setFactorId(value.verified[0]?.id ?? ""); } }).catch(value => { if (live.current) setError(value); });
    return () => { live.current = false; };
  }, [userId]);
  async function run(action: () => Promise<void>) {
    if (actionRunning.current) return;
    actionRunning.current = true;
    setBusy(true); setError(null);
    try { await action(); } catch (value) { if (live.current) setError(value); }
    finally { actionRunning.current = false; if (live.current) setBusy(false); }
  }
  async function refresh() {
    const current = await readNativeMfa(userId);
    if (live.current) { setState(current); setFactorId(selected => [...current.verified, ...current.unverified].some(factor => factor.id === selected) ? selected : current.verified[0]?.id ?? ""); }
  }
  async function enroll() {
    const enrolled = await beginNativeTotpSetup(userId);
    if (!live.current) return;
    setSetup(enrolled); setFactorId(enrolled.factorId); setCode(""); setRevealSecret(false);
    await refresh();
  }
  async function verify() {
    const current = await verifyNativeTotp(userId, factorId, code);
    if (!live.current) return;
    setCode(""); setSetup(null); setRevealSecret(false); setState(current);
    void queryClient.invalidateQueries();
  }
  function discard(id: string) {
    Alert.alert("Onafgeronde instelling verwijderen?", "De bijbehorende instelsleutel werkt daarna niet meer. Je bevestigde authenticators blijven behouden.", [
      { text: "Behouden", style: "cancel" },
      { text: "Instelling verwijderen", style: "destructive", onPress: () => void run(async () => {
        const current = await removeUnverifiedNativeTotp(userId, id);
        if (live.current) { setState(current); if (setup?.factorId === id) { setSetup(null); setRevealSecret(false); setCode(""); setFactorId(current.verified[0]?.id ?? ""); } }
      }) },
    ]);
  }
  return <AppShell><ScreenScrollView>
    <BrandMark size={48} />
    <AppText variant="pageTitle" accessibilityRole="header">Bevestig je account</AppText>
    <AppText muted>{email}</AppText>
    <AppText>Gebruik je authenticator om ontwerpen en andere beveiligde beheeracties te bevestigen. Je opgeslagen invoer blijft behouden.</AppText>
    {error ? <AppError error={error} /> : null}
    {!state ? error ? <Button loading={busy} onPress={() => void run(refresh)}>Accountstatus opnieuw ophalen</Button> : <Skeleton height={180} /> : state.currentLevel === "aal2" ? <>
      <InlineAlert title="Tweestapsverificatie bevestigd" description="Je sessie is met je extra factor bevestigd. Je kunt terug naar je bewaarde beheeractie." tone="success" />
      <Button onPress={() => router.replace(returnTo as never)}>Verder met je beheeractie</Button>
    </> : <>
      {state.verified.length ? <SurfaceCard><View style={{ gap: mobileSpacing.default }}>
        <AppText variant="section">Je authenticator</AppText>
        {state.verified.map(factor => <Button key={factor.id} variant={factorId === factor.id ? "primary" : "secondary"} disabled={busy} onPress={() => { setFactorId(factor.id); setCode(""); }}>{factor.name}</Button>)}
        <AppText muted>Open je bestaande authenticator en vul de actuele code in.</AppText>
      </View></SurfaceCard> : !setup ? <SurfaceCard><View style={{ gap: mobileSpacing.default }}>
        <AppText variant="section">Authenticator instellen</AppText>
        <AppText>Er is nog geen bevestigde TOTP-authenticator. Start de instelling, scan de QR-code of voer de sleutel handmatig in en bevestig de eerste code.</AppText>
        <Button loading={busy} disabled={state.unverified.length > 0} onPress={() => void run(enroll)}>Authenticator instellen</Button>
      </View></SurfaceCard> : null}
      {setup ? <SurfaceCard><View style={{ gap: mobileSpacing.default }}>
        <AppText variant="section">Voeg VeyoCast toe aan je authenticator</AppText>
        {setup.qrSvg ? <View style={{ alignSelf: "center", backgroundColor: mobilePalette.brand.paper, padding: mobileSpacing.default }}><SvgXml xml={setup.qrSvg} width={220} height={220} /></View> : null}
        <AppText>Scan deze QR-code met je authenticator. Gebruik op hetzelfde toestel de handmatige sleutel.</AppText>
        <Button variant="secondary" disabled={busy} onPress={() => setRevealSecret(value => !value)}>{revealSecret ? "Instelsleutel verbergen" : "Handmatige instelsleutel tonen"}</Button>
        {revealSecret ? <><AppText selectable variant="bodyStrong">{setup.secret}</AppText><AppText muted>Voer deze sleutel als tijdgebonden code voor VeyoCast in. De sleutel wordt hier alleen tijdens de instelling getoond.</AppText></> : null}
        <Button variant="ghost" disabled={busy} onPress={() => discard(setup.factorId)}>Deze onafgeronde instelling verwijderen</Button>
      </View></SurfaceCard> : null}
      {factorId ? <SurfaceCard><View style={{ gap: mobileSpacing.default }}>
        <TextField label="Zescijferige authenticatorcode" value={code} onChangeText={value => setCode(value.replace(/\D/g, "").slice(0, 6))} editable={!busy} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} autoCapitalize="none" autoCorrect={false} />
        <Button loading={busy} disabled={!/^\d{6}$/.test(code)} onPress={() => void run(verify)}>Code bevestigen</Button>
      </View></SurfaceCard> : null}
      {state.unverified.filter(factor => factor.id !== setup?.factorId).map(factor => <SurfaceCard key={factor.id}><View style={{ gap: mobileSpacing.default }}>
        <AppText variant="cardTitle">Onafgeronde instelling: {factor.name}</AppText>
        <AppText muted>Een eerdere instelsleutel kan hier niet opnieuw worden opgehaald. Verwijder deze onafgeronde instelling bewust om een nieuwe te beginnen.</AppText>
        <Button variant="dangerQuiet" disabled={busy} onPress={() => discard(factor.id)}>Onafgeronde instelling verwijderen</Button>
      </View></SurfaceCard>)}
      <Button variant="secondary" loading={busy} onPress={() => void run(refresh)}>Accountstatus opnieuw ophalen</Button>
      <Button variant="ghost" disabled={busy} onPress={() => router.replace(returnTo as never)}>Verder zonder extra bevestiging</Button>
    </>}
  </ScreenScrollView></AppShell>;
}
