import { PageHeader, StatusPill } from "../../_components/shell-primitives";

const settings = [
  ["Clubprofiel", "Naam, standaardtaal en contactgegevens", "Voorbereid"],
  ["Schermstandaarden", "Oriëntatie, veilige zones en standaardgedrag", "Voorbereid"],
  ["Team en toegang", "Rollen, uitnodigingen en rechten", "Beveiligd"],
  ["Opslag en limieten", "Gebruik, retentie en beschikbare capaciteit", "Voorbereid"],
  ["Beveiliging", "Sessies en auditinstellingen", "Alleen lezen"]
] as const;

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        description="Stel de operationele defaults van de vereniging in. Wijzigingen met invloed op rechten blijven expliciet en worden server-side gecontroleerd."
        eyebrow="Museumkwartier"
        status={{ label: "Beheerder vereist", tone: "info" }}
        title="Instellingen"
      />

      <section className="resource-workspace">
        <aside className="data-surface" aria-label="Instellingssecties">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title">Secties</h2>
              <p className="work-panel__meta">Kies een onderdeel om te beheren.</p>
            </div>
          </div>
          <nav aria-label="Instellingen navigatie">
            <ul className="settings-list">
              {settings.map(([title]) => (
                <li className="settings-item" key={title}>
                  <button className="table-action" type="button">{title}</button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <section className="workspace-section" aria-labelledby="settings-overview-title">
          <div className="workspace-section__header">
            <div>
              <h2 className="workspace-section__title" id="settings-overview-title">Instellingsoverzicht</h2>
              <p className="work-panel__meta">Geen wijzigingen worden opgeslagen zonder server-side autorisatie.</p>
            </div>
            <StatusPill label="Read-only demo" tone="neutral" />
          </div>
          <ul className="settings-list">
            {settings.map(([title, description, state]) => (
              <li className="settings-item" key={title}>
                <span className="settings-item__copy">
                  <span className="settings-item__title">{title}</span>
                  <span className="work-panel__meta">{description}</span>
                </span>
                <StatusPill label={state} tone={state === "Beveiligd" ? "success" : "neutral"} />
              </li>
            ))}
          </ul>
          <p className="notice" role="status">
            Instellingen zijn nog niet gekoppeld aan een echte sessie. Daarom zijn
            ze zichtbaar als overzicht, maar niet wijzigbaar.
          </p>
        </section>
      </section>
    </>
  );
}
