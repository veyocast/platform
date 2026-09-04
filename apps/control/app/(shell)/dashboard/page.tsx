import { hasCapability } from "@veyocast/auth";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CloudUpload,
  Clock3,
  MapPin,
  MoreHorizontal,
  Monitor,
  Play,
  Plus,
  Radio,
  WandSparkles,
  X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { requireTenantControlSession } from "../../../lib/control-session";
import { deriveOperationalDashboard } from "../../../lib/control-operations";
import {
  loadTenantOverview,
  type TenantOverview
} from "../../../lib/control-overview";
import { loadContentSchedules } from "./planning/data";
import type { ContentScheduleListItem } from "./planning/planning-types";
import {
  buildCalendarDays
} from "./planning/schedule-calendar";
import { isoToZonedDateTimeLocal } from "./planning/schedule-time";
import styles from "./publisher-overview.module.css";
import DashboardLoading from "./loading";
import {
  createTodayVisualFixture,
  resolveTodayVisualState
} from "./visual-qa-fixtures";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ dismiss?: string; visualState?: string }>;
}) {
  const session = await requireTenantControlSession();
  const { dismiss, visualState: requestedVisualState } = await searchParams;
  const visualState = resolveTodayVisualState(requestedVisualState);

  if (visualState === "loading") return <DashboardLoading />;

  if (visualState) {
    const data = createTodayVisualFixture(visualState);
    return (
      <FieldFlowOverview
        canCreateMedia
        canCreateStudio
        canManageScreens
        data={data}
        schedules={createVisualScheduleFixture(visualState)}
        tenant="Duindorp SV"
        visualAttentionDismissed={dismiss === "1"}
        visualState={visualState}
      />
    );
  }

  if (!session.isLive) {
    return (
      <FieldFlowOverview
        canCreateMedia={false}
        canCreateStudio={false}
        canManageScreens={false}
        data={createTodayVisualFixture("empty-unconfigured")}
        schedules={[]}
        tenant={session.tenant}
      />
    );
  }

  const [data, planning] = await Promise.all([
    loadTenantOverview(session.tenantId!),
    loadContentSchedules(session.tenantId!)
  ]);

  return (
    <FieldFlowOverview
      canCreateMedia={hasCapability(session.capabilities, "tenant.media.write")}
      canCreateStudio={hasCapability(session.capabilities, "tenant.studio.create")}
      canManageScreens={hasCapability(session.capabilities, "tenant.screen.manage")}
      data={data}
      planningError={planning.error}
      schedules={planning.schedules}
      tenant={session.tenant}
    />
  );
}

function FieldFlowOverview({
  canCreateMedia,
  canCreateStudio,
  canManageScreens,
  data,
  planningError = null,
  schedules,
  tenant,
  visualAttentionDismissed = false,
  visualState
}: {
  canCreateMedia: boolean;
  canCreateStudio: boolean;
  canManageScreens: boolean;
  data: TenantOverview;
  planningError?: string | null;
  schedules: ContentScheduleListItem[];
  tenant: string;
  visualAttentionDismissed?: boolean;
  visualState?: string;
}) {
  const operations = deriveOperationalDashboard(data);
  const devices = new Map(data.devices.map((device) => [device.screen_id, device]));
  const releaseById = new Map(data.releases.map((release) => [release.id, release]));
  const playlistById = new Map(data.playlists.map((playlist) => [playlist.id, playlist]));
  const latestHeartbeatByScreen = new Map<string, TenantOverview["heartbeats"][number]>();
  for (const heartbeat of data.heartbeats) {
    if (!latestHeartbeatByScreen.has(heartbeat.screen_id)) {
      latestHeartbeatByScreen.set(heartbeat.screen_id, heartbeat);
    }
  }
  const activeFeature = [...latestHeartbeatByScreen.values()].flatMap((heartbeat) => {
    if (
      !heartbeat.active_release_id ||
      !["PLAYING", "OFFLINE_PLAYING", "READY"].includes(heartbeat.runtime_state) ||
      Date.now() - new Date(heartbeat.created_at).getTime() >= 5 * 60_000
    ) return [];
    const screen = data.screens.find((candidate) => candidate.id === heartbeat.screen_id);
    const release = releaseById.get(heartbeat.active_release_id);
    const playlist = release ? playlistById.get(release.playlist_id) : undefined;
    if (!screen || !release) return [];
    return [{ device: devices.get(screen.id), playlist, release, screen }];
  })[0];
  const tenantTimeZone = schedules[0]?.timezoneName ?? "Europe/Amsterdam";
  const today = scheduleOccurrencesForToday(schedules, tenantTimeZone);
  const latestRelease = data.releases[0];
  const attention = visualState === "healthy"
    ? visualAttentionDismissed
      ? undefined
      : {
          ageLabel: "Over 6 uur",
          effect: "Er staat nog geen vervolgcontent klaar voor de entree.",
          href: "/dashboard/planning",
          label: "Sponsorloop stopt vandaag om 17:00",
          severity: "warning" as const
        }
    : operations.signals.find((signal) => signal.severity !== "info");
  const screensKnown = data.availability.screens && data.availability.devices;
  const allScreensOnline = screensKnown && data.screens.length > 0 &&
    operations.onlineScreenCount === data.screens.length;
  const systemStatusVerified = !data.error && !planningError &&
    Object.values(data.availability).every(Boolean) && allScreensOnline &&
    operations.status.id === "healthy";

  return (
    <div
      className={styles.referenceDashboard}
      data-tenant={tenant}
      data-visual-state={visualState}
    >
      {data.error ? (
        <p className={styles.dataNotice} role="alert">
          <strong>Niet alle actuele gegevens zijn beschikbaar.</strong>{" "}
          Bekende waarden blijven zichtbaar; ontbrekende waarden tonen een streepje.
        </p>
      ) : null}
      {planningError ? (
        <p className={styles.dataNotice} role="alert">
          <strong>De dagplanning kon niet worden geladen.</strong> Open Planning om opnieuw te proberen.
        </p>
      ) : null}

      <section aria-label="Belangrijkste cijfers" className={styles.referenceMetrics}>
        <MetricCard
          detail={data.screens.length ? "Alle locaties bereikbaar" : "Nog geen schermen gekoppeld"}
          href="/dashboard/screens"
          icon={<Monitor aria-hidden="true" />}
          label="Schermen online"
          tone="green"
          value={screensKnown && data.screens.length
            ? `${operations.onlineScreenCount} / ${data.screens.length}`
            : "—"}
        />
        <MetricCard
          detail="afspeellijsten"
          href="/dashboard/publications"
          icon={<Play aria-hidden="true" />}
          label="Nu actief"
          tone="blue"
          value={data.availability.devices && data.availability.telemetry
            ? operations.activePlaybackCount
            : "—"}
        />
        <MetricCard
          detail="publicatiemomenten"
          href="/dashboard/planning"
          icon={<CalendarDays aria-hidden="true" />}
          label="Gepland vandaag"
          tone="orange"
          value={planningError ? "—" : today.length}
        />
        <MetricCard
          detail={latestRelease
            ? `${playlistById.get(latestRelease.playlist_id)?.name ?? "Publicatie"} · zojuist`
            : "Nog niets gepubliceerd"}
          href="/dashboard/publications"
          icon={<Clock3 aria-hidden="true" />}
          label="Laatste publicatie"
          tone="petrol"
          value={latestRelease ? formatTime(latestRelease.published_at, tenantTimeZone) : "—"}
        />
      </section>

      <section
        aria-label={attention ? "Aandacht nodig" : "Systeemstatus"}
        className={styles.attentionBanner}
        data-clear={(!attention && systemStatusVerified) || undefined}
        data-unknown={(!attention && !systemStatusVerified) || undefined}
      >
        <span className={styles.attentionIcon} aria-hidden="true">
          {attention ? <AlertCircle /> : <Radio />}
        </span>
        <span className={styles.attentionCopy}>
          <small>{attention ? "Aandacht nodig" : systemStatusVerified ? "Alles in orde" : "Statusoverzicht"}</small>
          <strong>{attention?.label ?? (systemStatusVerified
            ? "Alle schermen zijn bereikbaar"
            : "Status is niet volledig bevestigd")}</strong>
          <span>{attention?.effect ?? (systemStatusVerified
            ? "Nieuwe operationele meldingen verschijnen hier automatisch."
            : "Open de statusweergave om ontbrekende of nog niet geladen controles te bekijken.")}</span>
        </span>
        {attention ? (
          <span className={styles.attentionAge}>
            <Clock3 aria-hidden="true" />
            {attention.ageLabel}
          </span>
        ) : null}
        <Link className={styles.attentionAction} href={attention?.href ?? "/dashboard/screens?view=health"}>
          {visualState === "healthy"
            ? "Planning bekijken"
            : attention
              ? "Bekijk herstelactie"
              : "Status bekijken"}
          <ArrowRight aria-hidden="true" />
        </Link>
        {visualState === "healthy" ? (
          <Link
            aria-label="Melding sluiten"
            className={styles.attentionDismiss}
            href="/dashboard?visualState=healthy&dismiss=1"
          >
            <X aria-hidden="true" />
          </Link>
        ) : null}
      </section>

      <section aria-labelledby="publication-flow-title" className={styles.publicationFlow}>
        <div className={styles.sectionLabel}>
          <span>
            <small>Publicatiestroom</small>
            <h2 id="publication-flow-title">Van idee naar ieder scherm</h2>
          </span>
          <Link href="/dashboard/studio">Open Studio <ArrowRight aria-hidden="true" /></Link>
        </div>
        <ol>
          <FlowStep color="blue" href="/dashboard/studio" icon={<WandSparkles />} label="Studio" meta="Maak content" />
          <FlowStep color="sky" href="/dashboard/planning" icon={<CalendarDays />} label="Planning" meta="Kies het moment" />
          <FlowStep color="green" href="/dashboard/publications" icon={<Play />} label="Publiceren" meta="Zet het live" />
          <FlowStep color="petrol" href="/dashboard/screens" icon={<Monitor />} label="Schermen" meta="Bereik de club" />
        </ol>
      </section>

      <section className={styles.referenceLowerGrid}>
        <section aria-labelledby="active-feature-title" className={styles.featurePanel}>
          <div className={styles.panelHeading}>
            <span>
              <small>Nu actief op schermen</small>
              <h2 id="active-feature-title">{activeFeature?.playlist?.name ?? "Nog niets actief"}</h2>
            </span>
            {activeFeature ? <span className={styles.livePill}><i /> Nu actief</span> : null}
          </div>
          {activeFeature ? (
            <Link className={styles.featureVisual} href={`/dashboard/screens/${activeFeature.screen.id}`}>
              <Image
                alt="Clubleden rond een sportmoment"
                fill
                priority
                sizes="(max-width: 900px) 100vw, 50vw"
                src="/fieldflow/photos/FF-PHOTO-06-community-3840x2560-web.webp"
              />
              <span className={styles.featureShade} />
              <span className={styles.featureCopy}>
                <small>{activeFeature.playlist?.name ?? "Actieve publicatie"}</small>
                <strong>{visualState === "healthy"
                  ? "14:30"
                  : formatTime(activeFeature.release.published_at, tenantTimeZone)}</strong>
                <span>{visualState === "healthy"
                  ? "Heren 1 — S.V. Vooruit"
                  : activeFeature.screen.name}</span>
                {visualState === "healthy" || activeFeature.screen.location ? (
                  <em className={styles.featureLocation}>
                    <MapPin aria-hidden="true" />
                    {visualState === "healthy"
                      ? "Sportpark Houtrust"
                      : activeFeature.screen.location}
                  </em>
                ) : null}
              </span>
            </Link>
          ) : (
            <div className={styles.featureEmpty} role="status">
              <Monitor aria-hidden="true" />
              <strong>Publiceer een playlist om hier live content te zien.</strong>
              <Link href="/dashboard/playlists">Naar playlists <ArrowRight aria-hidden="true" /></Link>
            </div>
          )}
        </section>

        <section aria-labelledby="today-title" className={styles.todayPanel}>
          <div className={styles.panelHeading}>
            <span><small>Vandaag</small><h2 id="today-title">Dit staat er klaar</h2></span>
            <Link
              aria-label="Planning openen"
              className={styles.panelOverflowAction}
              href="/dashboard/planning"
            >
              <MoreHorizontal aria-hidden="true" />
            </Link>
          </div>
          {today.length ? (
            <ol>
              {today.slice(0, 4).map((occurrence, index) => (
                <li data-tone={toneAt(index)} key={`${occurrence.scheduleId}-${occurrence.startsAt}`}>
                  <time dateTime={occurrence.startsAt}>{formatTime(occurrence.startsAt, tenantTimeZone)}</time>
                  <span><strong>{occurrence.name}</strong><small>{occurrence.targetName}</small></span>
                  <ArrowRight aria-hidden="true" />
                </li>
              ))}
            </ol>
          ) : (
            <div className={styles.todayEmpty} role="status">Er staat vandaag nog niets gepland.</div>
          )}
        </section>

        <aside aria-labelledby="quick-title" className={styles.quickPanel}>
          <div className={styles.panelHeading}>
            <span><small>Snel starten</small><h2 id="quick-title">Wat wil je doen?</h2></span>
          </div>
          <nav aria-label="Snelle acties">
            {canCreateStudio ? <QuickLink color="orange" href="/dashboard/studio/new" icon={<Plus />} label="Nieuwe slide" meta="Maak iets nieuws" /> : null}
            {canCreateMedia ? <QuickLink color="blue" href="/dashboard/media?upload=1" icon={<CloudUpload />} label="Media uploaden" meta="Foto of video" /> : null}
            {canManageScreens ? <QuickLink color="green" href="/dashboard/screens/new" icon={<Monitor />} label="Nieuw scherm" meta="Koppel in 2 minuten" /> : null}
            {!canCreateStudio && !canCreateMedia && !canManageScreens ? (
              <p className={styles.quickEmpty}>Je hebt alleen-lezen toegang. Open een onderdeel via het hoofdmenu.</p>
            ) : null}
          </nav>
        </aside>
      </section>
    </div>
  );
}

function MetricCard({
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
  tone: "blue" | "green" | "orange" | "petrol";
  value: number | string;
}) {
  return (
    <Link className={styles.metricCard} data-tone={tone} href={href}>
      <span className={styles.metricIcon}>{icon}</span>
      <span><small>{label}</small><strong>{value}</strong></span>
      <p>{detail}</p>
    </Link>
  );
}

function FlowStep({
  color,
  href,
  icon,
  label,
  meta
}: {
  color: string;
  href: string;
  icon: React.ReactNode;
  label: string;
  meta: string;
}) {
  return (
    <li data-color={color}>
      <Link href={href}>
        <span>{icon}</span><strong>{label}</strong><small>{meta}</small>
      </Link>
    </li>
  );
}

function QuickLink({
  color,
  href,
  icon,
  label,
  meta
}: {
  color: string;
  href: string;
  icon: React.ReactNode;
  label: string;
  meta: string;
}) {
  return (
    <Link data-color={color} href={href}>
      <span>{icon}</span><span><strong>{label}</strong><small>{meta}</small></span><ArrowRight aria-hidden="true" />
    </Link>
  );
}

function scheduleOccurrencesForToday(
  schedules: ContentScheduleListItem[],
  timezone: string
) {
  if (!schedules.length) return [];
  const now = new Date();
  return buildCalendarDays(
    schedules,
    "week",
    isoToZonedDateTimeLocal(now.toISOString(), timezone).slice(0, 10),
    timezone,
    now
  ).find((day) => day.isToday)?.occurrences ?? [];
}

function formatTime(value: string, timeZone = "Europe/Amsterdam") {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone
  }).format(new Date(value));
}

function toneAt(index: number) {
  return (["green", "blue", "orange", "petrol"] as const)[index % 4];
}

function createVisualScheduleFixture(
  state: Exclude<ReturnType<typeof resolveTodayVisualState>, "loading" | null>
): ContentScheduleListItem[] {
  if (state !== "healthy") return [];
  const now = new Date();
  const starts = [9, 10, 14, 19, 20, 20, 21, 21, 22, 22, 23, 23];
  const names = ["Trainingstijden jeugd", "Wedstrijd Heren 1", "Sponsor van de week", "Bingoavond"];
  const targets = ["Kantine", "Hoofdveld", "Clubhuis", "Kantine"];
  return starts.map((hour, index) => {
    const start = new Date(now);
    start.setHours(
      hour,
      index === 1 || index === 3 || (index > 3 && index % 2 === 1) ? 30 : 0,
      0,
      0
    );
    const end = new Date(start.getTime() + 60 * 60_000);
    return {
      enabled: true,
      endsAt: end.toISOString(),
      id: `visual-schedule-${index}`,
      name: names[index] ?? `Clubmoment ${index + 1}`,
      playlistId: "visual-playlist-1",
      playlistName: "Clubhuis vandaag",
      priority: index,
      recurrence: {},
      releaseId: "visual-release-1",
      releaseVersion: 7,
      revision: 1,
      scheduleKind: "once",
      source: "schedule",
      startsAt: start.toISOString(),
      targetId: `visual-target-${index}`,
      targetKind: "screen",
      targetName: targets[index] ?? `Zone ${index + 1}`,
      timezoneName: "Europe/Amsterdam"
    };
  });
}
