import { hasCapability } from "@veyocast/auth";

import { requireControlSession } from "../../../lib/control-session";
import { StatusPill } from "../_components/shell-primitives";
import { switchTenantContext } from "./actions";

type ContextPageProps = {
  searchParams: Promise<{ fout?: string; reden?: string }>;
};

export default async function ContextPage({ searchParams }: ContextPageProps) {
  const session = await requireControlSession();
  const { fout, reden } = await searchParams;

  return (
    <div className="page-stack page-stack--narrow">
      <header className="page-header">
        <div>
          <p className="eyebrow">Werkcontext</p>
          <h1>Kies een vereniging</h1>
          <p>
            Je keuze wordt bij iedere serverrequest opnieuw gecontroleerd. Data,
            formulieren en navigatie worden na de wissel volledig opnieuw geladen.
          </p>
        </div>
      </header>

      {reden || fout ? (
        <div className="notice notice--warning" role="alert">
          {contextMessage[fout ?? reden ?? ""] ?? contextMessage.needs_selection}
        </div>
      ) : null}

      {session.tenantMemberships.length > 0 ? (
        <section aria-labelledby="context-list-title" className="work-panel">
          <div className="work-panel__header">
            <div>
              <p className="eyebrow">Beschikbare verenigingen</p>
              <h2 id="context-list-title">Jouw toegang</h2>
            </div>
          </div>
          <ul className="context-list">
            {session.tenantMemberships.map((membership) => (
              <li className="context-list__item" key={membership.id}>
                <div>
                  <strong>{membership.name}</strong>
                  <p>
                    {roleLabel[membership.role]} · {statusLabel[membership.status]}
                  </p>
                </div>
                {membership.status === "archived" ? (
                  <StatusPill label="Niet beschikbaar" tone="neutral" />
                ) : (
                  <form action={switchTenantContext}>
                    <input name="tenantSlug" type="hidden" value={membership.slug} />
                    <input name="returnTo" type="hidden" value="/dashboard" />
                    <button className="button-link button-link--primary" type="submit">
                      Open vereniging
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="notice">
          Er zijn geen verenigingen aan dit account gekoppeld. Vraag een beheerder
          om toegang; er wordt niet automatisch een willekeurige context gekozen.
        </div>
      )}

      {hasCapability(session.roles, "platform.system.read") ? (
        <form action={switchTenantContext}>
          <input name="tenantSlug" type="hidden" value="" />
          <button className="button-link button-link--secondary" type="submit">
            Open platformcontext
          </button>
        </form>
      ) : null}
    </div>
  );
}

const contextMessage: Record<string, string> = {
  invalid_context:
    "De gekozen context is ongeldig. Er is geen verenigingsdata geladen; kies opnieuw.",
  membership_revoked:
    "Je toegang tot de vorige vereniging is ingetrokken. Eventuele oude pagina- of formulierdata is gewist; kies een beschikbare vereniging.",
  needs_selection:
    "Kies bewust de vereniging waarin je wilt werken voordat Control gegevens laadt.",
  platformcontext:
    "Je hebt geen platformrechten. Kies een vereniging waartoe je toegang hebt.",
  tenant_archived:
    "De vorige vereniging is gearchiveerd en kan niet als normale werkcontext worden geopend. Vraag een platformbeheerder om herstel."
};

const roleLabel = {
  tenant_admin: "Beheerder",
  tenant_editor: "Editor",
  tenant_owner: "Eigenaar",
  tenant_viewer: "Alleen lezen"
} as const;

const statusLabel = {
  active: "Actief",
  archived: "Gearchiveerd",
  paused: "Gepauzeerd"
} as const;
