import Link from "next/link";

import { PageHeader, StatusPill } from "../../_components/shell-primitives";

const teamMembers = [
  ["Mira Vos", "Tenantadmin", "Actief", "mira@example.test"],
  ["Omar Smits", "Editor", "Actief", "omar@example.test"],
  ["Lena Park", "Viewer", "Invite verzonden", "lena@example.test"]
] as const;

export default function TeamPage() {
  return (
    <>
      <PageHeader
        actions={
          <Link className="button-link button-link--primary" href="/accept-invite">
            Inviteflow testen
          </Link>
        }
        description="Teambeheer maakt zichtbaar welke rollen straks server-side claims krijgen. Roltoekenning blijft tenantgebonden."
        eyebrow="Tenantbeheer"
        status={{ label: "Tenantadmin vereist", tone: "info" }}
        title="Team"
      />

      <section className="work-panel" aria-labelledby="team-table-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="team-table-title">
              Gebruikers en rollen
            </h2>
            <p className="work-panel__meta">
              Eerste weergave voor invites, rollen en toegang.
            </p>
          </div>
          <StatusPill label="RBAC volgt" tone="neutral" />
        </div>
        <div className="data-table-frame">
          <table className="data-table">
            <caption>Tenantteam met status per gebruiker.</caption>
            <thead>
              <tr>
                <th scope="col">Naam</th>
                <th scope="col">Rol</th>
                <th scope="col">Status</th>
                <th scope="col">E-mail</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map(([name, role, status, email]) => (
                <tr key={email}>
                  <td>{name}</td>
                  <td>{role}</td>
                  <td>
                    <StatusPill
                      label={status}
                      tone={status === "Actief" ? "success" : "warning"}
                    />
                  </td>
                  <td>{email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
