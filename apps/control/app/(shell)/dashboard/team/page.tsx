import { hasCapability } from "@veyocast/auth";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { loadTenantTeam } from "../../../../lib/control-overview";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import {
  changeTenantMemberRole,
  inviteTenantMember,
  removeTenantMember,
  resendTenantInvitation,
  revokeTenantInvitation
} from "./actions";

type TeamPageProps = Readonly<{
  searchParams: Promise<{ fout?: string; succes?: string; waarschuwing?: string }>;
}>;

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const session = await requireTenantControlSession("tenant.team.read");
  const query = await searchParams;
  const data = session.isLive
    ? await loadTenantTeam(session.tenantId!)
    : { error: false, invitations: [], members: demoMembers };
  const activeMembership = session.tenantMemberships.find(
    (membership) => membership.id === session.tenantId
  );
  const canManage =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.roles, "tenant.team.manage");
  const canManageOwners = activeMembership?.role === "tenant_owner";

  return (
    <>
      <PageHeader
        actions={canManage ? <a className="button-link button-link--primary" href="#nieuw-teamlid">Teamlid uitnodigen</a> : null}
        description="Beheer leden en persoonlijke uitnodigingen. Iedere rolwijziging wordt server-side gevalideerd en geaudit."
        eyebrow={session.tenant}
        status={{ label: session.isLive ? "Live tenantdata" : "Demodata", tone: session.isLive ? "success" : "warning" }}
        title="Team"
      />

      {!session.isLive ? <p className="notice notice--warning" role="status">Deze personen zijn uitsluitend lokale fixtures; teammutaties zijn uitgeschakeld.</p> : null}
      {session.tenantStatus === "paused" ? <p className="notice notice--warning" role="status">Deze vereniging is gepauzeerd. Leden en uitnodigingen blijven zichtbaar, maar wijzigingen zijn databasebreed geblokkeerd.</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Team niet beschikbaar.</strong> Leden en uitnodigingen konden niet veilig worden geladen.</p> : null}
      {query.fout ? <p className="notice notice--critical" role="alert"><strong>Actie niet uitgevoerd.</strong> {teamErrors[query.fout] ?? teamErrors.teamwijziging}</p> : null}
      {query.waarschuwing === "bezorging" ? <p className="notice notice--warning" role="status"><strong>Uitnodiging veilig geregistreerd.</strong> De e-mailprovider bevestigde de bezorging nog niet. Gebruik ‘Nieuwe link versturen’; de oude acceptance-token wordt dan ingetrokken.</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{teamSuccess[query.succes] ?? "De teamwijziging is opgeslagen en geaudit."}</p> : null}

      {canManage ? (
        <form action={inviteTenantMember} className="data-surface" id="nieuw-teamlid">
          <div className="work-panel__header"><div><h2 className="work-panel__title">Nieuw teamlid</h2><p className="work-panel__meta">De persoonlijke link verloopt na zeven dagen en werkt alleen voor het opgegeven e-mailadres.</p></div><StatusPill label="Persoonlijke uitnodiging" tone="info" /></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="team-email">E-mailadres</label><input autoComplete="email" id="team-email" maxLength={320} name="email" placeholder="vrijwilliger@vereniging.nl" required type="email" /></div>
            <div className="field"><label htmlFor="team-role">Rol</label><select defaultValue="tenant_editor" id="team-role" name="role"><option value="tenant_viewer">Kijker</option><option value="tenant_editor">Editor</option><option value="tenant_admin">Beheerder</option>{canManageOwners ? <option value="tenant_owner">Eigenaar</option> : null}</select><p>Alleen een eigenaar kan nog een eigenaar uitnodigen.</p></div>
          </div>
          <div className="sticky-form-actions"><p className="work-panel__meta">E-mailadres en invitation-token worden nooit in auditmetadata opgenomen.</p><button className="button-link button-link--primary" type="submit">Uitnodiging versturen</button></div>
        </form>
      ) : null}

      <section className="workspace-section" aria-labelledby="team-table-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="team-table-title">Gebruikers en rollen</h2><p className="work-panel__meta">De laatste eigenaar en je eigen toegang kunnen niet via deze route worden verwijderd of gedegradeerd.</p></div><StatusPill label={`${data.members.length} personen`} tone="neutral" /></div>
        {data.members.length ? <div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Toegang binnen de actieve vereniging.</caption><thead><tr><th scope="col">Gebruiker</th><th scope="col">Rol</th><th scope="col">Toegevoegd</th><th scope="col">Beheer</th></tr></thead><tbody>{data.members.map((member) => { const isSelf = member.user_id === session.userId; const targetIsOwner = member.role === "tenant_owner"; const canEditTarget = canManage && !isSelf && (canManageOwners || !targetIsOwner); return <tr key={member.user_id}><td data-label="Gebruiker"><span className="table-primary">{member.display_name || `Gebruiker ${member.user_id.slice(0, 8)}`}</span>{isSelf ? <span className="table-secondary">Huidige gebruiker</span> : null}</td><td data-label="Rol">{roleLabel(member.role)}</td><td data-label="Toegevoegd">{formatDate(member.created_at)}</td><td data-label="Beheer">{canEditTarget ? <div className="table-actions"><form action={changeTenantMemberRole} className="inline-form"><input name="userId" type="hidden" value={member.user_id} /><label className="sr-only" htmlFor={`role-${member.user_id}`}>Rol voor {member.display_name || member.user_id}</label><select defaultValue={member.role} id={`role-${member.user_id}`} name="role"><option value="tenant_viewer">Kijker</option><option value="tenant_editor">Editor</option><option value="tenant_admin">Beheerder</option>{canManageOwners ? <option value="tenant_owner">Eigenaar</option> : null}</select><button className="table-action" type="submit">Rol opslaan</button></form><details><summary>Toegang intrekken</summary><form action={removeTenantMember} className="auth-form"><input name="userId" type="hidden" value={member.user_id} /><label className="check-row"><input name="confirmRemove" required type="checkbox" /><span><strong>Toegang definitief intrekken</strong><span className="work-panel__meta">Open sessies verliezen bij de volgende serverrequest hun tenantcontext.</span></span></label><button className="button-link button-link--secondary" type="submit">Toegang intrekken</button></form></details></div> : <span>{isSelf ? "Beschermd tegen self-lockout" : "Alleen een eigenaar kan deze rol beheren"}</span>}</td></tr>; })}</tbody></table></div> : <p className="notice" role="status">Nog geen teamleden binnen deze vereniging.</p>}
      </section>

      <section className="workspace-section" id="uitnodigingen" aria-labelledby="team-invitations-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="team-invitations-title">Uitnodigingen</h2><p className="work-panel__meta">Pending, verlopen, geaccepteerd en ingetrokken blijven zichtbaar als beheerbewijs.</p></div><StatusPill label={`${data.invitations.length} totaal`} tone="neutral" /></div>
        {data.invitations.length ? <div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Persoonlijke tenantuitnodigingen.</caption><thead><tr><th scope="col">E-mail</th><th scope="col">Rol</th><th scope="col">Status</th><th scope="col">Bezorging</th><th scope="col">Actie</th></tr></thead><tbody>{data.invitations.map((invitation) => { const effectiveStatus = invitation.status === "pending" && new Date(invitation.expires_at) <= new Date() ? "expired" : invitation.status; return <tr key={invitation.id}><td data-label="E-mail"><span className="table-primary">{invitation.email}</span><span className="table-secondary">Aangemaakt {formatDate(invitation.created_at)}</span></td><td data-label="Rol">{roleLabel(invitation.role)}</td><td data-label="Status"><StatusPill label={invitationStatusLabel(effectiveStatus)} tone={effectiveStatus === "accepted" ? "success" : effectiveStatus === "pending" ? "info" : "neutral"} /></td><td data-label="Bezorging">{deliveryLabel(invitation.delivery_status)}</td><td data-label="Actie">{canManage && invitation.status === "pending" ? <div className="table-actions"><form action={resendTenantInvitation}><input name="invitationId" type="hidden" value={invitation.id} /><button className="table-action" type="submit">Nieuwe link versturen</button></form><details><summary>Intrekken</summary><form action={revokeTenantInvitation} className="auth-form"><input name="invitationId" type="hidden" value={invitation.id} /><label className="check-row"><input name="confirmRevoke" required type="checkbox" /><span><strong>Link ongeldig maken</strong></span></label><button className="button-link button-link--secondary" type="submit">Uitnodiging intrekken</button></form></details></div> : <span>Geen actie</span>}</td></tr>; })}</tbody></table></div> : <p className="notice" role="status">Er zijn nog geen uitnodigingen verstuurd.</p>}
      </section>
    </>
  );
}

const demoMembers = [
  { created_at: "2026-07-19T08:24:00.000Z", display_name: "Lokale beheerder", role: "tenant_admin", user_id: "demo-admin" },
  { created_at: "2026-07-19T08:12:00.000Z", display_name: "Lokale editor", role: "tenant_editor", user_id: "demo-editor" }
];

const teamErrors: Record<string, string> = {
  bestaat: "Voor dit e-mailadres staat al een uitnodiging open of het account is al lid.",
  bevestiging: "Bevestig eerst de impact van deze destructieve actie.",
  configuratie: "De beveiligde datasessie ontbreekt. Log opnieuw in en probeer opnieuw.",
  invoer: "Controleer e-mailadres en rol. Er is niets gewijzigd.",
  "laatste-eigenaar": "De laatste eigenaar kan niet worden verwijderd of gedegradeerd. Wijs eerst een tweede eigenaar aan.",
  rechten: "Je rol mag deze teamwijziging niet uitvoeren.",
  teamwijziging: "De teamwijziging kon niet veilig worden uitgevoerd. Vernieuw de pagina en controleer de actuele rollen.",
  uitnodiging: "De uitnodiging kon niet veilig worden gewijzigd. Vernieuw de pagina en probeer opnieuw.",
  zelf: "Je kunt je eigen rol of toegang hier niet wijzigen. Vraag een andere eigenaar om de overdracht af te ronden."
};

const teamSuccess: Record<string, string> = {
  ingetrokken: "De uitnodiging is ingetrokken en kan niet meer worden gebruikt.",
  rol: "De rol is gewijzigd en in het auditlog vastgelegd.",
  verwijderd: "De toegang is ingetrokken en in het auditlog vastgelegd.",
  verstuurd: "De persoonlijke uitnodigingslink is verstuurd."
};

function roleLabel(value: string) { return value === "tenant_owner" ? "Eigenaar" : value === "tenant_admin" ? "Beheerder" : value === "tenant_editor" ? "Editor" : "Kijker"; }
function invitationStatusLabel(value: string) { return value === "pending" ? "In afwachting" : value === "accepted" ? "Geaccepteerd" : value === "revoked" ? "Ingetrokken" : "Verlopen"; }
function deliveryLabel(value: string) { return value === "sent" ? "Verstuurd" : value === "failed" ? "Mislukt · herstel nodig" : "Nog niet bevestigd"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(value)); }
