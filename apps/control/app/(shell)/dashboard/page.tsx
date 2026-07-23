import Link from "next/link";

import { hasCapability } from "@veyocast/auth";
import {
  Alert,
  Button,
  DataTable,
  PageHeader,
  StatusPill,
  SummaryStrip
} from "@veyocast/ui";

import { requireTenantControlSession } from "../../../lib/control-session";
import { deriveOperationalDashboard } from "../../../lib/control-operations";
import {
  loadTenantOverview,
  type TenantOverview
} from "../../../lib/control-overview";
import { OperationalActionInbox } from "../_components/operational-action-inbox";

export default async function DashboardPage() {
  const session = await requireTenantControlSession();

  if (!session.isLive) {
    return <DemoDashboardPage userName={session.userName} />;
  }

  const data = await loadTenantOverview(session.tenantId!);
  const operations = deriveOperationalDashboard(data);
  return (
    <LiveDashboard
      canManageScreens={hasCapability(session.roles, "tenant.screen.manage")}
      data={data}
      operations={operations}
      tenant={session.tenant}
      userName={session.userName}
    />
  );
}

function LiveDashboard({
  canManageScreens,
  data,
  operations,
  tenant,
  userName
}: {
  canManageScreens: boolean;
  data: TenantOverview;
  operations: ReturnType<typeof deriveOperationalDashboard>;
  tenant: string;
  userName: string;
}) {
  const devices = new Map(data.devices.map((device) => [device.screen_id, device]));
  const actionableSignals = operations.signals.filter((signal) => signal.severity !== "info");
  const hasCriticalSignal = operations.signals.some(
    (signal) => signal.severity === "critical"
  );
  const onboardingComplete = operations.onboarding.filter((step) => step.complete).length;

  return (
    <>
      <PageHeader
        actions={
          <Button asChild>
            <Link href="/dashboard/playlists">
              Playlists beheren
            </Link>
          </Button>
        }
        description="Wat vandaag aandacht vraagt en hoe je vloot ervoor staat."
        eyebrow={tenant}
        title={`Welkom, ${userName}`}
      />

      {data.error ? (
        <Alert status="critical" title="Overzicht niet beschikbaar">
          De actuele gegevens konden niet volledig worden geladen. Effect:
          signalen en aantallen kunnen ontbreken. Herstel: vernieuw de pagina of
          meld je opnieuw aan.
        </Alert>
      ) : null}

      <OperationalActionInbox
        signals={operations.signals.slice(0, 5)}
        totalCount={operations.signals.length}
      />

      <SummaryStrip
        aria-label="Operationele samenvatting"
        className="dashboard-operational-summary control-motion-enter"
        items={[
          {
            label: "Actie nodig",
            tone:
              hasCriticalSignal
                ? "critical"
                : actionableSignals.length
                  ? "warning"
                  : operations.signals.length
                    ? "info"
                    : "success",
            value: operations.signals.length
          },
          {
            label: "Schermen online",
            tone:
              operations.onlineScreenCount === data.screens.length
                ? "success"
                : "warning",
            value: `${operations.onlineScreenCount}/${data.screens.length}`
          },
          {
            label: "Media in verwerking",
            tone: operations.processingMediaCount ? "info" : "success",
            value: operations.processingMediaCount
          },
          {
            label: "Playback bevestigd",
            tone: operations.activePlaybackCount ? "success" : "neutral",
            value: operations.activePlaybackCount
          }
        ]}
      />

      <section className="dashboard-layout dashboard-layout--operations">
        <section className="workspace-section" aria-labelledby="fleet-health-title">
          <div className="workspace-section__header">
            <div>
              <h2 className="workspace-section__title" id="fleet-health-title">Vlootgezondheid</h2>
              <p className="work-panel__meta">Koppeling, verbinding en actieve release per scherm.</p>
            </div>
            <div className="workspace-section__actions">
              {canManageScreens ? (
                <Button asChild size="sm" variant="secondary">
                  <Link href="/dashboard/screens/new">Scherm koppelen</Link>
                </Button>
              ) : null}
              <Link className="table-action" href="/dashboard/screens">Alle schermen bekijken</Link>
            </div>
          </div>
          {data.screens.length ? (
            <DataTable caption="Actuele schermstatus binnen de actieve vereniging.">
                <thead><tr><th scope="col">Scherm</th><th scope="col">Status</th><th scope="col">Locatie</th><th scope="col">Release</th><th scope="col">Actie</th></tr></thead>
                <tbody>{data.screens.map((screen) => {
                  const device = devices.get(screen.id);
                  const online = isRecentlyOnline(device?.last_seen_at);
                  return <tr key={screen.id}>
                    <td data-label="Scherm"><span className="table-primary">{screen.name}</span></td>
                    <td data-label="Status"><StatusPill label={online ? "Online" : device ? "Offline" : "Niet gekoppeld"} tone={online ? "success" : "warning"} /></td>
                    <td data-label="Locatie">{screen.location || "Niet ingesteld"}</td>
                    <td data-label="Release">{device?.active_release_id ? shortId(device.active_release_id) : "Geen actieve release"}</td>
                    <td data-label="Actie"><Link className="table-action" href={`/dashboard/screens/${screen.id}`}>Diagnose</Link></td>
                  </tr>;
                })}</tbody>
            </DataTable>
          ) : (
            <p className="notice" role="status">Nog geen schermen. Maak een scherm aan en koppel daarna een Player.</p>
          )}
        </section>

        <aside className="dashboard-aside" aria-label="Inrichting en publicaties">
          <section className="status-panel" aria-labelledby="onboarding-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="onboarding-title">Startklaar maken</h2>
                <p className="work-panel__meta">Afgeleid uit echte resources; geen handmatige afvinkstatus.</p>
              </div>
              <StatusPill label={`${onboardingComplete}/${operations.onboarding.length}`} tone={onboardingComplete === operations.onboarding.length ? "success" : "info"} />
            </div>
            <ol className="operational-checklist">
              {operations.onboarding.map((step) => (
                <li data-complete={step.complete} key={step.id}>
                  <span aria-hidden="true">{step.complete ? "✓" : "○"}</span>
                  <Link href={step.href}>{step.label}</Link>
                </li>
              ))}
            </ol>
          </section>

          <section className="status-panel" aria-labelledby="recent-releases-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="recent-releases-title">Recente releases</h2>
                <p className="work-panel__meta">Immutable publicaties, nieuwste eerst.</p>
              </div>
              <Link className="table-action" href="/dashboard/releases">Historie</Link>
            </div>
            {data.releases.length ? (
              <ul className="compact-resource-list">
                {data.releases.slice(0, 5).map((release) => (
                  <li key={release.id}>
                    <Link href={`/dashboard/releases/${release.id}`}>Versie {release.version}</Link>
                    <span>{formatDate(release.published_at)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="notice" role="status">Nog geen release gepubliceerd.</p>}
          </section>
        </aside>
      </section>

      <section className="workspace-section" aria-labelledby="recent-events-title">
        <div className="workspace-section__header">
          <div><h2 className="workspace-section__title" id="recent-events-title">Recente activiteit</h2><p className="work-panel__meta">Server-side auditgebeurtenissen, nieuwste eerst.</p></div>
          <StatusPill label={`${data.auditEvents.length} getoond`} tone="neutral" />
        </div>
        {data.auditEvents.length ? <ul className="health-list" aria-label="Recente auditgebeurtenissen">{data.auditEvents.map((event) => <li className="health-item" key={event.id}><span className="health-item__copy"><span className="health-item__title">{humanize(event.action)}</span><span className="work-panel__meta">{event.target_type} · {formatDate(event.created_at)}</span></span><StatusPill label={event.result === "success" ? "Geslaagd" : "Mislukt"} tone={event.result === "success" ? "success" : "critical"} /></li>)}</ul> : <p className="notice" role="status">Nog geen auditgebeurtenissen voor deze vereniging.</p>}
      </section>
    </>
  );
}

function DemoDashboardPage({ userName }: { userName: string }) {
  return (
    <>
      <PageHeader
        description="Deze lokale demomodus bevat bewust geen fictieve KPI’s of operationele meldingen. Verbind een live tenant om het dashboard te vullen."
        eyebrow="Lokale demomodus"
        status={{ label: "Geen live tenantdata", tone: "info" }}
        title={`Welkom, ${userName}`}
      />
      <section className="empty-dashboard" aria-labelledby="demo-dashboard-title">
        <StatusPill label="Veilige lege staat" tone="info" />
        <h2 id="demo-dashboard-title">Verbind een live omgeving voor operationeel inzicht</h2>
        <p>Acties, schermstatus, verwerking, onboarding en releases worden uitsluitend uit tenantgebonden serverdata afgeleid. Deze route simuleert daarom geen klant, schermen of publicaties.</p>
        <div className="page-actions">
          <Button asChild>
            <Link href="/dashboard/screens">Bekijk schermflow</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/dashboard/media">Bekijk mediaflow</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function isRecentlyOnline(value: string | null | undefined) {
  return Boolean(value && Date.now() - new Date(value).getTime() < 5 * 60_000);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function humanize(value: string) {
  return value.replaceAll(".", " ").replaceAll("_", " ");
}

function shortId(value: string) {
  return value.slice(0, 8);
}
