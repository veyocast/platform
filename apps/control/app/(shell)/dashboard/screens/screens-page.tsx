import Link from "next/link";

import {
  Button,
  FilterBar,
  SummaryStrip,
  TablePreferences
} from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import { loadScreenFleet, type FleetDevice, type FleetScreen } from "./data";

type ScreensPageProps = {
  searchParams: Promise<{ fout?: string; q?: string; status?: string; succes?: string }>;
};

export default async function ScreensPage({ searchParams }: ScreensPageProps) {
  const session = await requireTenantControlSession("tenant.screen.read");
  const query = await searchParams;
  const data = session.isLive && session.tenantId
    ? await loadScreenFleet(session.tenantId)
    : { devices: [], error: null, limit: 0, releases: [], screens: [] };
  const devicesByScreen = new Map(
    data.devices.filter((device) => device.status === "paired").map((device) => [device.screenId, device])
  );
  const releaseLabels = new Map(data.releases.map((release) => [release.id, release.label]));
  const statuses = data.screens.map((screen) => screenStatus(screen, devicesByScreen.get(screen.id)));
  const normalizedQuery = query.q?.trim().toLocaleLowerCase("nl-NL") ?? "";
  const statusFilter = new Set(["online", "offline", "syncing", "unpaired", "maintenance", "disabled"]).has(query.status ?? "")
    ? query.status!
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
  const online = statuses.filter((status) => status.kind === "online").length;
  const syncing = statuses.filter((status) => status.kind === "syncing").length;
  const attention = statuses.filter((status) => ["maintenance", "offline", "unpaired"].includes(status.kind)).length;

  return <>
    <PageHeader
      actions={<Button asChild><Link href="/dashboard/screens/new">Scherm toevoegen</Link></Button>}
      description="Beheer lifecycle, content, Players, synchronisatie en gebeurtenissen vanuit één echte schermvloot."
      eyebrow={session.tenant}
      status={!session.isLive ? { label: "Demomodus", tone: "warning" } : undefined}
      title="Schermen"
    />
    {query.fout ? <p className="notice notice--critical" role="alert"><strong>Actie mislukt.</strong> {query.fout}</p> : null}
    {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
    {!session.isLive ? <p className="notice notice--warning" role="status">Deze pagina toont bewust geen fictieve schermen. Configureer Supabase en log in om de vloot te beheren.</p> : null}
    {data.error ? <p className="notice notice--critical" role="alert"><strong>Schermvloot niet beschikbaar.</strong> {data.error}</p> : null}

    <SummaryStrip
      aria-label="Compact schermoverzicht"
      items={[
        {
          detail: attention ? "Offline, niet gekoppeld of in onderhoud" : "De actieve vloot vraagt nu geen herstelactie",
          label: "Actie nodig",
          tone: attention ? "warning" : "success",
          value: attention
        },
        { label: "Online", tone: "success", value: online },
        { label: "Synchroniseren", tone: "info", value: syncing },
        {
          detail: "Toegestane capaciteit",
          label: "In gebruik",
          tone: data.screens.length >= data.limit && data.limit > 0 ? "warning" : "neutral",
          value: `${data.screens.length}/${data.limit || "—"}`
        }
      ]}
    />

    <form method="get" role="search">
      <FilterBar
        activeCount={Number(Boolean(normalizedQuery)) + Number(statusFilter !== "all")}
        actions={(
          <TablePreferences
            columns={[
              { id: "screen", label: "Scherm", required: true },
              { id: "status", label: "Status", required: true },
              { id: "player", label: "Player" },
              { id: "content", label: "Content" },
              { id: "sync", label: "Synchronisatie" },
              { defaultVisible: false, id: "seen", label: "Laatst gezien" },
              { id: "action", label: "Actie", required: true }
            ]}
            tableKey="tenant-screen-fleet"
          />
        )}
        clearHref="/dashboard/screens"
        defaultOpen={Boolean(normalizedQuery) || statusFilter !== "all"}
        primary={<input aria-label="Zoeken in de schermvloot" className="toolbar-search" defaultValue={query.q ?? ""} name="q" placeholder="Scherm, locatie of Player" type="search" />}
        results={`${filteredScreens.length} van ${data.screens.length} schermen`}
      >
        <label className="toolbar-field"><span>Status</span><select className="toolbar-select" defaultValue={statusFilter} name="status"><option value="all">Alle statussen</option><option value="online">Online</option><option value="offline">Offline</option><option value="syncing">Synchroniseren</option><option value="unpaired">Niet gekoppeld</option><option value="maintenance">Onderhoud</option><option value="disabled">Uitgeschakeld</option></select></label>
        <Button type="submit" variant="secondary">Vloot filteren</Button>
      </FilterBar>
    </form>

    <section className="workspace-section" aria-labelledby="screen-fleet-title">
      <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="screen-fleet-title">Schermvloot</h2><p className="work-panel__meta">De vloot staat standaard op herstelprioriteit; uitgeschakelde schermen staan onderaan.</p></div><div className="workspace-section__actions"><Button asChild size="sm" variant="secondary"><Link href="/dashboard/releases">Release Center</Link></Button><StatusPill label={`${data.screens.length} totaal`} tone="neutral" /></div></div>
      {filteredScreens.length ? <div className="data-table-frame"><table className="data-table data-table--responsive" data-vc-table-key="tenant-screen-fleet"><caption>Operationele schermstatus binnen de actieve vereniging.</caption><thead><tr><th data-column="screen" scope="col">Scherm</th><th data-column="status" scope="col">Status</th><th data-column="player" scope="col">Player</th><th data-column="content" scope="col">Content</th><th data-column="sync" scope="col">Synchronisatie</th><th data-column="seen" scope="col">Laatst gezien</th><th data-column="action" scope="col">Actie</th></tr></thead><tbody>{filteredScreens.map((screen) => {
        const device = devicesByScreen.get(screen.id);
        const status = screenStatus(screen, device);
        return <tr key={screen.id}>
          <td data-column="screen" data-label="Scherm"><span className="table-primary">{screen.name}</span><span className="table-secondary">{screen.location || orientationLabel(screen.orientation)}</span></td>
          <td data-column="status" data-label="Status"><StatusPill label={status.label} tone={status.tone} /></td>
          <td data-column="player" data-label="Player">{device?.deviceName || "Niet gekoppeld"}<span className="table-secondary">{device?.appVersion ? `App ${device.appVersion}` : device?.platform || "Geen telemetry"}</span></td>
          <td data-column="content" data-label="Content">{screen.assignedReleaseId ? releaseLabels.get(screen.assignedReleaseId) || `Release ${screen.assignedReleaseId.slice(0, 8)}` : "Geen release"}</td>
          <td data-column="sync" data-label="Synchronisatie">{syncLabel(device)}</td>
          <td data-column="seen" data-label="Laatst gezien">{formatLastSeen(device?.lastSeenAt)}</td>
          <td data-column="action" data-label="Actie"><Link className="table-action" href={`/dashboard/screens/${screen.id}`}>Bekijk scherm</Link></td>
        </tr>;
      })}</tbody></table></div> : <p className="notice" role="status">{data.screens.length ? "Geen schermen passen bij deze filters. Pas je zoekopdracht of statusfilter aan." : "Er zijn nog geen schermen. Start de begeleide onboarding om het eerste scherm transactioneel aan te maken."}</p>}
    </section>
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
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function orientationLabel(value: string) { return value === "portrait" ? "Staand scherm" : "Liggend scherm"; }
