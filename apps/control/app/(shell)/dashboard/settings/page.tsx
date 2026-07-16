import { PageHeader, StatusPill } from "../../_components/shell-primitives";

const settings = [
  ["Tenantprofiel", "Naam, slug en standaardtaal", "Voorbereid"],
  ["Rechten", "Mapping tussen approllen en serverclaims", "Beveiligd"],
  ["Publicatiebeleid", "Goedkeuringen en default vensters", "Later"]
] as const;

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        description="Instellingen tonen de plekken waar tenantbeheerders straks operationele defaults aanpassen. Securitygevoelige wijzigingen blijven expliciet server-side."
        eyebrow="Tenantbeheer"
        status={{ label: "Tenantadmin vereist", tone: "info" }}
        title="Instellingen"
      />

      <section className="work-grid">
        <article className="work-panel">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title">Instellingsgroepen</h2>
              <p className="work-panel__meta">Geen verborgen toggles zonder guard</p>
            </div>
            <StatusPill label="S03 shell" tone="neutral" />
          </div>
          <ul className="settings-list">
            {settings.map(([title, description, state]) => (
              <li className="settings-item" key={title}>
                <span className="settings-item__copy">
                  <span className="settings-item__title">{title}</span>
                  <span className="work-panel__meta">{description}</span>
                </span>
                <StatusPill
                  label={state}
                  tone={state === "Later" ? "warning" : "success"}
                />
              </li>
            ))}
          </ul>
        </article>

        <article className="work-panel">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title">Permission state</h2>
              <p className="work-panel__meta">Cause, effect en recovery</p>
            </div>
            <StatusPill label="Expliciet" tone="success" />
          </div>
          <p className="page-description">
            Oorzaak: echte tenantclaims zijn nog niet gekoppeld. Effect:
            instellingen zijn read-only placeholders. Herstel: auth-sessie en
            serveracties aansluiten voordat mutaties zichtbaar worden.
          </p>
        </article>
      </section>
    </>
  );
}
