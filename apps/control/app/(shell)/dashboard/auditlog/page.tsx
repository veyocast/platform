import { PageHeader, StatusPill } from "../../_components/shell-primitives";

const auditEvents = [
  ["Vandaag 10:24", "Playlist bijgewerkt", "Zomerroute", "Omar Smits", "Content", "Geslaagd"],
  ["Vandaag 09:12", "Uitnodiging aangemaakt", "Lena Park", "Mira Vos", "Team", "Geslaagd"],
  ["Gisteren 17:48", "Instelling gewijzigd", "Publicatiebeleid", "Mira Vos", "Instellingen", "Geslaagd"]
] as const;

export default function AuditLogPage() {
  return (
    <>
      <PageHeader
        description="Het auditlog is append-only en laat zien wie welke wijziging deed, binnen welke context en met welk resultaat."
        eyebrow="Museumkwartier"
        status={{ label: "Alleen lezen", tone: "success" }}
        title="Auditlog"
      />

      <section className="resource-toolbar" aria-label="Auditlog filteren">
        <div className="resource-toolbar__group">
          <select aria-label="Filter auditlog op domein" className="toolbar-select" defaultValue="all">
            <option value="all">Alle domeinen</option>
            <option value="content">Content</option>
            <option value="team">Team</option>
            <option value="settings">Instellingen</option>
          </select>
          <select aria-label="Filter auditlog op resultaat" className="toolbar-select" defaultValue="all">
            <option value="all">Alle resultaten</option>
            <option value="success">Geslaagd</option>
            <option value="failed">Mislukt</option>
          </select>
        </div>
        <p className="resource-toolbar__summary">3 gebeurtenissen · nieuwste eerst</p>
      </section>

      <section className="workspace-section" aria-labelledby="audit-table-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="audit-table-title">Recente gebeurtenissen</h2>
            <p className="work-panel__meta">Acties kunnen niet in deze lijst worden aangepast of verwijderd.</p>
          </div>
          <StatusPill label="Append-only" tone="neutral" />
        </div>
        <div className="data-table-frame">
          <table className="data-table data-table--responsive">
            <caption>Gebeurtenissen binnen de actieve vereniging.</caption>
            <thead>
              <tr>
                <th scope="col">Tijd</th>
                <th scope="col">Actie</th>
                <th scope="col">Doel</th>
                <th scope="col">Actor</th>
                <th scope="col">Domein</th>
                <th scope="col">Resultaat</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map(([time, action, target, actor, domain, result]) => (
                <tr key={`${time}-${action}`}>
                  <td data-label="Tijd"><span className="table-primary">{time}</span></td>
                  <td data-label="Actie">{action}</td>
                  <td data-label="Doel">{target}</td>
                  <td data-label="Actor">{actor}</td>
                  <td data-label="Domein">{domain}</td>
                  <td data-label="Resultaat"><StatusPill label={result} tone="success" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
