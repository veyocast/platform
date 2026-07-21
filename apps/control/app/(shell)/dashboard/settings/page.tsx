import { hasCapability } from "@veyocast/auth";

import { requireControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import { updateTenantSettings } from "./actions";

type SettingsPageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

type TenantSettings = {
  defaultFitMode: "contain" | "cover";
  defaultImageDuration: number;
  defaultResolutionHeight: number;
  defaultResolutionWidth: number;
  defaultScreenOrientation: "landscape" | "portrait";
  defaultVideoMuted: boolean;
  name: string;
};

const defaults: TenantSettings = {
  defaultFitMode: "contain",
  defaultImageDuration: 10,
  defaultResolutionHeight: 1080,
  defaultResolutionWidth: 1920,
  defaultScreenOrientation: "landscape",
  defaultVideoMuted: true,
  name: "Museumkwartier"
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await requireControlSession();
  const { fout, succes } = await searchParams;
  const { data, error } = await loadSettings(session.tenantId, session.isLive, session.tenant);
  const canManage =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.roles, "tenant.settings.manage");
  const canExportSupport =
    session.isLive && hasCapability(session.roles, "tenant.support.export");

  return (
    <>
      <PageHeader
        description="Beheer de echte verenigingsgegevens en veilige standaarden voor nieuwe playlistitems en schermen."
        eyebrow={session.tenant}
        status={{
          label: session.isLive ? canManage ? "Live beheer" : "Alleen bekijken" : "Demomodus",
          tone: canManage ? "success" : "warning"
        }}
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

      <form action={updateTenantSettings} className="settings-layout">
        <section className="data-surface" aria-labelledby="club-profile-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="club-profile-title">Clubprofiel</h2>
              <p className="work-panel__meta">De zichtbare naam van de actieve vereniging.</p>
            </div>
            <StatusPill label="Tenantgebonden" tone="info" />
          </div>
          <div className="field">
            <label htmlFor="settings-name">Verenigingsnaam</label>
            <input defaultValue={data.name} disabled={!canManage} id="settings-name" maxLength={120} minLength={2} name="name" required type="text" />
          </div>
        </section>

        <section className="data-surface" aria-labelledby="playback-defaults-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="playback-defaults-title">Afspeelstandaarden</h2>
              <p className="work-panel__meta">Nieuwe playlistitems erven deze veilige beginwaarden.</p>
            </div>
            <StatusPill label="Muted video" tone="success" />
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

        <section className="data-surface" aria-labelledby="screen-defaults-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="screen-defaults-title">Schermstandaarden</h2>
              <p className="work-panel__meta">Voorkeuren voor nieuw aangemaakte schermen.</p>
            </div>
            <StatusPill label="LG-ready" tone="info" />
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

        <div className="sticky-form-actions">
          <p className="work-panel__meta">Alle wijzigingen worden server-side gecontroleerd en in het auditlog vastgelegd.</p>
          <button className="button-link button-link--primary" disabled={!canManage} type="submit">Instellingen opslaan</button>
        </div>
      </form>

      <section className="data-surface support-export" aria-labelledby="support-export-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="support-export-title">Veilige supportbundel</h2>
            <p className="work-panel__meta">
              Exporteert alleen servicestatus, versie, eventcodes, release-ID&apos;s en het tijdvenster van de laatste 24 uur.
              Tokens, URL&apos;s, persoonsgegevens, credentialhashes, user agents en ruwe logs worden nooit opgenomen.
            </p>
          </div>
          <StatusPill label="Allowlist" tone="success" />
        </div>
        <div className="support-export__actions">
          {canExportSupport ? (
            <form action="/api/support-bundle" method="post">
              <button className="button-link button-link--secondary" type="submit">
                Supportbundel downloaden
              </button>
            </form>
          ) : (
            <button className="button-link button-link--secondary" disabled type="button">
              Geen exportrechten
            </button>
          )}
          <p className="work-panel__meta">Elke geslaagde export wordt append-only geaudit.</p>
        </div>
      </section>
    </>
  );
}

async function loadSettings(tenantId: string | null, isLive: boolean, tenantName: string) {
  if (!isLive || !tenantId) return { data: { ...defaults, name: tenantName }, error: null };
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { data: { ...defaults, name: tenantName }, error: "De beveiligde datasessie ontbreekt." };

  const [tenantResult, settingsResult] = await Promise.all([
    supabase.from("tenants").select("name").eq("id", tenantId).single(),
    supabase.from("tenant_settings").select("default_image_duration_seconds, default_fit_mode, default_video_muted, default_screen_orientation, default_resolution_width, default_resolution_height").eq("tenant_id", tenantId).maybeSingle()
  ]);

  if (tenantResult.error || settingsResult.error) {
    console.error("Tenantinstellingen laden mislukt", tenantResult.error ?? settingsResult.error);
    return { data: { ...defaults, name: tenantName }, error: "De actuele tenantinstellingen konden niet veilig worden gelezen." };
  }

  const row = settingsResult.data;
  return {
    data: {
      defaultFitMode: (row?.default_fit_mode ?? defaults.defaultFitMode) as TenantSettings["defaultFitMode"],
      defaultImageDuration: row?.default_image_duration_seconds ?? defaults.defaultImageDuration,
      defaultResolutionHeight: row?.default_resolution_height ?? defaults.defaultResolutionHeight,
      defaultResolutionWidth: row?.default_resolution_width ?? defaults.defaultResolutionWidth,
      defaultScreenOrientation: (row?.default_screen_orientation ?? defaults.defaultScreenOrientation) as TenantSettings["defaultScreenOrientation"],
      defaultVideoMuted: row?.default_video_muted ?? defaults.defaultVideoMuted,
      name: tenantResult.data.name
    },
    error: null
  };
}
