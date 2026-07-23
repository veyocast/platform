import Link from "next/link";

import { hasCapability } from "@veyocast/auth";
import {
  Alert,
  Button,
  PageHeader,
  StatusPill
} from "@veyocast/ui";
import {
  ArrowRight,
  CalendarPlus,
  CloudUpload,
  ListPlus,
  MonitorUp,
  Radio,
  RefreshCw,
  Server
} from "lucide-react";

import { requireTenantControlSession } from "../../../lib/control-session";
import { deriveOperationalDashboard } from "../../../lib/control-operations";
import {
  loadTenantOverview,
  type TenantOverview
} from "../../../lib/control-overview";
import { OperationalActionInbox } from "../_components/operational-action-inbox";
import styles from "./publisher-overview.module.css";

export default async function DashboardPage() {
  const session = await requireTenantControlSession();

  if (!session.isLive) {
    return <DemoDashboardPage userName={session.userName} />;
  }

  const data = await loadTenantOverview(session.tenantId!);
  const operations = deriveOperationalDashboard(data);
  return (
    <LiveDashboard
      canManageScreens={hasCapability(session.capabilities, "tenant.screen.manage")}
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
  const unsyncedScreenCount = data.devices.filter(
    (device) =>
      device.status === "paired" &&
      device.desired_release_id &&
      device.desired_release_id !== device.active_release_id
  ).length;
  const unpublishedDraftCount = data.playlists.filter(
    (playlist) =>
      playlist.status === "draft" &&
      !data.releases.some((release) => release.playlist_id === playlist.id)
  ).length;
  const mediaBytes = data.media.reduce(
    (total, asset) => total + Number(asset.file_size_bytes ?? 0),
    0
  );
  const releaseById = new Map(data.releases.map((release) => [release.id, release]));
  const playlistById = new Map(data.playlists.map((playlist) => [playlist.id, playlist]));
  const activeAssignments = data.screens
    .map((screen) => {
      const device = devices.get(screen.id);
      const releaseId = device?.active_release_id ?? screen.assigned_release_id;
      const release = releaseId ? releaseById.get(releaseId) : undefined;
      const playlistId = release?.playlist_id ?? screen.assigned_playlist_id;
      return {
        device,
        playlist: playlistId ? playlistById.get(playlistId) : undefined,
        release,
        screen
      };
    })
    .filter(({ playlist, release }) => playlist || release);
  const onboardingComplete = operations.onboarding.filter((step) => step.complete).length;

  return (
    <>
      <PageHeader
        actions={
          <Button asChild>
            <Link href="/dashboard/playlists?nieuw=1">
              <ListPlus aria-hidden="true" />
              Nieuwe playlist
            </Link>
          </Button>
        }
        description="Publiceer content en houd in één oogopslag zicht op wat er live staat."
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
        signals={actionableSignals.slice(0, 5)}
        totalCount={actionableSignals.length}
      />

      <section aria-label="Publisherstatus" className={styles.statusGrid}>
        <StatusCard
          detail="gekoppelde schermen bereikbaar"
          href="/dashboard/screens?status=online"
          icon={<Radio aria-hidden="true" />}
          label="Schermen online"
          tone={operations.onlineScreenCount === data.screens.length ? "success" : "warning"}
          value={`${operations.onlineScreenCount} van ${data.screens.length}`}
        />
        <StatusCard
          detail={unpublishedDraftCount ? "concepten wachten op publicatie" : "alles gepubliceerd"}
          href="/dashboard/playlists?status=draft"
          icon={<CloudUpload aria-hidden="true" />}
          label="Publicatie gereed"
          tone={unpublishedDraftCount ? "warning" : "success"}
          value={String(unpublishedDraftCount)}
        />
        <StatusCard
          detail={unsyncedScreenCount ? "schermen lopen nog achter" : "alle schermen zijn bij"}
          href="/dashboard/screens?sync=pending"
          icon={<RefreshCw aria-hidden="true" />}
          label="Synchronisatie"
          tone={unsyncedScreenCount ? "warning" : "success"}
          value={unsyncedScreenCount ? `${unsyncedScreenCount} open` : "Actueel"}
        />
        <StatusCard
          href="/dashboard/media"
          icon={<Server aria-hidden="true" />}
          label="Opslag"
          tone="neutral"
          detail={data.mediaStorageLimitBytes === null
            ? `${formatBytes(mediaBytes)} gebruikt · geen limiet ingesteld`
            : `${formatBytes(mediaBytes)} van ${formatBytes(data.mediaStorageLimitBytes)}`}
          value={formatBytes(mediaBytes)}
        />
      </section>

      <nav aria-label="Snelle acties" className={styles.quickActions}>
        <QuickAction href="/dashboard/playlists?nieuw=1" icon={<ListPlus aria-hidden="true" />}>
          Nieuwe playlist
        </QuickAction>
        <QuickAction href="/dashboard/media?upload=1" icon={<CloudUpload aria-hidden="true" />}>
          Media uploaden
        </QuickAction>
        {canManageScreens ? (
          <QuickAction href="/dashboard/screens/new" icon={<MonitorUp aria-hidden="true" />}>
            Scherm koppelen
          </QuickAction>
        ) : null}
        <QuickAction href="/dashboard/planning?nieuw=1" icon={<CalendarPlus aria-hidden="true" />}>
          Planning maken
        </QuickAction>
      </nav>

      <section
        className={`${styles.dashboardGrid}${
          onboardingComplete === operations.onboarding.length
            ? ` ${styles.dashboardGridSingle}`
            : ""
        }`}
      >
        <section className={styles.activePanel} aria-labelledby="active-content-title">
          <SectionHeading
            actionHref="/dashboard/screens"
            actionLabel="Alle schermen"
            description="De publicaties die spelers op dit moment daadwerkelijk melden."
            id="active-content-title"
            title="Nu actief"
          />
          {activeAssignments.length ? (
            <ul className={styles.activeList}>
              {activeAssignments.slice(0, 6).map(({ device, playlist, release, screen }) => {
                const online = isRecentlyOnline(device?.last_seen_at);
                return (
                  <li key={screen.id}>
                    <Link className={styles.activeLink} href={`/dashboard/screens/${screen.id}`}>
                      <span className={styles.activeIcon} aria-hidden="true"><Radio /></span>
                      <span className={styles.activeCopy}>
                        <strong>{playlist?.name ?? "Actieve publicatie"}</strong>
                        <small>{screen.name}{screen.location ? ` · ${screen.location}` : ""}</small>
                      </span>
                      <span className={styles.activeMeta}>
                        <StatusPill label={online ? "Live" : "Offline cache"} tone={online ? "success" : "warning"} />
                        <small>{release ? `Versie ${release.version}` : "Toegewezen concept"}</small>
                      </span>
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.emptyCompact} role="status">
              <Radio aria-hidden="true" />
              <div>
                <strong>Nog niets live</strong>
                <p>Publiceer een playlist en wijs die toe aan een gekoppeld scherm.</p>
              </div>
            </div>
          )}
        </section>

        {onboardingComplete < operations.onboarding.length ? (
          <aside className={styles.sideColumn}>
            <section className={styles.onboarding} aria-labelledby="onboarding-title">
              <div className={styles.onboardingHeader}>
                <div>
                  <h2 id="onboarding-title">Startklaar maken</h2>
                  <p>De kortste route naar een werkende eerste publicatie.</p>
                </div>
                <StatusPill
                  label={`${onboardingComplete}/${operations.onboarding.length}`}
                  tone="info"
                />
              </div>
              <ol>
                {operations.onboarding.filter((step) => !step.complete).slice(0, 4).map((step) => (
                  <li key={step.id}>
                    <Link href={step.href}>
                      <span aria-hidden="true">○</span>
                      {step.label}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        ) : null}
      </section>

      <section className={styles.activityPanel} aria-labelledby="recent-events-title">
        <SectionHeading
          actionHref="/dashboard/auditlog"
          actionLabel="Alle activiteit"
          description="Recente, serverbevestigde wijzigingen binnen deze organisatie."
          id="recent-events-title"
          title="Recente activiteit"
        />
        {data.auditEvents.length ? (
          <ul className={styles.activityList} aria-label="Recente auditgebeurtenissen">
            {data.auditEvents.map((event) => (
              <li key={event.id}>
                <span className={styles.activityMarker} data-result={event.result} aria-hidden="true" />
                <span>
                  <strong>{humanize(event.action)}</strong>
                  <small>
                    {event.actor_name} · {event.target_name ?? targetTypeLabel(event.target_type)} ·{" "}
                    {formatDate(event.created_at)}
                  </small>
                </span>
                <StatusPill
                  label={event.result === "success" ? "Geslaagd" : "Mislukt"}
                  tone={event.result === "success" ? "success" : "critical"}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.emptyCompact} role="status">
            <span className={styles.activityMarker} aria-hidden="true" />
            <div><strong>Nog geen activiteit</strong><p>Bevestigde wijzigingen verschijnen hier automatisch.</p></div>
          </div>
        )}
      </section>
    </>
  );
}

function StatusCard({
  detail,
  href,
  icon,
  label,
  tone,
  value
}: {
  detail: string;
  href: string;
  icon: React.ReactNode;
  label: string;
  tone: "success" | "warning" | "neutral";
  value: string;
}) {
  return (
    <Link className={styles.statusCard} data-tone={tone} href={href}>
      <span className={styles.statusIcon}>{icon}</span>
      <span className={styles.statusCopy}>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{detail}</span>
      </span>
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

function QuickAction({
  children,
  href,
  icon
}: {
  children: React.ReactNode;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link className={styles.quickAction} href={href}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function SectionHeading({
  actionHref,
  actionLabel,
  description,
  id,
  title
}: {
  actionHref: string;
  actionLabel: string;
  description: string;
  id: string;
  title: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </div>
      <Link href={actionHref}>{actionLabel}<ArrowRight aria-hidden="true" /></Link>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
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
  const text = value.replaceAll(".", " ").replaceAll("_", " ");
  return text.charAt(0).toLocaleUpperCase("nl-NL") + text.slice(1);
}

function targetTypeLabel(value: string) {
  return ({
    content_schedules: "Planning",
    media_assets: "Media",
    playlist_releases: "Release",
    playlists: "Playlist",
    screen_groups: "Schermgroep",
    screens: "Scherm"
  } as Record<string, string>)[value] ?? humanize(value);
}
