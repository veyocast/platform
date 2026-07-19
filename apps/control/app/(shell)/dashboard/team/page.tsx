import { requireTenantControlSession } from "../../../../lib/control-session";
import { loadTenantMembers } from "../../../../lib/control-overview";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";

export default async function TeamPage() {
  const session = await requireTenantControlSession("tenant_admin");
  const data = session.isLive
    ? await loadTenantMembers(session.tenantId!)
    : { error: false, members: demoMembers };

  return (
    <>
      <PageHeader
        description="Rollen binnen de actieve vereniging. Nieuwe uitnodigingen worden via het beveiligde Supabase-beheerpad verstuurd."
        eyebrow={session.tenant}
        status={{ label: session.isLive ? "Live tenantdata" : "Demodata", tone: session.isLive ? "success" : "warning" }}
        title="Team"
      />
      {!session.isLive ? <p className="notice notice--warning" role="status">Deze personen zijn uitsluitend lokale fixtures.</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Team niet beschikbaar.</strong> De rollen konden niet veilig worden geladen.</p> : null}
      <section className="workspace-section" aria-labelledby="team-table-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="team-table-title">Gebruikers en rollen</h2><p className="work-panel__meta">Toegang wordt server-side vanuit memberships bepaald.</p></div><StatusPill label={`${data.members.length} personen`} tone="neutral" /></div>
        {data.members.length ? <div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Toegang binnen de actieve vereniging.</caption><thead><tr><th scope="col">Gebruiker</th><th scope="col">Rol</th><th scope="col">Toegevoegd</th></tr></thead><tbody>{data.members.map((member) => <tr key={member.user_id}><td data-label="Gebruiker"><span className="table-primary">{member.display_name || `Gebruiker ${member.user_id.slice(0, 8)}`}</span></td><td data-label="Rol">{roleLabel(member.role)}</td><td data-label="Toegevoegd">{formatDate(member.created_at)}</td></tr>)}</tbody></table></div> : <p className="notice" role="status">Nog geen teamleden binnen deze vereniging.</p>}
      </section>
    </>
  );
}

const demoMembers = [
  { created_at: "2026-07-19T08:24:00.000Z", display_name: "Lokale beheerder", role: "tenant_admin", user_id: "demo-admin" },
  { created_at: "2026-07-19T08:12:00.000Z", display_name: "Lokale editor", role: "tenant_editor", user_id: "demo-editor" }
];

function roleLabel(value: string) {
  if (value === "tenant_owner") return "Eigenaar";
  if (value === "tenant_admin") return "Beheerder";
  if (value === "tenant_editor") return "Editor";
  return "Kijker";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(value));
}
