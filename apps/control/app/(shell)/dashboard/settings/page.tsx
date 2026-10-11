import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ArrowRight, Building2, Clock3, Palette, ShieldCheck, UsersRound } from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, StatusPill } from "@veyocast/ui";

import { requireControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { updateTenantSettings } from "./actions";
import { SettingsCategoryWorkspace } from "./settings-category-workspace";
import { SettingsDirtySavebar } from "./settings-dirty-savebar";
import styles from "./sites-settings.module.css";

type SettingsPageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

type TenantSettings = {
  clubLocation: string;
  clubWebsite: string;
  profileRevision: number;
  defaultBackgroundColor: string | null;
  defaultFitMode: "contain" | "cover";
  defaultImageDuration: number;
  defaultResolutionHeight: number;
  defaultResolutionWidth: number;
  defaultScreenOrientation: "landscape" | "portrait";
  defaultTransition: "crossfade" | "cut" | "wipe";
  defaultVideoMuted: boolean;
  name: string;
  primaryColor: string;
  timezoneName: string;
};

const defaults: TenantSettings = {
  clubLocation: "",
  clubWebsite: "",
  profileRevision: 0,
  defaultBackgroundColor: null,
  defaultFitMode: "contain",
  defaultImageDuration: 10,
  defaultResolutionHeight: 1080,
  defaultResolutionWidth: 1920,
  defaultScreenOrientation: "landscape",
  defaultTransition: "cut",
  defaultVideoMuted: true,
  name: "",
  primaryColor: "#FF5C20",
  timezoneName: "Europe/Amsterdam"
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await requireControlSession();
  const { fout, succes } = await searchParams;
  const { data, error } = await loadSettings(session.tenantId, session.isLive, session.tenant);
  const canManage =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.settings.manage") &&
    !error;
  return (
    <div className={styles.page}>
      <h1 className="sr-only">Instellingen</h1>
      {session.isLive && !canManage ? <StatusPill label="Alleen bekijken" tone="warning" /> : null}

      {fout ? <p className="notice notice--critical" role="alert"><strong>Opslaan mislukt.</strong> {fout}</p> : null}
      {succes ? <p className="notice notice--success" role="status">{succes}</p> : null}
      {error ? <p className="notice notice--critical" role="alert"><strong>Instellingen niet geladen.</strong> {error}</p> : null}
      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          Configureer Supabase en log in om instellingen echt op te slaan. In demomodus blijven alle velden uitgeschakeld.
        </p>
      ) : null}

      <form action={updateTenantSettings} className={`settings-workspace-form ${styles.settingsForm}`}>
        <input name="profileRevision" type="hidden" value={data.profileRevision} />
        <input name="idempotencyKey" type="hidden" value={randomUUID()} />
        <input name="defaultBackgroundColor" type="hidden" value={data.defaultBackgroundColor ?? ""} />
        <input name="defaultTransition" type="hidden" value={data.defaultTransition} />
        <input name="primaryColor" type="hidden" value={data.primaryColor} />
        <SettingsCategoryWorkspace>
        <section className={styles.surface} data-settings-surface="true" aria-labelledby="club-profile-title" id="clubprofiel">
          <div className={styles.surfaceHeading}>
            <div>
              <h2 className="work-panel__title" id="club-profile-title">Clubprofiel</h2>
              <p className="work-panel__meta">De naam en gegevens waarmee jouw vereniging herkenbaar is.</p>
            </div>
          </div>
          <div className={styles.organization}><span className={styles.organizationIcon}><Building2 aria-hidden="true" size={29} /></span><div><h3>{data.name}</h3><StatusPill label={session.isLive ? "Vereniging" : "Demomodus"} tone={session.isLive ? "neutral" : "warning"} /></div></div>
          <div className={styles.fieldGrid} data-settings-field-grid="true">
            <div className="field">
              <label htmlFor="settings-name">Verenigingsnaam</label>
              <input defaultValue={data.name} disabled={!canManage} id="settings-name" maxLength={120} minLength={2} name="name" required type="text" />
            </div>
            <div className="field"><label htmlFor="settings-club-location">Vestigingsplaats</label><input defaultValue={data.clubLocation} disabled={!canManage} id="settings-club-location" maxLength={120} name="clubLocation" type="text" /></div>
            <div className="field"><label htmlFor="settings-club-website">Website</label><input defaultValue={data.clubWebsite} disabled={!canManage} id="settings-club-website" maxLength={500} name="clubWebsite" pattern="https://[^\\s@]+" placeholder="https://jouwvereniging.nl" type="url" /></div>
          </div>
        </section>

        <section className={styles.surface} data-settings-surface="true" aria-labelledby="brand-settings-title" id="huisstijl"><div className={styles.surfaceHeading}><h2 id="brand-settings-title">Huisstijl</h2><p>Geef nieuwe schermcontent de uitstraling van jouw vereniging.</p></div><div className={styles.linkCards}><Link href="/dashboard/themes/fieldflow"><Palette aria-hidden="true" /><span><strong>Thema en clubkleuren</strong><small>FieldFlow of Onze Trots TV, met veilige live-uitrol</small></span><ArrowRight aria-hidden="true" size={18} /></Link></div></section>

        <section className={styles.surface} data-settings-surface="true" aria-labelledby="timezone-settings-title" id="tijdzone">
          <div className={styles.surfaceHeading}>
            <div>
              <h2 className="work-panel__title" id="timezone-settings-title">Tijdzone</h2>
              <p className="work-panel__meta">Planning, previews en activiteit gebruiken deze lokale tijd. Opgeslagen momenten blijven absolute UTC-tijdstippen.</p>
            </div>
          </div>
          <div className="field">
            <label htmlFor="settings-timezone">Lokale tijdzone</label>
            <select defaultValue={data.timezoneName} disabled={!canManage} id="settings-timezone" name="timezoneName">
              <option value="Europe/Amsterdam">Nederland · Amsterdam</option>
              <option value="Europe/Brussels">België · Brussel</option>
              <option value="Europe/Berlin">Duitsland · Berlijn</option>
              <option value="Europe/London">Verenigd Koninkrijk · Londen</option>
              <option value="Europe/Paris">Frankrijk · Parijs</option>
            </select>
          </div>
          <div className={styles.info}><Clock3 aria-hidden="true" size={20} /><p>Zomer- en wintertijd worden automatisch gevolgd. Je publicatieplanning blijft overzichtelijk in de gekozen tijdzone.</p></div><Button asChild variant="secondary"><Link href="/dashboard/planning">Planning openen<ArrowRight aria-hidden="true" size={16} /></Link></Button>
        </section>

        <section className={styles.surface} data-settings-surface="true" aria-labelledby="playback-defaults-title" id="afspelen">
          <div className={styles.surfaceHeading}>
            <div>
              <h2 className="work-panel__title" id="playback-defaults-title">Afspeelstandaarden</h2>
              <p className="work-panel__meta">Nieuwe playlistitems erven deze veilige beginwaarden.</p>
            </div>
          </div>
          <div className={styles.fieldGrid} data-settings-field-grid="true">
            <div className="field">
              <label htmlFor="settings-image-duration">Afbeeldingsduur in seconden</label>
              <input defaultValue={data.defaultImageDuration} disabled={!canManage} id="settings-image-duration" max={3600} min={5} name="defaultImageDuration" required type="number" />
            </div>
            <div className="field">
              <label htmlFor="settings-fit-mode">Standaard weergave</label>
              <select defaultValue={data.defaultFitMode} disabled={!canManage} id="settings-fit-mode" name="defaultFitMode">
                <option value="contain">Volledig in beeld</option>
                <option value="cover">Schermvullend</option>
              </select>
            </div>
          </div>
          <label className={styles.toggleRow} htmlFor="settings-video-muted">
            <input defaultChecked={data.defaultVideoMuted} disabled={!canManage} id="settings-video-muted" name="defaultVideoMuted" type="checkbox" />
            <span><strong>Video standaard zonder geluid</strong><span className="work-panel__meta">Voorkomt onverwachte autoplay-audio op publieke schermen.</span></span>
          </label>
        </section>

        <section className={styles.surface} data-settings-surface="true" aria-labelledby="screen-defaults-title" id="schermen">
          <div className={styles.surfaceHeading}>
            <div>
              <h2 className="work-panel__title" id="screen-defaults-title">Schermstandaarden</h2>
              <p className="work-panel__meta">Voorkeuren voor nieuw aangemaakte schermen.</p>
            </div>
          </div>
          <div className={styles.fieldGrid} data-settings-field-grid="true">
            <div className="field">
              <label htmlFor="settings-orientation">Oriëntatie</label>
              <select defaultValue={data.defaultScreenOrientation} disabled={!canManage} id="settings-orientation" name="defaultScreenOrientation">
                <option value="landscape">Liggend</option>
                <option value="portrait">Staand</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="settings-resolution-width">Breedte</label>
              <input defaultValue={data.defaultResolutionWidth} disabled={!canManage} id="settings-resolution-width" max={7680} min={320} name="defaultResolutionWidth" required type="number" />
            </div>
            <div className="field">
              <label htmlFor="settings-resolution-height">Hoogte</label>
              <input defaultValue={data.defaultResolutionHeight} disabled={!canManage} id="settings-resolution-height" max={4320} min={240} name="defaultResolutionHeight" required type="number" />
            </div>
          </div>
        </section>

        <section className={styles.surface} data-settings-surface="true" aria-labelledby="billing-settings-title" id="abonnement">
          <div className={styles.surfaceHeading}>
            <div>
              <h2 className="work-panel__title" id="billing-settings-title">Abonnement & facturatie</h2>
              <p className="work-panel__meta">Bekijk welke actieve schermen meetellen, de prijs na trial, facturen en de veilige betaalmethode bij Mollie.</p>
            </div>
          </div>
          <div className="settings-security-actions">
            <Button asChild variant="secondary"><Link href="/dashboard/settings/billing">Abonnement openen</Link></Button>
          </div>
        </section>

        <section className={styles.surface} data-settings-surface="true" aria-labelledby="security-settings-title" id="beveiliging">
          <div className={styles.surfaceHeading}>
            <div>
              <h2 className="work-panel__title" id="security-settings-title">Beveiliging</h2>
              <p className="work-panel__meta">Beheer je eigen sessies en tweestapsverificatie zonder tenantinstellingen te vermengen.</p>
            </div>
          </div>
          <div className={styles.linkCards}><Link href="/dashboard/account/mfa"><ShieldCheck aria-hidden="true" /><span><strong>Accountbeveiliging</strong><small>Persoonlijke instellingen en tweestapsverificatie</small></span><ArrowRight aria-hidden="true" size={18} /></Link><Link href="/dashboard/team"><UsersRound aria-hidden="true" /><span><strong>Team en toegangsrollen</strong><small>Bepaal wie wat kan beheren</small></span><ArrowRight aria-hidden="true" size={18} /></Link></div>
        </section>
        </SettingsCategoryWorkspace>
        <SettingsDirtySavebar disabled={!canManage} />
      </form>
    </div>
  );
}

async function loadSettings(tenantId: string | null, isLive: boolean, tenantName: string) {
  if (!isLive || !tenantId) return { data: { ...defaults, name: tenantName }, error: null };
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { data: { ...defaults, name: tenantName }, error: "De beveiligde datasessie ontbreekt." };

  const [tenantResult, settingsResult] = await Promise.all([
    supabase.from("tenants").select("name").eq("id", tenantId).single(),
    supabase.from("tenant_settings").select("club_location, club_website, club_profile_revision, primary_color, default_image_duration_seconds, default_fit_mode, default_video_muted, default_screen_orientation, default_resolution_width, default_resolution_height, timezone_name, default_transition, default_background_color").eq("tenant_id", tenantId).maybeSingle()
  ]);

  if (tenantResult.error || settingsResult.error) {
    console.error("Tenantinstellingen laden mislukt", tenantResult.error ?? settingsResult.error);
    return { data: { ...defaults, name: tenantName }, error: "De actuele tenantinstellingen konden niet veilig worden gelezen." };
  }

  const row = settingsResult.data;
  return {
    data: {
      clubLocation: row?.club_location ?? "",
      clubWebsite: row?.club_website ?? "",
      profileRevision: Number(row?.club_profile_revision ?? 0),
      defaultBackgroundColor: row?.default_background_color ?? defaults.defaultBackgroundColor,
      defaultFitMode: (row?.default_fit_mode ?? defaults.defaultFitMode) as TenantSettings["defaultFitMode"],
      defaultImageDuration: row?.default_image_duration_seconds ?? defaults.defaultImageDuration,
      defaultResolutionHeight: row?.default_resolution_height ?? defaults.defaultResolutionHeight,
      defaultResolutionWidth: row?.default_resolution_width ?? defaults.defaultResolutionWidth,
      defaultScreenOrientation: (row?.default_screen_orientation ?? defaults.defaultScreenOrientation) as TenantSettings["defaultScreenOrientation"],
      defaultTransition: (row?.default_transition ?? defaults.defaultTransition) as TenantSettings["defaultTransition"],
      defaultVideoMuted: row?.default_video_muted ?? defaults.defaultVideoMuted,
      name: tenantResult.data.name,
      primaryColor: row?.primary_color ?? defaults.primaryColor,
      timezoneName: row?.timezone_name ?? defaults.timezoneName
    },
    error: null
  };
}
