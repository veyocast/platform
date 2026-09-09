import { randomUUID } from "node:crypto";

import { hasCapability } from "@veyocast/auth";
import Link from "next/link";

import { requireControlCapability } from "../../../../lib/control-session";
import { loadPlatformOverview } from "../../../../lib/control-overview";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import { createTenant } from "./actions";
import { TenantCreateSubmit } from "./tenant-create-submit";

type PlatformTenantsPageProps = {
  searchParams: Promise<{ fout?: string }>;
};

export default async function PlatformTenantsPage({
  searchParams
}: PlatformTenantsPageProps) {
  const session = await requireControlCapability("platform.tenant.read");
  const data = session.isLive ? await loadPlatformOverview() : null;
  const { fout } = await searchParams;
  const hasCreateCapability = hasCapability(session.capabilities, "platform.tenant.create");
  const canCreate = session.isLive && hasCreateCapability && session.assuranceLevel === "aal2";
  const requiresAal2 = session.isLive && hasCreateCapability && session.assuranceLevel !== "aal2";

  return (
    <>
      <PageHeader
        actions={canCreate ? (
          <a
            className="button-link button-link--secondary"
            href="#nieuwe-tenant"
          >
            Naar formulier
          </a>
        ) : null}
        description={
          session.isLive
            ? "Maak verenigingen aan en bekijk hun status en schermlimieten vanuit de platformcontext."
            : "Lokale ontwikkelpreview; de getoonde vereniging is geen stagingdata."
        }
        eyebrow="Platform"
        status={!session.isLive ? { label: "Demodata", tone: "warning" } : undefined}
        title="Tenantbeheer"
      />

      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          Demo-organisaties zijn uitsluitend zichtbaar op een lokale
          ontwikkelserver. Aanmaken is hier uitgeschakeld.
        </p>
      ) : null}
      {session.isLive && hasCreateCapability && session.assuranceLevel !== "aal2" ? (
        <p className="notice notice--warning" role="status">
          <strong>Extra verificatie nodig.</strong> Een vereniging aanmaken is een gevoelige platformwijziging en blijft geblokkeerd totdat je AAL2 bevestigt. <Link href="/auth/mfa?reden=aal2&terug=%2Fplatform%2Ftenants%23nieuwe-tenant">Open tweestapsverificatie</Link> en keer daarna terug naar dit formulier.
        </p>
      ) : null}
      {session.isLive && !hasCreateCapability ? (
        <p className="notice notice--warning" role="status">
          Je kunt verenigingen bekijken, maar niet aanmaken. Vraag een platformeigenaar of platformbeheerder om deze wijziging uit te voeren.
        </p>
      ) : null}
      {data?.error ? (
        <p className="notice notice--critical" role="alert">
          <strong>Verenigingen niet beschikbaar.</strong> De lijst kon niet
          veilig worden geladen. Er is niets gewijzigd; vernieuw de pagina of
          log opnieuw in.
        </p>
      ) : null}
      <form
        action={createTenant}
        className="data-surface tenant-create-form"
        id="nieuwe-tenant"
      >
        {fout && tenantErrors[fout] ? (
          <p className="notice notice--critical" role="alert" tabIndex={-1}>
            <strong>Aanmaken mislukt.</strong> {tenantErrors[fout]}
          </p>
        ) : null}
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title">Nieuwe vereniging</h2>
            <p className="work-panel__meta">
              De vereniging, veilige standaarden en uitnodiging voor de eerste
              eigenaar worden atomair voorbereid. Platformtoegang maakt je niet
              automatisch eigenaar.
            </p>
          </div>
          <StatusPill label="Platformadmin" tone="info" />
        </div>
        <input name="idempotencyKey" type="hidden" value={`tenant:${randomUUID()}`} />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="tenant-name">Verenigingsnaam</label>
            <input
              disabled={!canCreate}
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
              disabled={!canCreate}
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
            <label htmlFor="tenant-owner-email">E-mailadres eerste eigenaar</label>
            <input
              autoComplete="email"
              disabled={!canCreate}
              id="tenant-owner-email"
              maxLength={320}
              name="ownerEmail"
              placeholder="beheerder@vereniging.nl"
              required
              type="email"
            />
          </div>
          <div className="field">
            <label htmlFor="tenant-screen-limit">Schermlimiet</label>
            <input
              defaultValue={4}
              disabled={!canCreate}
              id="tenant-screen-limit"
              max={10000}
              min={1}
              name="screenLimit"
              required
              type="number"
            />
          </div>
          <div className="field">
            <label htmlFor="tenant-locale">Taal en notatie</label>
            <select defaultValue="nl-NL" disabled={!canCreate} id="tenant-locale" name="locale">
              <option value="nl-NL">Nederlands (Nederland)</option>
              <option value="en-GB">Engels (Verenigd Koninkrijk)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="tenant-timezone">Tijdzone</label>
            <select defaultValue="Europe/Amsterdam" disabled={!canCreate} id="tenant-timezone" name="timezone">
              <option value="Europe/Amsterdam">Europa/Amsterdam</option>
              <option value="Europe/Brussels">Europa/Brussel</option>
              <option value="Europe/Paris">Europa/Parijs</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
        <label className="check-row" htmlFor="tenant-actor-owner">
          <input disabled={!canCreate} id="tenant-actor-owner" name="actorBecomesOwner" type="checkbox" />
          <span>
            <strong>Geef mij ook tenanttoegang</strong>
            <span className="work-panel__meta">Alleen gebruiken wanneer je operationeel mede-eigenaar moet zijn; deze keuze wordt geaudit.</span>
          </span>
        </label>
        <div className="sticky-form-actions">
          <p className="work-panel__meta">
            {canCreate
              ? "De vereniging en uitnodiging worden veilig voorbereid. Je wordt daarna automatisch doorgestuurd."
              : requiresAal2
                ? "Bevestig eerst je tweestapsverificatie; daarna blijven de ingevulde velden opnieuw beschikbaar."
                : "Deze accountrol kan geen verenigingen aanmaken."}
          </p>
          <TenantCreateSubmit canCreate={canCreate} requiresAal2={requiresAal2} />
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
                  <th scope="col">Actie</th>
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
                        <td data-label="Actie"><Link className="table-action" href={`/platform/tenants/${tenant.id}`}>Open details</Link></td>
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
                    <td data-label="Actie">Niet beschikbaar</td>
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
  conflict: "Deze slug of eigenaaruitnodiging bestaat al. Controleer de bestaande vereniging voordat je opnieuw probeert.",
  idempotency: "Deze formulieropdracht is met andere gegevens herhaald. Vernieuw de pagina en controleer de invoer.",
  invoer: "Controleer naam, slug, eigenaar, taal, tijdzone en schermlimiet. Er is niets gedeeltelijk opgeslagen.",
  onverwacht:
    "De vereniging kon niet veilig worden aangemaakt. Er is niets gedeeltelijk opgeslagen; probeer opnieuw.",
  rechten:
    "Je hebt platformbeheerrechten nodig. Er is niets aangemaakt; log opnieuw in met een bevoegd account.",
};
