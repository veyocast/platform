import { alertDefinitions, sloDefinitions } from "@veyocast/observability";
import { Button, DataTable, PageHeader, StatusPill } from "@veyocast/ui";

import { requireControlCapability } from "../../../../lib/control-session";
import { loadPlatformPlayerDemo } from "../../../../lib/platform-player-demo";
import { configureStagingPlayerDemo } from "./actions";

type PlatformSystemPageProps = {
  searchParams?: Promise<{ demo?: string; demoFout?: string }>;
};

export default async function PlatformSystemPage({
  searchParams
}: PlatformSystemPageProps) {
  const session = await requireControlCapability("platform.system.read");
  const query = await searchParams;
  const mayManageDemo =
    process.env.VEYOCAST_ENVIRONMENT === "staging" &&
    session.roles.includes("platform_owner");
  const demo = mayManageDemo ? await loadPlatformPlayerDemo() : null;
  const configuredDemo = demo?.options.find(
    (option) => option.playlistId === demo.configuredPlaylistId
  );

  return (
    <>
      <PageHeader
        description="Canonieke doelwaarden, kritieke alertdrempels en directe herstelroutes voor staging en productie. Deze pagina toont configuratie, geen gesimuleerde live metingen."
        eyebrow="Platform"
        status={!session.isLive
          ? { label: "Lokale contractpreview", tone: "warning" }
          : undefined}
        title="Systeem en herstel"
      />

      {demo ? (
        <section
          className="workspace-section"
          id="player-demo"
          aria-labelledby="player-demo-title"
        >
          <div className="workspace-section__header">
            <div>
              <h2 className="workspace-section__title" id="player-demo-title">
                Android reviewdemo
              </h2>
              <p className="work-panel__meta">
                Kies de staging-playlist waarvan de nieuwste immutable release
                via de herbruikbare reviewcode wordt afgespeeld. Echte schermen
                en device-pairings blijven ongemoeid.
              </p>
            </div>
            <StatusPill
              label={configuredDemo ? `Release ${configuredDemo.latestReleaseVersion}` : "Veilige fallback actief"}
              tone={configuredDemo ? "success" : "warning"}
            />
          </div>

          {query?.demo === "opgeslagen" ? (
            <p className="notice notice--success" role="status">
              De reviewdemo gebruikt voortaan de nieuwste gepubliceerde release
              van de gekozen playlist.
            </p>
          ) : null}
          {query?.demoFout ? (
            <p className="notice notice--critical" role="alert">
              {demoErrorMessage(query.demoFout)}
            </p>
          ) : null}
          {demo.error ? (
            <p className="notice notice--critical" role="alert">
              De democonfiguratie kon niet veilig worden geladen. De bestaande
              configuratie is niet gewijzigd.
            </p>
          ) : null}

          <form action={configureStagingPlayerDemo} className="settings-form">
            <div className="field">
              <label htmlFor="platform-player-demo-playlist">
                Gepubliceerde demoplaylist
              </label>
              <select
                defaultValue={
                  configuredDemo
                    ? `${configuredDemo.tenantId}:${configuredDemo.playlistId}`
                    : ""
                }
                disabled={demo.error || demo.options.length === 0}
                id="platform-player-demo-playlist"
                name="demoPlaylist"
                required
              >
                <option disabled value="">
                  Kies een playlist met minimaal één release
                </option>
                {demo.options.map((option) => (
                  <option
                    key={`${option.tenantId}:${option.playlistId}`}
                    value={`${option.tenantId}:${option.playlistId}`}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Button
                disabled={demo.error || demo.options.length === 0}
                type="submit"
              >
                Demoplaylist opslaan
              </Button>
            </div>
          </form>

          <p className="work-panel__meta">
            Reviewcode: <strong>VYO 2VY</strong>. De code is alleen geldig in
            de staging-app en maakt per reviewer een afzonderlijke virtuele
            demosessie. Publiceer een nieuwe release om de reviewinhoud bij de
            volgende demosessie bij te werken.
          </p>
        </section>
      ) : null}

      <section className="workspace-section" aria-labelledby="slo-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="slo-title">Service level objectives</h2>
            <p className="work-panel__meta">Meetbare doelen; live burn-rate visualisatie wordt uitsluitend gevuld door echte telemetry.</p>
          </div>
          <StatusPill label={`${sloDefinitions.length} doelen`} tone="info" />
        </div>
        <DataTable caption="Canonieke SLO-doelwaarden.">
          <thead><tr><th scope="col">Journey</th><th scope="col">Doelwaarde</th><th scope="col">Objectief</th><th scope="col">Venster</th></tr></thead>
          <tbody>{sloDefinitions.map((slo) => <tr key={slo.id}>
            <td data-label="Journey"><span className="table-primary">{slo.description}</span><span className="table-secondary">{slo.id}</span></td>
            <td data-label="Doelwaarde">Binnen {formatDuration(slo.targetMs)}</td>
            <td data-label="Objectief">{Math.round(slo.objective * 100)}%</td>
            <td data-label="Venster">{slo.window}</td>
          </tr>)}</tbody>
        </DataTable>
      </section>

      <section className="workspace-section" aria-labelledby="alerts-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="alerts-title">Kritieke alertcontracten</h2>
            <p className="work-panel__meta">Iedere drempel heeft een eigenaar, runbook en Control-deeplink.</p>
          </div>
          <StatusPill label={`${alertDefinitions.length} alerts`} tone="success" />
        </div>
        <DataTable caption="Alertdrempels en herstelroutes.">
          <thead><tr><th scope="col">Alert</th><th scope="col">Drempel</th><th scope="col">Eigenaar</th><th scope="col">Herstelcontext</th></tr></thead>
          <tbody>{alertDefinitions.map((alert) => <tr key={alert.id}>
            <td data-label="Alert"><span className="table-primary">{humanize(alert.id)}</span><span className="table-secondary">{alert.id}</span></td>
            <td data-label="Drempel">{alert.threshold.operator} {alert.threshold.value} {alert.threshold.unit} gedurende {alert.threshold.durationMinutes} min</td>
            <td data-label="Eigenaar">{alert.owner === "platform" ? "Platform operations" : "Product support"}</td>
            <td data-label="Herstelcontext"><a className="table-action" href={alert.controlPath}>Open Control</a><span className="table-secondary">{alert.runbook}</span></td>
          </tr>)}</tbody>
        </DataTable>
      </section>
    </>
  );
}

function formatDuration(milliseconds: number) {
  if (milliseconds < 60_000) return `${milliseconds / 1_000} sec`;
  return `${milliseconds / 60_000} min`;
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function demoErrorMessage(code: string) {
  const messages: Record<string, string> = {
    configuratie:
      "De stagingdatabase is niet beschikbaar. Er is niets gewijzigd.",
    invoer:
      "Kies een geldige tenantplaylist uit de lijst. Er is niets gewijzigd.",
    omgeving:
      "De reviewdemo mag uitsluitend vanuit de stagingomgeving worden geconfigureerd.",
    playlist:
      "De playlist is niet actief of heeft nog geen immutable release.",
    rechten:
      "Alleen een Platform Owner met AAL2 mag de reviewdemo wijzigen.",
    onverwacht:
      "De demoplaylist kon niet worden opgeslagen. De vorige configuratie blijft actief."
  };
  return messages[code] ?? messages.onverwacht;
}
