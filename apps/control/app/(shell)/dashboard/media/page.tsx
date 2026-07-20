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
import { VideoUploadForm } from "./video-upload-form";

type MediaPageProps = {
  searchParams: Promise<{ asset?: string; fout?: string; q?: string; status?: string; succes?: string; type?: string }>;
};

type MediaAsset = {
  checksumSha256: string | null;
  createdAt: string;
  fileName: string;
  fileSizeBytes: number;
  id: string;
  kind: "image" | "video";
  mimeType: string;
  previewUrl: string | null;
  status: string;
  storagePath: string;
  title: string;
  usageCount: number;
  validationError: string | null;
};

const demoAssets: MediaAsset[] = [
  {
    checksumSha256: "8c40de5d3f6ca3d66317b1e6bf15bcd29acf2c93eef20482ac6a0f780677e304",
    createdAt: "2026-07-16T12:00:00.000Z",
    fileName: "zomerroute.webp",
    fileSizeBytes: 430080,
    id: "demo-ready",
    kind: "image",
    mimeType: "image/webp",
    previewUrl: null,
    status: "ready",
    storagePath: "tenants/.../assets/.../original/zomerroute.webp",
    title: "Zomerroute poster",
    usageCount: 2,
    validationError: null
  },
  {
    checksumSha256: null,
    createdAt: "2026-07-16T11:00:00.000Z",
    fileName: "welkom-loop.mp4",
    fileSizeBytes: 65011712,
    id: "demo-processing",
    kind: "video",
    mimeType: "video/mp4",
    previewUrl: null,
    status: "processing",
    storagePath: "tenants/.../assets/.../original/welkom-loop.mp4",
    title: "Welkom loop",
    usageCount: 0,
    validationError: null
  },
  {
    checksumSha256: null,
    createdAt: "2026-07-16T10:00:00.000Z",
    fileName: "sponsor-logo.svg",
    fileSizeBytes: 18342,
    id: "demo-failed",
    kind: "image",
    mimeType: "image/svg+xml",
    previewUrl: null,
    status: "validation_failed",
    storagePath: "Geen opslagobject aangemaakt",
    title: "Sponsorlogo",
    usageCount: 0,
    validationError: "unsupported_media_type"
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
    detail: "Afbeeldingen krijgen magic-bytecontrole; video gaat met een tijdelijke signed upload rechtstreeks naar private tenantopslag.",
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
  const { assets, loadError } = await loadMediaData(session.tenantId, session.isLive);
  const canUpload =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.roles, "tenant.media.write");
  const query = (params.q ?? "").trim().toLocaleLowerCase("nl-NL");
  const visibleAssets = assets.filter((asset) =>
    (!query || `${asset.title} ${asset.fileName}`.toLocaleLowerCase("nl-NL").includes(query))
    && (!params.type || params.type === "all" || asset.kind === params.type)
    && (!params.status || params.status === "all" || asset.status === params.status)
  );
  const readyCount = assets.filter((asset) => asset.status === "ready").length;
  const processingAssets = assets.filter((asset) =>
    ["uploading", "uploaded", "processing"].includes(asset.status)
  );
  const failedCount = assets.filter((asset) => asset.status === "validation_failed").length;
  const selectedAsset = assets.find((asset) => asset.id === params.asset) ?? visibleAssets[0] ?? null;

  return (
    <>
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
          detail="Geverifieerd en beschikbaar voor playlists."
          label="Gereed"
          tone="success"
          value={String(readyCount)}
        />
        <MetricCard
          detail="Nog niet beschikbaar voor publicatie."
          label="In verwerking"
          tone="warning"
          value={String(processingAssets.length)}
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
            <option value="all">Alle statussen</option><option value="ready">Gereed</option><option value="processing">Verwerken</option><option value="validation_failed">Validatie mislukt</option>
          </select>
          <button className="button-link button-link--secondary" type="submit">Filteren</button>
        </div>
        <p className="resource-toolbar__summary">{visibleAssets.length} van {assets.length} zichtbaar</p>
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
            <StatusPill label={`${assets.length} items`} tone="neutral" />
          </div>
          {visibleAssets.length > 0 ? (
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
                        {asset.usageCount === 1 ? "1 playlistitem" : `${asset.usageCount} playlistitems`}
                      </td>
                      <td data-label="Toegevoegd">{formatDate(asset.createdAt)}</td>
                      <td data-label="Actie"><Link className="table-action" href={`/dashboard/media?asset=${asset.id}`}>Openen</Link></td>
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
                  <div><dt>Checksum</dt><dd>{shortChecksum(selectedAsset.checksumSha256)}</dd></div>
                  <div><dt>Validatie</dt><dd>{validationSummary(selectedAsset.validationError)}</dd></div>
                  <div><dt>Opslagpad</dt><dd>{selectedAsset.storagePath}</dd></div>
                </dl>
                <form action={renameMediaAsset} className="playlist-form">
                  <input name="assetId" type="hidden" value={selectedAsset.id} />
                  <div className="field"><label htmlFor="media-rename-title">Mediatitel</label><input defaultValue={selectedAsset.title} disabled={!canUpload} id="media-rename-title" maxLength={120} minLength={2} name="title" required type="text" /></div>
                  <button className="button-link button-link--secondary" disabled={!canUpload} type="submit">Titel opslaan</button>
                </form>
                {selectedAsset.kind === "video" && selectedAsset.status === "validation_failed" ? <form action={retryMediaProcessing}><input name="assetId" type="hidden" value={selectedAsset.id} /><button className="button-link button-link--secondary" disabled={!canUpload} type="submit">Verwerking opnieuw proberen</button></form> : null}
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
                <p className="work-panel__meta">Media wordt pas na volledige verificatie gereed.</p>
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
              <p className="work-panel__meta">MP4 · maximaal 500 MB en vijf minuten na inhoudscontrole.</p>
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

async function loadMediaData(tenantId: string | null, isLive: boolean) {
  if (!isLive) {
    return { assets: demoAssets, loadError: null };
  }

  if (!tenantId) {
    return {
      assets: [],
      loadError: "Er is geen actieve tenant. Kies een tenant en laad de pagina opnieuw."
    };
  }

  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return {
      assets: [],
      loadError: "De beveiligde datasessie ontbreekt. Log opnieuw in en probeer het daarna nogmaals."
    };
  }

  const [assetResult, usageResult, variantResult] = await Promise.all([
    supabase
      .from("media_assets")
      .select("id, title, original_file_name, kind, mime_type, status, storage_path, file_size_bytes, checksum_sha256, validation_error, created_at")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("playlist_items").select("media_asset_id").eq("tenant_id", tenantId),
    supabase.from("media_variants").select("asset_id, variant_type, storage_path").eq("tenant_id", tenantId)
  ]);

  if (assetResult.error || usageResult.error || variantResult.error) {
    console.error("Mediabibliotheek laden mislukt", assetResult.error ?? usageResult.error ?? variantResult.error);
    return {
      assets: [],
      loadError: "Tenantmedia kon niet worden gelezen. Er is niets gewijzigd; vernieuw de pagina of log opnieuw in."
    };
  }

  const usageCounts = new Map<string, number>();
  for (const item of usageResult.data ?? []) {
    usageCounts.set(item.media_asset_id, (usageCounts.get(item.media_asset_id) ?? 0) + 1);
  }

  const previewPaths = new Map<string, string>();
  for (const variant of variantResult.data ?? []) {
    const asset = (assetResult.data ?? []).find((candidate) => candidate.id === variant.asset_id);
    const preferredType = asset?.kind === "video" ? "player_1080p" : "original";
    if (variant.variant_type === preferredType) previewPaths.set(variant.asset_id, variant.storage_path);
  }

  const signedPreviews = new Map<string, string>();
  await Promise.all([...previewPaths.entries()].map(async ([assetId, path]) => {
    const { data, error } = await supabase.storage.from("tenant-media").createSignedUrl(path, 600);
    if (!error && data?.signedUrl) signedPreviews.set(assetId, data.signedUrl);
  }));

  const assets: MediaAsset[] = (assetResult.data ?? []).map((asset) => ({
    checksumSha256: asset.checksum_sha256,
    createdAt: asset.created_at,
    fileName: asset.original_file_name,
    fileSizeBytes: Number(asset.file_size_bytes),
    id: asset.id,
    kind: asset.kind as MediaAsset["kind"],
    mimeType: asset.mime_type,
    previewUrl: signedPreviews.get(asset.id) ?? null,
    status: asset.status,
    storagePath: asset.storage_path,
    title: asset.title,
    usageCount: usageCounts.get(asset.id) ?? 0,
    validationError: asset.validation_error
  }));

  return { assets, loadError: null };
}

function MediaType({ kind, status }: Pick<MediaAsset, "kind" | "status">) {
  if (status === "validation_failed") {
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
  const tone = status === "ready" ? "success" : status === "validation_failed" ? "critical" : "warning";
  return <StatusPill label={statusLabel(status)} tone={tone} />;
}

function statusLabel(status: string) {
  return {
    processing: "Verwerken",
    ready: "Gereed",
    uploaded: "Geüpload",
    uploading: "Uploaden",
    validation_failed: "Validatie mislukt"
  }[status] ?? status;
}

function mediaDetails(asset: MediaAsset) {
  return `${asset.mimeType.replace("image/", "").toUpperCase()} · ${formatBytes(asset.fileSizeBytes)}`;
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
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
    variant_registration_failed: "Variantregistratie mislukt"
  }[value] ?? "Validatie mislukt";
}
