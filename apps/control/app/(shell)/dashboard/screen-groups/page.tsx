import Link from "next/link";
import { MonitorCog, UsersRound } from "lucide-react";

import { Button, PageHeader, StatusPill, SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import styles from "../publisher-resources.module.css";
import { loadScreenGroups } from "./data";

export default async function ScreenGroupsPage() {
  const session = await requireTenantControlSession("tenant.screen.read");
  const data = session.isLive && session.tenantId
    ? await loadScreenGroups(session.tenantId)
    : { error: null, groups: [], screens: [] };
  const activeGroups = data.groups.filter((group) => group.status === "active");
  const assignedScreens = new Set(activeGroups.flatMap((group) => group.memberNames));

  return (
    <>
      <PageHeader
        description="Bundel schermen zonder hun individuele identiteit of status te verliezen."
        eyebrow={session.tenant}
        status={!session.isLive ? { label: "Demomodus", tone: "warning" } : undefined}
        title="Schermgroepen"
      />
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Schermgroepen niet geladen.</strong> {data.error}</p> : null}
      {!session.isLive ? <p className="notice notice--warning" role="status">Configureer Supabase en log in om echte schermgroepen te beheren.</p> : null}

      <SummaryStrip
        aria-label="Samenvatting schermgroepen"
        items={[
          { label: "Actieve groepen", value: activeGroups.length },
          { label: "Schermen in groepen", value: assignedScreens.size },
          {
            detail: "Een scherm mag veilig in meerdere groepen zitten",
            label: "Beschikbare schermen",
            value: data.screens.length
          }
        ]}
      />

      {data.groups.length ? (
        <section aria-label="Schermgroepen" className={styles.resourceGrid}>
          {data.groups.map((group) => (
            <article className={styles.resourceCard} data-muted={group.status === "archived"} key={group.id}>
              <div className={styles.resourceHeader}>
                <div><h2>{group.name}</h2><p>{group.description || "Geen beschrijving toegevoegd."}</p></div>
                <StatusPill label={group.status === "active" ? "Actief" : "Gearchiveerd"} tone={group.status === "active" ? "success" : "neutral"} />
              </div>
              <dl className={styles.resourceMeta}>
                <div><dt>Schermen</dt><dd>{group.memberNames.length}</dd></div>
                <div><dt>Standaardcontent</dt><dd>{group.defaultContent || "Niet ingesteld"}</dd></div>
              </dl>
              {group.memberNames.length ? (
                <ul aria-label={`Schermen in ${group.name}`} className={styles.memberList}>
                  {group.memberNames.slice(0, 6).map((name) => <li key={name}>{name}</li>)}
                  {group.memberNames.length > 6 ? <li>+{group.memberNames.length - 6}</li> : null}
                </ul>
              ) : <p className={styles.resourceDescription}>Deze groep bevat nog geen schermen.</p>}
              <div className={styles.resourceFooter}><span>Bijgewerkt {formatDate(group.updatedAt)}</span><span>Revisie {group.revision}</span></div>
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.empty} role="status">
          <UsersRound aria-hidden="true" />
          <h2>Nog geen schermgroepen</h2>
          <p>Maak groepen om dezelfde planning of standaardcontent verklaarbaar naar meerdere schermen te sturen.</p>
          <Button asChild variant="secondary"><Link href="/dashboard/screens"><MonitorCog aria-hidden="true" />Bekijk schermvloot</Link></Button>
        </section>
      )}
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(value));
}
