import Link from "next/link";
import { MonitorCog, UsersRound } from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, PageHeader, StatusPill, SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { formatTenantDateTime } from "../../../../lib/tenant-time";
import styles from "../publisher-resources.module.css";
import { loadScreenGroups } from "./data";
import groupStyles from "./screen-groups.module.css";
import {
  ArchiveScreenGroupDialog,
  ScreenGroupDialog
} from "./screen-group-dialogs";

type ScreenGroupsPageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

export default async function ScreenGroupsPage({ searchParams }: ScreenGroupsPageProps) {
  const session = await requireTenantControlSession("tenant.screen.read");
  const query = await searchParams;
  const data = session.isLive && session.tenantId
    ? await loadScreenGroups(session.tenantId)
    : { error: null, groups: [], releases: [], screens: [] };
  const activeGroups = data.groups.filter((group) => group.status === "active");
  const assignedScreens = new Set(activeGroups.flatMap((group) => group.memberNames));
  const canManage = session.isLive && session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.screen.manage");

  return (
    <>
      <PageHeader
        actions={(
          <ScreenGroupDialog
            disabled={!canManage}
            releases={data.releases}
            screens={data.screens}
          />
        )}
        description="Bundel schermen zonder hun individuele identiteit of status te verliezen."
        eyebrow={session.tenant}
        status={!session.isLive ? { label: "Demomodus", tone: "warning" } : undefined}
        title="Schermgroepen"
      />
      {query.fout ? <p className="notice notice--critical" role="alert"><strong>Schermgroep niet opgeslagen.</strong> {query.fout}</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Schermgroepen niet geladen.</strong> {data.error}</p> : null}
      {!session.isLive ? <p className="notice notice--warning" role="status">Configureer Supabase en log in om echte schermgroepen te beheren.</p> : null}
      {session.isLive && !canManage ? <p className="notice notice--info" role="status">Je kunt schermgroepen bekijken. Beheerrechten zijn nodig om groepen en leden te wijzigen.</p> : null}

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
              <div className={styles.resourceFooter}>
                <span>Bijgewerkt {formatDate(group.updatedAt)} · revisie {group.revision}</span>
                {canManage && group.status === "active" ? (
                  <span className={groupStyles.cardActions}>
                    <ScreenGroupDialog
                      disabled={false}
                      group={group}
                      releases={data.releases}
                      screens={data.screens}
                    />
                    <ArchiveScreenGroupDialog group={group} />
                  </span>
                ) : null}
              </div>
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
  return formatTenantDateTime(value, null, { dateStyle: "medium" });
}
