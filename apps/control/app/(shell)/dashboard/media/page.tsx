/* eslint-disable @next/next/no-img-element */
import { FileWarning, Image as ImageIcon, Video } from "lucide-react";
import Link from "next/link";

import { hasCapability } from "@veyocast/auth";

import { requireControlSession } from "../../../../lib/control-session";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import {
  HealthList,
  MetricCard,
  PageHeader,
  StatusPill,
  Timeline
} from "../../_components/shell-primitives";
import {
  archiveMediaAsset,
  renameMediaAsset,
  retryMediaProcessing,
  uploadMediaImage
} from "./actions";
import { ProcessingStatusRefresh } from "./processing-status-refresh";
import { VideoUploadForm } from "./video-upload-form";

type MediaPageProps = {
  searchParams: Promise<{
    asset?: string;
    fout?: string;
    from?: string;
    page?: string;
    q?: string;
    status?: string;
    succes?: string;
    type?: string;
    to?: string;
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
  height: number | null;
  id: string;
  kind: "image" | "video";
  mimeType: string;
  previewUrl: string | null;
  releaseCount: number;
  screenCount: number;
  status: string;
  storagePath: string;
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
  checksum_sha256: string | null;
  created_at: string;
  draft_count: number | string;
  duration_seconds: number | string | null;
  file_size_bytes: number | string;
  id: string;
  height: number | null;
  kind: "image" | "video";
  mime_type: string;
  original_file_name: string;
  release_count: number | string;
  screen_count: number | string;
  status: string;
  storage_path: string;
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

type ProcessingSummary = {
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  status: string;
};

type ProcessingQueueItem = {
  fileName: string;
  id: string;
  status: string;
  title: string;
};

const demoAssets: MediaAsset[] = [
  {
    checksumSha256: "8c40de5d3f6ca3d66317b1e6bf15bcd29acf2c93eef20482ac6a0f780677e304",
    createdAt: "2026-07-16T12:00:00.000Z",
    draftCount: 2,
    fileName: "zomerroute.webp",
    fileSizeBytes: 430080,
    height: 1080,
    id: "demo-ready",
    kind: "image",
    mimeType: "image/webp",
    previewUrl: null,
    releaseCount: 1,
    screenCount: 1,
    status: "ready",
    storagePath: "tenants/.../assets/.../original/zomerroute.webp",
    title: "Zomerroute poster",
    usageCount: 2,
    validationError: null,
    width: 1920,
    durationSeconds: null
  },
  {
    checksumSha256: null,
    createdAt: "2026-07-16T11:00:00.000Z",
    draftCount: 0,
    fileName: "welkom-loop.mp4",
    fileSizeBytes: 65011712,
    height: null,
    id: "demo-processing",
    kind: "video",
    mimeType: "video/mp4",
    previewUrl: null,
    releaseCount: 0,
    screenCount: 0,
    status: "processing",
    storagePath: "tenants/.../assets/.../original/welkom-loop.mp4",
    title: "Welkom loop",
    usageCount: 0,
    validationError: null,
    width: null,
    durationSeconds: null
  },
  {
    checksumSha256: null,
    createdAt: "2026-07-16T10:00:00.000Z",
    draftCount: 0,
    fileName: "sponsor-logo.svg",
    fileSizeBytes: 18342,
    height: null,
    id: "demo-failed",
    kind: "image",
    mimeType: "image/svg+xml",
    previewUrl: null,
    releaseCount: 0,
    screenCount: 0,
    status: "validation_failed",
    storagePath: "Geen opslagobject aangemaakt",
    title: "Sponsorlogo",
    usageCount: 0,
    validationError: "unsupported_media_type",
    width: null,
    durationSeconds: null
  }
];

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
    loadError,
    mediaStorageLimitBytes,
    mediaStorageUsedBytes,
    processingCount,
    processingQueue,
    processingSummary,
    readyCount,
    selectedUsage,
    totalCount
  } = await loadMediaData(session.tenantId, session.isLive, params, page);
  const canUpload =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.roles, "tenant.media.write");
  const visibleAssets = assets;
  const processingAssets = processingQueue;
  const selectedAsset = assets.find((asset) => asset.id === params.asset) ?? visibleAssets[0] ?? null;
  const pageCount = Math.max(1, Math.ceil(totalCount / 20));

  return (
    <>
      {session.isLive && processingCount > 0 ? <ProcessingStatusRefresh /> : null}
      <PageHeader
        actions={canUpload ? (
          <a className="button-link button-link--primary" href="#upload">
            Media uploaden
          </a>
        ) : null}
        description="Upload gevalideerde afbeeldingen en video's en beheer tenantgebonden media voordat die in een playlist beschikbaar komt."
        eyebrow={session.tenant}
        status={{
          label: session.isLive ? "Live tenantdata" : "Demomodus",
          tone: session.isLive ? "success" : "warning"
        }}
        title="Media"
      />

      {fout ? (
        <p className="notice notice--critical" role="alert">
          <strong>Upload mislukt.</strong> {fout}
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

      <section className="metric-grid" aria-label="Mediastatussen">
        <MetricCard
          detail={`Geverifieerd · ${formatBytes(mediaStorageUsedBytes)} van ${formatBytes(mediaStorageLimitBytes)} gereserveerd.`}
          label="Gereed"
          tone="success"
          value={String(readyCount)}
        />
        <MetricCard
          detail="Nog niet beschikbaar voor publicatie."
          label="In verwerking"
          tone="warning"
          value={String(processingCount)}
        />
        <MetricCard
          detail="Afgewezen; herstelactie is nodig."
          label="Validatie mislukt"
          tone="critical"
          value={String(failedCount)}
        />
      </section>

      <form className="resource-toolbar" method="get" role="search">
        <div className="resource-toolbar__group">
          <input aria-label="Zoeken in media" className="toolbar-search" defaultValue={params.q} name="q" placeholder="Zoeken op titel of bestandsnaam" type="search" />
          <select aria-label="Filter media op type" className="toolbar-select" defaultValue={params.type ?? "all"} name="type">
            <option value="all">Alle typen</option><option value="image">Afbeeldingen</option><option value="video">Video's</option>
          </select>
          <select aria-label="Filter media op status" className="toolbar-select" defaultValue={params.status ?? "all"} name="status">
            <option value="all">Alle statussen</option><option value="uploading">Uploaden</option><option value="processing">Verwerken</option><option value="ready">Gereed</option><option value="validation_failed">Validatie mislukt</option><option value="quarantined">In quarantaine</option>
          </select>
          <select aria-label="Filter media op gebruik" className="toolbar-select" defaultValue={params.usage ?? "all"} name="usage">
            <option value="all">Elk gebruik</option><option value="used">In gebruik</option><option value="unused">Niet in gebruik</option>
          </select>
          <label className="toolbar-date"><span>Vanaf</span><input defaultValue={params.from} name="from" type="date" /></label>
          <label className="toolbar-date"><span>Tot en met</span><input defaultValue={params.to} name="to" type="date" /></label>
          <input name="view" type="hidden" value={params.view === "grid" ? "grid" : "list"} />
          <button className="button-link button-link--secondary" type="submit">Filteren</button>
        </div>
        <div className="resource-toolbar__group">
          <Link aria-current={params.view !== "grid" ? "page" : undefined} className="button-link button-link--secondary" href={mediaHref(params, { page: "1", view: "list" })}>Lijst</Link>
          <Link aria-current={params.view === "grid" ? "page" : undefined} className="button-link button-link--secondary" href={mediaHref(params, { page: "1", view: "grid" })}>Raster</Link>
          <p className="resource-toolbar__summary">{visibleAssets.length} van {totalCount} zichtbaar</p>
        </div>
      </form>

      <section className="resource-workspace">
        <section className="workspace-section" aria-labelledby="media-library-title">
          <div className="workspace-section__header">
            <div>
              <h2 className="workspace-section__title" id="media-library-title">
                Mediabibliotheek
              </h2>
              <p className="work-panel__meta">Private bucket: tenant-media</p>
            </div>
            <StatusPill label={`${totalCount} items`} tone="neutral" />
          </div>
          {visibleAssets.length > 0 && params.view === "grid" ? (
            <div className="media-library-grid">
              {visibleAssets.map((asset) => (
                <article className="media-library-card" key={asset.id}>
                  <MediaPreview asset={asset} />
                  <div className="media-library-card__body">
                    <div className="work-panel__header"><div><h3>{asset.title}</h3><p className="work-panel__meta">{asset.fileName}</p></div><MediaStatus status={asset.status} /></div>
                    <p className="work-panel__meta">{mediaDetails(asset)} · {usageSummary(asset)}</p>
                    <Link className="table-action" href={mediaHref(params, { asset: asset.id })}>Openen</Link>
                  </div>
                </article>
              ))}
            </div>
          ) : visibleAssets.length > 0 ? (
            <div className="data-table-frame">
              <table className="data-table data-table--responsive">
                <caption>Media binnen de actieve vereniging.</caption>
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Media</th>
                    <th scope="col">Details</th>
                    <th scope="col">Status</th>
                    <th scope="col">Gebruik</th>
                    <th scope="col">Toegevoegd</th>
                    <th scope="col">Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td data-label="Type">
                        <MediaType kind={asset.kind} status={asset.status} />
                      </td>
                      <td data-label="Media">
                        <span className="table-primary">{asset.title}</span>
                        <span className="table-secondary">{asset.fileName}</span>
                      </td>
                      <td data-label="Details">{mediaDetails(asset)}</td>
                      <td data-label="Status">
                        <MediaStatus status={asset.status} />
                      </td>
                      <td data-label="Gebruik">
                        {usageSummary(asset)}
                      </td>
                      <td data-label="Toegevoegd">{formatDate(asset.createdAt)}</td>
                      <td data-label="Actie"><Link className="table-action" href={mediaHref(params, { asset: asset.id })}>Openen</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="notice" role="status">
              Er staat nog geen media in deze tenant. Upload een afbeelding of video om de bibliotheek te vullen.
            </p>
          )}
          {totalCount > 20 ? (
            <nav aria-label="Paginering mediabibliotheek" className="pagination">
              <Link aria-disabled={page <= 1} className="button-link button-link--secondary" href={mediaHref(params, { page: String(Math.max(1, page - 1)) })}>Vorige</Link>
              <span>Pagina {Math.min(page, pageCount)} van {pageCount}</span>
              <Link aria-disabled={page >= pageCount} className="button-link button-link--secondary" href={mediaHref(params, { page: String(Math.min(pageCount, page + 1)) })}>Volgende</Link>
            </nav>
          ) : null}
        </section>

        <aside className="workspace-aside" aria-label="Media-inspector en uploadqueue">
          <section className="inspector-panel" aria-labelledby="media-inspector-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="media-inspector-title">
                  Media-inspector
                </h2>
                <p className="work-panel__meta">Meest recent toegevoegd</p>
              </div>
              {selectedAsset ? <MediaStatus status={selectedAsset.status} /> : null}
            </div>
            {selectedAsset ? (
              <>
                <MediaPreview asset={selectedAsset} />
                <dl className="meta-list">
                  <div><dt>Titel</dt><dd>{selectedAsset.title}</dd></div>
                  <div><dt>Bestand</dt><dd>{selectedAsset.fileName}</dd></div>
                  <div><dt>Afmetingen</dt><dd>{selectedAsset.width && selectedAsset.height ? `${selectedAsset.width} × ${selectedAsset.height}` : "Na verwerking beschikbaar"}</dd></div>
                  <div><dt>Duur</dt><dd>{selectedAsset.durationSeconds ? `${selectedAsset.durationSeconds.toFixed(1)} seconden` : "Niet van toepassing of nog onbekend"}</dd></div>
                  <div><dt>Checksum</dt><dd>{shortChecksum(selectedAsset.checksumSha256)}</dd></div>
                  <div><dt>Validatie</dt><dd>{validationSummary(selectedAsset.validationError)}</dd></div>
                  <div><dt>Opslagpad</dt><dd>{selectedAsset.storagePath}</dd></div>
                </dl>
                <section aria-labelledby="media-usage-title" className="media-usage">
                  <div className="work-panel__header">
                    <div><h3 id="media-usage-title">Gebruik en impact</h3><p className="work-panel__meta">Concept → release → scherm</p></div>
                    <StatusPill label={usageSummary(selectedAsset)} tone={selectedAsset.usageCount > 0 ? "warning" : "neutral"} />
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
                  ) : <p className="work-panel__meta">Niet gebruikt in concepten, releases of schermtoewijzingen.</p>}
                </section>
                {processingSummary ? (
                  <section className="media-usage" aria-labelledby="media-processing-title">
                    <div className="work-panel__header"><div><h3 id="media-processing-title">Verwerking</h3><p className="work-panel__meta">{processingSummary.attempts} poging{processingSummary.attempts === 1 ? "" : "en"}</p></div><StatusPill label={statusLabel(processingSummary.status)} tone={processingSummary.status === "failed" ? "critical" : "info"} /></div>
                    <p className="work-panel__meta">{processingExplanation(processingSummary)}</p>
                  </section>
                ) : null}
                {activity.length > 0 ? (
                  <section className="media-usage" aria-labelledby="media-activity-title">
                    <div className="work-panel__header"><div><h3 id="media-activity-title">Activiteit</h3><p className="work-panel__meta">Controleerbare servergebeurtenissen</p></div></div>
                    <ul className="media-usage__list">{activity.map((event) => <li key={`${event.createdAt}-${event.action}`}><strong>{activityLabel(event.action)}</strong><span>{formatDateTime(event.createdAt)} · {event.result === "success" ? "Geslaagd" : "Niet geslaagd"}</span></li>)}</ul>
                  </section>
                ) : null}
                <form action={renameMediaAsset} className="playlist-form">
                  <input name="assetId" type="hidden" value={selectedAsset.id} />
                  <div className="field"><label htmlFor="media-rename-title">Mediatitel</label><input defaultValue={selectedAsset.title} disabled={!canUpload} id="media-rename-title" maxLength={120} minLength={2} name="title" required type="text" /></div>
                  <button className="button-link button-link--secondary" disabled={!canUpload} type="submit">Titel opslaan</button>
                </form>
                {selectedAsset.kind === "video" && selectedAsset.status === "validation_failed" ? <form action={retryMediaProcessing}><input name="assetId" type="hidden" value={selectedAsset.id} /><button className="button-link button-link--secondary" disabled={!canUpload} type="submit">Verwerking opnieuw proberen</button><p className="work-panel__meta">Een tijdelijke workerfout kan opnieuw worden verwerkt. Een inhoudelijk onveilig bestand gaat in quarantaine en moet opnieuw worden aangeleverd.</p></form> : null}
                <form action={archiveMediaAsset}>
                  <input name="assetId" type="hidden" value={selectedAsset.id} />
                  <button className="button-link button-link--secondary" disabled={!canUpload || selectedAsset.usageCount > 0} type="submit">Media archiveren</button>
                  {selectedAsset.usageCount > 0 ? <p className="work-panel__meta">Verwijder deze media eerst uit alle conceptplaylists. Gepubliceerde releases blijven altijd intact.</p> : null}
                </form>
              </>
            ) : (
              <p className="notice">Na de eerste upload toont VeyoCast hier de controleerbare metadata.</p>
            )}
          </section>

          <section className="data-surface" aria-labelledby="upload-queue-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="upload-queue-title">
                  Uploadqueue
                </h2>
                <p className="work-panel__meta">Automatische statusupdate · media wordt pas na volledige verificatie gereed.</p>
              </div>
              <StatusPill label={`${processingAssets.length} items`} tone="info" />
            </div>
            {processingAssets.length > 0 ? (
              <HealthList
                ariaLabel="Uploadqueue"
                items={processingAssets.map((asset) => ({
                  detail: asset.fileName,
                  label: asset.title,
                  status: statusLabel(asset.status),
                  tone: "warning" as const
                }))}
              />
            ) : (
              <p className="notice" role="status">Geen uploads in verwerking.</p>
            )}
          </section>
        </aside>
      </section>

      <section className="work-grid">
        <section className="data-surface" aria-labelledby="pipeline-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="pipeline-title">Pipeline voortgang</h2>
              <p className="work-panel__meta">Van gebruikersbestand naar geverifieerde variant.</p>
            </div>
            <StatusPill label="Server-side" tone="success" />
          </div>
          <Timeline ariaLabel="Media pipeline stappen" items={pipelineSteps} />
        </section>

        <section className="data-surface" id="upload" aria-labelledby="upload-intake-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="upload-intake-title">Afbeelding uploaden</h2>
              <p className="work-panel__meta">JPEG, PNG of WebP · maximaal 20 MB.</p>
            </div>
            <StatusPill
              label={canUpload ? "Editor actief" : session.isLive ? "Alleen bekijken" : "Demo"}
              tone={canUpload ? "success" : "warning"}
            />
          </div>
          <form action={uploadMediaImage} className="upload-form">
            <div className="field">
              <label htmlFor="media-title">Titel</label>
              <input
                disabled={!canUpload}
                id="media-title"
                minLength={2}
                name="title"
                placeholder="Bijvoorbeeld zomerroute poster"
                required
                type="text"
              />
            </div>
            <div className="field">
              <label htmlFor="media-file">Bestand</label>
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={!canUpload}
                id="media-file"
                name="media"
                required
                type="file"
              />
            </div>
            <button className="button-link button-link--primary" disabled={!canUpload} type="submit">
              Uploaden en verifiëren
            </button>
            {!canUpload && session.isLive ? (
              <p className="notice notice--warning" role="status">
                Uploaden vereist editor- of beheerrechten. Vraag een tenantbeheerder om toegang.
              </p>
            ) : null}
          </form>
        </section>

        <section className="data-surface" aria-labelledby="video-upload-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="video-upload-title">Video uploaden</h2>
              <p className="work-panel__meta">MP4 · één bestand per overdracht · maximaal 500 MB, vijf minuten en vijf openstaande intents.</p>
            </div>
            <StatusPill
              label={canUpload ? "Direct naar opslag" : session.isLive ? "Alleen bekijken" : "Demo"}
              tone={canUpload ? "success" : "warning"}
            />
          </div>
          <VideoUploadForm
            anonKey={publicConfig?.anonKey ?? ""}
            canUpload={canUpload && publicConfig !== null}
            supabaseUrl={publicConfig?.url ?? ""}
          />
        </section>
      </section>

      <section className="work-panel" aria-labelledby="media-risk-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="media-risk-title">Verwerkingsregels</h2>
            <p className="work-panel__meta">Grenzen van de huidige veilige upload- en verwerkingsroutes.</p>
          </div>
          <StatusPill label="3 regels" tone="warning" />
        </div>
        <HealthList ariaLabel="Media validatierisico's" items={mediaRules} />
      </section>
    </>
  );
}

async function loadMediaData(
  tenantId: string | null,
  isLive: boolean,
  params: Awaited<MediaPageProps["searchParams"]>,
  page: number
) {
  if (!isLive) {
    return {
      activity: [{ action: "media.upload.intent_created", createdAt: demoAssets[0]!.createdAt, result: "success" }] satisfies MediaActivity[],
      assets: demoAssets,
      failedCount: 1,
      loadError: null,
      mediaStorageLimitBytes: 10 * 1024 * 1024 * 1024,
      mediaStorageUsedBytes: demoAssets.reduce((total, asset) => total + asset.fileSizeBytes, 0),
      processingCount: 1,
      processingQueue: demoAssets.filter((asset) => ["uploading", "processing"].includes(asset.status)) satisfies ProcessingQueueItem[],
      processingSummary: null as ProcessingSummary | null,
      readyCount: 1,
      selectedUsage: [
        { playlistId: "demo-playlist", releaseVersion: null, resourceId: "demo-playlist", resourceName: "Museumroute", screenCount: 0, usageType: "draft" },
        { playlistId: "demo-playlist", releaseVersion: 3, resourceId: "demo-release", resourceName: "Museumroute", screenCount: 1, usageType: "release" },
        { playlistId: "demo-playlist", releaseVersion: 3, resourceId: "demo-screen", resourceName: "Entree", screenCount: 1, usageType: "screen" }
      ] satisfies MediaUsage[],
      totalCount: demoAssets.length
    };
  }

  if (!tenantId) {
    return {
      activity: [] as MediaActivity[],
      assets: [],
      failedCount: 0,
      loadError: "Er is geen actieve tenant. Kies een tenant en laad de pagina opnieuw.",
      mediaStorageLimitBytes: 0,
      mediaStorageUsedBytes: 0,
      processingCount: 0,
      processingQueue: [] as ProcessingQueueItem[],
      processingSummary: null as ProcessingSummary | null,
      readyCount: 0,
      selectedUsage: [] as MediaUsage[],
      totalCount: 0
    };
  }

  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return {
      activity: [] as MediaActivity[],
      assets: [],
      failedCount: 0,
      loadError: "De beveiligde datasessie ontbreekt. Log opnieuw in en probeer het daarna nogmaals.",
      mediaStorageLimitBytes: 0,
      mediaStorageUsedBytes: 0,
      processingCount: 0,
      processingQueue: [] as ProcessingQueueItem[],
      processingSummary: null as ProcessingSummary | null,
      readyCount: 0,
      selectedUsage: [] as MediaUsage[],
      totalCount: 0
    };
  }

  const kind = params.type === "image" || params.type === "video" ? params.type : null;
  const allowedStatuses = ["uploading", "processing", "ready", "validation_failed", "quarantined"];
  const status = params.status && allowedStatuses.includes(params.status) ? params.status : null;
  const usage = params.usage === "used" || params.usage === "unused" ? params.usage : "all";

  const [assetResult, readyResult, processingResult, failedResult, storageResult, queueResult] = await Promise.all([
    supabase.rpc("list_media_assets", {
      p_created_from: dateBoundary(params.from, false),
      p_created_until: dateBoundary(params.to, true),
      p_kind: kind,
      p_page: page,
      p_page_size: 20,
      p_query: params.q?.trim() || null,
      p_status: status,
      p_tenant_id: tenantId,
      p_usage: usage
    }),
    supabase.from("media_assets").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "ready").is("deleted_at", null),
    supabase.from("media_assets").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["uploading", "processing"]).is("deleted_at", null),
    supabase.from("media_assets").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["validation_failed", "quarantined"]).is("deleted_at", null),
    supabase.rpc("get_media_storage_usage", { p_tenant_id: tenantId }),
    supabase.from("media_assets").select("id, title, original_file_name, status").eq("tenant_id", tenantId).in("status", ["uploading", "processing"]).is("deleted_at", null).order("created_at", { ascending: false }).limit(10)
  ]);

  if (assetResult.error || readyResult.error || processingResult.error || failedResult.error || storageResult.error || queueResult.error) {
    console.error("Mediabibliotheek laden mislukt", assetResult.error ?? readyResult.error ?? processingResult.error ?? failedResult.error ?? storageResult.error ?? queueResult.error);
    return {
      activity: [] as MediaActivity[],
      assets: [],
      failedCount: 0,
      loadError: "Tenantmedia kon niet worden gelezen. Er is niets gewijzigd; vernieuw de pagina of log opnieuw in.",
      mediaStorageLimitBytes: 0,
      mediaStorageUsedBytes: 0,
      processingCount: 0,
      processingQueue: [] as ProcessingQueueItem[],
      processingSummary: null as ProcessingSummary | null,
      readyCount: 0,
      selectedUsage: [] as MediaUsage[],
      totalCount: 0
    };
  }

  const rows = (assetResult.data ?? []) as MediaAssetRow[];
  const assetIds = rows.map((asset) => asset.id);
  const variantResult = assetIds.length > 0
    ? await supabase.from("media_variants").select("asset_id, variant_type, storage_path").eq("tenant_id", tenantId).in("asset_id", assetIds)
    : { data: [], error: null };
  if (variantResult.error) {
    console.error("Mediavoorbeelden laden mislukt", variantResult.error);
  }

  const previewPaths = new Map<string, string>();
  for (const variant of variantResult.data ?? []) {
    const asset = rows.find((candidate) => candidate.id === variant.asset_id);
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
    draftCount: Number(asset.draft_count),
    durationSeconds: asset.duration_seconds === null ? null : Number(asset.duration_seconds),
    fileName: asset.original_file_name,
    fileSizeBytes: Number(asset.file_size_bytes),
    height: asset.height,
    id: asset.id,
    kind: asset.kind as MediaAsset["kind"],
    mimeType: asset.mime_type,
    previewUrl: signedPreviews.get(asset.id) ?? null,
    releaseCount: Number(asset.release_count),
    screenCount: Number(asset.screen_count),
    status: asset.status,
    storagePath: asset.storage_path,
    title: asset.title,
    usageCount: Number(asset.draft_count),
    validationError: asset.validation_error,
    width: asset.width
  }));

  const selectedId = params.asset && assets.some((asset) => asset.id === params.asset)
    ? params.asset
    : assets[0]?.id;
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

  return {
    activity,
    assets,
    failedCount: failedResult.count ?? 0,
    loadError: variantResult.error ? "De bibliotheek is geladen, maar één of meer voorbeelden konden niet worden gemaakt." : null,
    mediaStorageLimitBytes: Number(storage?.limit_bytes ?? 0),
    mediaStorageUsedBytes: Number(storage?.used_bytes ?? 0),
    processingCount: processingResult.count ?? 0,
    processingQueue: (queueResult.data ?? []).map((item) => ({ fileName: item.original_file_name, id: item.id, status: item.status, title: item.title })),
    processingSummary,
    readyCount: readyResult.count ?? 0,
    selectedUsage,
    totalCount: Number(rows[0]?.total_count ?? 0)
  };
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

function MediaPreview({ asset }: { asset: MediaAsset }) {
  if (!asset.previewUrl) {
    return <div className="media-card__preview" data-kind={asset.kind}>{asset.status === "ready" ? "Voorbeeld niet beschikbaar" : statusLabel(asset.status)}</div>;
  }
  if (asset.kind === "video") {
    return <video className="media-inspector-preview" controls muted preload="metadata" src={asset.previewUrl}><track kind="captions" /></video>;
  }
  return <img alt={`Voorbeeld van ${asset.title}`} className="media-inspector-preview" src={asset.previewUrl} />;
}

function MediaStatus({ status }: { status: string }) {
  const tone = status === "ready" ? "success" : ["validation_failed", "quarantined"].includes(status) ? "critical" : "warning";
  return <StatusPill label={statusLabel(status)} tone={tone} />;
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
