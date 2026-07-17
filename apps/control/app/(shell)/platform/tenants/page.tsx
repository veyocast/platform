import { PageHeader, StatusPill } from "../../_components/shell-primitives";

const tenants = [
  ["Museumkwartier", "Actief", "128 schermen", "18,4 GB / 50 GB", "Daan Operator"],
  ["Stadstheater", "Actief", "42 schermen", "9,1 GB / 25 GB", "Uitnodiging open"],
  ["Campus Oost", "Aandacht", "76 schermen", "45,5 GB / 50 GB", "Opslaglimiet 91%"]
] as const;

export default function PlatformTenantsPage() {
  return (
    <>
      <PageHeader
        description="Beheer verenigingen, limieten en de operationele context vanuit de platformrol. Tenantinhoud blijft buiten dit overzicht."
        eyebrow="Platform"
        status={{ label: "Platformbeheerder vereist", tone: "info" }}
        title="Tenantbeheer"
      />

      <section className="resource-toolbar" aria-label="Tenants bedienen">
        <div className="resource-toolbar__group">
          <input aria-label="Zoeken in tenants" className="toolbar-search" name="tenant-search" placeholder="Zoeken op vereniging" type="search" />
          <select aria-label="Filter tenants op status" className="toolbar-select" defaultValue="all">
            <option value="all">Alle statussen</option><option value="active">Actief</option><option value="attention">Aandacht</option>
          </select>
        </div>
        <p className="resource-toolbar__summary">12 verenigingen · sortering: status</p>
      </section>

      <section className="workspace-section" aria-labelledby="tenant-table-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="tenant-table-title">Verenigingen</h2>
            <p className="work-panel__meta">Status en limieten die actie vanuit de platformrol vragen.</p>
          </div>
          <StatusPill label="12 totaal" tone="neutral" />
        </div>
        <div className="data-table-frame">
          <table className="data-table data-table--responsive">
            <caption>Tenantstatus en platformlimieten.</caption>
            <thead><tr><th scope="col">Vereniging</th><th scope="col">Status</th><th scope="col">Schermen</th><th scope="col">Opslag</th><th scope="col">Contact</th><th scope="col">Actie</th></tr></thead>
            <tbody>
              {tenants.map(([tenant, status, screens, storage, contact]) => (
                <tr key={tenant}>
                  <td data-label="Vereniging"><span className="table-primary">{tenant}</span></td>
                  <td data-label="Status"><StatusPill label={status} tone={status === "Aandacht" ? "warning" : "success"} /></td>
                  <td data-label="Schermen">{screens}</td>
                  <td data-label="Opslag">{storage}</td>
                  <td data-label="Contact">{contact}</td>
                  <td data-label="Actie"><button className="table-action" type="button">Beheren</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
