import { WandSparkles } from "lucide-react";
import Link from "next/link";

import { hasCapability } from "@veyocast/auth";
import {
  Button,
  FilterBar,
  PageHeader,
  ResourceState,
  SummaryStrip,
  TablePreferences
} from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { formatTenantDateTime } from "../../../../lib/tenant-time";
import { SlideLibraryWorkspace } from "./slide-library-workspace";
import {
  parseSlideResourceFilter,
  slideFilterCount,
  slidePageHref
} from "./slide-resource";
import {
  loadSlideResources,
  type SlideResourceData
} from "./slide-resource-data";
import styles from "./slide-resource.module.css";

type PageProps = {
  searchParams: Promise<{
    fout?: string;
    page?: string;
    q?: string;
    sort?: string;
    status?: string;
    succes?: string;
  }>;
};

const slideColumns = [
  { defaultVisible: true, id: "name", label: "Naam slide", required: true },
  { defaultVisible: true, id: "status", label: "Status" },
  { defaultVisible: true, id: "created", label: "Aangemaakt op" },
  { defaultVisible: true, id: "updated", label: "Bijgewerkt op" },
  { defaultVisible: true, id: "actions", label: "Acties", required: true }
] as const;

// De serverloader resolveert current_published_version_id per rij, zodat een
// concept nooit stilzwijgend de zichtbare gepubliceerde slide overschrijft.

export default async function SlidesPage({ searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.read");
  const params = await searchParams;
  const filter = parseSlideResourceFilter(params);
  const data = session.isLive && session.tenantId
    ? await loadSlideResources(session.tenantId, filter)
    : emptyData();
  const tenantIsMutable = session.isLive && session.tenantStatus === "active";
  const canWrite = tenantIsMutable && hasCapability(
    session.capabilities,
    "tenant.dynamic_slide.write"
  );
  const canAddToPlaylist = tenantIsMutable && hasCapability(
    session.capabilities,
    "tenant.playlist.write"
  );

  return (
    <>
      <PageHeader
        actions={canWrite ? (
          <Button asChild>
            <Link href="/dashboard/studio/new">
              <WandSparkles aria-hidden="true" />
              Nieuwe slide
            </Link>
          </Button>
        ) : null}
        description="Zoek, controleer en beheer datagedreven slides. Gepubliceerde releases blijven immutable."
        eyebrow={session.tenant}
        status={!session.isLive ? { label: "Demomodus", tone: "warning" } : undefined}
        title="Slides"
      />

      {params.fout ? (
        <p className="notice notice--critical" role="alert">
          <strong>Slideactie mislukt.</strong> {params.fout}
        </p>
      ) : null}
      {params.succes ? (
        <p className="notice notice--success" role="status">{params.succes}</p>
      ) : null}
      {data.error && data.rows.length ? (
        <p className="notice notice--warning" role="status">
          <strong>Niet alle slidedetails zijn geladen.</strong> {data.error}
        </p>
      ) : null}
      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          Slides beheren is niet beschikbaar in de demomodus. Start Supabase en log opnieuw in om tenantinhoud te laden.
        </p>
      ) : null}

      <SummaryStrip
        aria-label="Slide-overzicht"
        items={[
          { label: "Slides", value: data.counts.total },
          { label: "Actief", tone: "success", value: data.counts.active },
          { label: "Concept", tone: "warning", value: data.counts.concept },
          { label: "Inactief", value: data.counts.inactive }
        ]}
      />

      <form method="get" role="search">
        <FilterBar
          activeCount={slideFilterCount(filter)}
          actions={(
            <TablePreferences
              columns={slideColumns}
              defaultDensity="comfortable"
              tableKey="tenant-slides"
              title="Weergave-instellingen"
              triggerLabel="Weergave-instellingen"
            />
          )}
          clearHref="/dashboard/slides"
          defaultOpen={false}
          primary={(
            <input
              aria-label="Zoeken in slides"
              className="toolbar-search"
              defaultValue={filter.query}
              maxLength={120}
              name="q"
              placeholder="Zoeken op slidenaam"
              type="search"
            />
          )}
          results={`${data.total} ${data.total === 1 ? "slide" : "slides"}`}
        >
          <label className="toolbar-field">
            <span>Status</span>
            <select defaultValue={filter.status} name="status">
              <option value="all">Alle statussen</option>
              <option value="concept">Concept</option>
              <option value="active">Actief</option>
              <option value="inactive">Inactief</option>
            </select>
          </label>
          <label className="toolbar-field">
            <span>Sorteren</span>
            <select defaultValue={filter.sort} name="sort">
              <option value="updated-desc">Laatst bijgewerkt</option>
              <option value="name">Naam</option>
              <option value="created-asc">Oudste eerst</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">Filters toepassen</Button>
        </FilterBar>
      </form>

      <section aria-labelledby="slides-list-title" className={styles.resourceSection}>
        <h2 className="sr-only" id="slides-list-title">Dynamische slides</h2>
        {data.error && !data.rows.length ? (
          <ResourceState
            action={<Button asChild variant="secondary"><Link href="/dashboard/slides">Opnieuw laden</Link></Button>}
            kind="error"
            title="Slides niet geladen"
          >
            {data.error}
          </ResourceState>
        ) : (
          <SlideLibraryWorkspace
            canAddToPlaylist={canAddToPlaylist}
            canWrite={canWrite}
            playlists={data.playlists}
            rows={data.rows.map((row) => ({
              ...row,
              createdLabel: formatDateTime(row.createdAt),
              updatedLabel: formatDateTime(row.updatedAt)
            }))}
          />
        )}

        {data.pageCount > 1 ? (
          <nav aria-label="Slidepagina’s" className="pagination">
            <Button asChild size="sm" variant="secondary">
              {data.page <= 1
                ? <button disabled type="button">Vorige</button>
                : <Link href={slidePageHref(params, data.page - 1)}>Vorige</Link>}
            </Button>
            <span>Pagina {data.page} van {data.pageCount}</span>
            <Button asChild size="sm" variant="secondary">
              {data.page >= data.pageCount
                ? <button disabled type="button">Volgende</button>
                : <Link href={slidePageHref(params, data.page + 1)}>Volgende</Link>}
            </Button>
          </nav>
        ) : null}
      </section>
    </>
  );
}

function formatDateTime(value: string) {
  return formatTenantDateTime(value, null, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function emptyData(): SlideResourceData {
  return {
    counts: { active: 0, concept: 0, inactive: 0, total: 0 },
    error: null,
    page: 1,
    pageCount: 1,
    playlists: [],
    rows: [],
    total: 0
  };
}
