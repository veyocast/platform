import {
  HealthList,
  MetricCard,
  PageHeader,
  StatusPill,
  Timeline
} from "../../_components/shell-primitives";

const mediaMetrics = [
  {
    detail: "Klaar voor playlistgebruik zodra releases bestaan.",
    label: "Gereed",
    tone: "success",
    value: "38"
  },
  {
    detail: "Workerqueue wacht op metadata en thumbnailgeneratie.",
    label: "In verwerking",
    tone: "warning",
    value: "4"
  },
  {
    detail: "Meestal type, grootte of duur buiten MVP-limiet.",
    label: "Validatie mislukt",
    tone: "critical",
    value: "2"
  }
] as const;

const mediaAssets = [
  {
    detail: "1920 x 1080 · 420 KB · image/webp",
    fileName: "zomerroute.webp",
    kind: "Afbeelding",
    path: "tenants/.../assets/.../original/zomerroute.webp",
    status: "Gereed",
    title: "Zomerroute poster",
    tone: "success"
  },
  {
    detail: "MP4 · 1:48 · 62 MB · video/mp4",
    fileName: "welkom-loop.mp4",
    kind: "Video",
    path: "tenants/.../assets/.../original/welkom-loop.mp4",
    status: "Verwerken",
    title: "Welkom loop",
    tone: "warning"
  },
  {
    detail: "SVG is uitgeschakeld in MVP",
    fileName: "sponsor-logo.svg",
    kind: "Afgewezen",
    path: "Geen storage object aangemaakt",
    status: "Validatie mislukt",
    title: "Sponsorlogo",
    tone: "critical"
  }
] as const;

const queueRows = [
  {
    asset: "Nieuw posterbeeld",
    output: "thumbnail + original",
    status: "queued",
    tone: "info"
  },
  {
    asset: "Welkom loop",
    output: "thumbnail + 1080p",
    status: "processing",
    tone: "warning"
  },
  {
    asset: "Sponsorlogo",
    output: "unsupported_mime_type",
    status: "failed",
    tone: "critical"
  }
] as const;

const pipelineSteps = [
  {
    detail: "Browser krijgt pas een signed URL na tenantrol en limietcheck.",
    label: "Upload sessie",
    meta: "server",
    tone: "info"
  },
  {
    detail: "Worker valideert MIME, duur, metadata en veilige extensie.",
    label: "Validatie",
    meta: "actief",
    tone: "warning"
  },
  {
    detail: "Ready assets krijgen checksum, thumbnail en player-variant.",
    label: "Player variant",
    meta: "gereed",
    tone: "success"
  }
] as const;

const mediaRisks = [
  {
    detail: "SVG blijft uitgeschakeld tenzij sanitizing expliciet wordt toegevoegd.",
    label: "Bestandstype",
    status: "MVP-regel",
    tone: "critical"
  },
  {
    detail: "MP4/H.264/AAC maximaal 500 MB en vijf minuten.",
    label: "Videolimiet",
    status: "bewaakt",
    tone: "info"
  },
  {
    detail: "Gepubliceerde assets worden niet stilzwijgend vervangen.",
    label: "Release-impact",
    status: "immutable",
    tone: "success"
  }
] as const;

export default function MediaPage() {
  return (
    <>
      <PageHeader
        actions={
          <button className="button-link button-link--primary" disabled type="button">
            Uploadsessie aanvragen
          </button>
        }
        description="Tenantmedia gebruikt private storagepaden, RLS-gefilterde assetrijen en een workerqueue voordat content in playlists mag landen."
        eyebrow="Tenantmedia"
        status={{ label: "Tenanteditor vereist voor upload", tone: "info" }}
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

      <section className="work-grid">
        <article className="work-panel">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title">Uploadintake</h2>
              <p className="work-panel__meta">Private bucket: tenant-media</p>
            </div>
            <StatusPill label="MVP-limieten" tone="info" />
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
              <p>JPEG, PNG, WebP of MP4. Video maximaal 500 MB en 5 minuten.</p>
            </div>
            <div className="field">
              <label htmlFor="media-title">Titel</label>
              <input
                id="media-title"
                name="media-title"
                placeholder="Bijvoorbeeld zomerroute poster"
                type="text"
              />
            </div>
            <div className="notice" role="status">
              Oorzaak: echte Supabase sessies zijn nog niet aangesloten. Effect:
              uploadknop blijft read-only. Herstel: server-side auth en signed
              upload URL aansluiten op deze S04-tabellen.
            </div>
          </form>
        </article>

        <article className="work-panel">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title">Permission state</h2>
              <p className="work-panel__meta">Viewer ziet, editor uploadt</p>
            </div>
            <StatusPill label="RLS actief" tone="success" />
          </div>
          <HealthList
            ariaLabel="Media permissiestatus"
            items={[
              {
                detail: "Kan eigen tenantmedia lezen en queue-statussen volgen.",
                label: "Tenantviewer",
                status: "read-only",
                tone: "neutral"
              },
              {
                detail: "Kan assets en upload sessies aanmaken na server-check.",
                label: "Tenanteditor",
                status: "upload",
                tone: "success"
              }
            ]}
          />
        </article>
      </section>

      <section className="work-grid">
        <article className="work-panel" aria-labelledby="pipeline-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="pipeline-title">
                Pipeline voortgang
              </h2>
              <p className="work-panel__meta">Van upload sessie naar player variant</p>
            </div>
            <StatusPill label="Canon" tone="info" />
          </div>
          <Timeline ariaLabel="Media pipeline stappen" items={pipelineSteps} />
        </article>

        <article className="work-panel" aria-labelledby="media-risk-title">
          <div className="work-panel__header">
            <div>
              <h2 className="work-panel__title" id="media-risk-title">
                Validatierisico's
              </h2>
              <p className="work-panel__meta">Wat publish readiness blokkeert</p>
            </div>
            <StatusPill label="3 regels" tone="warning" />
          </div>
          <HealthList ariaLabel="Media validatierisico's" items={mediaRisks} />
        </article>
      </section>

      <section className="work-panel" aria-labelledby="media-library-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="media-library-title">
              Bibliotheek
            </h2>
            <p className="work-panel__meta">Status, type en tenantpad per asset</p>
          </div>
          <StatusPill label="3 assets" tone="neutral" />
        </div>
        <div className="media-library-grid">
          {mediaAssets.map((asset) => (
            <article className="media-card" key={asset.fileName}>
              <div className="media-card__preview" data-kind={asset.kind}>
                {asset.kind}
              </div>
              <div className="media-card__body">
                <div className="work-panel__header">
                  <div>
                    <h3 className="media-card__title">{asset.title}</h3>
                    <p className="work-panel__meta">{asset.fileName}</p>
                  </div>
                  <StatusPill label={asset.status} tone={asset.tone} />
                </div>
                <p className="media-card__detail">{asset.detail}</p>
                <p className="media-card__path">{asset.path}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="work-panel" aria-labelledby="queue-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="queue-title">
              Uploadqueue
            </h2>
            <p className="work-panel__meta">Worker shell validatie en varianten</p>
          </div>
          <StatusPill label="Service role only" tone="info" />
        </div>
        <div className="data-table-frame">
          <table className="data-table">
            <caption>Verwerkingsstatus per mediajob.</caption>
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col">Jobstatus</th>
                <th scope="col">Output</th>
              </tr>
            </thead>
            <tbody>
              {queueRows.map((row) => (
                <tr key={row.asset}>
                  <td>{row.asset}</td>
                  <td>
                    <StatusPill label={row.status} tone={row.tone} />
                  </td>
                  <td>{row.output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
