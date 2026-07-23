import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, PageHeader, StatusPill, SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import styles from "../publisher-resources.module.css";
import { loadContentSchedules } from "./data";
import {
  ContentScheduleDialog,
  ScheduleStateDialog
} from "./planning-dialogs";
import planningStyles from "./planning.module.css";

type PlanningPageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

export default async function PlanningPage({ searchParams }: PlanningPageProps) {
  const session = await requireTenantControlSession("tenant.release.read");
  const query = await searchParams;
  const data = session.isLive && session.tenantId
    ? await loadContentSchedules(session.tenantId)
    : { error: null, groups: [], releases: [], schedules: [], screens: [], timezoneName: "Europe/Amsterdam" };
  const now = Date.now();
  const active = data.schedules.filter((schedule) =>
    schedule.enabled &&
    new Date(schedule.startsAt).getTime() <= now &&
    (!schedule.endsAt || new Date(schedule.endsAt).getTime() > now)
  ).length;
  const upcoming = data.schedules.filter((schedule) =>
    schedule.enabled && new Date(schedule.startsAt).getTime() > now
  ).length;
  const canWrite = session.isLive && session.tenantStatus === "active" &&
    hasCapability(session.roles, "tenant.playlist.write");
  const defaultStartAt = new Date(now + 60 * 60 * 1000).toISOString();

  return (
    <>
      <PageHeader
        actions={(
          <ContentScheduleDialog
            defaultStartAt={defaultStartAt}
            disabled={!canWrite}
            groups={data.groups}
            releases={data.releases}
            screens={data.screens}
            timezoneName={data.timezoneName}
          />
        )}
        description="Plan immutable publicaties per scherm of schermgroep, met zichtbare prioriteit en tijdzone."
        eyebrow={`${session.tenant} · ${data.timezoneName}`}
        status={!session.isLive ? { label: "Demomodus", tone: "warning" } : undefined}
        title="Planning"
      />
      {query.fout ? <p className="notice notice--critical" role="alert"><strong>Planning niet opgeslagen.</strong> {query.fout}</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Planning niet geladen.</strong> {data.error}</p> : null}
      {!session.isLive ? <p className="notice notice--warning" role="status">Configureer Supabase en log in om echte planningen te beheren.</p> : null}
      {session.isLive && !canWrite ? <p className="notice notice--info" role="status">Je kunt de planning bekijken. Playlistbewerkingsrechten zijn nodig om tijdvakken te wijzigen.</p> : null}

      <SummaryStrip
        aria-label="Planningssamenvatting"
        items={[
          { label: "Nu actief", tone: active ? "success" : "neutral", value: active },
          { label: "Aankomend", tone: upcoming ? "info" : "neutral", value: upcoming },
          { label: "Totaal", value: data.schedules.length }
        ]}
      />

      {data.schedules.length ? (
        <ol aria-label="Geplande content" className={styles.scheduleList}>
          {data.schedules.map((schedule) => (
            <li className={styles.scheduleRow} key={schedule.id}>
              <span className={styles.scheduleIdentity}><strong>{schedule.name}</strong><small>{schedule.targetKind === "screen" ? "Scherm" : "Schermgroep"} · {schedule.targetName}</small></span>
              <span className={styles.scheduleContent}><strong>{schedule.playlistName}</strong><small>Immutable versie {schedule.releaseVersion} · prioriteit {schedule.priority} · {sourceLabel(schedule.source)}</small></span>
              <span className={styles.scheduleTiming}><strong>{scheduleKindLabel(schedule.scheduleKind)}</strong><small>{formatScheduleWindow(schedule.startsAt, schedule.endsAt, schedule.timezoneName)}</small></span>
              <span className={planningStyles.rowActions}>
                <StatusPill label={schedule.enabled ? "Actief" : "Uitgeschakeld"} tone={schedule.enabled ? "success" : "neutral"} />
                {canWrite && schedule.source !== "fallback" ? (
                  <>
                    <ContentScheduleDialog
                      defaultStartAt={defaultStartAt}
                      disabled={false}
                      groups={data.groups}
                      releases={data.releases}
                      schedule={schedule}
                      screens={data.screens}
                      timezoneName={data.timezoneName}
                    />
                    <ScheduleStateDialog schedule={schedule} timezoneName={data.timezoneName} />
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <section className={styles.empty} role="status">
          <CalendarClock aria-hidden="true" />
          <h2>Nog geen planning</h2>
          <p>Publiceer eerst een playlistversie. Alleen immutable releases kunnen veilig worden ingepland.</p>
          <Button asChild variant="secondary"><Link href="/dashboard/playlists">Naar playlists</Link></Button>
        </section>
      )}
    </>
  );
}

function sourceLabel(value: string) {
  if (value === "override") return "Tijdelijke override";
  if (value === "fallback") return "Fallback";
  return "Normale planning";
}

function scheduleKindLabel(value: string) {
  return ({ custom: "Aangepast", daily: "Dagelijks", once: "Eenmalig", weekly: "Wekelijks" } as Record<string, string>)[value] ?? value;
}

function formatScheduleWindow(start: string, end: string | null, timezone: string) {
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone
  });
  return end ? `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}` : `Vanaf ${formatter.format(new Date(start))}`;
}
