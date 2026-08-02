import { randomUUID } from "node:crypto";

import Link from "next/link";
import {
  Grid3X3,
  List,
  MapPin,
  Monitor,
  TriangleAlert
} from "lucide-react";

import {
  Button,
  DataTable,
  FilterBar,
  IconButton,
  SummaryStrip,
  TablePreferences
} from "@veyocast/ui";
import { hasCapability } from "@veyocast/auth";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { formatTenantDateTime } from "../../../../lib/tenant-time";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import {
  loadScreenFleet,
  type FleetDevice,
  type FleetScreen,
  type ScreenAutomationSummary
} from "./data";
import {
  addBulkScreensToGroup,
  assignBulkScreenRelease,
  requestBulkScreenSyncRetry
} from "./actions";
import { ScreenBulkForm } from "./screen-bulk-form";
import styles from "./screens-overview.module.css";

type ScreensPageProps = {
  searchParams: Promise<{ fout?: string; q?: string; status?: string; succes?: string; sync?: string; view?: string }>;
};

const screenColumns = [
  { id: "screen", label: "Scherm", defaultVisible: true, required: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "player", label: "Player", defaultVisible: true },
  { id: "content", label: "Content", defaultVisible: true },
  { id: "sync", label: "Synchronisatie", defaultVisible: true },
  { id: "automation", label: "Automatisering", defaultVisible: true },
  { id: "seen", label: "Laatst gezien", defaultVisible: true },
  { id: "action", label: "Actie", defaultVisible: true, required: true }
] as const;

export default async function ScreensPage({ searchParams }: ScreensPageProps) {
  const session = await requireTenantControlSession("tenant.screen.read");
  const query = await searchParams;
  const data = session.isLive && session.tenantId
    ? await loadScreenFleet(session.tenantId)
    : {
        automation: {} as Record<string, ScreenAutomationSummary>,
        devices: [],
        error: null,
        groups: [],
        limit: 0,
        releases: [],
        screens: []
      };
  const devicesByScreen = new Map(
    data.devices.filter((device) => device.status === "paired").map((device) => [device.screenId, device])
  );
  const releaseById = new Map(data.releases.map((release) => [release.id, release]));
  const statuses = data.screens.map((screen) => screenStatus(screen, devicesByScreen.get(screen.id)));
  const normalizedQuery = query.q?.trim().toLocaleLowerCase("nl-NL") ?? "";
  const requestedStatus = query.sync === "pending" ? "syncing" : query.status;
  const statusFilter = new Set(["online", "offline", "syncing", "unpaired", "maintenance", "disabled"]).has(requestedStatus ?? "")
    ? requestedStatus!
    : "all";
  const filteredScreens = data.screens
    .filter((screen) => {
      const device = devicesByScreen.get(screen.id);
      const status = screenStatus(screen, device);
      return (statusFilter === "all" || status.kind === statusFilter) &&
        (!normalizedQuery || [screen.name, screen.location, device?.deviceName].some((value) => value?.toLocaleLowerCase("nl-NL").includes(normalizedQuery)));
    })
    .sort((left, right) => {
      const priorityDifference =
        screenPriority(screenStatus(left, devicesByScreen.get(left.id)).kind) -
        screenPriority(screenStatus(right, devicesByScreen.get(right.id)).kind);
      return priorityDifference || left.name.localeCompare(right.name, "nl-NL");
    });
  const syncing = statuses.filter((status) => status.kind === "syncing").length;
  const attention = statuses.filter((status) => ["maintenance", "offline", "unpaired"].includes(status.kind)).length;
  const view = query.view === "cards" ? "cards" : "list";
  const canManage =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.screen.manage");
  const canPublish =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.playlist.publish");
  const capacityNeedsAttention =
    data.limit > 0 && data.screens.length >= data.limit;

  return <>
    <PageHeader
      actions={canManage ? <Button asChild><Link href="/dashboard/screens/new">Scherm toevoegen</Link></Button> : null}
      description="Beheer de status, content en synchronisatie van ieder scherm."
      eyebrow={session.tenant}
      status={!session.isLive ? { label: "Demomodus", tone: "warning" } : undefined}
      title="Schermen"
    />
    {query.fout ? <p className="notice notice--critical" role="alert"><strong>Actie mislukt.</strong> {query.fout}</p> : null}
    {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
    {!session.isLive ? <p className="notice notice--warning" role="status">Deze pagina toont bewust geen fictieve schermen. Configureer Supabase en log in om de vloot te beheren.</p> : null}
    {data.error ? <p className="notice notice--critical" role="alert"><strong>Schermvloot niet beschikbaar.</strong> {data.error}</p> : null}

    {attention || syncing || capacityNeedsAttention ? (
      <SummaryStrip
        aria-label="Aandachtspunten schermvloot"
        items={[
          ...(attention
            ? [{
                detail: "Offline, niet gekoppeld of in onderhoud",
                label: "Actie nodig",
                tone: "warning" as const,
                value: attention
              }]
            : []),
          ...(syncing
            ? [{
                detail: "Nieuwe content wordt voorbereid",
                label: "Synchroniseren",
                tone: "info" as const,
                value: syncing
              }]
            : []),
          ...(capacityNeedsAttention
            ? [{
                detail: "Toegestane capaciteit bereikt",
                label: "In gebruik",
                tone: "warning" as const,
                value: `${data.screens.length}/${data.limit}`
              }]
            : [])
        ]}
      />
    ) : null}

    <form method="get" role="search">
      <FilterBar
        className="screens-filter-bar"
        activeCount={Number(Boolean(normalizedQuery)) + Number(statusFilter !== "all")}
        actions={(
          <>
            <IconButton asChild aria-label="Schermen als compacte lijst tonen" title="Lijst">
              <Link
                aria-current={view === "list" ? "page" : undefined}
                href={screenViewHref(query, "list")}
              >
                <List aria-hidden="true" />
              </Link>
            </IconButton>
            <IconButton asChild aria-label="Schermen als kaarten tonen" title="Kaarten">
              <Link
                aria-current={view === "cards" ? "page" : undefined}
                href={screenViewHref(query, "cards")}
              >
                <Grid3X3 aria-hidden="true" />
              </Link>
            </IconButton>
            <div className="screens-filter-desktop-options">
              <TablePreferences
                columns={screenColumns}
                tableKey="tenant-screen-fleet"
                title="Vlootweergave"
                triggerLabel="Weergave-instellingen"
              />
            </div>
          </>
        )}
        clearHref="/dashboard/screens"
        defaultOpen={Boolean(normalizedQuery) || statusFilter !== "all"}
        primary={<input aria-label="Zoeken in de schermvloot" className="toolbar-search" defaultValue={query.q ?? ""} name="q" placeholder="Scherm, locatie of Player" type="search" />}
        results={filteredScreens.length === data.screens.length
          ? `${data.screens.length} ${data.screens.length === 1 ? "scherm" : "schermen"}`
          : `${filteredScreens.length} van ${data.screens.length}`}
      >
        <label className="toolbar-field"><span>Status</span><select className="toolbar-select" defaultValue={statusFilter} name="status"><option value="all">Alle statussen</option><option value="online">Online</option><option value="offline">Offline</option><option value="syncing">Synchroniseren</option><option value="unpaired">Niet gekoppeld</option><option value="maintenance">Onderhoud</option><option value="disabled">Uitgeschakeld</option></select></label>
        <Button type="submit" variant="secondary">Vloot filteren</Button>
        <div className="screens-filter-mobile-options">
          <TablePreferences
            columns={screenColumns}
            tableKey="tenant-screen-fleet"
            title="Vlootweergave"
            triggerLabel="Weergave-instellingen"
          />
        </div>
      </FilterBar>
    </form>

    <ScreenBulkForm
      addToGroupAction={addBulkScreensToGroup}
      assignReleaseAction={assignBulkScreenRelease}
      canPublish={canPublish}
      groups={data.groups}
      idempotencyKey={randomUUID()}
      releases={data.releases}
      syncAction={requestBulkScreenSyncRetry}
    >
    <section aria-labelledby="screen-fleet-title">
      <h2 className="sr-only" id="screen-fleet-title">Schermvloot</h2>
      {filteredScreens.length && view === "cards" ? (
        <div className={styles.screenGrid}>
          {filteredScreens.map((screen) => {
            const device = devicesByScreen.get(screen.id);
            const status = screenStatus(screen, device);
            const releaseId = device?.activeReleaseId ?? screen.assignedReleaseId;
            const release = releaseId ? releaseById.get(releaseId) : undefined;
            const hasWarning = ["maintenance", "offline", "unpaired"].includes(status.kind);
            return (
              <article className={styles.screenCard} data-status={status.kind} key={screen.id}>
                <label className={styles.screenSelect}>
                  <input
                    aria-label={`${screen.name} selecteren`}
                    data-screen-select
                    disabled={!canManage || screen.status !== "active"}
                    name="screenIds"
                    type="checkbox"
                    value={screen.id}
                  />
                </label>
                <Link className={styles.screenPreview} href={`/dashboard/screens/${screen.id}`}>
                  <Monitor aria-hidden="true" />
                  <span>{release?.playlistName ?? "Geen actieve content"}</span>
                  <StatusPill label={status.label} tone={status.tone} />
                </Link>
                <div className={styles.screenBody}>
                  <div className={styles.screenTitle}>
                    <div>
                      <Link href={`/dashboard/screens/${screen.id}`}>{screen.name}</Link>
                      <p><MapPin aria-hidden="true" />{screen.location || "Geen locatie ingesteld"}</p>
                    </div>
                    {hasWarning ? <TriangleAlert aria-label="Dit scherm vraagt aandacht" /> : null}
                  </div>
                  <dl className={styles.screenMeta}>
                    <div><dt>Content</dt><dd>{release?.playlistName ?? "Niet toegewezen"}</dd></div>
                    <div><dt>Versie</dt><dd>{release ? `Versie ${release.version}` : "—"}</dd></div>
                    <div><dt>Bron</dt><dd>{assignmentSourceLabel(screen, Boolean(release))}</dd></div>
                    <div><dt>Synchronisatie</dt><dd>{syncLabel(device)}</dd></div>
                    <div>
                      <dt>Automatisering</dt>
                      <dd>
                        <Link href={`/dashboard/screens/${screen.id}?tab=automation`}>
                          {data.automation[screen.id]?.label ?? "Handmatig"}
                        </Link>
                      </dd>
                    </div>
                    <div><dt>Scherm</dt><dd>{screen.resolutionWidth && screen.resolutionHeight ? `${screen.resolutionWidth} × ${screen.resolutionHeight}` : "Resolutie onbekend"} · {orientationLabel(screen.orientation)}</dd></div>
                    <div><dt>Laatste contact</dt><dd>{formatLastSeen(device?.lastSeenAt)}</dd></div>
                  </dl>
                </div>
              </article>
            );
          })}
        </div>
      ) : filteredScreens.length ? <DataTable caption="Operationele schermstatus binnen de actieve vereniging." tableKey="tenant-screen-fleet"><thead><tr><th scope="col"><span className="sr-only">Selecteren</span></th><th data-column="screen" scope="col">Scherm</th><th data-column="status" scope="col">Status</th><th data-column="player" scope="col">Player</th><th data-column="content" scope="col">Content</th><th data-column="sync" scope="col">Synchronisatie</th><th data-column="automation" scope="col">Automatisering</th><th data-column="seen" scope="col">Laatst gezien</th><th data-column="action" scope="col">Actie</th></tr></thead><tbody>{filteredScreens.map((screen) => {
        const device = devicesByScreen.get(screen.id);
        const status = screenStatus(screen, device);
        return <tr key={screen.id}>
          <td data-label="Selecteren"><input aria-label={`${screen.name} selecteren`} data-screen-select disabled={!canManage || screen.status !== "active"} name="screenIds" type="checkbox" value={screen.id} /></td>
          <td data-column="screen" data-label="Scherm"><span className="table-primary">{screen.name}</span><span className="table-secondary">{screen.location || orientationLabel(screen.orientation)}</span></td>
          <td data-column="status" data-label="Status"><StatusPill label={status.label} tone={status.tone} /></td>
          <td data-column="player" data-label="Player">{device?.deviceName || "Niet gekoppeld"}<span className="table-secondary">{device?.appVersion ? `App ${device.appVersion}` : device?.platform || "Geen telemetry"}</span></td>
          <td data-column="content" data-label="Content">{screen.assignedReleaseId ? releaseById.get(screen.assignedReleaseId)?.label || `Release ${screen.assignedReleaseId.slice(0, 8)}` : "Geen release"}</td>
          <td data-column="sync" data-label="Synchronisatie">{syncLabel(device)}</td>
          <td data-column="automation" data-label="Automatisering"><Link className="table-action" href={`/dashboard/screens/${screen.id}?tab=automation`}>{data.automation[screen.id]?.label ?? "Handmatig"}</Link></td>
          <td data-column="seen" data-label="Laatst gezien">{formatLastSeen(device?.lastSeenAt)}</td>
          <td data-column="action" data-label="Actie"><Link className="table-action" href={`/dashboard/screens/${screen.id}`}>Bekijk scherm</Link></td>
        </tr>;
      })}</tbody></DataTable> : <p className="notice" role="status">{data.screens.length ? "Geen schermen passen bij deze filters. Pas je zoekopdracht of statusfilter aan." : "Er zijn nog geen schermen. Start de begeleide onboarding om het eerste scherm transactioneel aan te maken."}</p>}
    </section>
    </ScreenBulkForm>
  </>;
}

function screenStatus(screen: FleetScreen, device?: FleetDevice) {
  if (screen.status === "disabled") return { kind: "disabled", label: "Uitgeschakeld", tone: "critical" as const };
  if (screen.status === "maintenance") return { kind: "maintenance", label: "Onderhoud", tone: "warning" as const };
  if (!device) return { kind: "unpaired", label: "Niet gekoppeld", tone: "warning" as const };
  if (device.desiredReleaseId && device.desiredReleaseId !== device.activeReleaseId) return { kind: "syncing", label: "Synchroniseren", tone: "info" as const };
  if (device.lastSeenAt && Date.now() - new Date(device.lastSeenAt).getTime() < 5 * 60_000) return { kind: "online", label: "Online", tone: "success" as const };
  return { kind: "offline", label: "Offline", tone: "warning" as const };
}

function syncLabel(device: FleetDevice | undefined) {
  if (!device) return "Wacht op pairing";
  if (device.syncRetryRequestedAt) return "Retry aangevraagd";
  if (device.desiredReleaseId && device.desiredReleaseId !== device.activeReleaseId) return "Nieuwe release voorbereiden";
  if (device.activeReleaseId) return "Actieve release gelijk";
  return "Wacht op eerste release";
}

function screenPriority(kind: string) {
  return {
    unpaired: 0,
    offline: 1,
    maintenance: 2,
    syncing: 3,
    online: 4,
    disabled: 5
  }[kind] ?? 6;
}

function formatLastSeen(value: string | null | undefined) {
  if (!value) return "Nog nooit";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (elapsed < 60_000) return "Nu";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min geleden`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} uur geleden`;
  return formatTenantDateTime(value, null, {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function orientationLabel(value: string) { return value === "portrait" ? "Staand scherm" : "Liggend scherm"; }

function screenViewHref(
  query: Awaited<ScreensPageProps["searchParams"]>,
  view: "cards" | "list"
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value && !["view", "fout", "succes"].includes(key)) next.set(key, value);
  }
  if (view === "cards") next.set("view", view);
  const suffix = next.toString();
  return suffix ? `/dashboard/screens?${suffix}` : "/dashboard/screens";
}

function assignmentSourceLabel(screen: FleetScreen, hasRelease: boolean) {
  if (!hasRelease) return "Geen toewijzing";
  if (screen.activeAssignmentSource === "override") return "Tijdelijke override";
  if (screen.activeAssignmentSource === "schedule") return "Planning";
  return "Standaardplaylist";
}
