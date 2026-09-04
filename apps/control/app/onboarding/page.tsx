import { JourneyShell } from "@veyocast/ui";
import { randomUUID } from "node:crypto";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  onboardingSetupCookieName,
  onboardingSourceKeys
} from "../../lib/onboarding-contract";
import { verifySetupIntentToken } from "@veyocast/auth/setup-intent";
import { setupIntentSigningSecret } from "../../lib/setup-intent.server";
import { createControlSupabaseClient } from "../../lib/supabase/server";
import {
  provisionOnboardingTenant,
  refreshOnboardingProgress,
  updateOnboardingPreferences
} from "./actions";

type OnboardingPageProps = Readonly<{
  searchParams: Promise<{ fout?: string; status?: string }>;
}>;

type OnboardingState = Readonly<{
  current_step: string;
  organization_type: string;
  source_keys: string[];
  status: string;
  tenant_id: string;
  use_case: string;
}>;

const journeySteps = [
  { id: "organization", label: "Organisatie" },
  { id: "brand_sources", label: "Merk & bronnen" },
  { id: "screens", label: "Schermen" },
  { id: "pairing", label: "Player koppelen" },
  { id: "first_release", label: "Eerste release" },
  { id: "billing", label: "Proefperiode" }
] as const;

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) redirect("/login?reden=sessie");
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) redirect("/login?reden=sessie");
  const { fout, status } = await searchParams;
  const membershipResult = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userResult.data.user.id);
  if (membershipResult.error) {
    throw new Error("De tenanttoegang voor onboarding kon niet veilig worden geladen.");
  }
  const tenantIds = (membershipResult.data ?? []).map((membership) => membership.tenant_id);
  if (tenantIds.length === 0) return <OrganizationClaim error={fout} />;

  const { data, error } = await supabase
    .from("tenant_onboarding_states")
    .select("tenant_id,status,current_step,organization_type,use_case,source_keys")
    .in("tenant_id", tenantIds)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("De onboardingstatus kon niet veilig worden geladen.");
  if (!data) redirect("/context?reden=needs_selection");
  const state = data as OnboardingState;
  if (state.status === "complete") redirect("/dashboard");

  const [tenantResult, screenResult, deviceResult, releaseResult] = await Promise.all([
    supabase.from("tenants").select("name").eq("id", state.tenant_id).single(),
    supabase.from("screens").select("id,name,status").eq("tenant_id", state.tenant_id).neq("status", "disabled"),
    supabase.from("player_devices").select("id,status").eq("tenant_id", state.tenant_id).eq("status", "paired"),
    supabase.from("playlist_releases").select("id").eq("tenant_id", state.tenant_id)
  ]);
  if (tenantResult.error || screenResult.error || deviceResult.error || releaseResult.error) {
    throw new Error("De echte onboardingresources konden niet worden geladen.");
  }
  const screens = screenResult.data ?? [];
  const pairedCount = deviceResult.data?.length ?? 0;
  const releaseCount = releaseResult.data?.length ?? 0;

  return (
    <main className="onboarding-shell">
      <Image alt="VeyoCast" className="onboarding-brand" height={32} priority src="/brand/veyocast-logo-primary.svg" width={134} />
      <JourneyShell
        aside={<OnboardingPulse pairedCount={pairedCount} releaseCount={releaseCount} screenCount={screens.length} />}
        currentStep={state.current_step}
        description={`We richten ${tenantResult.data.name} in op basis van echte resources. Je voortgang blijft bewaard.`}
        eyebrow="Living Venue OS · eerste inrichting"
        steps={journeySteps}
        title="Breng je eerste scherm veilig live"
      >
        {fout ? <div className="notice notice--warning" role="alert">{onboardingErrors[fout] ?? onboardingErrors.opslaan}</div> : null}
        {status ? <div className="notice notice--success" role="status">{onboardingSuccess[status] ?? onboardingSuccess.ververst}</div> : null}
        {state.current_step === "brand_sources" ? (
          <SourcePreferences state={state} />
        ) : (
          <OperationalStep
            pairedCount={pairedCount}
            releaseCount={releaseCount}
            screens={screens}
            state={state}
          />
        )}
      </JourneyShell>
    </main>
  );
}

async function OrganizationClaim({ error }: Readonly<{ error?: string }>) {
  const cookieStore = await cookies();
  const setupToken = cookieStore.get(onboardingSetupCookieName)?.value;
  const secret = setupIntentSigningSecret();
  const setup = setupToken && secret ? await verifySetupIntentToken(setupToken, secret) : null;
  const defaultOrganizationType = setup?.branch ?? "sportclub";
  const defaultUseCase = defaultOrganizationType === "sportclub"
    ? "club_communication"
    : defaultOrganizationType === "hospitality"
      ? "venue_information"
      : "internal_communication";

  return (
    <main className="onboarding-shell">
      <Image alt="VeyoCast" className="onboarding-brand" height={32} priority src="/brand/veyocast-logo-primary.svg" width={134} />
      <JourneyShell
        aside={setup ? <SetupIntentSummary setup={setup} /> : <OnboardingPromise />}
        currentStep="organization"
        description="Je account is bevestigd. Leg nu vast voor welke organisatie je VeyoCast inricht."
        eyebrow="Living Venue OS · eerste inrichting"
        steps={journeySteps}
        title="Welkom bij VeyoCast"
      >
        {error ? <div className="notice notice--warning" role="alert">{onboardingErrors[error] ?? onboardingErrors.opslaan}</div> : null}
        <form action={provisionOnboardingTenant} className="onboarding-form">
          <input name="idempotencyKey" type="hidden" value={randomUUID()} />
          <div className="field">
            <label htmlFor="organizationName">Naam van je organisatie</label>
            <input autoComplete="organization" id="organizationName" maxLength={120} name="organizationName" required />
          </div>
          <fieldset className="onboarding-choice-grid">
            <legend>Wat voor organisatie beheer je?</legend>
            {organizationOptions.map((option) => (
              <label key={option.value}>
                <input defaultChecked={option.value === defaultOrganizationType} name="organizationType" type="radio" value={option.value} />
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="useCase">Waar begin je mee?</label>
            <select defaultValue={defaultUseCase} id="useCase" name="useCase">
              <option value="club_communication">Clubcommunicatie en wedstrijden</option>
              <option value="venue_information">Bezoekers, menu en locatie-informatie</option>
              <option value="internal_communication">Interne informatie en ontvangst</option>
            </select>
          </div>
          <label className="auth-consent">
            <input name="termsAccepted" required type="checkbox" value="yes" />
            <span>Ik accepteer namens deze organisatie de actuele VeyoCast-voorwaarden. De proefperiode start pas bij de eerste succesvolle activering van een billable scherm.</span>
          </label>
          <button className="auth-button" type="submit">Organisatie veilig aanmaken</button>
        </form>
      </JourneyShell>
    </main>
  );
}

function SourcePreferences({ state }: Readonly<{ state: OnboardingState }>) {
  return (
    <form action={updateOnboardingPreferences} className="onboarding-form">
      <input name="tenantId" type="hidden" value={state.tenant_id} />
      <input name="organizationType" type="hidden" value={state.organization_type} />
      <input name="useCase" type="hidden" value={state.use_case} />
      <div>
        <h2>Kies je eerste contentbronnen</h2>
        <p className="auth-copy">Je kunt dit later wijzigen. Alleen bronnen die werkelijk beschikbaar zijn worden nu aangeboden.</p>
      </div>
      <fieldset className="onboarding-choice-grid onboarding-choice-grid--sources">
        <legend>Contentbronnen</legend>
        {onboardingSourceKeys.map((key) => (
          <label key={key}>
            <input defaultChecked={state.source_keys.includes(key)} name="sourceKeys" type="checkbox" value={key} />
            <span><strong>{sourceLabels[key]}</strong><small>{sourceDescriptions[key]}</small></span>
          </label>
        ))}
      </fieldset>
      <button className="auth-button" type="submit">Bronnen bewaren en doorgaan</button>
    </form>
  );
}

function OperationalStep({ pairedCount, releaseCount, screens, state }: Readonly<{
  pairedCount: number;
  releaseCount: number;
  screens: Array<{ id: string; name: string; status: string }>;
  state: OnboardingState;
}>) {
  const current = state.current_step;
  return (
    <div className="onboarding-operational-step">
      {current === "screens" ? <><h2>Voeg je eerste fysieke scherm toe</h2><p>Leg oriëntatie, resolutie en locatie vast. VeyoCast kiest nooit stilzwijgend een schermcontext.</p><Link className="button-link button-link--primary" href="/dashboard/screens/new">Eerste scherm toevoegen</Link></> : null}
      {current === "pairing" ? <><h2>Koppel de Player aan je scherm</h2><p>Open het scherm en start pairing met de korte code of QR. Een tijdelijke code geeft nooit zelfstandig tenanttoegang.</p>{screens[0] ? <Link className="button-link button-link--primary" href={`/dashboard/screens/new?screen=${screens[0].id}`}>Player koppelen aan {screens[0].name}</Link> : null}</> : null}
      {current === "first_release" ? <><h2>Maak en publiceer je eerste playlist</h2><p>De Player activeert pas nadat alle assets zijn gedownload en geverifieerd. De vorige geldige release blijft intussen spelen.</p><Link className="button-link button-link--primary" href="/dashboard/playlists">Naar Publisher</Link></> : null}
      {current === "billing" ? <><h2>Je eerste scherm is technisch klaar</h2><p>De proefperiode en betaalmethode worden in de beveiligde abonnementsstap geactiveerd. Tot die serverbevestiging claimen we geen actieve betaalstatus.</p><Link className="button-link button-link--primary" href="/dashboard">Bekijk actuele status</Link></> : null}
      <form action={refreshOnboardingProgress}>
        <input name="tenantId" type="hidden" value={state.tenant_id} />
        <button className="button-link button-link--secondary" type="submit">Voortgang opnieuw controleren</button>
      </form>
      <p className="auth-copy">Gevonden: {screens.length} scherm(en), {pairedCount} gekoppelde Player(s), {releaseCount} release(s).</p>
    </div>
  );
}

function OnboardingPulse({ pairedCount, releaseCount, screenCount }: Readonly<{ pairedCount: number; releaseCount: number; screenCount: number }>) {
  return <div className="onboarding-aside"><p className="eyebrow">Inrichtingsstatus</p><h2>Echte voortgang</h2><ul><li><strong>{screenCount}</strong><span>schermen</span></li><li><strong>{pairedCount}</strong><span>gekoppelde Players</span></li><li><strong>{releaseCount}</strong><span>veilige releases</span></li></ul><p>Herlaadbaar, tenant-geïsoleerd en gebaseerd op serverdata.</p></div>;
}

function SetupIntentSummary({ setup }: Readonly<{ setup: { grossMonthlyCents: number; modules: readonly string[]; screenCount: number } }>) {
  return <div className="onboarding-aside"><p className="eyebrow">Bewaarde locatie-opstelling</p><h2>{setup.screenCount} scherm{setup.screenCount === 1 ? "" : "en"}</h2><p>{setup.modules.length} gekozen bronnen · € {(setup.grossMonthlyCents / 100).toLocaleString("nl-NL", { minimumFractionDigits: 2 })} incl. btw per maand na trial.</p><p>De ondertekende intent bevat geen account- of persoonsgegevens.</p></div>;
}

function OnboardingPromise() {
  return <div className="onboarding-aside"><p className="eyebrow">Veilige start</p><h2>Van account naar werkend scherm</h2><p>Je inrichting wordt per stap bewaard. Pairing, content en release blijven echte domeinacties.</p></div>;
}

const organizationOptions = [
  { value: "sportclub", label: "Sportvereniging", description: "Clubhuis, entree, teams en wedstrijden." },
  { value: "hospitality", label: "Horeca & sportlocatie", description: "Ontvangst, menu en meerdere publiekszones." },
  { value: "organization", label: "Organisatie", description: "Interne informatie, bezoekers en locaties." }
] as const;
const sourceLabels: Record<(typeof onboardingSourceKeys)[number], string> = { sportlink: "Sportlink", twelve: "Twelve XLSX", rss: "RSS & nieuws", "own-media": "Eigen media", sponsors: "Sponsors" };
const sourceDescriptions: Record<(typeof onboardingSourceKeys)[number], string> = { sportlink: "Teams, programma, uitslagen en standen wanneer data bestaat.", twelve: "Gecontroleerde normale .xlsx-import met mapping en preview.", rss: "Nieuwsfeeds met bronstatus, stale-indicatie en fallback.", "own-media": "Afbeeldingen en video uit je tenantbibliotheek.", sponsors: "Sponsorcampagnes, plaatsingen en rotatie." };
const onboardingErrors: Record<string, string> = { context: "De organisatie is gemaakt, maar de werkcontext kon niet veilig worden gezet. Log opnieuw in om te hervatten.", gegevens: "Controleer de verplichte gegevens en probeer opnieuw.", naam: "Deze organisatienaam kan niet als unieke werkcontext worden gebruikt. Probeer een specifiekere naam.", opslaan: "De stap kon niet veilig worden opgeslagen. Er is niets half geactiveerd; probeer opnieuw.", rechten: "Je sessie heeft niet de vereiste tenantrechten voor deze stap." };
const onboardingSuccess: Record<string, string> = { organisatie: "Je organisatie en eigenaarstoegang zijn transactioneel aangemaakt.", bronnen: "Je bronnen zijn bewaard. Voeg nu je eerste echte scherm toe.", ververst: "De voortgang is opnieuw bepaald op basis van schermen, Players en releases." };
