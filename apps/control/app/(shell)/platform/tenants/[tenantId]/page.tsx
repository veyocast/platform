import { hasCapability } from "@veyocast/auth";
import { SummaryStrip } from "@veyocast/ui";
import Link from "next/link";

import { requireControlCapability } from "../../../../../lib/control-session";
import {
  invitationDeliveryLabel,
  invitationDeliveryRecovery
} from "../../../../../lib/invitation-delivery";
import { loadPlatformTenantDetail } from "../../../../../lib/platform-management";
import { switchTenantContext } from "../../../context/actions";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import {
  resendProvisioningInvitation,
  updateTenantFeatureFlag,
  updateTenantLifecycle,
  updateTenantScreenLimit
} from "./actions";

type PlatformTenantDetailPageProps = Readonly<{
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ fout?: string; succes?: string; waarschuwing?: string }>;
}>;

export default async function PlatformTenantDetailPage({
  params,
  searchParams
}: PlatformTenantDetailPageProps) {
  const session = await requireControlCapability("platform.tenant.read");
  const { tenantId } = await params;
  const query = await searchParams;
  const data = session.isLive ? await loadPlatformTenantDetail(tenantId) : null;

  if (!data || data.error || !data.tenant) {
    return (
      <div className="page-stack page-stack--narrow">
        <PageHeader description="De vereniging kon niet veilig worden geladen." eyebrow="Platform" title="Vereniging niet beschikbaar" />
        <p className="notice notice--critical" role="alert">Controleer je platformrechten en probeer opnieuw. Er is niets gewijzigd.</p>
        <Link className="button-link button-link--secondary" href="/platform/tenants">Terug naar verenigingen</Link>
      </div>

    );
  }

  const tenant = data.tenant;
  const canManage = hasCapability(session.capabilities, "platform.tenant.lifecycle");
  const aal2Ready = !session.isLive || session.assuranceLevel === "aal2";
  const canMutate = canManage && aal2Ready;
  const membership = session.tenantMemberships.find((item) => item.id === tenant.id);

  return (
    <>
      <PageHeader
        actions={<Link className="button-link button-link--secondary" href="/platform/tenants">Alle verenigingen</Link>}
        description="Beheer lifecycle, capaciteit, eigenaarschap en provisioning vanuit één geauditeerde platformroute."
        eyebrow="Platform · Vereniging"
        status={tenant.status !== "active"
          ? { label: statusLabel(tenant.status), tone: "warning" }
          : undefined}
        title={tenant.name}
      />

      {!aal2Ready && canManage ? (
        <p className="notice notice--warning" role="status"><strong>Extra verificatie nodig.</strong> Lifecycle- en limietwijzigingen blijven geblokkeerd tot je <Link href={`/auth/mfa?reden=aal2&terug=${encodeURIComponent(`/platform/tenants/${tenant.id}`)}`}>AAL2 bevestigt</Link>.</p>
      ) : null}
      {query.fout ? <p className="notice notice--critical" role="alert"><strong>Wijziging niet uitgevoerd.</strong> {tenantErrors[query.fout] ?? tenantErrors.onverwacht}</p> : null}
      {query.waarschuwing === "uitnodiging" ? <p className="notice notice--warning" role="status"><strong>Vereniging veilig aangemaakt.</strong> De eigenaaruitnodiging kon nog niet worden bezorgd. De tenant blijft zichtbaar als ‘e-mailactie nodig’; verstuur hieronder een nieuwe link.</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{successMessage[query.succes] ?? "De wijziging is opgeslagen en geaudit."}</p> : null}

      <SummaryStrip
        aria-label="Verenigingsoverzicht"
        items={[
          { detail: "Gebruik en limiet", label: "Schermen", value: `${data.screenCount}/${tenant.screen_limit}` },
          {
            detail: `${data.members.filter((member) => member.role === "tenant_owner").length} eigenaar/eigenaren`,
            label: "Teamleden",
            value: data.members.length
          },
          { detail: "Actieve media-assets", label: "Mediaopslag", value: formatBytes(data.storageBytes) },
          {
            detail: `${tenant.locale} · ${tenant.timezone}`,
            label: "Provisioning",
            value: provisioningLabel(tenant.provisioning_status)
          }
        ]}
      />

      {membership && tenant.status !== "archived" ? (
        <form action={switchTenantContext}>
          <input name="tenantSlug" type="hidden" value={membership.slug} />
          <input name="returnTo" type="hidden" value="/dashboard" />
          <button className="button-link button-link--primary" type="submit">Open vereniging</button>
        </form>
      ) : (
        <p className="notice" role="status">Je platformrol geeft beheerinzage, maar opent niet automatisch tenantdata. Alleen een expliciete tenantmembership maakt ‘Open vereniging’ beschikbaar.</p>
      )}

      <div className="work-grid">
        <section className="work-panel" aria-labelledby="lifecycle-title">
          <div className="work-panel__header"><div><p className="eyebrow">Lifecycle</p><h2 id="lifecycle-title">Status en impact</h2></div><StatusPill label={statusLabel(tenant.status)} tone={tenant.status === "active" ? "success" : "warning"} /></div>
          <p>Gepauzeerd blijft leesbaar en speelt bestaande releases af, maar blokkeert wijzigingen, publicatie en pairing. Archiveren verwijdert de normale Control-context; last-known-good playback blijft behouden.</p>
          {tenant.status !== "active" ? (
            <form action={updateTenantLifecycle} className="inline-form">
              <input name="tenantId" type="hidden" value={tenant.id} />
              <input name="status" type="hidden" value="active" />
              <button className="button-link button-link--primary" disabled={!canMutate} type="submit">Heractiveren</button>
            </form>
          ) : null}
          {tenant.status !== "paused" ? <LifecycleForm disabled={!canMutate} status="paused" tenantId={tenant.id} /> : null}
          {tenant.status !== "archived" ? <LifecycleForm disabled={!canMutate} status="archived" tenantId={tenant.id} /> : null}
        </section>

        <section className="work-panel" id="limieten" aria-labelledby="limit-title">
          <div className="work-panel__header"><div><p className="eyebrow">Capaciteit</p><h2 id="limit-title">Schermlimiet</h2></div><StatusPill label={`${data.screenCount} in gebruik`} tone={data.screenCount >= tenant.screen_limit ? "warning" : "neutral"} /></div>
          <form action={updateTenantScreenLimit} className="auth-form">
            <input name="tenantId" type="hidden" value={tenant.id} />
            <div className="field"><label htmlFor="screen-limit">Maximaal aantal schermen</label><input defaultValue={tenant.screen_limit} disabled={!canMutate} id="screen-limit" min={Math.max(1, data.screenCount)} max={10000} name="screenLimit" required type="number" /><p>De limiet kan nooit lager worden dan de {data.screenCount} bestaande schermen.</p></div>
            <button className="button-link button-link--primary" disabled={!canMutate} type="submit">Limiet opslaan</button>
          </form>
        </section>
      </div>

      <section className="workspace-section" id="productuitrol" aria-labelledby="feature-rollout-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="feature-rollout-title">Gecontroleerde productuitrol</h2><p className="work-panel__meta">Flags sturen alleen ontdekking en presentatie. Capabilities, RLS en tenantstatus blijven server-side leidend.</p></div><StatusPill label="AAL2 + audit" tone="info" /></div>
        <div className="work-grid">
          {featureDefinitions.map((definition) => {
            const stored = data.featureFlags.find((flag) => flag.flag_key === definition.key);
            const enabled = stored?.enabled === true;
            return <section className="work-panel" key={definition.key}><div className="work-panel__header"><div><p className="eyebrow">{definition.status}</p><h3>{definition.label}</h3></div><StatusPill label={enabled ? "Vrijgegeven" : "Uit"} tone={enabled ? "success" : "neutral"} /></div><p>{definition.description}</p>{stored ? <p className="work-panel__meta">Laatste reden: {stored.rollout_reason}</p> : <p className="work-panel__meta">Geen cohortbesluit: canonieke default is uit.</p>}<form action={updateTenantFeatureFlag} className="auth-form"><input name="tenantId" type="hidden" value={tenant.id} /><input name="flagKey" type="hidden" value={definition.key} /><input name="enabled" type="hidden" value={enabled ? "no" : "yes"} /><div className="field"><label htmlFor={`flag-reason-${definition.key}`}>Reden voor {enabled ? "uitschakelen" : "vrijgeven"}</label><textarea disabled={!canMutate} id={`flag-reason-${definition.key}`} maxLength={500} minLength={8} name="reason" placeholder="Cohort, eigenaar en verificatiepad" required /></div><button className={enabled ? "button-link button-link--secondary" : "button-link button-link--primary"} disabled={!canMutate} type="submit">{enabled ? "Kill switch activeren" : "Tenant vrijgeven"}</button></form></section>;
          })}
        </div>
      </section>

      <section className="workspace-section" id="uitnodigingen" aria-labelledby="invitation-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="invitation-title">Uitnodigingen</h2><p className="work-panel__meta">Een nieuwe verzending roteert de acceptance-token; de vorige link wordt direct ongeldig.</p></div><StatusPill label={`${data.invitations.length} totaal`} tone="neutral" /></div>
        {data.invitations.length ? <div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Uitnodigingen voor deze vereniging.</caption><thead><tr><th scope="col">E-mail</th><th scope="col">Rol</th><th scope="col">Status</th><th scope="col">Bezorging</th><th scope="col">Actie</th></tr></thead><tbody>{data.invitations.map((invitation) => { const effectiveStatus = invitation.status === "pending" && new Date(invitation.expires_at) <= new Date() ? "expired" : invitation.status; return <tr key={invitation.id}><td data-label="E-mail"><span className="table-primary">{invitation.email}</span></td><td data-label="Rol">{roleLabel(invitation.role)}</td><td data-label="Status">{invitationStatusLabel(effectiveStatus)}</td><td data-label="Bezorging"><span className="table-primary">{invitationDeliveryLabel(invitation.delivery_status, invitation.last_delivery_error_code)}</span>{invitation.delivery_status === "failed" ? <span className="work-panel__meta">{invitationDeliveryRecovery(invitation.last_delivery_error_code)}</span> : null}</td><td data-label="Actie">{invitation.status === "pending" ? <form action={resendProvisioningInvitation}><input name="tenantId" type="hidden" value={tenant.id} /><input name="invitationId" type="hidden" value={invitation.id} /><button className="table-action" disabled={!canMutate} type="submit">Nieuwe link versturen</button></form> : <span>Geen actie</span>}</td></tr>; })}</tbody></table></div> : <p className="notice" role="status">Geen uitnodigingen gevonden.</p>}
      </section>

      <section className="workspace-section" aria-labelledby="member-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="member-title">Team</h2><p className="work-panel__meta">Platforminzage; dagelijkse rolmutaties lopen via de tenantteamroute.</p></div></div>
        {data.members.length ? <div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Actieve leden van deze vereniging.</caption><thead><tr><th scope="col">Gebruiker</th><th scope="col">Rol</th><th scope="col">Sinds</th></tr></thead><tbody>{data.members.map((member) => <tr key={member.user_id}><td data-label="Gebruiker"><span className="table-primary">{member.display_name || `Gebruiker ${member.user_id.slice(0, 8)}`}</span></td><td data-label="Rol">{roleLabel(member.role)}</td><td data-label="Sinds">{formatDate(member.created_at)}</td></tr>)}</tbody></table></div> : <p className="notice notice--warning" role="status">Nog geen geaccepteerde eigenaar. Herstel eerst de eigenaaruitnodiging.</p>}
      </section>

      <section className="workspace-section" aria-labelledby="audit-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="audit-title">Recente beheer-events</h2><p className="work-panel__meta">Privacyveilige acties zonder invitation-token, MFA-secret of providerresponse.</p></div></div>
        <ul className="context-list">{data.auditEvents.map((event) => <li className="context-list__item" key={event.id}><div><strong>{event.action}</strong><p>{event.target_type} · {formatDateTime(event.created_at)}</p></div><StatusPill label={event.result === "success" ? "Geslaagd" : "Aandacht"} tone={event.result === "success" ? "success" : "warning"} /></li>)}</ul>
      </section>
    </>
  );
}

function LifecycleForm({ disabled, status, tenantId }: Readonly<{ disabled: boolean; status: "paused" | "archived"; tenantId: string }>) {
  return <details className="data-surface"><summary>{status === "paused" ? "Vereniging pauzeren" : "Vereniging archiveren"}</summary><form action={updateTenantLifecycle} className="auth-form"><input name="tenantId" type="hidden" value={tenantId} /><input name="status" type="hidden" value={status} /><label className="check-row"><input disabled={disabled} name="confirmImpact" required type="checkbox" /><span><strong>Ik begrijp de impact</strong><span className="work-panel__meta">{status === "paused" ? "Nieuwe wijzigingen, publicaties en koppelingen stoppen; bestaande playback blijft werken." : "De normale tenantcontext verdwijnt; bestaande last-known-good playback blijft beschikbaar."}</span></span></label><button className="button-link button-link--secondary" disabled={disabled} type="submit">{status === "paused" ? "Pauzeren" : "Archiveren"}</button></form></details>;
}

const tenantErrors: Record<string, string> = {
  bevestiging: "Bevestig eerst dat je de impact begrijpt.",
  configuratie: "De beveiligde datasessie ontbreekt. Log opnieuw in en probeer opnieuw.",
  featureflag: "Het cohortbesluit is ongeldig of kon niet veilig worden geaudit.",
  invoer: "De aangeleverde wijziging is ongeldig.",
  lifecycle: "De lifecycle kon niet veilig worden gewijzigd. Controleer de huidige status.",
  "limiet-in-gebruik": "De limiet is lager dan het actuele aantal schermen. Verwijder geen data; kies minimaal het huidige gebruik.",
  onverwacht: "De wijziging kon niet veilig worden voltooid. Er is niets gedeeltelijk opgeslagen.",
  rechten: "Je mist de vereiste platformcapability of AAL2-verificatie.",
  schermlimiet: "Kies een schermlimiet tussen het actuele gebruik en 10.000.",
  uitnodiging: "De uitnodiging kon niet veilig worden vernieuwd. Vernieuw de pagina en probeer opnieuw."
};

const successMessage: Record<string, string> = {
  aangemaakt: "De vereniging en eigenaaruitnodiging zijn veilig aangemaakt.",
  bestaand: "Deze opdracht was al verwerkt; het bestaande resultaat is geladen.",
  lifecycle: "De lifecycle-status is gewijzigd en geaudit.",
  limiet: "De schermlimiet is gewijzigd en geaudit.",
  featureflag: "De productuitrol is gewijzigd en met reden geaudit.",
  uitnodiging: "Een nieuwe uitnodigingslink is verstuurd; de vorige link is ingetrokken."
};

function statusLabel(value: string) { return value === "active" ? "Actief" : value === "paused" ? "Gepauzeerd" : "Gearchiveerd"; }
function provisioningLabel(value: string) { return value === "ready" ? "Gereed" : value === "mail_failed" ? "E-mailactie nodig" : "Uitnodiging voorbereiden"; }
function roleLabel(value: string) { return value === "tenant_owner" ? "Eigenaar" : value === "tenant_admin" ? "Beheerder" : value === "tenant_editor" ? "Editor" : "Kijker"; }
function invitationStatusLabel(value: string) { return value === "pending" ? "In afwachting" : value === "accepted" ? "Geaccepteerd" : value === "revoked" ? "Ingetrokken" : "Verlopen"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`; return `${(value / 1024 ** 3).toFixed(1)} GB`; }

const featureDefinitions = [
  { description: "Semantische Vector-tokens, compacte geometrie en consistente light/dark componenttaal.", key: "vector_v2_design_system", label: "Vector-designsysteem", status: "STABIELE BASIS" },
  { description: "Living Venue-rail, commandbar, System Pulse en zichtbare operationele context in Control.", key: "vector_v2_control_shell", label: "Vector Control-shell", status: "PILOT" },
  { description: "Eén toegankelijke bronkiezer voor media, slides, templates en ondersteunde integratieassets.", key: "unified_resource_picker", label: "Unified Resource Picker", status: "PILOT" },
  { description: "Eén samenhangende zoek- en filterervaring voor operationele resourcepagina's.", key: "unified_filter_dock", label: "Unified Filter Dock", status: "PILOT" },
  { description: "Persistente venues, zones, plattegronden en genormaliseerde schermposities met toegankelijke lijstfallback.", key: "venue_twin", label: "Venue Twin", status: "PILOTPRODUCT" },
  { description: "Samengestelde vlootgezondheid boven bestaande heartbeat-, sync-, error- en opslagtelemetry.", key: "screen_health_view", label: "Screen Health", status: "PILOT UI" },
  { description: "Polls en publieksstemmen met QR, lifecycle, misbruikbeperking en live resultaten.", key: "engage", label: "Engage", status: "PILOTPRODUCT" },
  { description: "Officiële online-only playback met Data/IFrame API en verplichte lokale fallback.", key: "youtube_integration", label: "YouTube", status: "PROVIDER GATED" }
] as const;
