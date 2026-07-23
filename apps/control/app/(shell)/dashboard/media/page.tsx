/* eslint-disable @next/next/no-img-element */
import { FileWarning, Image as ImageIcon, Star, Upload, Video } from "lucide-react";
import Link from "next/link";

import { hasCapability } from "@veyocast/auth";
import {
  Button,
  DataTable,
  FilterBar,
  PageHeader,
  StatusPill,
  SummaryStrip,
  TablePreferences
} from "@veyocast/ui";

import { requireControlSession } from "../../../../lib/control-session";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import {
  HealthList,
  Timeline
} from "../../_components/shell-primitives";
import {
  archiveMediaAsset,
  assignMediaTag,
  moveMediaAsset,
  renameMediaAsset,
  removeMediaTag,
  retryMediaProcessing,
  setMediaFavorite
} from "./actions";
import {
  MediaInspectorSheet,
  MediaOrganizationDialog,
  MediaUploadDialog,
  SavedMediaViewsDialog
} from "./media-overlays";
import {
  mediaViewHref,
  mediaViewStateFromSearch,
  mediaViewStateFromStorage,
  mediaViewStateKey,
  type MediaViewState
} from "./saved-media-view";

type MediaPageProps = {
  searchParams: Promise<{
    asset?: string;
    favorite?: string;
    folder?: string;
    fout?: string;
    from?: string;
    page?: string;
    q?: string;
    sort?: string;
    status?: string;
    succes?: string;
    tag?: string;
    type?: string;
    to?: string;
    upload?: string;
    usage?: string;
    view?: string;
  }>;
};

type MediaAsset = {
  checksumSha256: string | null;
  createdAt: string;
  draftCount: number;
  fileName: string;
  fileSizeBytes: number;
  folderId: string | null;
  height: number | null;
  id: string;
  isFavorite: boolean;
  kind: "image" | "video";
  mimeType: string;
  previewUrl: string | null;
  releaseCount: number;
  screenCount: number;
  status: string;
  storagePath: string;
  tagIds: string[];
  title: string;
  usageCount: number;
  validationError: string | null;
  width: number | null;
  durationSeconds: number | null;
};

type MediaUsage = {
  playlistId: string;
  releaseVersion: number | null;
  resourceId: string;
  resourceName: string;
  screenCount: number;
  usageType: "draft" | "release" | "screen";
};

type MediaAssetRow = {
  asset_id: string;
  checksum_sha256: string | null;
  created_at: string;
  draft_usage_count: number | string;
  duration_seconds: number | string | null;
  file_size_bytes: number | string;
  folder_id: string | null;
  height: number | null;
  is_favorite: boolean;
  kind: "image" | "video";
  mime_type: string;
  original_file_name: string;
  release_usage_count: number | string;
  screen_usage_count: number | string;
  status: string;
  storage_path: string;
  tags: unknown;
  title: string;
  total_count: number | string;
  validation_error: string | null;
  width: number | null;
};

type MediaUsageRow = {
  playlist_id: string;
  release_version: number | null;
  resource_id: string;
  resource_name: string;
  screen_count: number | string;
  usage_type: string;
};

type MediaActivity = {
  action: string;
  createdAt: string;
  result: string;
};

type MediaFolder = {
  id: string;
  name: string;
  parentFolderId: string | null;
  revision: number;
};

type MediaTag = {
  color: string | null;
  id: string;
  name: string;
  revision: number;
};

type SavedMediaView = {
  href: string;
  id: string;
  name: string;
  revision: number;
  state: MediaViewState;
  updatedAt: string;
};

type SavedMediaViewRow = {
  filter_json: unknown;
  id: string;
  name: string;
  revision: number | string;
  sort_json: unknown;
  updated_at: string;
};

type ProcessingSummary = {
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  status: string;
};

const pipelineSteps = [
  {
    detail: "Sessie, tenantrol, titel, grootte en gedeclareerd MIME-type worden server-side gecontroleerd.",
    label: "Upload voorbereiden",
    meta: "Server",
    tone: "info"
  },
  {
    detail: "Afbeeldingen krijgen magic-bytecontrole; video gaat in hervatbare TUS-delen rechtstreeks naar het vooraf vastgelegde private tenantpad.",
    label: "Inhoud valideren",
    meta: "Verplicht",
    tone: "warning"
  },
  {
    detail: "Pas na opslag, SHA-256 en variantregistratie krijgt de media status Gereed.",
    label: "Veilig activeren",
    meta: "Geverifieerd",
    tone: "success"
  }
] as const;

const mediaRules = [
  {
    detail: "SVG blijft uitgeschakeld totdat sanitizing bewust en aantoonbaar veilig is toegevoegd.",
    label: "Bestandstype",
    status: "Beleid",
    tone: "critical"
  },
  {
    detail: "Deze live route accepteert JPEG, PNG en WebP tot maximaal 20 MB.",
    label: "Afbeeldingslimiet",
    status: "Bewaakt",
    tone: "info"
  },
  {
    detail: "MP4 tot 500 MB wordt asynchroon geprobed en genormaliseerd naar maximaal 1080p30 H.264 met optionele AAC-audio; maximaal vijf minuten.",
    label: "Video",
    status: "Workerqueue",
    tone: "success"
  }
] as const;

export default async function MediaPage({ searchParams }: MediaPageProps) {
  const session = await requireControlSession();
  const publicConfig = getSupabasePublicConfig();
  const params = await searchParams;
  const { fout, succes } = params;
  const page = positiveInteger(params.page, 1);
  const {
    assets,
    activity,
    failedCount,
    folders,
    loadError,
    mediaStorageLimitBytes,
    mediaStorageUsedBytes,
    processingCount,
    processingSummary,
    readyCount,
    savedViews,
    selectedUsage,
    tags,
    totalCount
  } = await loadMediaData(session.tenantId, session.userId, session.isLive, params, page);
  const canUpload =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.roles, "tenant.media.write");
  const canSaveViews =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.roles, "tenant.media.read");
  const visibleAssets = assets;
  const selectedAsset = params.asset
    ? assets.find((asset) => asset.id === params.asset) ?? null
    : null;
  const pageCount = Math.max(1, Math.ceil(totalCount / 20));
  const uploadCloseHref = mediaHref(params, { upload: undefined });
  const inspectorCloseHref = mediaHref(params, { asset: undefined });
  const currentViewState = mediaViewStateFromSearch(params);
  const currentViewStateKey = mediaViewStateKey(currentViewState);

  return (
    <>
      <PageHeader
        actions={canUpload ? (
          <div className="page-action-group">
            <MediaOrganizationDialog canWrite={canUpload} folders={folders} />
            <Button asChild>
              <Link href={mediaHref(params, { upload: "1" })}>
                <Upload aria-hidden="true" />
                Media uploaden
              </Link>
            </Button>
          </div>
        ) : null}
        description="Beheer afbeeldingen en video's voor je playlists."
        eyebrow={session.tenant}
        status={!session.isLive ? { label: "Demomodus", tone: "warning" } : undefined}
        title="Media"
      />

      {fout ? (
        <p className="notice notice--critical" role="alert">
          <strong>Mediaactie mislukt.</strong> {fout}
        </p>
      ) : null}
      {succes ? (
        <p className="notice notice--success" role="status">
          {succes}
        </p>
      ) : null}
      {loadError ? (
        <p className="notice notice--critical" role="alert">
          <strong>Bibliotheek niet geladen.</strong> {loadError}
        </p>
      ) : null}
      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          Uploaden is niet beschikbaar in de demomodus. Start lokale Supabase en log in om
          echte tenantmedia te beheren.
        </p>
      ) : null}

      <SummaryStrip
        aria-label="Samenvatting mediabibliotheek"
        items={[
          { label: "Media", value: String(totalCount), detail: `${readyCount} gereed` },
          {
            label: "In verwerking",
            value: String(processingCount),
            detail: processingCount > 0 ? "Automatisch bijgewerkt" : "Geen wachtrij",
            tone: processingCount > 0 ? "warning" : "neutral"
          },
          {
            label: "Actie nodig",
            value: String(failedCount),
            detail: failedCount > 0 ? "Controleer afgewezen media" : "Geen fouten",
            tone: failedCount > 0 ? "critical" : "success"
          },
          {
            label: "Opslag",
            value: formatBytes(mediaStorageUsedBytes),
            detail: mediaStorageLimitBytes === null
              ? "Geen limiet ingesteld"
              : `van ${formatBytes(mediaStorageLimitBytes)}`
          }
        ]}
      />

      <form method="get" role="search">
        <FilterBar
          activeCount={mediaFilterCount(params)}
          actions={(
            <>
              <SavedMediaViewsDialog
                canSave={canSaveViews}
                currentState={JSON.stringify(currentViewState)}
                views={savedViews.map((view) => ({
                  active: mediaViewStateKey(view.state) === currentViewStateKey,
                  href: view.href,
                  id: view.id,
                  name: view.name,
                  revision: view.revision,
                  updatedLabel: formatDateTime(view.updatedAt)
                }))}
              />
              <TablePreferences
                columns={[
                  { id: "type", label: "Type", defaultVisible: true },
                  { id: "name", label: "Media", defaultVisible: true, required: true },
                  { id: "details", label: "Details", defaultVisible: true },
                  { id: "status", label: "Status", defaultVisible: true },
                  { id: "usage", label: "Gebruik", defaultVisible: true },
                  { id: "created", label: "Toegevoegd", defaultVisible: true },
                  { id: "actions", label: "Actie", defaultVisible: true, required: true }
                ]}
                defaultDensity="comfortable"
                tableKey="media"
              />
              <Button asChild size="sm" variant={params.view !== "grid" ? "secondary" : "ghost"}>
                <Link
                  aria-current={params.view !== "grid" ? "page" : undefined}
                  href={mediaHref(params, { page: "1", view: "list" })}
                >
                  Lijst
                </Link>
              </Button>
              <Button asChild size="sm" variant={params.view === "grid" ? "secondary" : "ghost"}>
                <Link
                  aria-current={params.view === "grid" ? "page" : undefined}
                  href={mediaHref(params, { page: "1", view: "grid" })}
                >
                  Raster
                </Link>
              </Button>
            </>
          )}
          clearHref={`/dashboard/media?view=${params.view === "grid" ? "grid" : "list"}`}
          defaultOpen={mediaFilterCount(params) > 0}
          primary={(
            <input
              aria-label="Zoeken in media"
              className="toolbar-search"
              defaultValue={params.q}
              name="q"
              placeholder="Zoeken op titel of bestandsnaam"
              type="search"
            />
          )}
          results={`${visibleAssets.length} van ${totalCount} zichtbaar`}
        >
          <select aria-label="Filter media op type" className="toolbar-select" defaultValue={params.type ?? "all"} name="type">
            <option value="all">Alle typen</option><option value="image">Afbeeldingen</option><option value="video">Video's</option>
          </select>
          <select aria-label="Filter media op status" className="toolbar-select" defaultValue={params.status ?? "all"} name="status">
            <option value="all">Alle statussen</option><option value="uploading">Uploaden</option><option value="processing">Verwerken</option><option value="ready">Gereed</option><option value="validation_failed">Validatie mislukt</option><option value="quarantined">In quarantaine</option>
          </select>
          <select aria-label="Filter media op gebruik" className="toolbar-select" defaultValue={params.usage ?? "all"} name="usage">
            <option value="all">Elk gebruik</option><option value="used">In gebruik</option><option value="unused">Niet in gebruik</option>
          </select>
          <select aria-label="Filter media op map" className="toolbar-select" defaultValue={params.folder ?? "all"} name="folder">
            <option value="all">Alle mappen</option>
            <option value="root">Zonder map</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
          <select aria-label="Filter media op tag" className="toolbar-select" defaultValue={params.tag ?? "all"} name="tag">
            <option value="all">Alle tags</option>
            {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
          <select aria-label="Sorteer media" className="toolbar-select" defaultValue={params.sort ?? "newest"} name="sort">
            <option value="newest">Nieuwste eerst</option>
            <option value="oldest">Oudste eerst</option>
            <option value="name">Naam</option>
            <option value="size">Bestandsgrootte</option>
          </select>
          <label className="check-row">
            <input defaultChecked={params.favorite === "true"} name="favorite" type="checkbox" value="true" />
            <span><Star aria-hidden="true" /> Alleen favorieten</span>
          </label>
          <label className="toolbar-date"><span>Vanaf</span><input defaultValue={params.from} name="from" type="date" /></label>
          <label className="toolbar-date"><span>Tot en met</span><input defaultValue={params.to} name="to" type="date" /></label>
          <input name="view" type="hidden" value={params.view === "grid" ? "grid" : "list"} />
          <Button size="sm" type="submit" variant="secondary">Filters toepassen</Button>
        </FilterBar>
      </form>

      <section className="workspace-section" aria-labelledby="media-library-title">
          <div className="workspace-section__header">
            <div>
              <h2 className="workspace-section__title" id="media-library-title">
                Mediabibliotheek
              </h2>
              <p className="work-panel__meta">
                Selecteer een item om details en gebruik te bekijken.
              </p>
            </div>
            <StatusPill label={`${totalCount} items`} tone="neutral" />
          </div>
          {visibleAssets.length > 0 && params.view === "grid" ? (
            <div className="media-library-grid">
              {visibleAssets.map((asset) => (
                <article className="media-library-card" key={asset.id}>
                  <MediaPreview asset={asset} compact />
                  <div className="media-library-card__body">
                    <div className="work-panel__header"><div><h3>{asset.title}</h3><p className="work-panel__meta">{asset.fileName}</p></div><MediaStatus status={asset.status} /></div>
                    <p className="work-panel__meta">{asset.isFavorite ? "Favoriet · " : ""}{mediaDetails(asset)} · {usageSummary(asset)}</p>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={mediaHref(params, { asset: asset.id })}>
                        Details bekijken
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : visibleAssets.length > 0 ? (
            <DataTable caption="Media binnen de actieve vereniging." tableKey="media">
                <thead>
                  <tr>
                    <th data-column="type" scope="col">Type</th>
                    <th data-column="name" scope="col">Media</th>
                    <th data-column="details" scope="col">Details</th>
                    <th data-column="status" scope="col">Status</th>
                    <th data-column="usage" scope="col">Gebruik</th>
                    <th data-column="created" scope="col">Toegevoegd</th>
                    <th data-column="actions" scope="col">Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td data-column="type" data-label="Type">
                        <MediaType kind={asset.kind} status={asset.status} />
                      </td>
                      <td data-column="name" data-label="Media">
                        <span className="table-primary">{asset.isFavorite ? "★ " : ""}{asset.title}</span>
                        <span className="table-secondary">{asset.fileName}</span>
                      </td>
                      <td data-column="details" data-label="Details">{mediaDetails(asset)}</td>
                      <td data-column="status" data-label="Status">
                        <MediaStatus status={asset.status} />
                      </td>
                      <td data-column="usage" data-label="Gebruik">
                        {usageSummary(asset)}
                      </td>
                      <td data-column="created" data-label="Toegevoegd">{formatDate(asset.createdAt)}</td>
                      <td data-column="actions" data-label="Actie">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={mediaHref(params, { asset: asset.id })}>Details</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </DataTable>
          ) : (
            <div className="notice" role="status">
              <strong>Nog geen media.</strong>{" "}
              Upload een afbeelding of video om je bibliotheek te vullen.
            </div>
          )}
          {totalCount > 20 ? (
            <nav aria-label="Paginering mediabibliotheek" className="pagination">
              <Button asChild size="sm" variant="secondary">
                {page <= 1
                  ? <button disabled type="button">Vorige</button>
                  : <Link href={mediaHref(params, { page: String(page - 1) })}>Vorige</Link>}
              </Button>
              <span>Pagina {Math.min(page, pageCount)} van {pageCount}</span>
              <Button asChild size="sm" variant="secondary">
                {page >= pageCount
                  ? <button disabled type="button">Volgende</button>
                  : <Link href={mediaHref(params, { page: String(page + 1) })}>Volgende</Link>}
              </Button>
            </nav>
          ) : null}
      </section>

      <details className="media-guidance">
        <summary>Upload- en verwerkingsregels</summary>
        <div className="work-grid">
        <section aria-labelledby="pipeline-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="pipeline-title">Veilige verwerking</h2>
              <p className="work-panel__meta">Van gebruikersbestand naar geverifieerde variant.</p>
            </div>
          </div>
          <Timeline ariaLabel="Media pipeline stappen" items={pipelineSteps} />
        </section>

      <section aria-labelledby="media-risk-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="media-risk-title">Ondersteunde bestanden</h2>
            <p className="work-panel__meta">Private bucket: tenant-media</p>
          </div>
        </div>
        <HealthList ariaLabel="Media validatierisico's" items={mediaRules} />
      </section>
        </div>
      </details>

      {selectedAsset ? (
        <MediaInspectorSheet
          closeHref={inspectorCloseHref}
          description={selectedAsset.fileName}
          open
          status={{
            label: statusLabel(selectedAsset.status),
            tone: mediaStatusTone(selectedAsset.status)
          }}
          title={selectedAsset.title}
        >
          <MediaPreview asset={selectedAsset} />
          <dl className="meta-list">
            <div><dt>Type</dt><dd>{mediaDetails(selectedAsset)}</dd></div>
            <div><dt>Afmetingen</dt><dd>{selectedAsset.width && selectedAsset.height ? `${selectedAsset.width} × ${selectedAsset.height}` : "Na verwerking beschikbaar"}</dd></div>
            <div><dt>Duur</dt><dd>{selectedAsset.durationSeconds ? `${selectedAsset.durationSeconds.toFixed(1)} seconden` : "Niet van toepassing of nog onbekend"}</dd></div>
            <div><dt>Checksum</dt><dd>{shortChecksum(selectedAsset.checksumSha256)}</dd></div>
            <div><dt>Validatie</dt><dd>{validationSummary(selectedAsset.validationError)}</dd></div>
            <div><dt>Map</dt><dd>{folders.find((folder) => folder.id === selectedAsset.folderId)?.name ?? "Hoofdniveau"}</dd></div>
            <div><dt>Tags</dt><dd>{selectedAsset.tagIds.length ? selectedAsset.tagIds.map((id) => tags.find((tag) => tag.id === id)?.name).filter(Boolean).join(", ") : "Geen tags"}</dd></div>
          </dl>

          <section aria-labelledby="media-organization-title" className="media-usage">
            <div className="work-panel__header">
              <div>
                <h3 id="media-organization-title">Organisatie</h3>
                <p className="work-panel__meta">Persoonlijke favoriet, tenantmap en herbruikbare tags.</p>
              </div>
              <StatusPill label={selectedAsset.isFavorite ? "Favoriet" : "Niet favoriet"} tone={selectedAsset.isFavorite ? "info" : "neutral"} />
            </div>
            <form action={setMediaFavorite}>
              <input name="assetId" type="hidden" value={selectedAsset.id} />
              <input name="favorite" type="hidden" value={selectedAsset.isFavorite ? "false" : "true"} />
              <Button disabled={!canUpload} size="sm" type="submit" variant="secondary">
                <Star aria-hidden="true" />
                {selectedAsset.isFavorite ? "Uit favorieten" : "Aan favorieten toevoegen"}
              </Button>
            </form>
            <form action={moveMediaAsset} className="playlist-form">
              <input name="assetId" type="hidden" value={selectedAsset.id} />
              <div className="field">
                <label htmlFor="media-folder-select">Map</label>
                <select defaultValue={selectedAsset.folderId ?? ""} disabled={!canUpload} id="media-folder-select" name="folderId">
                  <option value="">Hoofdniveau</option>
                  {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </div>
              <Button disabled={!canUpload} size="sm" type="submit" variant="secondary">Naar map verplaatsen</Button>
            </form>
            {selectedAsset.tagIds.length ? (
              <ul className="media-usage__list" aria-label="Toegekende tags">
                {selectedAsset.tagIds.map((tagId) => {
                  const tag = tags.find((candidate) => candidate.id === tagId);
                  return tag ? <li key={tag.id}>
                    <strong>{tag.name}</strong>
                    <form action={removeMediaTag}>
                      <input name="assetId" type="hidden" value={selectedAsset.id} />
                      <input name="tagId" type="hidden" value={tag.id} />
                      <Button disabled={!canUpload} size="sm" type="submit" variant="ghost">Verwijderen</Button>
                    </form>
                  </li> : null;
                })}
              </ul>
            ) : null}
            <form action={assignMediaTag} className="playlist-form">
              <input name="assetId" type="hidden" value={selectedAsset.id} />
              <div className="field">
                <label htmlFor="media-tag-select">Tag toevoegen</label>
                <select disabled={!canUpload || tags.every((tag) => selectedAsset.tagIds.includes(tag.id))} id="media-tag-select" name="tagId" required>
                  <option value="">Kies een tag</option>
                  {tags.filter((tag) => !selectedAsset.tagIds.includes(tag.id)).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                </select>
              </div>
              <Button disabled={!canUpload || tags.every((tag) => selectedAsset.tagIds.includes(tag.id))} size="sm" type="submit" variant="secondary">Tag toevoegen</Button>
            </form>
          </section>

          <section aria-labelledby="media-usage-title" className="media-usage">
            <div className="work-panel__header">
              <div>
                <h3 id="media-usage-title">Gebruik en impact</h3>
                <p className="work-panel__meta">Concept → release → scherm</p>
              </div>
              <StatusPill
                label={usageSummary(selectedAsset)}
                tone={selectedAsset.usageCount > 0 ? "warning" : "neutral"}
              />
            </div>
            {selectedUsage.length > 0 ? (
              <ul className="media-usage__list">
                {selectedUsage.map((usage) => (
                  <li key={`${usage.usageType}-${usage.resourceId}`}>
                    <strong>{usage.resourceName}</strong>
                    <span>{usageLabel(usage)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="work-panel__meta">
                Niet gebruikt in concepten, releases of schermtoewijzingen.
              </p>
            )}
          </section>

          {processingSummary ? (
            <section className="media-usage" aria-labelledby="media-processing-title">
              <div className="work-panel__header">
                <div>
                  <h3 id="media-processing-title">Verwerking</h3>
                  <p className="work-panel__meta">
                    {processingSummary.attempts} poging
                    {processingSummary.attempts === 1 ? "" : "en"}
                  </p>
                </div>
                <StatusPill
                  label={statusLabel(processingSummary.status)}
                  tone={processingSummary.status === "failed" ? "critical" : "info"}
                />
              </div>
              <p className="work-panel__meta">
                {processingExplanation(processingSummary)}
              </p>
            </section>
          ) : null}

          {activity.length > 0 ? (
            <details className="media-inspector-activity">
              <summary>Recente activiteit</summary>
              <ul className="media-usage__list">
                {activity.map((event) => (
                  <li key={`${event.createdAt}-${event.action}`}>
                    <strong>{activityLabel(event.action)}</strong>
                    <span>
                      {formatDateTime(event.createdAt)} ·{" "}
                      {event.result === "success" ? "Geslaagd" : "Niet geslaagd"}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <form action={renameMediaAsset} className="playlist-form">
            <input name="assetId" type="hidden" value={selectedAsset.id} />
            <div className="field">
              <label htmlFor="media-rename-title">Mediatitel</label>
              <input
                defaultValue={selectedAsset.title}
                disabled={!canUpload}
                id="media-rename-title"
                maxLength={120}
                minLength={2}
                name="title"
                required
                type="text"
              />
            </div>
            <Button disabled={!canUpload} type="submit" variant="secondary">
              Titel opslaan
            </Button>
          </form>

          {selectedAsset.kind === "video"
            && selectedAsset.status === "validation_failed" ? (
              <form action={retryMediaProcessing}>
                <input name="assetId" type="hidden" value={selectedAsset.id} />
                <Button disabled={!canUpload} type="submit" variant="secondary">
                  Verwerking opnieuw proberen
                </Button>
                <p className="work-panel__meta">
                  Alleen een tijdelijke workerfout kan opnieuw worden verwerkt.
                  Lever media in quarantaine opnieuw aan.
                </p>
              </form>
            ) : null}

          <form action={archiveMediaAsset}>
            <input name="assetId" type="hidden" value={selectedAsset.id} />
            <Button
              disabled={!canUpload || selectedAsset.usageCount > 0}
              type="submit"
              variant="destructive"
            >
              Media archiveren
            </Button>
            {selectedAsset.usageCount > 0 ? (
              <p className="work-panel__meta">
                Verwijder deze media eerst uit alle conceptplaylists.
                Gepubliceerde releases blijven intact.
              </p>
            ) : null}
          </form>
        </MediaInspectorSheet>
      ) : null}

      <MediaUploadDialog
        anonKey={publicConfig?.anonKey ?? ""}
        canUpload={canUpload && publicConfig !== null}
        closeHref={uploadCloseHref}
        open={params.upload === "1"}
        supabaseUrl={publicConfig?.url ?? ""}
      />
    </>
  );
}

function mediaFilterCount(params: Awaited<MediaPageProps["searchParams"]>) {
  return [
    Boolean(params.q?.trim()),
    Boolean(params.type && params.type !== "all"),
    Boolean(params.status && params.status !== "all"),
    Boolean(params.usage && params.usage !== "all"),
    Boolean(params.folder && params.folder !== "all"),
    Boolean(params.tag && params.tag !== "all"),
    params.favorite === "true",
    Boolean(params.sort && params.sort !== "newest"),
    Boolean(params.from),
    Boolean(params.to)
  ].filter(Boolean).length;
}

async function loadMediaData(
  tenantId: string | null,
  userId: string,
  isLive: boolean,
  params: Awaited<MediaPageProps["searchParams"]>,
  page: number
) {
  if (!isLive) {
    return {
      activity: [] as MediaActivity[],
      assets: [] as MediaAsset[],
      failedCount: 0,
      folders: [] as MediaFolder[],
      loadError: null,
      mediaStorageLimitBytes: null as number | null,
      mediaStorageUsedBytes: 0,
      processingCount: 0,
      processingSummary: null as ProcessingSummary | null,
      readyCount: 0,
      savedViews: [] as SavedMediaView[],
      selectedUsage: [] as MediaUsage[],
      tags: [] as MediaTag[],
      totalCount: 0
    };
  }

  if (!tenantId) {
    return {
      activity: [] as MediaActivity[],
      assets: [],
      failedCount: 0,
      folders: [] as MediaFolder[],
      loadError: "Er is geen actieve tenant. Kies een tenant en laad de pagina opnieuw.",
      mediaStorageLimitBytes: null as number | null,
      mediaStorageUsedBytes: 0,
      processingCount: 0,
      processingSummary: null as ProcessingSummary | null,
      readyCount: 0,
      savedViews: [] as SavedMediaView[],
      selectedUsage: [] as MediaUsage[],
      tags: [] as MediaTag[],
      totalCount: 0
    };
  }

  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return {
      activity: [] as MediaActivity[],
      assets: [],
      failedCount: 0,
      folders: [] as MediaFolder[],
      loadError: "De beveiligde datasessie ontbreekt. Log opnieuw in en probeer het daarna nogmaals.",
      mediaStorageLimitBytes: null as number | null,
      mediaStorageUsedBytes: 0,
      processingCount: 0,
      processingSummary: null as ProcessingSummary | null,
      readyCount: 0,
      savedViews: [] as SavedMediaView[],
      selectedUsage: [] as MediaUsage[],
      tags: [] as MediaTag[],
      totalCount: 0
    };
  }

  const kind = params.type === "image" || params.type === "video" ? params.type : null;
  const allowedStatuses = ["uploading", "processing", "ready", "validation_failed", "quarantined"];
  const status = params.status && allowedStatuses.includes(params.status) ? params.status : null;
  const usage = params.usage === "used" || params.usage === "unused" ? params.usage : "all";

  const folderId = uuidOrNull(params.folder);
  const tagId = uuidOrNull(params.tag);
  const sort = ["name", "newest", "oldest", "size"].includes(params.sort ?? "") ? params.sort! : "newest";
  const [
    assetResult,
    readyResult,
    processingResult,
    failedResult,
    storageResult,
    folderResult,
    tagResult,
    savedViewResult
  ] = await Promise.all([
    supabase.rpc("list_publisher_media_assets_v1", {
      p_created_from: dateBoundary(params.from, false),
      p_created_until: dateBoundary(params.to, true),
      p_favorites_only: params.favorite === "true",
      p_folder_id: folderId,
      p_kind: kind,
      p_page_size: 20,
      p_offset: (page - 1) * 20,
      p_root_only: params.folder === "root",
      p_search: params.q?.trim() || null,
      p_sort: sort,
      p_status: status,
      p_tag_id: tagId,
      p_tenant_id: tenantId,
      p_usage: usage
    }),
    supabase.from("media_assets").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "ready").is("deleted_at", null),
    supabase.from("media_assets").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["uploading", "processing"]).is("deleted_at", null),
    supabase.from("media_assets").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["validation_failed", "quarantined"]).is("deleted_at", null),
    supabase.rpc("get_media_storage_usage", { p_tenant_id: tenantId }),
    supabase.from("media_folders").select("id, name, parent_folder_id, revision").eq("tenant_id", tenantId).order("name"),
    supabase.from("media_tags").select("id, name, color, revision").eq("tenant_id", tenantId).order("name"),
    supabase
      .from("publisher_saved_views")
      .select("id, name, filter_json, sort_json, revision, updated_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("resource_type", "media")
      .order("updated_at", { ascending: false })
  ]);

  if (assetResult.error || readyResult.error || processingResult.error || failedResult.error || storageResult.error || folderResult.error || tagResult.error) {
    console.error("Mediabibliotheek laden mislukt", assetResult.error ?? readyResult.error ?? processingResult.error ?? failedResult.error ?? storageResult.error ?? folderResult.error ?? tagResult.error);
    return {
      activity: [] as MediaActivity[],
      assets: [],
      failedCount: 0,
      folders: [] as MediaFolder[],
      loadError: "Tenantmedia kon niet worden gelezen. Er is niets gewijzigd; vernieuw de pagina of log opnieuw in.",
      mediaStorageLimitBytes: null as number | null,
      mediaStorageUsedBytes: 0,
      processingCount: 0,
      processingSummary: null as ProcessingSummary | null,
      readyCount: 0,
      savedViews: [] as SavedMediaView[],
      selectedUsage: [] as MediaUsage[],
      tags: [] as MediaTag[],
      totalCount: 0
    };
  }

  const rows = (assetResult.data ?? []) as MediaAssetRow[];
  const assetIds = rows.map((asset) => asset.asset_id);
  const variantResult = assetIds.length > 0
    ? await supabase.from("media_variants").select("asset_id, variant_type, storage_path").eq("tenant_id", tenantId).in("asset_id", assetIds)
    : { data: [], error: null };
  if (variantResult.error) {
    console.error("Mediavoorbeelden laden mislukt", variantResult.error);
  }
  if (savedViewResult.error) {
    console.error("Persoonlijke mediaweergaven laden mislukt", {
      code: savedViewResult.error.code
    });
  }

  const previewPaths = new Map<string, string>();
  for (const variant of variantResult.data ?? []) {
    const asset = rows.find((candidate) => candidate.asset_id === variant.asset_id);
    const preferredType = asset?.kind === "video" ? "player_1080p" : "original";
    if (variant.variant_type === preferredType) previewPaths.set(variant.asset_id, variant.storage_path);
  }

  const signedPreviews = new Map<string, string>();
  await Promise.all([...previewPaths.entries()].map(async ([assetId, path]) => {
    const { data, error } = await supabase.storage.from("tenant-media").createSignedUrl(path, 600);
    if (!error && data?.signedUrl) signedPreviews.set(assetId, data.signedUrl);
  }));

  const assets: MediaAsset[] = rows.map((asset) => ({
    checksumSha256: asset.checksum_sha256,
    createdAt: asset.created_at,
    draftCount: Number(asset.draft_usage_count),
    durationSeconds: asset.duration_seconds === null ? null : Number(asset.duration_seconds),
    fileName: asset.original_file_name,
    fileSizeBytes: Number(asset.file_size_bytes),
    folderId: asset.folder_id,
    height: asset.height,
    id: asset.asset_id,
    isFavorite: asset.is_favorite,
    kind: asset.kind as MediaAsset["kind"],
    mimeType: asset.mime_type,
    previewUrl: signedPreviews.get(asset.asset_id) ?? null,
    releaseCount: Number(asset.release_usage_count),
    screenCount: Number(asset.screen_usage_count),
    status: asset.status,
    storagePath: asset.storage_path,
    tagIds: parseTagIds(asset.tags),
    title: asset.title,
    usageCount: Number(asset.draft_usage_count),
    validationError: asset.validation_error,
    width: asset.width
  }));

  const selectedId = params.asset && assets.some((asset) => asset.id === params.asset)
    ? params.asset
    : null;
  const [usageResult, processingDetailResult, activityResult] = selectedId
    ? await Promise.all([
        supabase.rpc("get_media_asset_usage", { p_asset_id: selectedId }),
        supabase.from("media_processing_jobs").select("status, attempt_count, error_code, error_message").eq("tenant_id", tenantId).eq("asset_id", selectedId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("audit_events").select("action, result, created_at").eq("tenant_id", tenantId).eq("target_id", selectedId).order("created_at", { ascending: false }).limit(10)
      ])
    : [
        { data: [], error: null },
        { data: null, error: null },
        { data: [], error: null }
      ];
  if (usageResult.error || processingDetailResult.error || activityResult.error) {
    console.error("Mediadetail laden mislukt", usageResult.error ?? processingDetailResult.error ?? activityResult.error);
  }
  const selectedUsage: MediaUsage[] = ((usageResult.data ?? []) as MediaUsageRow[]).map((usageRow) => ({
    playlistId: usageRow.playlist_id,
    releaseVersion: usageRow.release_version,
    resourceId: usageRow.resource_id,
    resourceName: usageRow.resource_name,
    screenCount: Number(usageRow.screen_count),
    usageType: usageRow.usage_type as MediaUsage["usageType"]
  }));
  const processingSummary: ProcessingSummary | null = processingDetailResult.data ? {
    attempts: Number(processingDetailResult.data.attempt_count),
    errorCode: processingDetailResult.data.error_code,
    errorMessage: processingDetailResult.data.error_message,
    status: processingDetailResult.data.status
  } : null;
  const activity: MediaActivity[] = (activityResult.data ?? []).map((event: { action: string; created_at: string; result: string }) => ({
    action: event.action,
    createdAt: event.created_at,
    result: event.result
  }));
  const storage = storageResult.data?.[0];
  const savedViews: SavedMediaView[] = savedViewResult.error
    ? []
    : ((savedViewResult.data ?? []) as SavedMediaViewRow[]).flatMap((view) => {
        const state = mediaViewStateFromStorage(view.filter_json, view.sort_json);
        return state ? [{
          href: mediaViewHref(state),
          id: view.id,
          name: view.name,
          revision: Number(view.revision),
          state,
          updatedAt: view.updated_at
        }] : [];
      });

  return {
    activity,
    assets,
    failedCount: failedResult.count ?? 0,
    folders: (folderResult.data ?? []).map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentFolderId: folder.parent_folder_id,
      revision: Number(folder.revision)
    })),
    loadError: mediaLibraryWarning(Boolean(variantResult.error), Boolean(savedViewResult.error)),
    mediaStorageLimitBytes: storage?.limit_bytes === null || storage?.limit_bytes === undefined
      ? null
      : Number(storage.limit_bytes),
    mediaStorageUsedBytes: Number(storage?.used_bytes ?? 0),
    processingCount: processingResult.count ?? 0,
    processingSummary,
    readyCount: readyResult.count ?? 0,
    savedViews,
    selectedUsage,
    tags: (tagResult.data ?? []).map((tag) => ({
      color: tag.color,
      id: tag.id,
      name: tag.name,
      revision: Number(tag.revision)
    })),
    totalCount: Number(rows[0]?.total_count ?? 0)
  };
}

function mediaLibraryWarning(previewFailed: boolean, savedViewsFailed: boolean) {
  if (previewFailed && savedViewsFailed) {
    return "De bibliotheek is geladen, maar voorbeelden en persoonlijke weergaven zijn tijdelijk niet beschikbaar.";
  }
  if (previewFailed) {
    return "De bibliotheek is geladen, maar één of meer voorbeelden konden niet worden gemaakt.";
  }
  if (savedViewsFailed) {
    return "De bibliotheek is geladen, maar persoonlijke weergaven konden niet worden opgehaald.";
  }
  return null;
}

function MediaType({ kind, status }: Pick<MediaAsset, "kind" | "status">) {
  if (["validation_failed", "quarantined"].includes(status)) {
    return <span className="media-type media-type--failed" aria-label="Afgewezen media"><FileWarning aria-hidden="true" /></span>;
  }
  if (kind === "video") {
    return <span className="media-type media-type--video" aria-label="Video"><Video aria-hidden="true" /></span>;
  }
  return <span className="media-type" aria-label="Afbeelding"><ImageIcon aria-hidden="true" /></span>;
}

function MediaPreview({ asset, compact = false }: { asset: MediaAsset; compact?: boolean }) {
  if (!asset.previewUrl) {
    return <div className="media-card__preview" data-kind={asset.kind}>{asset.status === "ready" ? "Voorbeeld niet beschikbaar" : statusLabel(asset.status)}</div>;
  }
  if (asset.kind === "video") {
    if (compact) {
      return <div className="media-card__preview" data-kind="video"><Video aria-hidden="true" /><span>Video</span></div>;
    }
    return <video className="media-inspector-preview" controls muted preload="metadata" src={asset.previewUrl}><track kind="captions" /></video>;
  }
  return <img alt={`Voorbeeld van ${asset.title}`} className="media-inspector-preview" src={asset.previewUrl} />;
}

function MediaStatus({ status }: { status: string }) {
  return <StatusPill label={statusLabel(status)} tone={mediaStatusTone(status)} />;
}

function mediaStatusTone(status: string) {
  if (status === "ready") return "success" as const;
  if (["validation_failed", "quarantined"].includes(status)) return "critical" as const;
  return "warning" as const;
}

function statusLabel(status: string) {
  return {
    completed: "Afgerond",
    failed: "Mislukt",
    processing: "Verwerken",
    queued: "In wachtrij",
    ready: "Gereed",
    quarantined: "In quarantaine",
    uploaded: "Geüpload",
    uploading: "Uploaden",
    validation_failed: "Validatie mislukt"
  }[status] ?? status;
}

function mediaDetails(asset: MediaAsset) {
  return `${asset.mimeType.replace("image/", "").toUpperCase()} · ${formatBytes(asset.fileSizeBytes)}`;
}

function formatBytes(value: number) {
  if (value <= 0) return "0 KB";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function shortChecksum(value: string | null) {
  return value ? `${value.slice(0, 12)}…` : "Nog niet beschikbaar";
}

function validationSummary(value: string | null) {
  if (!value) return "Geslaagd of nog in verwerking";

  return {
    ready_transition_failed: "Veilige afronding mislukt",
    server_upload_unavailable: "Uploadservice niet beschikbaar",
    storage_upload_failed: "Private opslag mislukt",
    unsupported_media_type: "Bestandstype niet toegestaan",
    upload_cancelled: "Upload geannuleerd",
    variant_registration_failed: "Variantregistratie mislukt"
  }[value] ?? "Validatie mislukt";
}

function usageSummary(asset: MediaAsset) {
  const parts = [
    asset.draftCount > 0 ? `${asset.draftCount} concept${asset.draftCount === 1 ? "" : "en"}` : null,
    asset.releaseCount > 0 ? `${asset.releaseCount} release${asset.releaseCount === 1 ? "" : "s"}` : null,
    asset.screenCount > 0 ? `${asset.screenCount} scherm${asset.screenCount === 1 ? "" : "en"}` : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Niet in gebruik";
}

function usageLabel(usage: MediaUsage) {
  if (usage.usageType === "draft") return "Conceptplaylist";
  if (usage.usageType === "screen") return `Scherm · release v${usage.releaseVersion ?? "?"}`;
  return `Immutable release v${usage.releaseVersion ?? "?"}${usage.screenCount > 0 ? ` · ${usage.screenCount} scherm${usage.screenCount === 1 ? "" : "en"}` : ""}`;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function uuidOrNull(value: string | undefined) {
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function parseTagIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((tag) => {
    if (!tag || typeof tag !== "object" || Array.isArray(tag)) return [];
    const id = (tag as Record<string, unknown>).id;
    return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? [id] : [];
  });
}

function dateBoundary(value: string | undefined, includeWholeDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (includeWholeDay) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function processingExplanation(processing: ProcessingSummary) {
  if (processing.status === "queued") return "De job wacht op een beschikbare mediaworker. De video kan nog niet worden gepubliceerd.";
  if (processing.status === "processing") return "De worker controleert de echte container en maakt een geverifieerde playervariant.";
  if (processing.status === "completed") return "De bron en playervariant zijn geverifieerd; de media kan in conceptplaylists worden gebruikt.";
  const cause = {
    command_failed: "De worker kon FFmpeg tijdelijk niet uitvoeren.",
    normalization_failed: "De video kon niet naar het playercontract worden genormaliseerd.",
    processing_timeout: "De video kon niet binnen één minuut veilig worden verwerkt. Lever bij voorkeur H.264/AAC tot 1080p30 aan.",
    player_upload_failed: "De geverifieerde variant kon niet naar private opslag worden geschreven.",
    player_upload_timeout: "Het opslaan van de playervariant duurde langer dan acht seconden.",
    source_download_failed: "De worker kon de bron tijdelijk niet ophalen.",
    source_download_timeout: "Het ophalen van de bron duurde langer dan acht seconden."
  }[processing.errorCode ?? ""] ?? "De verwerking is veilig gestopt voordat de media beschikbaar werd.";
  return `${cause} Probeer alleen een tijdelijke fout opnieuw; lever een item in quarantaine als nieuw bestand aan.`;
}

function activityLabel(action: string) {
  return {
    "media.processing.retried": "Verwerking opnieuw gestart",
    "media.upload.cancelled": "Upload geannuleerd",
    "media.upload.intent_created": "Upload voorbereid",
    "media.upload.quarantined": "Media in quarantaine geplaatst"
  }[action] ?? "Media bijgewerkt";
}

function mediaHref(
  current: Awaited<MediaPageProps["searchParams"]>,
  changes: Partial<Awaited<MediaPageProps["searchParams"]>>
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...changes })) {
    if (value && !["all", "list"].includes(value)) next.set(key, value);
  }
  const query = next.toString();
  return query ? `/dashboard/media?${query}` : "/dashboard/media";
}
