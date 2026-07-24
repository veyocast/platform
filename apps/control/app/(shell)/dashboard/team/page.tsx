import { hasCapability } from "@veyocast/auth";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { loadTenantTeam } from "../../../../lib/control-overview";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import {
  archiveTenantCustomRole,
  changeTenantMemberRole,
  inviteTenantMember,
  removeTenantMember,
  resendTenantInvitation,
  revokeTenantInvitation
} from "./actions";
import {
  CustomRoleDialog,
  type CustomRoleView
} from "./custom-role-dialogs";

type TeamPageProps = Readonly<{
  searchParams: Promise<{ fout?: string; succes?: string; waarschuwing?: string }>;
}>;

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const session = await requireTenantControlSession("tenant.team.read");
  const query = await searchParams;
  const data = session.isLive
    ? await loadTenantTeam(session.tenantId!)
    : { customRoles: [], error: false, invitations: [], members: [] };
  const activeMembership = session.tenantMemberships.find(
    (membership) => membership.id === session.tenantId
  );
  const canManage =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.team.manage");
  const canManageOwners = activeMembership?.role === "tenant_owner";
  const canManageCustomRoles = canManageOwners || session.roles.some(
    (role) => role === "platform_owner" || role === "platform_admin"
  );
  const customRoles = data.customRoles as CustomRoleView[];
  const activeCustomRoles = customRoles.filter((role) => role.status === "active");
  const customRoleNames = new Map(customRoles.map((role) => [role.id, role.name]));

  return (
    <>
      <PageHeader
        actions={canManage ? <a className="button-link button-link--primary" href="#nieuw-teamlid">Teamlid uitnodigen</a> : null}
        description="Beheer toegang met beschermde standaardrollen en tenant-eigen werkrollen."
        eyebrow={session.tenant}
        status={!session.isLive ? { label: "Demomodus", tone: "warning" } : undefined}
        title="Team"
      />

      {!session.isLive ? <p className="notice notice--warning" role="status">Configureer Supabase en log in om echte teamleden en rollen te beheren.</p> : null}
      {session.tenantStatus === "paused" ? <p className="notice notice--warning" role="status">Deze vereniging is gepauzeerd. Toegang blijft zichtbaar, maar wijzigingen zijn databasebreed geblokkeerd.</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Team niet beschikbaar.</strong> Leden, rollen en uitnodigingen konden niet veilig worden geladen.</p> : null}
      {query.fout ? <p className="notice notice--critical" role="alert"><strong>Actie niet uitgevoerd.</strong> {teamErrors[query.fout] ?? teamErrors.teamwijziging}</p> : null}
      {query.waarschuwing === "bezorging" ? <p className="notice notice--warning" role="status"><strong>Uitnodiging veilig geregistreerd.</strong> De e-mailprovider bevestigde de bezorging nog niet. Verstuur een nieuwe link om de oude token in te trekken.</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{teamSuccess[query.succes] ?? "De teamwijziging is opgeslagen en geaudit."}</p> : null}

      <section className="workspace-section" aria-labelledby="custom-roles-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="custom-roles-title">Custom rollen</h2>
            <p className="work-panel__meta">Iedere tenantgebruiker kan gedeelde inhoud bekijken. Eigenaars bepalen welke werkacties een custom rol daarbovenop krijgt.</p>
          </div>
          {canManageCustomRoles ? <CustomRoleDialog /> : <StatusPill label={`${activeCustomRoles.length} actief`} tone="neutral" />}
        </div>
        {customRoles.length ? (
          <div className="role-card-grid">
            {customRoles.map((role) => {
              const memberCount = data.members.filter((member) => member.custom_role_id === role.id).length;
              const pendingCount = data.invitations.filter(
                (invitation) => invitation.custom_role_id === role.id && invitation.status === "pending"
              ).length;
              const assignedCount = memberCount + pendingCount;
              return (
                <article className="role-card" data-muted={role.status === "archived"} key={role.id}>
                  <div className="role-card__header">
                    <div>
                      <h3 title={role.name}>{role.name}</h3>
                      <p>{role.description || "Geen beschrijving toegevoegd."}</p>
                    </div>
                    <StatusPill
                      label={role.status === "active" ? "Actief" : "Gearchiveerd"}
                      tone={role.status === "active" ? "success" : "neutral"}
                    />
                  </div>
                  <ul className="role-capability-list" aria-label={`Rechten van ${role.name}`}>
                    {roleCapabilityLabels(role.capabilities).map((label) => <li key={label}>{label}</li>)}
                  </ul>
                  <div className="role-card__footer">
                    <span>{memberCount} leden · {pendingCount} open uitnodigingen</span>
                    {canManageCustomRoles && role.status === "active" ? (
                      <div className="role-card__actions">
                        <CustomRoleDialog role={role} />
                        <details>
                          <summary>Archiveren</summary>
                          <form action={archiveTenantCustomRole} className="auth-form">
                            <input name="expectedRevision" type="hidden" value={role.revision} />
                            <input name="roleId" type="hidden" value={role.id} />
                            <label className="check-row">
                              <input disabled={assignedCount > 0} name="confirmArchive" required type="checkbox" />
                              <span>
                                <strong>Rol archiveren</strong>
                                <span className="work-panel__meta">
                                  {assignedCount > 0
                                    ? "Wijs eerst alle leden en open uitnodigingen een andere rol toe."
                                    : "De rol verdwijnt uit nieuwe toewijzingen."}
                                </span>
                              </span>
                            </label>
                            <button className="button-link button-link--secondary" disabled={assignedCount > 0} type="submit">Rol archiveren</button>
                          </form>
                        </details>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="notice" role="status">Nog geen custom rollen. De beschermde rollen Eigenaar, Beheerder, Editor en Kijker blijven beschikbaar.</p>
        )}
      </section>

      {canManage ? (
        <form action={inviteTenantMember} className="data-surface team-invite-form" id="nieuw-teamlid">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title">Nieuw teamlid</h2>
              <p className="work-panel__meta">De persoonlijke link verloopt na zeven dagen en werkt alleen voor het opgegeven e-mailadres.</p>
            </div>
            <StatusPill label="Persoonlijke uitnodiging" tone="info" />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="team-email">E-mailadres</label>
              <input autoComplete="email" id="team-email" maxLength={320} name="email" placeholder="vrijwilliger@vereniging.nl" required type="email" />
            </div>
            <div className="field">
              <label htmlFor="team-access">Rol</label>
              <select defaultValue="builtin:tenant_editor" id="team-access" name="access">
                <optgroup label="Standaardrollen">
                  <option value="builtin:tenant_viewer">Kijker</option>
                  <option value="builtin:tenant_editor">Editor</option>
                  <option value="builtin:tenant_admin">Beheerder</option>
                  {canManageOwners ? <option value="builtin:tenant_owner">Eigenaar</option> : null}
                </optgroup>
                {activeCustomRoles.length ? (
                  <optgroup label="Custom rollen">
                    {activeCustomRoles.map((role) => <option key={role.id} value={`custom:${role.id}`}>{role.name}</option>)}
                  </optgroup>
                ) : null}
              </select>
              <p>Alleen een eigenaar kan een andere eigenaar uitnodigen.</p>
            </div>
          </div>
          <div className="sticky-form-actions team-invite-actions">
            <p className="work-panel__meta">E-mailadres en invitation-token worden nooit in auditmetadata opgenomen.</p>
            <button className="button-link button-link--primary" type="submit">Uitnodiging versturen</button>
          </div>
        </form>
      ) : null}

      <section className="workspace-section" aria-labelledby="team-table-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="team-table-title">Gebruikers en rollen</h2>
            <p className="work-panel__meta">De laatste eigenaar en je eigen toegang zijn beschermd tegen self-lockout.</p>
          </div>
          <StatusPill
            label={data.members.length === 1 ? "1 persoon" : `${data.members.length} personen`}
            tone="neutral"
          />
        </div>
        {data.members.length ? (
          <div className="data-table-frame">
            <table className="data-table data-table--responsive">
              <caption>Toegang binnen de actieve vereniging.</caption>
              <thead><tr><th scope="col">Gebruiker</th><th scope="col">Rol</th><th scope="col">Toegevoegd</th><th scope="col">Beheer</th></tr></thead>
              <tbody>
                {data.members.map((member) => {
                  const isSelf = member.user_id === session.userId;
                  const targetIsOwner = member.role === "tenant_owner";
                  const canEditTarget = canManage && !isSelf && (canManageOwners || !targetIsOwner);
                  const currentAccess = member.custom_role_id
                    ? `custom:${member.custom_role_id}`
                    : `builtin:${member.role}`;
                  return (
                    <tr key={member.user_id}>
                      <td data-label="Gebruiker">
                        <span className="table-primary" title={member.display_name || undefined}>{member.display_name || `Gebruiker ${member.user_id.slice(0, 8)}`}</span>
                        {isSelf ? <span className="table-secondary">Huidige gebruiker</span> : null}
                      </td>
                      <td data-label="Rol">{accessLabel(member.role, member.custom_role_id, customRoleNames)}</td>
                      <td data-label="Toegevoegd">{formatDate(member.created_at)}</td>
                      <td data-label="Beheer">
                        {canEditTarget ? (
                          <div className="table-actions">
                            <form action={changeTenantMemberRole} className="inline-form">
                              <input name="userId" type="hidden" value={member.user_id} />
                              <label className="sr-only" htmlFor={`role-${member.user_id}`}>Rol voor {member.display_name || member.user_id}</label>
                              <select defaultValue={currentAccess} id={`role-${member.user_id}`} name="access">
                                <optgroup label="Standaardrollen">
                                  <option value="builtin:tenant_viewer">Kijker</option>
                                  <option value="builtin:tenant_editor">Editor</option>
                                  <option value="builtin:tenant_admin">Beheerder</option>
                                  {canManageOwners ? <option value="builtin:tenant_owner">Eigenaar</option> : null}
                                </optgroup>
                                {activeCustomRoles.length ? (
                                  <optgroup label="Custom rollen">
                                    {activeCustomRoles.map((role) => <option key={role.id} value={`custom:${role.id}`}>{role.name}</option>)}
                                  </optgroup>
                                ) : null}
                              </select>
                              <button className="table-action" type="submit">Opslaan</button>
                            </form>
                            <details>
                              <summary>Intrekken</summary>
                              <form action={removeTenantMember} className="auth-form">
                                <input name="userId" type="hidden" value={member.user_id} />
                                <label className="check-row">
                                  <input name="confirmRemove" required type="checkbox" />
                                  <span><strong>Toegang definitief intrekken</strong><span className="work-panel__meta">Open sessies verliezen bij de volgende serverrequest hun tenantcontext.</span></span>
                                </label>
                                <button className="button-link button-link--secondary" type="submit">Toegang intrekken</button>
                              </form>
                            </details>
                          </div>
                        ) : <span>{isSelf ? "Beschermd tegen self-lockout" : "Alleen een eigenaar kan deze rol beheren"}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="notice" role="status">Nog geen teamleden binnen deze vereniging.</p>}
      </section>

      <section className="workspace-section" id="uitnodigingen" aria-labelledby="team-invitations-title">
        <div className="workspace-section__header">
          <div><h2 className="workspace-section__title" id="team-invitations-title">Uitnodigingen</h2><p className="work-panel__meta">Pending, verlopen, geaccepteerd en ingetrokken blijven zichtbaar als beheerbewijs.</p></div>
          <StatusPill label={`${data.invitations.length} totaal`} tone="neutral" />
        </div>
        {data.invitations.length ? (
          <div className="data-table-frame">
            <table className="data-table data-table--responsive">
              <caption>Persoonlijke tenantuitnodigingen.</caption>
              <thead><tr><th scope="col">E-mail</th><th scope="col">Rol</th><th scope="col">Status</th><th scope="col">Bezorging</th><th scope="col">Actie</th></tr></thead>
              <tbody>
                {data.invitations.map((invitation) => {
                  const effectiveStatus = invitation.status === "pending" && new Date(invitation.expires_at) <= new Date() ? "expired" : invitation.status;
                  return (
                    <tr key={invitation.id}>
                      <td data-label="E-mail"><span className="table-primary" title={invitation.email}>{invitation.email}</span><span className="table-secondary">Aangemaakt {formatDate(invitation.created_at)}</span></td>
                      <td data-label="Rol">{accessLabel(invitation.role, invitation.custom_role_id, customRoleNames)}</td>
                      <td data-label="Status"><StatusPill label={invitationStatusLabel(effectiveStatus)} tone={effectiveStatus === "accepted" ? "success" : effectiveStatus === "pending" ? "info" : "neutral"} /></td>
                      <td data-label="Bezorging">{deliveryLabel(invitation.delivery_status)}</td>
                      <td data-label="Actie">
                        {canManage && invitation.status === "pending" ? (
                          <div className="table-actions">
                            <form action={resendTenantInvitation}><input name="invitationId" type="hidden" value={invitation.id} /><button className="table-action" type="submit">Nieuwe link</button></form>
                            <details>
                              <summary>Intrekken</summary>
                              <form action={revokeTenantInvitation} className="auth-form">
                                <input name="invitationId" type="hidden" value={invitation.id} />
                                <label className="check-row"><input name="confirmRevoke" required type="checkbox" /><span><strong>Link ongeldig maken</strong></span></label>
                                <button className="button-link button-link--secondary" type="submit">Uitnodiging intrekken</button>
                              </form>
                            </details>
                          </div>
                        ) : <span>Geen actie</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="notice" role="status">Er zijn nog geen uitnodigingen verstuurd.</p>}
      </section>
    </>
  );
}

const teamErrors: Record<string, string> = {
  bestaat: "Voor dit e-mailadres staat al een uitnodiging open of het account is al lid.",
  bevestiging: "Bevestig eerst de impact van deze destructieve actie.",
  configuratie: "De beveiligde datasessie ontbreekt. Log opnieuw in en probeer opnieuw.",
  invoer: "Controleer e-mailadres en rol. Er is niets gewijzigd.",
  "laatste-eigenaar": "De laatste eigenaar kan niet worden verwijderd of gedegradeerd. Wijs eerst een tweede eigenaar aan.",
  rechten: "Je rol mag deze teamwijziging niet uitvoeren.",
  "rol-eigenaar": "Alleen een tenant-eigenaar kan custom rollen maken, wijzigen of archiveren.",
  rolbestaat: "Er bestaat al een actieve custom rol met deze naam.",
  rolconflict: "Iemand heeft deze rol intussen gewijzigd. Vernieuw en controleer de actuele rechten.",
  rolinvoer: "Controleer de rolnaam, beschrijving en gekozen werkrechten.",
  "rol-toegewezen": "Deze rol is nog toegewezen aan een lid of open uitnodiging. Wijs die eerst een andere rol toe.",
  teamwijziging: "De teamwijziging kon niet veilig worden uitgevoerd. Vernieuw de pagina en controleer de actuele rollen.",
  uitnodiging: "De uitnodiging kon niet veilig worden gewijzigd. Vernieuw de pagina en probeer opnieuw.",
  zelf: "Je kunt je eigen rol of toegang hier niet wijzigen. Vraag een andere eigenaar om de overdracht af te ronden."
};

const teamSuccess: Record<string, string> = {
  "custom-rol": "De custom rol en effectieve werkrechten zijn opgeslagen.",
  ingetrokken: "De uitnodiging is ingetrokken en kan niet meer worden gebruikt.",
  "rol-gearchiveerd": "De ongebruikte custom rol is gearchiveerd.",
  rol: "De rol is gewijzigd en in het auditlog vastgelegd.",
  verwijderd: "De toegang is ingetrokken en in het auditlog vastgelegd.",
  verstuurd: "De persoonlijke uitnodigingslink is verstuurd."
};

function accessLabel(role: string, customRoleId: string | null, names: Map<string, string>) {
  return customRoleId ? names.get(customRoleId) ?? "Onbeschikbare custom rol" : roleLabel(role);
}

function roleLabel(value: string) {
  return value === "tenant_owner" ? "Eigenaar" : value === "tenant_admin" ? "Beheerder" : value === "tenant_editor" ? "Editor" : "Kijker";
}

function roleCapabilityLabels(values: string[]) {
  const labels = [
    values.includes("tenant.media.write") && values.includes("tenant.playlist.write") ? "Content bewerken" : null,
    values.includes("tenant.studio.create") ? "Studio gebruiken" : null,
    values.includes("tenant.studio.edit_all") ? "Studio beheren" : null,
    values.includes("tenant.studio.template.manage") ? "Studio-templates beheren" : null,
    values.includes("tenant.playlist.publish") ? "Publiceren" : null,
    values.includes("tenant.screen.manage") ? "Schermen beheren" : null,
    values.includes("tenant.settings.manage") ? "Instellingen beheren" : null,
    values.includes("tenant.audit.read") ? "Activiteit bekijken" : null,
    values.includes("tenant.support.export") ? "Support exporteren" : null
  ].filter((value): value is string => Boolean(value));
  return labels.length ? labels : ["Alleen bekijken"];
}

function invitationStatusLabel(value: string) {
  return value === "pending" ? "In afwachting" : value === "accepted" ? "Geaccepteerd" : value === "revoked" ? "Ingetrokken" : "Verlopen";
}

function deliveryLabel(value: string) {
  return value === "sent" ? "Verstuurd" : value === "failed" ? "Mislukt · herstel nodig" : "Nog niet bevestigd";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(value));
}
