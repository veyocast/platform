import Link from "next/link";

import { hasCapability } from "@veyocast/auth";
import { Button } from "@veyocast/ui";

import { requireControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { PageHeader } from "../../_components/shell-primitives";
import { updateTenantSettings } from "./actions";
import { SettingsCategoryWorkspace } from "./settings-category-workspace";
import { SettingsDirtySavebar } from "./settings-dirty-savebar";

type SettingsPageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

type TenantSettings = {
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
    <>
      <PageHeader
        description="Beheer de echte verenigingsgegevens en veilige standaarden voor nieuwe playlistitems en schermen."
        eyebrow={session.tenant}
        status={!session.isLive
          ? { label: "Demomodus", tone: "warning" }
          : !canManage
            ? { label: "Alleen bekijken", tone: "warning" }
            : undefined}
        title="Instellingen"
      />

      {fout ? <p className="notice notice--critical" role="alert"><strong>Opslaan mislukt.</strong> {fout}</p> : null}
      {succes ? <p className="notice notice--success" role="status">{succes}</p> : null}
      {error ? <p className="notice notice--critical" role="alert"><strong>Instellingen niet geladen.</strong> {error}</p> : null}
      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          Configureer Supabase en log in om instellingen echt op te slaan. In demomodus blijven alle velden uitgeschakeld.
        </p>
      ) : null}

      <form action={updateTenantSettings} className="settings-workspace-form">
        <input name="defaultBackgroundColor" type="hidden" value={data.defaultBackgroundColor ?? ""} />
        <input name="defaultTransition" type="hidden" value={data.defaultTransition} />
        <input name="primaryColor" type="hidden" value={data.primaryColor} />
        <SettingsCategoryWorkspace>
        <section className="data-surface" aria-labelledby="club-profile-title" id="clubprofiel">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="club-profile-title">Clubprofiel</h2>
              <p className="work-panel__meta">De zichtbare naam van de actieve vereniging.</p>
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="settings-name">Verenigingsnaam</label>
              <input defaultValue={data.name} disabled={!canManage} id="settings-name" maxLength={120} minLength={2} name="name" required type="text" />
            </div>
          </div>
        </section>

        <section className="data-surface" aria-labelledby="timezone-settings-title" id="tijdzone">
          <div className="work-panel__header">
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
        </section>

        <section className="data-surface" aria-labelledby="playback-defaults-title" id="afspelen">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="playback-defaults-title">Afspeelstandaarden</h2>
              <p className="work-panel__meta">Nieuwe playlistitems erven deze veilige beginwaarden.</p>
            </div>
          </div>
          <div className="form-grid">
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
          <label className="check-row" htmlFor="settings-video-muted">
            <input defaultChecked={data.defaultVideoMuted} disabled={!canManage} id="settings-video-muted" name="defaultVideoMuted" type="checkbox" />
            <span><strong>Video standaard zonder geluid</strong><span className="work-panel__meta">Voorkomt onverwachte autoplay-audio op publieke schermen.</span></span>
          </label>
        </section>

        <section className="data-surface" aria-labelledby="screen-defaults-title" id="schermen">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="screen-defaults-title">Schermstandaarden</h2>
              <p className="work-panel__meta">Voorkeuren voor nieuw aangemaakte schermen.</p>
            </div>
          </div>
          <div className="form-grid">
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

        <section className="data-surface" aria-labelledby="billing-settings-title" id="abonnement">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="billing-settings-title">Abonnement & facturatie</h2>
              <p className="work-panel__meta">Bekijk welke actieve schermen meetellen, de prijs na trial, facturen en de veilige betaalmethode bij Mollie.</p>
            </div>
          </div>
          <div className="settings-security-actions">
            <Button asChild variant="secondary"><Link href="/dashboard/settings/billing">Abonnement openen</Link></Button>
          </div>
        </section>

        <section className="data-surface" aria-labelledby="security-settings-title" id="beveiliging">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="security-settings-title">Beveiliging</h2>
              <p className="work-panel__meta">Beheer je eigen sessies en tweestapsverificatie zonder tenantinstellingen te vermengen.</p>
            </div>
          </div>
          <div className="settings-security-actions">
            <Button asChild variant="secondary"><Link href="/dashboard/account/mfa">Tweestapsverificatie beheren</Link></Button>
            <Button asChild variant="ghost"><Link href="/dashboard/account">Accountinstellingen</Link></Button>
          </div>
        </section>
        </SettingsCategoryWorkspace>
        <SettingsDirtySavebar disabled={!canManage} />
      </form>
    </>
  );
}

async function loadSettings(tenantId: string | null, isLive: boolean, tenantName: string) {
  if (!isLive || !tenantId) return { data: { ...defaults, name: tenantName }, error: null };
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { data: { ...defaults, name: tenantName }, error: "De beveiligde datasessie ontbreekt." };

  const [tenantResult, settingsResult] = await Promise.all([
    supabase.from("tenants").select("name").eq("id", tenantId).single(),
    supabase.from("tenant_settings").select("primary_color, default_image_duration_seconds, default_fit_mode, default_video_muted, default_screen_orientation, default_resolution_width, default_resolution_height, timezone_name, default_transition, default_background_color").eq("tenant_id", tenantId).maybeSingle()
  ]);

  if (tenantResult.error || settingsResult.error) {
    console.error("Tenantinstellingen laden mislukt", tenantResult.error ?? settingsResult.error);
    return { data: { ...defaults, name: tenantName }, error: "De actuele tenantinstellingen konden niet veilig worden gelezen." };
  }

  const row = settingsResult.data;
  return {
    data: {
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
