import { PageHeader, StatusPill } from "../../_components/shell-primitives";

const tenants = [
  ["Museumkwartier", "Actief", "128 schermen", "Tenantadmin aanwezig"],
  ["Stadstheater", "Actief", "42 schermen", "Invite open"],
  ["Campus Oost", "Aandacht", "76 schermen", "Opslaglimiet 91%"]
] as const;

export default function PlatformTenantsPage() {
  return (
    <>
      <PageHeader
        description="Tenantbeheer toont platformmetadata en operationele limieten. Tenantinhoud blijft buiten dit overzicht totdat een tenantcontext actief is."
        eyebrow="Platform"
        status={{ label: "Platformadmin vereist", tone: "info" }}
        title="Tenantbeheer"
      />

      <section className="work-panel" aria-labelledby="tenant-table-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="tenant-table-title">
              Tenants
            </h2>
            <p className="work-panel__meta">
              Eerste beheertabel voor onboarding en statuscontrole.
            </p>
          </div>
          <StatusPill label="Aanmaak volgt" tone="neutral" />
        </div>
        <div className="data-table-frame">
          <table className="data-table">
            <caption>Tenantstatus en platformnotities.</caption>
            <thead>
              <tr>
                <th scope="col">Tenant</th>
                <th scope="col">Status</th>
                <th scope="col">Schaal</th>
                <th scope="col">Notitie</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(([tenant, status, scale, note]) => (
                <tr key={tenant}>
                  <td>{tenant}</td>
                  <td>
                    <StatusPill
                      label={status}
                      tone={status === "Aandacht" ? "warning" : "success"}
                    />
                  </td>
                  <td>{scale}</td>
                  <td>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
