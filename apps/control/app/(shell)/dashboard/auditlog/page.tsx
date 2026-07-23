import Link from "next/link";

import {
  Button,
  DataTable,
  FilterBar,
  PageHeader,
  ResourceState,
  StatusPill
} from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import {
  loadTenantAuditEvents,
  type TenantAuditFilter
} from "../../../../lib/control-overview";

type AuditLogPageProps = {
  searchParams: Promise<{
    action?: string;
    from?: string;
    page?: string;
    result?: string;
    target?: string;
    to?: string;
  }>;
};

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
  const session = await requireTenantControlSession("tenant.audit.read");
  const params = await searchParams;
  const filter = parseAuditFilter(params);
  const data = session.isLive
    ? await loadTenantAuditEvents(session.tenantId!, filter)
    : {
        error: false,
        events: [],
        page: 1,
        pageCount: 1,
        timezoneName: "Europe/Amsterdam",
        total: 0
      };

  return (
    <>
      <PageHeader
        description="Begrijp wie wat veranderde en welke serverbevestiging daarbij hoort."
        eyebrow={session.tenant}
        status={!session.isLive ? { label: "Demomodus", tone: "warning" } : undefined}
        title="Activiteit"
      />
      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          Configureer Supabase en log in om echte, append-only activiteit te bekijken.
        </p>
      ) : null}

      <form method="get" role="search">
        <FilterBar
          activeCount={auditFilterCount(filter)}
          clearHref="/dashboard/auditlog"
          defaultOpen={auditFilterCount(filter) > 0}
          primary={(
            <input
              aria-label="Zoeken op activiteit"
              className="toolbar-search"
              defaultValue={filter.action}
              name="action"
              placeholder="Bijvoorbeeld playlist gepubliceerd"
              type="search"
            />
          )}
          results={`${data.total} ${data.total === 1 ? "gebeurtenis" : "gebeurtenissen"}`}
        >
          <label className="toolbar-field">
            <span>Object</span>
            <input defaultValue={filter.target} name="target" placeholder="Playlist, scherm of media" type="search" />
          </label>
          <label className="toolbar-field">
            <span>Resultaat</span>
            <select defaultValue={filter.result} name="result">
              <option value="all">Alle resultaten</option>
              <option value="success">Geslaagd</option>
              <option value="failure">Mislukt</option>
            </select>
          </label>
          <label className="toolbar-date"><span>Vanaf</span><input defaultValue={filter.from} name="from" type="date" /></label>
          <label className="toolbar-date"><span>Tot en met</span><input defaultValue={filter.to} name="to" type="date" /></label>
          <Button type="submit" variant="secondary">Filters toepassen</Button>
        </FilterBar>
      </form>

      <section className="workspace-section" aria-labelledby="audit-table-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="audit-table-title">
              Recente gebeurtenissen
            </h2>
            <p className="work-panel__meta">
              Acties kunnen hier niet worden gewijzigd of verwijderd.
            </p>
          </div>
          <StatusPill label={`${data.total} gebeurtenissen`} tone="neutral" />
        </div>
        {data.error ? (
          <ResourceState
            action={<a href="/dashboard/auditlog">Opnieuw proberen</a>}
            kind="error"
            title="Auditlog niet beschikbaar"
          >
            De gebeurtenissen konden niet veilig worden geladen. Probeer de auditlog opnieuw te
            openen.
          </ResourceState>
        ) : data.events.length ? (
          <DataTable caption="Gebeurtenissen binnen de actieve vereniging.">
            <thead>
              <tr>
                <th scope="col">Tijd</th>
                <th scope="col">Actie</th>
                <th scope="col">Doel</th>
                <th scope="col">Actor</th>
                <th scope="col">Resultaat en details</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((event) => (
                <tr key={event.id}>
                  <td data-label="Tijd">
                    <span className="table-primary">{formatDate(event.created_at, data.timezoneName)}</span>
                  </td>
                  <td data-label="Actie">{humanize(event.action)}</td>
                  <td data-label="Doel">
                    <span className="table-primary">
                      {event.target_name ?? targetTypeLabel(event.target_type)}
                    </span>
                    <span className="table-secondary">
                      {targetTypeLabel(event.target_type)}
                      {event.target_id ? ` · ${event.target_id.slice(0, 8)}` : ""}
                    </span>
                  </td>
                  <td data-label="Actor">
                    {event.actor_name}
                  </td>
                  <td data-label="Resultaat en details">
                    <StatusPill
                      label={event.result === "success" ? "Geslaagd" : "Mislukt"}
                      tone={event.result === "success" ? "success" : "critical"}
                    />
                    {auditMetadataEntries(event.metadata).length ? (
                      <details className="audit-details">
                        <summary>Commandodetails</summary>
                        <dl>
                          {auditMetadataEntries(event.metadata).map(([label, value]) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <ResourceState kind="empty" title="Nog geen auditgebeurtenissen">
            Nieuwe serverbevestigde wijzigingen verschijnen hier automatisch.
          </ResourceState>
        )}
        {data.pageCount > 1 ? (
          <nav aria-label="Activiteitspagina's" className="pagination">
            <PaginationLink
              disabled={data.page <= 1}
              href={auditPageHref(params, data.page - 1)}
            >
              Vorige
            </PaginationLink>
            <span>Pagina {data.page} van {data.pageCount}</span>
            <PaginationLink
              disabled={data.page >= data.pageCount}
              href={auditPageHref(params, data.page + 1)}
            >
              Volgende
            </PaginationLink>
          </nav>
        ) : null}
      </section>
    </>
  );
}

function humanize(value: string) {
  const text = value.replaceAll(".", " ").replaceAll("_", " ");
  return text.charAt(0).toLocaleUpperCase("nl-NL") + text.slice(1);
}

function formatDate(value: string, timezoneName: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezoneName
  }).format(new Date(value));
}

function targetTypeLabel(value: string) {
  return ({
    content_schedules: "Planning",
    media_assets: "Media",
    player_devices: "Player",
    playlist_releases: "Release",
    playlists: "Playlist",
    screen_groups: "Schermgroep",
    screens: "Scherm"
  } as Record<string, string>)[value] ?? humanize(value);
}

function auditMetadataEntries(metadata: unknown): [string, string][] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const source = metadata as Record<string, unknown>;
  const nested =
    source.outcome && typeof source.outcome === "object" && !Array.isArray(source.outcome)
      ? source.outcome as Record<string, unknown>
      : {};
  const allowed = [
    ["Versie", source.version ?? nested.version],
    ["Items", source.itemCount ?? nested.itemCount],
    ["Doelen", source.targetCount ?? nested.targetCount],
    ["Revisie", source.actualRevision ?? nested.actualRevision],
    ["Opdracht", source.commandType],
    ["Toewijzing", source.assignmentKind],
    ["Geëvalueerd", source.evaluatedAt],
    ["Uitkomst", nested.outcome]
  ] as const;
  return allowed.flatMap(([label, value]) => {
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      return [];
    }
    const rendered =
      typeof value === "boolean"
        ? value ? "Ja" : "Nee"
        : String(value).slice(0, 160);
    return [[label, rendered] as [string, string]];
  });
}

function parseAuditFilter(
  params: Awaited<AuditLogPageProps["searchParams"]>
): TenantAuditFilter {
  return {
    action: params.action?.trim() ?? "",
    from: params.from,
    page: Math.max(1, Number(params.page) || 1),
    result:
      params.result === "success" || params.result === "failure"
        ? params.result
        : "all",
    target: params.target?.trim() ?? "",
    to: params.to
  };
}

function auditFilterCount(filter: TenantAuditFilter) {
  return [
    Boolean(filter.action),
    Boolean(filter.target),
    filter.result !== "all",
    Boolean(filter.from),
    Boolean(filter.to)
  ].filter(Boolean).length;
}

function auditPageHref(
  params: Awaited<AuditLogPageProps["searchParams"]>,
  page: number
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") next.set(key, value);
  }
  next.set("page", String(page));
  return `/dashboard/auditlog?${next.toString()}`;
}

function PaginationLink({
  children,
  disabled,
  href
}: {
  children: string;
  disabled: boolean;
  href: string;
}) {
  return disabled ? (
    <span aria-disabled="true">{children}</span>
  ) : (
    <Link href={href}>{children}</Link>
  );
}
