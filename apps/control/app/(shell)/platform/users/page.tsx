import Link from "next/link";

import { requireControlCapability } from "../../../../lib/control-session";
import { loadPlatformUsers } from "../../../../lib/platform-management";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import { removePlatformUser, setPlatformUserRole } from "./actions";

type PlatformUsersPageProps = Readonly<{
  searchParams: Promise<{ fout?: string; succes?: string }>;
}>;

export default async function PlatformUsersPage({ searchParams }: PlatformUsersPageProps) {
  const session = await requireControlCapability("platform.user.manage");
  const query = await searchParams;
  const data = session.isLive ? await loadPlatformUsers() : { error: false, users: [] };
  const canMutate = session.isLive && session.assuranceLevel === "aal2";

  return (
    <>
      <PageHeader
        description="Platformrollen staan los van tenantrollen. Alleen een platformeigenaar met AAL2 kan deze toegang wijzigen."
        eyebrow="Platform"
        status={{ label: session.assuranceLevel === "aal2" ? "AAL2 bevestigd" : "Extra verificatie nodig", tone: session.assuranceLevel === "aal2" ? "success" : "warning" }}
        title="Platformgebruikers"
      />

      {!canMutate ? <p className="notice notice--warning" role="status"><strong>Wijzigingen geblokkeerd.</strong> <Link href="/auth/mfa?reden=aal2&terug=%2Fplatform%2Fusers">Bevestig AAL2</Link> voordat je platformtoegang toevoegt, wijzigt of intrekt.</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Platformgebruikers niet beschikbaar.</strong> Account- en MFA-status konden niet veilig worden geladen; er zijn geen secrets getoond.</p> : null}
      {query.fout ? <p className="notice notice--critical" role="alert"><strong>Actie niet uitgevoerd.</strong> {platformErrors[query.fout] ?? platformErrors.onverwacht}</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes === "verwijderd" ? "De platformtoegang is ingetrokken en geaudit." : query.succes === "uitgenodigd" ? "Het platformaccount is uitgenodigd en de rol is veilig toegewezen." : "De platformrol is ingesteld en geaudit."}</p> : null}

      <form action={setPlatformUserRole} className="data-surface">
        <div className="work-panel__header"><div><h2 className="work-panel__title">Platformrol instellen</h2><p className="work-panel__meta">Een nieuw e-mailadres krijgt automatisch een persoonlijke accountuitnodiging. Deze actie maakt geen tenantmembership aan.</p></div><StatusPill label="Platformeigenaar" tone="info" /></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="platform-user-email">E-mailadres</label><input disabled={!canMutate} id="platform-user-email" maxLength={320} name="email" required type="email" /></div>
          <div className="field"><label htmlFor="platform-user-role">Platformrol</label><select defaultValue="platform_viewer" disabled={!canMutate} id="platform-user-role" name="role"><option value="platform_viewer">Platformkijker</option><option value="platform_support">Platformsupport</option><option value="platform_admin">Platformbeheerder</option><option value="platform_owner">Platformeigenaar</option></select></div>
        </div>
        <button className="button-link button-link--primary" disabled={!canMutate} type="submit">Platformrol instellen</button>
      </form>

      <section className="workspace-section" aria-labelledby="platform-users-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="platform-users-title">Actieve platformtoegang</h2><p className="work-panel__meta">MFA toont alleen aanwezig/ontbreekt; factor-ID’s, secrets en hersteldata blijven verborgen.</p></div><StatusPill label={`${data.users.length} accounts`} tone="neutral" /></div>
        {data.users.length ? <div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Gebruikers met een platformrol.</caption><thead><tr><th scope="col">Account</th><th scope="col">Rol</th><th scope="col">MFA</th><th scope="col">Actie</th></tr></thead><tbody>{data.users.map((user) => { const isSelf = user.user_id === session.userId; return <tr key={`${user.user_id}-${user.role}`}><td data-label="Account"><span className="table-primary">{user.display_name || user.email}</span><span className="table-secondary">{user.email}{isSelf ? " · huidige gebruiker" : ""}</span></td><td data-label="Rol">{platformRoleLabel(user.role)}</td><td data-label="MFA"><StatusPill label={user.mfaEnabled ? "Ingeschakeld" : "Ontbreekt"} tone={user.mfaEnabled ? "success" : "warning"} /></td><td data-label="Actie">{isSelf ? <span>Beschermd tegen self-lockout</span> : <details><summary>Toegang intrekken</summary><form action={removePlatformUser} className="auth-form"><input name="userId" type="hidden" value={user.user_id} /><label className="check-row"><input disabled={!canMutate} name="confirmRemove" required type="checkbox" /><span><strong>Platformtoegang definitief intrekken</strong><span className="work-panel__meta">Tenantmemberships blijven afzonderlijk bestaan.</span></span></label><button className="button-link button-link--secondary" disabled={!canMutate} type="submit">Platformtoegang intrekken</button></form></details>}</td></tr>; })}</tbody></table></div> : <p className="notice" role="status">Geen platformgebruikers gevonden.</p>}
      </section>
    </>
  );
}

const platformErrors: Record<string, string> = {
  bezorging: "Het Auth-account kon niet veilig worden uitgenodigd. Controleer de mailprovider en probeer opnieuw; er is geen platformrol toegewezen.",
  bevestiging: "Bevestig eerst dat je de platformtoegang wilt intrekken.",
  configuratie: "De beveiligde datasessie ontbreekt. Log opnieuw in.",
  invoer: "Controleer het e-mailadres en de platformrol.",
  "laatste-eigenaar": "De laatste platformeigenaar kan niet worden verwijderd of gedegradeerd.",
  "niet-gevonden": "Er bestaat geen Auth-account of platformmembership voor deze gebruiker.",
  onverwacht: "De platformrol kon niet veilig worden gewijzigd. Vernieuw de pagina en probeer opnieuw.",
  rechten: "Alleen een platformeigenaar met AAL2 mag platformrollen beheren.",
  zelf: "Je kunt je eigen platformtoegang niet via deze route wijzigen. Vraag een andere platformeigenaar."
};

function platformRoleLabel(value: string) { return value === "platform_owner" ? "Platformeigenaar" : value === "platform_admin" ? "Platformbeheerder" : value === "platform_support" ? "Platformsupport" : "Platformkijker"; }
