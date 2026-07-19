import { requireControlRole } from "../../../../lib/control-session";
import { loadPlatformOverview } from "../../../../lib/control-overview";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";

export default async function PlatformTenantsPage() {
  const session = await requireControlRole("platform_admin");
  const data = session.isLive ? await loadPlatformOverview() : null;

  return (
    <>
      <PageHeader
        description={session.isLive ? "Live verenigingen en schermlimieten uit de platformcontext." : "Lokale ontwikkelpreview; de getoonde vereniging is geen stagingdata."}
        eyebrow="Platform"
        status={{ label: session.isLive ? "Live platformdata" : "Demodata", tone: session.isLive ? "success" : "warning" }}
        title="Tenantbeheer"
      />
      {!session.isLive ? <p className="notice notice--warning" role="status">Demo-organisaties zijn uitsluitend zichtbaar op een lokale ontwikkelserver.</p> : null}
      {data?.error ? <p className="notice notice--critical" role="alert"><strong>Verenigingen niet beschikbaar.</strong> De lijst kon niet veilig worden geladen.</p> : null}
      <section className="workspace-section" aria-labelledby="tenant-table-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="tenant-table-title">Verenigingen</h2><p className="work-panel__meta">Status en schermlimiet per organisatie.</p></div><StatusPill label={`${data?.tenants.length ?? 1} totaal`} tone="neutral" /></div>
        {(data?.tenants.length ?? 0) > 0 || !session.isLive ? <div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Verenigingen binnen het platform.</caption><thead><tr><th scope="col">Vereniging</th><th scope="col">Status</th><th scope="col">Schermen</th><th scope="col">Limiet</th></tr></thead><tbody>{session.isLive ? data!.tenants.map((tenant) => {
          const screenCount = data!.screens.filter((screen) => screen.tenant_id === tenant.id).length;
          return <tr key={tenant.id}><td data-label="Vereniging"><span className="table-primary">{tenant.name}</span><span className="table-secondary">{tenant.slug}</span></td><td data-label="Status"><StatusPill label={statusLabel(tenant.status)} tone={tenant.status === "active" ? "success" : "warning"} /></td><td data-label="Schermen">{screenCount}</td><td data-label="Limiet">{tenant.screen_limit}</td></tr>;
        }) : <tr><td data-label="Vereniging"><span className="table-primary">Lokale demovereniging</span></td><td data-label="Status"><StatusPill label="Demo" tone="warning" /></td><td data-label="Schermen">0</td><td data-label="Limiet">4</td></tr>}</tbody></table></div> : <p className="notice" role="status">Nog geen verenigingen aangemaakt.</p>}
      </section>
    </>
  );
}

function statusLabel(value: string) {
  if (value === "active") return "Actief";
  if (value === "paused") return "Gepauzeerd";
  return "Gearchiveerd";
}
