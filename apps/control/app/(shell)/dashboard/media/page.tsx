import { FileWarning, Image as ImageIcon, Video } from "lucide-react";

import {
  HealthList,
  MetricCard,
  PageHeader,
  StatusPill,
  Timeline
} from "../../_components/shell-primitives";

const mediaMetrics = [
  {
    detail: "Beschikbaar voor playlists.",
    label: "Gereed",
    tone: "success",
    value: "38"
  },
  {
    detail: "Thumbnail of player-variant wordt gemaakt.",
    label: "In verwerking",
    tone: "warning",
    value: "4"
  },
  {
    detail: "Type, grootte of duur buiten de limiet.",
    label: "Validatie mislukt",
    tone: "critical",
    value: "2"
  }
] as const;

const mediaAssets = [
  {
    detail: "1920 x 1080 · 420 KB",
    fileName: "zomerroute.webp",
    kind: "Afbeelding",
    path: "tenants/.../assets/.../original/zomerroute.webp",
    status: "Gereed",
    title: "Zomerroute poster",
    tone: "success",
    usedIn: "2 playlists"
  },
  {
    detail: "MP4 · 1:48 · 62 MB",
    fileName: "welkom-loop.mp4",
    kind: "Video",
    path: "tenants/.../assets/.../original/welkom-loop.mp4",
    status: "Verwerken",
    title: "Welkom loop",
    tone: "warning",
    usedIn: "Nog niet gebruikt"
  },
  {
    detail: "SVG niet toegestaan in de MVP",
    fileName: "sponsor-logo.svg",
    kind: "Afgewezen",
    path: "Geen opslagobject aangemaakt",
    status: "Validatie mislukt",
    title: "Sponsorlogo",
    tone: "critical",
    usedIn: "Niet beschikbaar"
  }
] as const;

const queueRows = [
  {
    asset: "Nieuw posterbeeld",
    output: "Thumbnail maken",
    status: "In wachtrij",
    tone: "info"
  },
  {
    asset: "Welkom loop",
    output: "Video normaliseren",
    status: "Verwerken",
    tone: "warning"
  },
  {
    asset: "Sponsorlogo",
    output: "Bestandstype afwijzen",
    status: "Mislukt",
    tone: "critical"
  }
] as const;

const pipelineSteps = [
  {
    detail: "Na een rechten- en limietcontrole krijg je een tijdelijke uploadsessie.",
    label: "Upload voorbereiden",
    meta: "Server",
    tone: "info"
  },
  {
    detail: "Castivo controleert type, duur, metadata en een veilige extensie.",
    label: "Controleren",
    meta: "Actief",
    tone: "warning"
  },
  {
    detail: "Gereede media krijgt een checksum, thumbnail en player-variant.",
    label: "Player-variant",
    meta: "Gereed",
    tone: "success"
  }
] as const;

const mediaRisks = [
  {
    detail: "SVG blijft uitgeschakeld totdat sanitizing bewust is toegevoegd.",
    label: "Bestandstype",
    status: "Beleid",
    tone: "critical"
  },
  {
    detail: "MP4/H.264/AAC maximaal 500 MB en vijf minuten.",
    label: "Videolimiet",
    status: "Bewaakt",
    tone: "info"
  },
  {
    detail: "Gepubliceerde assets worden nooit stilzwijgend vervangen.",
    label: "Release-impact",
    status: "Immutable",
    tone: "success"
  }
] as const;

export default function MediaPage() {
  const selectedAsset = mediaAssets[0];

  return (
    <>
      <PageHeader
        actions={
          <button className="button-link button-link--primary" disabled type="button">
            Media uploaden
          </button>
        }
        description="Beheer afbeeldingen en video’s voordat ze in een playlist kunnen worden gebruikt. Uploads blijven tenantgebonden en worden eerst verwerkt."
        eyebrow="Museumkwartier"
        status={{ label: "Alleen editor kan uploaden", tone: "info" }}
        title="Media"
      />

      <section className="metric-grid" aria-label="Mediastatussen">
        {mediaMetrics.map((metric) => (
          <MetricCard
            detail={metric.detail}
            key={metric.label}
            label={metric.label}
            tone={metric.tone}
            value={metric.value}
          />
        ))}
      </section>

      <section className="resource-toolbar" aria-label="Mediabibliotheek bedienen">
        <div className="resource-toolbar__group">
          <input
            aria-label="Zoeken in media"
            className="toolbar-search"
            name="media-search"
            placeholder="Zoeken op titel of bestandsnaam"
            type="search"
          />
          <select aria-label="Filter media op status" className="toolbar-select" defaultValue="all">
            <option value="all">Alle statussen</option>
            <option value="ready">Gereed</option>
            <option value="processing">In verwerking</option>
            <option value="failed">Validatie mislukt</option>
          </select>
        </div>
        <p className="resource-toolbar__summary">44 media-items · sortering: laatst gewijzigd</p>
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
            <StatusPill label="44 items" tone="neutral" />
          </div>
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
                  <th scope="col">Actie</th>
                </tr>
              </thead>
              <tbody>
                {mediaAssets.map((asset) => (
                  <tr key={asset.fileName}>
                    <td data-label="Type">
                      <MediaType kind={asset.kind} />
                    </td>
                    <td data-label="Media">
                      <span className="table-primary">{asset.title}</span>
                      <span className="table-secondary">{asset.fileName}</span>
                    </td>
                    <td data-label="Details">{asset.detail}</td>
                    <td data-label="Status">
                      <StatusPill label={asset.status} tone={asset.tone} />
                    </td>
                    <td data-label="Gebruik">{asset.usedIn}</td>
                    <td data-label="Actie">
                      <button className="table-action" type="button">
                        Inspecteren
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="workspace-aside" aria-label="Media-inspector en uploadqueue">
          <section className="inspector-panel" aria-labelledby="media-inspector-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="media-inspector-title">
                  Media-inspector
                </h2>
                <p className="work-panel__meta">Geselecteerd item</p>
              </div>
              <StatusPill label={selectedAsset.status} tone={selectedAsset.tone} />
            </div>
            <div className="media-card__preview" data-kind={selectedAsset.kind}>
              {selectedAsset.kind}
            </div>
            <dl className="meta-list">
              <div>
                <dt>Titel</dt>
                <dd>{selectedAsset.title}</dd>
              </div>
              <div>
                <dt>Bestand</dt>
                <dd>{selectedAsset.fileName}</dd>
              </div>
              <div>
                <dt>Gebruik</dt>
                <dd>{selectedAsset.usedIn}</dd>
              </div>
              <div>
                <dt>Opslagpad</dt>
                <dd>{selectedAsset.path}</dd>
              </div>
            </dl>
          </section>

          <section className="data-surface" aria-labelledby="upload-queue-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="upload-queue-title">
                  Uploadqueue
                </h2>
                <p className="work-panel__meta">Voortgang blijft zichtbaar tijdens verwerking.</p>
              </div>
              <StatusPill label="3 items" tone="info" />
            </div>
            <HealthList
              ariaLabel="Uploadqueue"
              items={queueRows.map((row) => ({
                detail: row.output,
                label: row.asset,
                status: row.status,
                tone: row.tone
              }))}
            />
          </section>
        </aside>
      </section>

      <section className="work-grid">
        <section className="data-surface" aria-labelledby="pipeline-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="pipeline-title">
                Pipeline voortgang
              </h2>
              <p className="work-panel__meta">Van upload naar veilige player-variant.</p>
            </div>
            <StatusPill label="Controleerbaar" tone="info" />
          </div>
          <Timeline ariaLabel="Media pipeline stappen" items={pipelineSteps} />
        </section>

        <section className="data-surface" aria-labelledby="upload-intake-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="upload-intake-title">
                Upload voorbereiden
              </h2>
              <p className="work-panel__meta">JPEG, PNG, WebP of MP4.</p>
            </div>
            <StatusPill label="Read-only" tone="neutral" />
          </div>
          <form className="upload-form">
            <div className="field">
              <label htmlFor="media-file">Bestand</label>
              <input
                id="media-file"
                name="media-file"
                placeholder="Nog geen bestand gekozen"
                readOnly
                type="text"
              />
            </div>
            <div className="field">
              <label htmlFor="media-title">Titel</label>
              <input id="media-title" name="media-title" placeholder="Bijvoorbeeld zomerroute poster" type="text" />
            </div>
            <p className="notice" role="status">
              Uploaden is nog niet beschikbaar in deze demo. Zodra een editor is
              aangemeld, vraagt Castivo een server-side uploadsessie aan.
            </p>
          </form>
        </section>
      </section>

      <section className="work-panel" aria-labelledby="media-risk-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="media-risk-title">
              Verwerkingsregels
            </h2>
            <p className="work-panel__meta">Wat de publicatiereview kan blokkeren.</p>
          </div>
          <StatusPill label="3 regels" tone="warning" />
        </div>
        <HealthList ariaLabel="Media validatierisico's" items={mediaRisks} />
      </section>
    </>
  );
}

function MediaType({ kind }: { kind: (typeof mediaAssets)[number]["kind"] }) {
  if (kind === "Video") {
    return (
      <span className="media-type media-type--video" aria-label="Video">
        <Video aria-hidden="true" />
      </span>
    );
  }

  if (kind === "Afgewezen") {
    return (
      <span className="media-type media-type--failed" aria-label="Afgewezen media">
        <FileWarning aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="media-type" aria-label="Afbeelding">
      <ImageIcon aria-hidden="true" />
    </span>
  );
}
