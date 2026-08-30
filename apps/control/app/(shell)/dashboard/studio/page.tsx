import Link from "next/link";
import {
  Archive,
  Clock3,
  Film,
  Grid3X3,
  Image as ImageIcon,
  List,
  Plus,
  RadioTower,
  Sparkles
} from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import {
  Button,
  FilterBar,
  PageHeader,
  Progress,
  StatusPill,
  SummaryStrip
} from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import {
  loadStudioBrandResources,
  loadStudioOverview,
  type StudioOverviewFilter
} from "./data";
import { BrandKitDialog } from "./brand-kit-dialog";
import { ProjectActions } from "./project-actions";
import styles from "./studio.module.css";

type StudioPageProps = {
  searchParams: Promise<{
    format?: string;
    fout?: string;
    kind?: string;
    owner?: string;
    q?: string;
    sort?: string;
    status?: string;
    succes?: string;
    updated?: string;
    view?: string;
    viewMode?: string;
  }>;
};

export default async function StudioPage({ searchParams }: StudioPageProps) {
  const session = await requireTenantControlSession("tenant.studio.read");
  const params = await searchParams;
  const filter = parseFilter(params);
  const [data, brandResources] = await Promise.all([
    loadStudioOverview(
      session.tenantId,
      session.isLive,
      session.userId,
      filter
    ),
    loadStudioBrandResources(session.tenantId, session.isLive)
  ]);
  const canCreate =
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.studio.create");
  const canArchive = hasCapability(
    session.capabilities,
    "tenant.studio.archive"
  );
  const canEditAll = hasCapability(
    session.capabilities,
    "tenant.studio.edit_all"
  );
  const canEditOwn = hasCapability(
    session.capabilities,
    "tenant.studio.edit_own"
  );
  const canManageBrand =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.settings.manage");
  const activeJobs = data.renderJobs.filter((job) =>
    ["queued", "preparing", "rendering", "encoding", "uploading", "creating_media"].includes(
      job.status
    )
  );
  const failedJobs = data.renderJobs.filter(
    (job) => job.status === "failed"
  );
  const view = filter.view ?? "grid";

  return (
    <>
      <PageHeader
        actions={
          <>
            {hasCapability(session.capabilities, "tenant.dynamic_slide.read") ? (
              <Button asChild variant="secondary">
                <Link href="/dashboard/studio/led-scores">
                  <RadioTower aria-hidden="true" />
                  LED Scores Goal Alerts
                </Link>
              </Button>
            ) : null}
            {hasCapability(session.capabilities, "tenant.dynamic_slide.read") ? (
              <Button asChild variant="secondary">
                <Link href="/dashboard/slides">Datagedreven slides</Link>
              </Button>
            ) : null}
            {canManageBrand ? (
              <BrandKitDialog
                assets={brandResources.assets}
                brandKit={brandResources.brandKit}
                tenantName={session.tenant}
              />
            ) : null}
            {canCreate ? (
              <Button asChild>
                <Link href="/dashboard/studio/new">
                  <Plus aria-hidden="true" />
                  Nieuwe slide
                </Link>
              </Button>
            ) : null}
          </>
        }
        description="Maak clubcontent van template tot veilig renderbaar media-item, zonder de publicatiestroom te verlaten."
        eyebrow={session.tenant}
        status={
          !session.isLive
            ? { label: "Demomodus", tone: "warning" }
            : undefined
        }
        title="Studio"
      />

      {params.fout ? (
        <p className="notice notice--critical" role="alert">
          <strong>Studio-actie mislukt.</strong> {params.fout}
        </p>
      ) : null}
      {params.succes ? (
        <p className="notice notice--success" role="status">
          {params.succes}
        </p>
      ) : null}
      {data.error ? (
        <p className="notice notice--critical" role="alert">
          <strong>Studio niet geladen.</strong> {data.error}
        </p>
      ) : null}
      {brandResources.error ? (
        <p className="notice notice--warning" role="status">
          {brandResources.error}
        </p>
      ) : null}

      <SummaryStrip
        aria-label="Studio-samenvatting"
        items={[
          {
            detail: failedJobs.length
              ? "Open het ontwerp en controleer de renderdetails"
              : "Geen mislukte renders",
            label: "Actie nodig",
            tone: failedJobs.length ? "warning" : "success",
            value: failedJobs.length
          },
          { label: "Ontwerpen", value: data.projects.length },
          {
            detail: "Worden veilig op de achtergrond verwerkt",
            label: "In verwerking",
            value: activeJobs.length
          }
        ]}
      />

      {activeJobs.length ? (
        <section
          aria-labelledby="studio-render-queue"
          className={styles.queue}
        >
          <div>
            <h2 id="studio-render-queue">Renderwachtrij</h2>
            <p>Je kunt doorwerken; afgeronde renders verschijnen in Media.</p>
          </div>
          <div className={styles.queueItems}>
            {activeJobs.slice(0, 3).map((job) => (
              <Link
                className={styles.queueItem}
                href={`/dashboard/studio/${job.projectId}?render=${job.id}`}
                key={job.id}
              >
                <span>
                  {renderStatusLabel(job.status)} · {job.outputKind.toUpperCase()}
                </span>
                <Progress
                  label={`Rendervoortgang ${job.progress}%`}
                  value={job.progress}
                />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <form method="get" role="search">
        <FilterBar
          activeCount={filterCount(filter)}
          actions={
            <div className={styles.viewSwitch} role="group" aria-label="Weergave">
              <Button
                aria-pressed={view === "grid"}
                name="viewMode"
                size="sm"
                type="submit"
                value="grid"
                variant={view === "grid" ? "secondary" : "ghost"}
              >
                <Grid3X3 aria-hidden="true" />
                Kaarten
              </Button>
              <Button
                aria-pressed={view === "list"}
                name="viewMode"
                size="sm"
                type="submit"
                value="list"
                variant={view === "list" ? "secondary" : "ghost"}
              >
                <List aria-hidden="true" />
                Lijst
              </Button>
            </div>
          }
          clearHref="/dashboard/studio"
          defaultOpen={filterCount(filter) > 0}
          primary={
            <input
              aria-label="Zoeken in Studio-ontwerpen"
              className="toolbar-search"
              defaultValue={filter.query}
              name="q"
              placeholder="Zoek op ontwerpnaam"
              type="search"
            />
          }
          results={`${data.projects.length} ${
            data.projects.length === 1 ? "ontwerp" : "ontwerpen"
          }`}
        >
          <label className="toolbar-field">
            <span>Status</span>
            <select defaultValue={filter.status} name="status">
              <option value="active">Actief</option>
              <option value="archived">Archief</option>
              <option value="deleted">Verwijderd</option>
              <option value="all">Alle statussen</option>
            </select>
          </label>
          <label className="toolbar-field">
            <span>Type</span>
            <select defaultValue={filter.kind} name="kind">
              <option value="all">Ontwerpen en templates</option>
              <option value="design">Ontwerpen</option>
              <option value="template">Tenanttemplates</option>
            </select>
          </label>
          <label className="toolbar-field">
            <span>Formaat</span>
            <select defaultValue={filter.format} name="format">
              <option value="all">Alle formaten</option>
              <option value="landscape">Liggend</option>
              <option value="portrait">Staand</option>
            </select>
          </label>
          <label className="toolbar-field">
            <span>Eigenaar</span>
            <select defaultValue={filter.owner} name="owner">
              <option value="all">Iedereen</option>
              <option value="mine">Mijn ontwerpen</option>
            </select>
          </label>
          <label className="toolbar-field">
            <span>Sorteren</span>
            <select defaultValue={filter.sort} name="sort">
              <option value="updated">Laatst gewijzigd</option>
              <option value="name">Naam</option>
            </select>
          </label>
          <label className="toolbar-field">
            <span>Gewijzigd</span>
            <select defaultValue={filter.updated} name="updated">
              <option value="all">Alle datums</option>
              <option value="week">Afgelopen 7 dagen</option>
              <option value="month">Afgelopen 30 dagen</option>
            </select>
          </label>
          <input name="view" type="hidden" value={view} />
          <Button type="submit" variant="secondary">
            Filters toepassen
          </Button>
        </FilterBar>
      </form>

      {data.projects.length ? (
        <section
          aria-label="Studio-ontwerpen"
          className={view === "grid" ? styles.projectGrid : styles.projectList}
        >
          {data.projects.map((project) => {
            const canEdit =
              canEditAll ||
              (canEditOwn && project.ownerUserId === session.userId);
            return (
              <article className={styles.projectCard} key={project.id}>
                <Link
                  aria-label={`${project.name} openen`}
                  className={styles.projectPreview}
                  data-orientation={project.orientation}
                  href={`/dashboard/studio/${project.id}`}
                >
                  <DocumentPreview project={project} />
                </Link>
                <div className={styles.projectBody}>
                  <div className={styles.projectTitleRow}>
                    <div>
                      <Link href={`/dashboard/studio/${project.id}`}>
                        {project.name}
                      </Link>
                      <p>
                        {project.orientation === "landscape"
                          ? "Liggend HD"
                          : "Staand HD"}
                        {project.motionEnabled ? " · Motion" : " · Stilstaand"}
                      </p>
                    </div>
                    <StatusPill
                      label={projectStatusLabel(project.status)}
                      tone={
                        project.status === "active" ? "success" : "neutral"
                      }
                    />
                  </div>
                  <div className={styles.projectMeta}>
                    <span>
                      <Clock3 aria-hidden="true" />
                      {formatRelativeDate(project.updatedAt)}
                    </span>
                    <span>
                      {project.motionEnabled ? (
                        <Film aria-hidden="true" />
                      ) : (
                        <ImageIcon aria-hidden="true" />
                      )}
                      {project.motionEnabled
                        ? `${Math.round(project.durationMs / 1000)} sec`
                        : "PNG"}
                    </span>
                  </div>
                  <ProjectActions
                    canArchive={canArchive && session.isLive}
                    canEdit={canEdit}
                    canMutate={session.isLive && (canEdit || canArchive)}
                    project={project}
                  />
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className={styles.empty} role="status">
          {filter.status === "archived" ? (
            <Archive aria-hidden="true" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          <h2>Geen passende ontwerpen</h2>
          <p>
            Pas je filters aan of start met een veilig VeyoCast-template.
          </p>
          {canCreate ? (
            <Button asChild>
              <Link href="/dashboard/studio/new">Nieuw ontwerp</Link>
            </Button>
          ) : null}
        </section>
      )}
    </>
  );
}

function DocumentPreview({
  project
}: {
  project: Awaited<ReturnType<typeof loadStudioOverview>>["projects"][number];
}) {
  const document = project.document;
  const background = document?.artboard.background;
  const style =
    background?.kind === "linear-gradient"
      ? {
          background: `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`
        }
      : background?.kind === "solid"
        ? { background: background.color }
        : undefined;
  const text = document?.elements.find((element) => element.type === "text");
  return (
    <span className={styles.previewCanvas} style={style}>
      <span className={styles.previewMark}>VeyoCast Studio</span>
      <strong>{text?.type === "text" ? text.text : project.name}</strong>
    </span>
  );
}

function parseFilter(
  params: Awaited<StudioPageProps["searchParams"]>
): StudioOverviewFilter {
  return {
    format:
      params.format === "landscape" || params.format === "portrait"
        ? params.format
        : "all",
    owner: params.owner === "mine" ? "mine" : "all",
    kind:
      params.kind === "design" || params.kind === "template"
        ? params.kind
        : "all",
    query: params.q?.trim() ?? "",
    sort: params.sort === "name" ? "name" : "updated",
    status:
      params.status === "archived" ||
      params.status === "deleted" ||
      params.status === "all"
        ? params.status
        : "active",
    updated:
      params.updated === "week" || params.updated === "month"
        ? params.updated
        : "all",
    view:
      (params.viewMode ?? params.view) === "list" ? "list" : "grid"
  };
}

function filterCount(filter: StudioOverviewFilter) {
  return [
    Boolean(filter.query),
    filter.format !== "all",
    filter.kind !== "all",
    filter.owner === "mine",
    filter.sort === "name",
    filter.status !== "active",
    filter.updated !== "all"
  ].filter(Boolean).length;
}

function formatRelativeDate(value: string) {
  const days = Math.round(
    (Date.parse(value) - Date.now()) / (24 * 60 * 60 * 1000)
  );
  if (Math.abs(days) < 1) return "Vandaag";
  return new Intl.RelativeTimeFormat("nl-NL", { numeric: "auto" }).format(
    days,
    "day"
  );
}

function projectStatusLabel(status: string) {
  if (status === "archived") return "Gearchiveerd";
  if (status === "deleted") return "Verwijderd";
  return "Concept";
}

function renderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    creating_media: "Media maken",
    encoding: "Video coderen",
    preparing: "Voorbereiden",
    queued: "In wachtrij",
    rendering: "Renderen",
    uploading: "Uploaden"
  };
  return labels[status] ?? "Verwerken";
}
