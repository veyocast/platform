import { requireControlRole } from "../../../../lib/control-session";
import { loadPlatformOverview } from "../../../../lib/control-overview";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import { createTenant } from "./actions";

type PlatformTenantsPageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

export default async function PlatformTenantsPage({
  searchParams
}: PlatformTenantsPageProps) {
  const session = await requireControlRole("platform_admin");
  const data = session.isLive ? await loadPlatformOverview() : null;
  const { fout, succes } = await searchParams;

  return (
    <>
      <PageHeader
        actions={
          <a
            className="button-link button-link--primary"
            href="#nieuwe-tenant"
          >
            Vereniging toevoegen
          </a>
        }
        description={
          session.isLive
            ? "Maak verenigingen aan en bekijk hun status en schermlimieten vanuit de platformcontext."
            : "Lokale ontwikkelpreview; de getoonde vereniging is geen stagingdata."
        }
        eyebrow="Platform"
        status={{
          label: session.isLive ? "Live platformbeheer" : "Demodata",
          tone: session.isLive ? "success" : "warning"
        }}
        title="Tenantbeheer"
      />

      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          Demo-organisaties zijn uitsluitend zichtbaar op een lokale
          ontwikkelserver. Aanmaken is hier uitgeschakeld.
        </p>
      ) : null}
      {data?.error ? (
        <p className="notice notice--critical" role="alert">
          <strong>Verenigingen niet beschikbaar.</strong> De lijst kon niet
          veilig worden geladen. Er is niets gewijzigd; vernieuw de pagina of
          log opnieuw in.
        </p>
      ) : null}
      {fout && tenantErrors[fout] ? (
        <p className="notice notice--critical" role="alert">
          <strong>Aanmaken mislukt.</strong> {tenantErrors[fout]}
        </p>
      ) : null}
      {succes === "aangemaakt" ? (
        <p className="notice notice--success" role="status">
          De vereniging, standaardinstellingen en jouw tenant-eigenaarschap
          zijn aangemaakt.
        </p>
      ) : null}

      <form
        action={createTenant}
        className="data-surface"
        id="nieuwe-tenant"
      >
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title">Nieuwe vereniging</h2>
            <p className="work-panel__meta">
              De vereniging wordt actief aangemaakt met veilige
              afspeelstandaarden. Jij wordt de eerste tenant-eigenaar.
            </p>
          </div>
          <StatusPill label="Platformadmin" tone="info" />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="tenant-name">Verenigingsnaam</label>
            <input
              disabled={!session.isLive}
              id="tenant-name"
              maxLength={120}
              minLength={2}
              name="name"
              placeholder="Voetbalvereniging Voorbeeld"
              required
              type="text"
            />
          </div>
          <div className="field">
            <label htmlFor="tenant-slug">Technische slug</label>
            <input
              aria-describedby="tenant-slug-help"
              disabled={!session.isLive}
              id="tenant-slug"
              maxLength={64}
              minLength={3}
              name="slug"
              pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]"
              placeholder="vv-voorbeeld"
              required
              type="text"
            />
            <p id="tenant-slug-help">
              3–64 kleine letters, cijfers en koppeltekens; later niet als
              zichtbare naam gebruikt.
            </p>
          </div>
          <div className="field">
            <label htmlFor="tenant-screen-limit">Schermlimiet</label>
            <input
              defaultValue={4}
              disabled={!session.isLive}
              id="tenant-screen-limit"
              max={10000}
              min={1}
              name="screenLimit"
              required
              type="number"
            />
          </div>
        </div>
        <div className="sticky-form-actions">
          <p className="work-panel__meta">
            De volledige onboarding wordt atomair uitgevoerd en in het
            auditlog vastgelegd.
          </p>
          <button
            className="button-link button-link--primary"
            disabled={!session.isLive}
            type="submit"
          >
            Vereniging aanmaken
          </button>
        </div>
      </form>

      <section className="workspace-section" aria-labelledby="tenant-table-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="tenant-table-title">
              Verenigingen
            </h2>
            <p className="work-panel__meta">
              Status en schermlimiet per organisatie.
            </p>
          </div>
          <StatusPill
            label={`${data?.tenants.length ?? 1} totaal`}
            tone="neutral"
          />
        </div>
        {(data?.tenants.length ?? 0) > 0 || !session.isLive ? (
          <div className="data-table-frame">
            <table className="data-table data-table--responsive">
              <caption>Verenigingen binnen het platform.</caption>
              <thead>
                <tr>
                  <th scope="col">Vereniging</th>
                  <th scope="col">Status</th>
                  <th scope="col">Schermen</th>
                  <th scope="col">Limiet</th>
                </tr>
              </thead>
              <tbody>
                {session.isLive ? (
                  data!.tenants.map((tenant) => {
                    const screenCount = data!.screens.filter(
                      (screen) => screen.tenant_id === tenant.id
                    ).length;
                    return (
                      <tr key={tenant.id}>
                        <td data-label="Vereniging">
                          <span className="table-primary">{tenant.name}</span>
                          <span className="table-secondary">{tenant.slug}</span>
                        </td>
                        <td data-label="Status">
                          <StatusPill
                            label={statusLabel(tenant.status)}
                            tone={tenant.status === "active" ? "success" : "warning"}
                          />
                        </td>
                        <td data-label="Schermen">{screenCount}</td>
                        <td data-label="Limiet">{tenant.screen_limit}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td data-label="Vereniging">
                      <span className="table-primary">
                        Lokale demovereniging
                      </span>
                    </td>
                    <td data-label="Status">
                      <StatusPill label="Demo" tone="warning" />
                    </td>
                    <td data-label="Schermen">0</td>
                    <td data-label="Limiet">4</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="notice" role="status">
            Nog geen verenigingen aangemaakt. Gebruik het formulier hierboven
            om de eerste vereniging veilig te initialiseren.
          </p>
        )}
      </section>
    </>
  );
}

function statusLabel(value: string) {
  if (value === "active") return "Actief";
  if (value === "paused") return "Gepauzeerd";
  return "Gearchiveerd";
}

const tenantErrors: Record<string, string> = {
  configuratie:
    "De live datasessie ontbreekt. Er is niets aangemaakt; herstel de configuratie en log opnieuw in.",
  naam: "Gebruik een verenigingsnaam van 2 tot en met 120 tekens.",
  onverwacht:
    "De vereniging kon niet veilig worden aangemaakt. Er is niets gedeeltelijk opgeslagen; probeer opnieuw.",
  rechten:
    "Je hebt platformbeheerrechten nodig. Er is niets aangemaakt; log opnieuw in met een bevoegd account.",
  schermlimiet: "Kies een schermlimiet tussen 1 en 10.000.",
  slug: "Gebruik een unieke slug van 3–64 kleine letters, cijfers en koppeltekens.",
  "slug-bestaat":
    "Deze slug is al in gebruik. Er is niets aangemaakt; kies een andere technische slug."
};
