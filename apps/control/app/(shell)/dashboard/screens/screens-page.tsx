import { randomUUID } from "node:crypto";

import Link from "next/link";
import {
  ChevronRight,
  CircleCheck,
  Grid3X3,
  List,
  Map as MapIcon,
  MapPin,
  Monitor,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  UsersRound,
  Wifi
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { hasCapability } from "@veyocast/auth";
import { Button, StatusPill } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { formatTenantDateTime } from "../../../../lib/tenant-time";
import { deriveScreenHealth } from "../../../../lib/screen-health";
import { PageHeader } from "../../_components/shell-primitives";
import {
  loadScreenFleet,
  type FleetDevice,
  type FleetRelease,
  type FleetScreen,
  type ScreenAutomationSummary,
  type ScreenFleetData
} from "./data";
import {
  addBulkScreensToGroup,
  assignBulkScreenRelease,
  requestBulkScreenSyncRetry
} from "./actions";
import { ScreenBulkForm } from "./screen-bulk-form";
import { HealthView } from "./health-view";
import { VenueView } from "./venue-view";
import styles from "./screens-overview.module.css";

type ScreensPageProps = {
  searchParams: Promise<{
    fout?: string;
    group?: string;
    q?: string;
    status?: string;
    succes?: string;
    sync?: string;
    view?: string;
    visual?: string;
  }>;
};

const mapPositions = [
  { left: 11, top: 19 },
  { left: 72, top: 17 },
  { left: 29, top: 70 },
  { left: 56, top: 67 },
  { left: 83, top: 54 },
  { left: 40, top: 26 },
  { left: 69, top: 43 }
] as const;

export default async function ScreensPage({ searchParams }: ScreensPageProps) {
  const session = await requireTenantControlSession("tenant.screen.read");
  const query = await searchParams;
  const visualReference = isReferenceVisual(query.visual);
  const loadedData = session.isLive && session.tenantId
    ? await loadScreenFleet(session.tenantId)
    : emptyScreenFleet();
  const data = visualReference ? createReferenceScreenFleet() : loadedData;
  const devicesByScreen = new Map(
    data.devices.filter((device) => device.status === "paired").map((device) => [device.screenId, device])
  );
  const releaseById = new Map(data.releases.map((release) => [release.id, release]));
  const statuses = data.screens.map((screen) => screenStatus(screen, devicesByScreen.get(screen.id)));
  const normalizedQuery = query.q?.trim().toLocaleLowerCase("nl-NL") ?? "";
  const requestedStatus = query.sync === "pending" ? "syncing" : query.status;
  const statusFilter = new Set(["online", "stale", "offline", "unknown", "syncing", "unpaired", "maintenance", "disabled"]).has(requestedStatus ?? "")
    ? requestedStatus!
    : "all";
  const selectedGroup = data.groups.some((group) => group.id === query.group)
    ? query.group ?? ""
    : "";
  const selectedMemberIds = selectedGroup
    ? new Set(data.groups.find((group) => group.id === selectedGroup)?.memberIds ?? [])
    : null;
  const matchingScreens = data.screens.filter((screen) => {
      const device = devicesByScreen.get(screen.id);
      const status = screenStatus(screen, device);
      return (!selectedMemberIds || selectedMemberIds.has(screen.id)) &&
        (statusFilter === "all" || status.kind === statusFilter) &&
        (!normalizedQuery || [screen.name, screen.location, device?.deviceName].some((value) => value?.toLocaleLowerCase("nl-NL").includes(normalizedQuery)));
    });
  const filteredScreens = visualReference ? matchingScreens : matchingScreens.sort((left, right) => {
      const priorityDifference =
        screenPriority(screenStatus(left, devicesByScreen.get(left.id)).kind) -
        screenPriority(screenStatus(right, devicesByScreen.get(right.id)).kind);
      return priorityDifference || left.name.localeCompare(right.name, "nl-NL");
    });
  const view = query.view === "venue" || query.view === "health" || query.view === "cards"
    ? query.view
    : "overview";
  const canManage = session.isLive && session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.screen.manage");
  const canPublish = session.isLive && session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.playlist.publish");
  const canUseReferenceActions = canManage || visualReference;
  const onlineCount = statuses.filter((status) => status.kind === "online" || status.kind === "syncing").length;
  const activeCount = data.screens.filter((screen) => {
    const device = devicesByScreen.get(screen.id);
    const status = screenStatus(screen, device);
    return Boolean(device?.activeReleaseId) &&
      (status.kind === "online" || status.kind === "syncing");
  }).length;
  const currentGroupName = selectedGroup
    ? data.groups.find((group) => group.id === selectedGroup)?.name ?? "Alle schermen"
    : "Alle schermen";

  if (data.error && !visualReference) {
    return (
      <div className={styles.screensPage}>
        <PageHeader
          description="Overzicht van alle schermen en schermgroepen."
          eyebrow="VeyoCast FieldFlow"
          title="Schermen"
        />
        <section className={styles.loadFailure} role="alert">
          <TriangleAlert aria-hidden="true" />
          <div>
            <h2>Schermstatus tijdelijk niet beschikbaar</h2>
            <p><strong>Oorzaak:</strong> {data.error}</p>
            <p><strong>Gevolg:</strong> Scherm-, groeps- en actieve playbackaantallen worden niet als nul gepresenteerd.</p>
            <p><strong>Herstel:</strong> Probeer de beveiligde vloot opnieuw te laden. Blijft dit gebeuren, controleer dan de datasessie.</p>
          </div>
          <Button asChild variant="secondary"><Link href="/dashboard/screens">Opnieuw proberen</Link></Button>
        </section>
      </div>
    );
  }

  return (
    <div
      className={styles.screensPage}
      data-visual-reference={visualReference ? "true" : undefined}
    >
      <PageHeader
        description="Overzicht van alle schermen en schermgroepen."
        eyebrow="VeyoCast FieldFlow"
        title="Schermen"
      />

      {query.fout ? <p className="notice notice--critical" role="alert"><strong>Actie mislukt.</strong> {query.fout}</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      {!session.isLive && !visualReference ? <p className="notice notice--warning" role="status">Deze pagina toont bewust geen fictieve schermen. Configureer Supabase en log in om de vloot te beheren.</p> : null}
      {data.error && !visualReference ? <p className="notice notice--critical" role="alert"><strong>Schermvloot niet beschikbaar.</strong> {data.error}</p> : null}

      <section aria-label="Samenvatting schermvloot" className={styles.metrics}>
        <FleetMetric
          detail={onlineCount === data.screens.length && data.screens.length > 0 ? "alle schermen bereikbaar" : "bereikbare schermen"}
          icon={<Wifi aria-hidden="true" />}
          label="Online"
          tone="green"
          value={data.error ? "—" : onlineCount}
        />
        <FleetMetric
          detail="tonen actuele content"
          icon={<Play aria-hidden="true" />}
          label="Nu actief"
          tone="blue"
          value={data.error ? "—" : activeCount}
        />
        <FleetMetric
          detail="flexibel gecombineerd"
          icon={<UsersRound aria-hidden="true" />}
          label="Schermgroepen"
          tone="petrol"
          value={data.error ? "—" : data.groups.length}
        />
      </section>

      <nav aria-label="Weergave van de schermvloot" className={styles.visualWorkspace}>
        <section className={styles.groupPanel}>
          <header>
            <div>
              <p>Groepen</p>
              <Link href="/dashboard/screens/groups">Schermgroepen</Link>
            </div>
            {canUseReferenceActions ? (
              <Link aria-label="Nieuwe schermgroep" className={styles.groupAdd} href="/dashboard/screens/groups?nieuw=1">
                <Plus aria-hidden="true" />
              </Link>
            ) : null}
          </header>
          <div className={styles.groupList}>
            <Link
              aria-current={!selectedGroup ? "page" : undefined}
              href={screenHref(query, { group: "", view: "overview" })}
            >
              <span className={styles.groupIcon}><Grid3X3 aria-hidden="true" /></span>
              <span><strong>Alle schermen</strong><small>{data.screens.length} schermen</small></span>
              <ChevronRight aria-hidden="true" />
            </Link>
            {data.groups.map((group, index) => (
              <Link
                aria-current={selectedGroup === group.id ? "page" : undefined}
                data-tone={index === 3 ? "orange" : "green"}
                href={screenHref(query, { group: group.id, view: "overview" })}
                key={group.id}
              >
                <span className={styles.groupIcon}><Grid3X3 aria-hidden="true" /></span>
                <span><strong>{group.name}</strong><small>{group.memberIds.length} {group.memberIds.length === 1 ? "scherm" : "schermen"}</small></span>
                <ChevronRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.mapPanel}>
          <header>
            <div>
              <p>Visueel overzicht</p>
              <h2>{currentGroupName}</h2>
            </div>
            <div className={styles.mapToggle}>
              {data.features.venueTwin ? (
                <Link
                  aria-current={view === "venue" ? "page" : undefined}
                  aria-label="Venue Twin"
                  href={screenHref(query, { view: "venue" })}
                >
                  <MapIcon aria-hidden="true" /><span aria-hidden="true">Plattegrond</span>
                </Link>
              ) : null}
              {data.features.healthView ? (
                <Link
                  aria-current={view === "health" ? "page" : undefined}
                  aria-label="Gezondheid"
                  href={screenHref(query, { view: "health" })}
                >
                  <List aria-hidden="true" /><span aria-hidden="true">Statuslijst</span>
                </Link>
              ) : null}
            </div>
          </header>
          <div className={styles.groupMap}>
            <div aria-hidden="true" className={styles.mapOrbit} />
            <span className={styles.venueMarker}><MapPin aria-hidden="true" />{visualReference ? "Ingang" : data.venues[0]?.name ?? "Overzicht"}</span>
            {data.groups.slice(0, visualReference ? 4 : 7).map((group, index) => {
              const position = mapPosition(group.name, index);
              const memberStatuses = group.memberIds
                .map((id) => data.screens.find((screen) => screen.id === id))
                .filter((screen): screen is FleetScreen => Boolean(screen))
                .map((screen) => screenStatus(screen, devicesByScreen.get(screen.id)));
              const healthy = memberStatuses.length > 0 && memberStatuses.every((status) => status.kind === "online" || status.kind === "syncing");
              return (
                <Link
                  className={styles.mapGroup}
                  href={screenHref(query, { group: group.id, view: "overview" })}
                  key={group.id}
                  style={{ "--map-left": `${position.left}%`, "--map-top": `${position.top}%` } as CSSProperties}
                >
                  <span><strong>{group.name}</strong><small>{group.memberIds.length} {group.memberIds.length === 1 ? "scherm" : "schermen"}</small></span>
                  {healthy ? <CircleCheck aria-label="Alle schermen bereikbaar" /> : <TriangleAlert aria-label="Aandacht nodig" />}
                </Link>
              );
            })}
            {!data.groups.length ? (
              <p className={styles.mapEmpty}>Maak een schermgroep om schermen hier logisch te combineren.</p>
            ) : null}
          </div>
        </section>
      </nav>

      {view === "venue" ? <div className={styles.specializedView}><VenueView canManage={canManage} data={data} /></div> : null}
      {view === "health" ? <div className={styles.specializedView}><HealthView data={data} /></div> : null}
      {view === "cards" ? (
        <div className={styles.specializedView}>
          <ScreenBulkForm
            addToGroupAction={addBulkScreensToGroup}
            assignReleaseAction={assignBulkScreenRelease}
            canPublish={canPublish}
            groups={data.groups}
            idempotencyKey={randomUUID()}
            playlists={playlistOptions(data.releases)}
            syncAction={requestBulkScreenSyncRetry}
          >
            <FleetCards
              canManage={canManage}
              data={data}
              devicesByScreen={devicesByScreen}
              releaseById={releaseById}
              screens={filteredScreens}
            />
          </ScreenBulkForm>
        </div>
      ) : null}

      {view === "overview" ? (
        <section className={styles.fleetPanel} aria-labelledby="screen-fleet-title">
          <h2 className="sr-only" id="screen-fleet-title">Schermen</h2>
          <div className={styles.tableToolbar}>
            <form method="get" role="search">
              {selectedGroup ? <input name="group" type="hidden" value={selectedGroup} /> : null}
              {visualReference ? <input name="visual" type="hidden" value="reference" /> : null}
              <label className={styles.searchField}>
                <Search aria-hidden="true" />
                <span className="sr-only">Zoeken in de schermvloot</span>
                <input defaultValue={query.q ?? ""} name="q" placeholder="Zoek een scherm" type="search" />
              </label>
              <details className={styles.filterMenu}>
                <summary><SlidersHorizontal aria-hidden="true" />Filter</summary>
                <div>
                  <label><span>Status</span><select defaultValue={statusFilter} name="status"><option value="all">Alle statussen</option><option value="online">Online</option><option value="stale">Status verouderd</option><option value="offline">Offline</option><option value="unknown">Status onbekend</option><option value="syncing">Synchroniseren</option><option value="unpaired">Niet gekoppeld</option><option value="maintenance">Onderhoud</option><option value="disabled">Uitgeschakeld</option></select></label>
                  <Button size="sm" type="submit" variant="secondary">Toepassen</Button>
                  {normalizedQuery || statusFilter !== "all" ? <Link href={screenHref(query, { q: "", status: "", view: "overview" })}>Wissen</Link> : null}
                </div>
              </details>
            </form>
            {canUseReferenceActions ? (
              <Button asChild><Link href="/dashboard/screens/new"><Plus aria-hidden="true" />Nieuw scherm</Link></Button>
            ) : null}
          </div>

          <ScreenBulkForm
            addToGroupAction={addBulkScreensToGroup}
            assignReleaseAction={assignBulkScreenRelease}
            canPublish={canPublish}
            groups={data.groups}
            idempotencyKey={randomUUID()}
            playlists={playlistOptions(data.releases)}
            syncAction={requestBulkScreenSyncRetry}
          >
            <CompactFleetTable
              canManage={canManage}
              data={data}
              devicesByScreen={devicesByScreen}
              releaseById={releaseById}
              screens={filteredScreens}
              visualReference={visualReference}
            />
          </ScreenBulkForm>
        </section>
      ) : null}
    </div>
  );
}

function FleetMetric({
  detail,
  icon,
  label,
  tone,
  value
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  tone: "blue" | "green" | "petrol";
  value: number | string;
}) {
  return (
    <article className={styles.metric} data-tone={tone}>
      <span className={styles.metricIcon}>{icon}</span>
      <span><small>{label}</small><strong>{value}</strong></span>
      <p>{detail}</p>
    </article>
  );
}

function CompactFleetTable({
  canManage,
  data,
  devicesByScreen,
  releaseById,
  screens,
  visualReference
}: {
  canManage: boolean;
  data: ScreenFleetData;
  devicesByScreen: Map<string, FleetDevice>;
  releaseById: Map<string, FleetRelease>;
  screens: FleetScreen[];
  visualReference: boolean;
}) {
  if (!screens.length) {
    return <p className={styles.emptyFleet} role="status">{data.screens.length
      ? "Geen schermen passen bij deze filters. Pas je zoekopdracht of statusfilter aan."
      : "Er zijn nog geen schermen. Start de begeleide onboarding om het eerste scherm veilig toe te voegen."}</p>;
  }

  return (
    <div className={styles.tableScroller}>
      <table className={styles.fleetTable}>
        <caption className="sr-only">Operationele schermstatus binnen de actieve vereniging.</caption>
        <thead><tr><th scope="col">Scherm</th><th scope="col">Groep</th><th scope="col">Status</th><th scope="col">Content</th><th scope="col"><span className="sr-only">Actie</span></th></tr></thead>
        <tbody>{screens.map((screen, index) => {
          const device = devicesByScreen.get(screen.id);
          const status = screenStatus(screen, device);
          const releaseId = device?.activeReleaseId;
          const release = releaseId ? releaseById.get(releaseId) : undefined;
          const group = data.groups.find((item) =>
            item.memberIds.includes(screen.id) && item.name === screen.location
          ) ?? data.groups.find((item) => item.memberIds.includes(screen.id));
          return (
            <tr data-reference-highlight={visualReference && index === 0} key={screen.id}>
              <td data-label="Scherm">
                <span className={styles.screenIdentity}>
                  <label className={styles.rowSelector}>
                    <input
                      aria-label={`${screen.name} selecteren`}
                      data-screen-select
                      disabled={!canManage || screen.status !== "active"}
                      name="screenIds"
                      type="checkbox"
                      value={screen.id}
                    />
                    <Monitor aria-hidden="true" />
                  </label>
                  <span>
                    <Link href={`/dashboard/screens/${screen.id}`}>{screen.name}</Link>
                    {!visualReference && device?.deviceName ? <small>{device.deviceName}</small> : null}
                  </span>
                </span>
              </td>
              <td data-label="Groep">{group?.name ?? "Niet ingedeeld"}</td>
              <td data-label="Status"><StatusPill label={release && status.kind === "online" ? "Nu actief" : status.label} tone={status.tone} /></td>
              <td data-label="Content">{release?.playlistName ?? "Geen actieve content"}</td>
              <td data-label="Actie"><Link aria-label={`Bekijk scherm ${screen.name}`} className={styles.rowAction} href={`/dashboard/screens/${screen.id}`}><MoreHorizontal aria-hidden="true" /></Link></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function FleetCards({
  canManage,
  data,
  devicesByScreen,
  releaseById,
  screens
}: {
  canManage: boolean;
  data: ScreenFleetData;
  devicesByScreen: Map<string, FleetDevice>;
  releaseById: Map<string, FleetRelease>;
  screens: FleetScreen[];
}) {
  if (!screens.length) return <p className={styles.emptyFleet}>Geen schermen in deze weergave.</p>;
  return (
    <div className={styles.screenGrid}>
      {screens.map((screen) => {
        const device = devicesByScreen.get(screen.id);
        const status = screenStatus(screen, device);
        const releaseId = device?.activeReleaseId;
        const release = releaseId ? releaseById.get(releaseId) : undefined;
        return (
          <article className={styles.screenCard} data-status={status.kind} key={screen.id}>
            <label className={styles.screenSelect}>
              <input aria-label={`${screen.name} selecteren`} data-screen-select disabled={!canManage || screen.status !== "active"} name="screenIds" type="checkbox" value={screen.id} />
            </label>
            <Link className={styles.screenPreview} href={`/dashboard/screens/${screen.id}`}>
              <Monitor aria-hidden="true" />
              <span>{release?.playlistName ?? "Geen actieve content"}</span>
              <StatusPill label={status.label} tone={status.tone} />
            </Link>
            <div className={styles.screenBody}>
              <div className={styles.screenTitle}>
                <div><Link href={`/dashboard/screens/${screen.id}`}>{screen.name}</Link><p><MapPin aria-hidden="true" />{screen.location || "Geen locatie ingesteld"}</p></div>
                {status.kind !== "online" ? <TriangleAlert aria-label="Dit scherm vraagt aandacht" /> : null}
              </div>
              <dl className={styles.screenMeta}>
                <div><dt>Content</dt><dd>{release?.playlistName ?? "Niet toegewezen"}</dd></div>
                <div><dt>Publicatie</dt><dd>{releaseDisplay(release)}</dd></div>
                <div><dt>Synchronisatie</dt><dd>{syncLabel(device, releaseById)}</dd></div>
                <div><dt>Automatisering</dt><dd>{data.automation[screen.id]?.label ?? "Handmatig"}</dd></div>
              </dl>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function playlistOptions(releases: FleetRelease[]) {
  return [...new Map(releases.map((release) => [
    release.playlistId,
    { id: release.playlistId, label: release.playlistName }
  ])).values()].sort((left, right) => left.label.localeCompare(right.label, "nl"));
}

function screenStatus(screen: FleetScreen, device?: FleetDevice) {
  return deriveScreenHealth({
    activeReleaseId: device?.activeReleaseId,
    desiredReleaseId: device?.desiredReleaseId,
    deviceStatus: device?.status,
    lastSeenAt: device?.lastSeenAt,
    screenStatus: screen.status
  });
}

function mapPosition(name: string, index: number) {
  const referencePositions: Record<string, { left: number; top: number }> = {
    Buiten: { left: 85.45, top: 28 },
    Clubhuis: { left: 14.65, top: 29.6 },
    Kantine: { left: 68.56, top: 77 },
    Kleedkamers: { left: 31.72, top: 79 }
  };
  const referencePosition = referencePositions[name];
  return referencePosition ?? mapPositions[index] ?? mapPositions[0];
}

function syncLabel(device: FleetDevice | undefined, releaseById: Map<string, FleetRelease>) {
  if (!device) return "Wacht op pairing";
  if (device.syncRetryRequestedAt) return "Retry aangevraagd";
  if (device.desiredReleaseId && device.desiredReleaseId !== device.activeReleaseId) {
    const activeVersion = device.activeReleaseId ? releaseById.get(device.activeReleaseId)?.version : undefined;
    const desiredVersion = releaseById.get(device.desiredReleaseId)?.version;
    if (desiredVersion !== undefined) return activeVersion === undefined ? `Versie ${desiredVersion} voorbereiden` : `Versie ${activeVersion} → ${desiredVersion}`;
    return "Nieuwe publicatie voorbereiden";
  }
  if (device.activeReleaseId) return "Player is bijgewerkt";
  return "Wacht op eerste release";
}

function releaseDisplay(release: FleetRelease | undefined) {
  if (!release) return "—";
  if (!release.automatic) return `Versie ${release.version}`;
  return `Automatisch bijgewerkt · ${formatTenantDateTime(release.publishedAt, null, { dateStyle: "short", timeStyle: "short" })}`;
}

function screenPriority(kind: string) {
  return { unpaired: 0, offline: 1, unknown: 2, stale: 3, maintenance: 4, syncing: 5, online: 6, disabled: 7 }[kind] ?? 6;
}

function screenHref(
  query: Awaited<ScreensPageProps["searchParams"]>,
  changes: Partial<{ group: string; q: string; status: string; view: string }>
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value && !["fout", "succes", "sync"].includes(key)) next.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  if (next.get("view") === "overview") next.delete("view");
  const suffix = next.toString();
  return suffix ? `/dashboard/screens?${suffix}` : "/dashboard/screens";
}

function isReferenceVisual(value: string | undefined) {
  return process.env.NODE_ENV !== "production" && process.env.FIELDFLOW_VISUAL_QA === "1" && value === "reference";
}

function emptyScreenFleet(): ScreenFleetData {
  return {
    automation: {},
    devices: [],
    error: null,
    features: { healthView: true, venueTwin: true },
    floorplans: [],
    floorplanAssets: [],
    groups: [],
    limit: 0,
    releases: [],
    screens: [],
    settings: { height: 1080, orientation: "landscape", width: 1920 },
    venuePlacements: [],
    venues: [],
    zones: []
  };
}

function createReferenceScreenFleet(): ScreenFleetData {
  const now = "2099-01-01T12:00:00.000Z";
  const releaseA: FleetRelease = { automatic: false, id: "visual-release-a", label: "Wedstrijd vandaag · versie 7", playlistId: "visual-playlist-a", playlistName: "Wedstrijd vandaag", publishedAt: now, version: 7 };
  const releaseB: FleetRelease = { automatic: false, id: "visual-release-b", label: "Clubnieuws · versie 5", playlistId: "visual-playlist-b", playlistName: "Clubnieuws", publishedAt: now, version: 5 };
  const names = [
    "Kantine TV 1", "Kantine TV 2", "Entree", "Sponsorwand", "Kleedkamer 1",
    "Kleedkamer 2", "Kleedkamer 3", "Kleedkamer 4", "Tribune links", "Tribune rechts",
    "Buitenbar", "Terras", "Veld 1", "Veld 2", "Jeugdhonk", "Bestuurskamer",
    "Clubhuis hal", "Clubhuis zaal", "Materiaalruimte", "Ontvangst"
  ];
  const screens: FleetScreen[] = names.map((name, index) => ({
    activeAssignmentSource: "default",
    activeScheduleId: null,
    activeTargetSnapshotId: null,
    assignedPlaylistId: index < 18 ? (index % 2 ? releaseB.playlistId : releaseA.playlistId) : null,
    assignedReleaseId: index < 18 ? (index % 2 ? releaseB.id : releaseA.id) : null,
    createdAt: now,
    defaultPlaylistId: index < 18 ? (index % 2 ? releaseB.playlistId : releaseA.playlistId) : null,
    defaultReleaseId: index < 18 ? (index % 2 ? releaseB.id : releaseA.id) : null,
    id: `visual-screen-${index + 1}`,
    location: index < 3 ? "Kantine" : "Clubhuis",
    name,
    orientation: "landscape",
    resolutionHeight: 1080,
    resolutionWidth: 1920,
    status: "active"
  }));
  const devices: FleetDevice[] = screens.map((screen, index) => ({
    activeReleaseId: index < 18 ? (index % 2 ? releaseB.id : releaseA.id) : null,
    appVersion: "1.6.0",
    capabilities: {},
    desiredReleaseId: index < 18 ? (index % 2 ? releaseB.id : releaseA.id) : null,
    deviceName: null,
    id: `visual-device-${index + 1}`,
    lastErrorAt: null,
    lastErrorCode: null,
    lastSeenAt: now,
    pairedAt: now,
    platform: "webOS",
    revokedAt: null,
    screenId: screen.id,
    status: "paired",
    storageQuotaBytes: 8_000_000_000,
    storageUsedBytes: 1_200_000_000,
    syncRetryRequestedAt: null
  }));
  const group = (id: string, name: string, indexes: number[]) => ({
    id,
    memberIds: indexes.map((index) => `visual-screen-${index}`),
    name,
    revision: 1
  });
  const groups = [
    group("visual-group-clubhuis", "Clubhuis", [1, 2, 3, 17, 18]),
    group("visual-group-kleedkamers", "Kleedkamers", [5, 6, 7, 8]),
    group("visual-group-kantine", "Kantine", [1, 2, 4]),
    group("visual-group-buiten", "Buiten", [11, 12, 13, 14, 15, 16, 19, 20]),
    group("visual-group-entree", "Entree", [3]),
    group("visual-group-tribune", "Tribune", [9, 10]),
    group("visual-group-bestuur", "Bestuur", [16])
  ];
  return {
    automation: Object.fromEntries(screens.map((screen) => [screen.id, { enabled: true, label: "Slimme planning" } satisfies ScreenAutomationSummary])),
    devices,
    error: null,
    features: { healthView: true, venueTwin: true },
    floorplans: [],
    floorplanAssets: [],
    groups,
    limit: 24,
    releases: [releaseA, releaseB],
    screens,
    settings: { height: 1080, orientation: "landscape", width: 1920 },
    venuePlacements: [],
    venues: [{ addressLabel: "Hoofdlocatie", id: "visual-venue", name: "Ingang", status: "active" }],
    zones: []
  };
}
