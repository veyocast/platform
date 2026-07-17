import Link from "next/link";

import { PageHeader, StatusPill } from "../../_components/shell-primitives";

const teamMembers = [
  ["Mira Vos", "mira@example.test", "Beheerder", "Actief", "Vandaag 10:24"],
  ["Omar Smits", "omar@example.test", "Editor", "Actief", "Vandaag 09:12"],
  ["Lena Park", "lena@example.test", "Kijker", "Uitnodiging verzonden", "Nog niet actief"]
] as const;

export default function TeamPage() {
  return (
    <>
      <PageHeader
        actions={
          <Link className="button-link button-link--primary" href="/accept-invite">
            Iemand uitnodigen
          </Link>
        }
        description="Beheer wie toegang heeft tot de vereniging. Rollen leggen begrijpelijk vast wie mensen, schermen en publicaties mag beheren."
        eyebrow="Museumkwartier"
        status={{ label: "Beheerder vereist", tone: "info" }}
        title="Team"
      />

      <section className="resource-toolbar" aria-label="Team bedienen">
        <div className="resource-toolbar__group">
          <input
            aria-label="Zoeken in team"
            className="toolbar-search"
            name="team-search"
            placeholder="Zoeken op naam of e-mail"
            type="search"
          />
          <select aria-label="Filter team op rol" className="toolbar-select" defaultValue="all">
            <option value="all">Alle rollen</option>
            <option value="admin">Beheerder</option>
            <option value="editor">Editor</option>
            <option value="viewer">Kijker</option>
          </select>
        </div>
        <p className="resource-toolbar__summary">3 personen · 1 uitnodiging open</p>
      </section>

      <section className="workspace-section" aria-labelledby="team-table-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="team-table-title">
              Gebruikers en rollen
            </h2>
            <p className="work-panel__meta">De laatste beheerder kan pas worden verwijderd nadat de rol is overgedragen.</p>
          </div>
          <StatusPill label="3 personen" tone="neutral" />
        </div>
        <div className="data-table-frame">
          <table className="data-table data-table--responsive">
            <caption>Toegang binnen de actieve vereniging.</caption>
            <thead>
              <tr>
                <th scope="col">Naam</th>
                <th scope="col">E-mail</th>
                <th scope="col">Rol</th>
                <th scope="col">Status</th>
                <th scope="col">Laatste activiteit</th>
                <th scope="col">Actie</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map(([name, email, role, status, activity]) => (
                <tr key={email}>
                  <td data-label="Naam"><span className="table-primary">{name}</span></td>
                  <td data-label="E-mail">{email}</td>
                  <td data-label="Rol">{role}</td>
                  <td data-label="Status">
                    <StatusPill label={status} tone={status === "Actief" ? "success" : "warning"} />
                  </td>
                  <td data-label="Laatste activiteit">{activity}</td>
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
