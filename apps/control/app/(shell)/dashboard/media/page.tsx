import { FileWarning, Image as ImageIcon, Video } from "lucide-react";

import { requireControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import {
  HealthList,
  MetricCard,
  PageHeader,
  StatusPill,
  Timeline
} from "../../_components/shell-primitives";
import { uploadMediaImage } from "./actions";

type MediaPageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

type MediaAsset = {
  checksumSha256: string | null;
  createdAt: string;
  fileName: string;
  fileSizeBytes: number;
  id: string;
  kind: "image" | "video";
  mimeType: string;
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
    detail: "Magic bytes moeten overeenkomen met JPEG, PNG of WebP voordat private opslag wordt gebruikt.",
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
    detail: "MP4-validatie en transcodering zijn nog geen onderdeel van deze synchrone uploadroute.",
    label: "Video",
    status: "Nog nodig",
    tone: "warning"
  }
] as const;

export default async function MediaPage({ searchParams }: MediaPageProps) {
  const session = await requireControlSession();
  const { fout, succes } = await searchParams;
  const { assets, loadError } = await loadMediaData(session.tenantId, session.isLive);
  const canUpload =
    session.isLive &&
    session.roles.some((role) =>
      ["tenant_owner", "tenant_admin", "tenant_editor"].includes(role)
    );
  const readyCount = assets.filter((asset) => asset.status === "ready").length;
  const processingAssets = assets.filter((asset) =>
    ["uploading", "uploaded", "processing"].includes(asset.status)
  );
  const failedCount = assets.filter((asset) => asset.status === "validation_failed").length;
  const selectedAsset = assets[0] ?? null;

  return (
    <>
      <PageHeader
        actions={
          <a className="button-link button-link--primary" href="#upload">
            Media uploaden
          </a>
        }
        description="Upload gevalideerde afbeeldingen en beheer tenantgebonden media voordat die in een playlist beschikbaar komt."
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
          {assets.length > 0 ? (
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
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="notice" role="status">
              Er staat nog geen media in deze tenant. Upload een afbeelding om de bibliotheek te vullen.
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
                <div className="media-card__preview" data-kind={selectedAsset.kind}>
                  {selectedAsset.kind === "video" ? "Video" : "Afbeelding"}
                </div>
                <dl className="meta-list">
                  <div><dt>Titel</dt><dd>{selectedAsset.title}</dd></div>
                  <div><dt>Bestand</dt><dd>{selectedAsset.fileName}</dd></div>
                  <div><dt>Checksum</dt><dd>{shortChecksum(selectedAsset.checksumSha256)}</dd></div>
                  <div><dt>Validatie</dt><dd>{validationSummary(selectedAsset.validationError)}</dd></div>
                  <div><dt>Opslagpad</dt><dd>{selectedAsset.storagePath}</dd></div>
                </dl>
              </>
            ) : (
              <p className="notice">Na de eerste upload toont Castivo hier de controleerbare metadata.</p>
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
      </section>

      <section className="work-panel" aria-labelledby="media-risk-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="media-risk-title">Verwerkingsregels</h2>
            <p className="work-panel__meta">Grenzen van de huidige veilige uploadroute.</p>
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

  const [assetResult, usageResult] = await Promise.all([
    supabase
      .from("media_assets")
      .select("id, title, original_file_name, kind, mime_type, status, storage_path, file_size_bytes, checksum_sha256, validation_error, created_at")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("playlist_items").select("media_asset_id").eq("tenant_id", tenantId)
  ]);

  if (assetResult.error || usageResult.error) {
    console.error("Mediabibliotheek laden mislukt", assetResult.error ?? usageResult.error);
    return {
      assets: [],
      loadError: "Tenantmedia kon niet worden gelezen. Er is niets gewijzigd; vernieuw de pagina of log opnieuw in."
    };
  }

  const usageCounts = new Map<string, number>();
  for (const item of usageResult.data ?? []) {
    usageCounts.set(item.media_asset_id, (usageCounts.get(item.media_asset_id) ?? 0) + 1);
  }

  const assets: MediaAsset[] = (assetResult.data ?? []).map((asset) => ({
    checksumSha256: asset.checksum_sha256,
    createdAt: asset.created_at,
    fileName: asset.original_file_name,
    fileSizeBytes: Number(asset.file_size_bytes),
    id: asset.id,
    kind: asset.kind as MediaAsset["kind"],
    mimeType: asset.mime_type,
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
