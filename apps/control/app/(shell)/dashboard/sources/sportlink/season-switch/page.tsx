import Link from "next/link";
import { hasCapability } from "@veyocast/auth";
import { sportlinkSeasonInventoryRequestSchema } from "@veyocast/contracts";
import { Button } from "@veyocast/ui";
import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { PageHeader } from "../../../../_components/shell-primitives";
import { loadSeasonConnections, loadSeasonInventory } from "./season-switch-data.server";
import { SeasonSwitchFilters } from "./season-switch-filters";
import { SeasonSwitchWorkspace } from "./season-switch-workspace";
import styles from "./season-switch.module.css";

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

export default async function SeasonSwitchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  const query = await searchParams;
  const connections = session.isLive && session.tenantId ? await loadSeasonConnections(session.tenantId) : { items: [], failed: false };
  const connectionId = first(query.connectionId) ?? (connections.items.length === 1 ? connections.items[0]!.id : undefined);
  const requested = sportlinkSeasonInventoryRequestSchema.safeParse({
    connectionId, targetSeasonId: first(query.targetSeasonId) || null,
    filters: { query: first(query.q) ?? "", status: first(query.status) ?? "all", resourceKind: first(query.resourceKind) ?? "all", ...(first(query.resourceId) ? { resourceId: first(query.resourceId) } : {}) },
    cursor: first(query.cursor) ?? null, pageSize: 25
  });
  const available = Boolean(requested.success && connections.items.some(item => item.id === requested.data.connectionId));
  const result = available && requested.success && session.tenantId ? await loadSeasonInventory(session.tenantId, requested.data) : null;
  const inventory = result?.ok ? result.inventory : null;
  const pageHref = (cursor: string | null) => {
    const params = new URLSearchParams();
    for (const key of ["connectionId", "targetSeasonId", "q", "status", "resourceKind", "resourceId"]) {
      const value = first(query[key]); if (value) params.set(key, value);
    }
    if (connectionId) params.set("connectionId", connectionId);
    if (cursor) params.set("cursor", cursor);
    return `/dashboard/sources/sportlink/season-switch?${params.toString()}`;
  };
  return <>
    <PageHeader eyebrow="Bronnen · Sportlink" title="Seizoenswissel" description="Controleer bronkoppelingen en gebruik. Werk alleen gekozen concepten bij; bestaande publicaties behouden hun oorspronkelijke context." actions={<Button asChild variant="ghost"><Link href="/dashboard/sources/sportlink">Terug naar Sportlink</Link></Button>} />
    <SeasonSwitchFilters connections={connections.items} seasons={inventory?.seasons ?? []} values={{ connectionId, targetSeasonId: first(query.targetSeasonId), q: first(query.q), status: first(query.status), resourceKind: first(query.resourceKind), resourceId: first(query.resourceId) }} />
    {connections.failed ? <p className="notice notice--critical" role="alert">De verbindingen konden niet veilig worden gelezen. Er is niets gewijzigd. Controleer je sessie en probeer opnieuw.</p> : connections.items.length === 0 ? <p className="notice notice--warning" role="status">Er is nog geen toegankelijke Sportlink-verbinding. <Link href="/dashboard/sources/sportlink">Controleer de broninstellingen.</Link></p> : null}
    {connectionId && !available ? <p className="notice notice--critical" role="alert">Deze selectie is niet volledig of niet toegankelijk. Kies een eigen verbinding en een geldige filterselectie; er is niets gewijzigd.</p> : null}
    {result && !result.ok ? <p className="notice notice--critical" role="alert">{result.error}</p> : null}
    {inventory && session.tenantId ? <SeasonSwitchWorkspace key={`${session.tenantId}:${session.userId}:${JSON.stringify(requested.success ? requested.data : null)}`} inventory={inventory} actorScope={`${session.tenantId}:${session.userId}`} canWriteDesigns={session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.dynamic_slide.write")} canWriteRunbooks={session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.playlist.write")} /> : null}
    {inventory ? <nav aria-label="Inventarispagina’s" className={styles.pager}>{requested.success && requested.data.cursor ? <Link href={pageHref(null)}>Naar eerste pagina</Link> : <span>Eerste pagina</span>}{inventory.nextCursor ? <Link href={pageHref(inventory.nextCursor)}>Volgende pagina</Link> : <span>Geen volgende pagina</span>}</nav> : null}
  </>;
}
