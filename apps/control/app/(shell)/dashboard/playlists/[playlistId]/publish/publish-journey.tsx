"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ReleasePreflightReasonCode, ReleasePreflightResult } from "@veyocast/domain";
import { Button, JourneyShell, StatusPill, StickyActionBar } from "@veyocast/ui";

import { publishPlaylistGuided } from "../../actions";
import { PlaylistPreview, type PlaylistPreviewItem } from "../../playlist-preview";

const steps = [
  { id: "readiness", label: "Readiness" },
  { id: "preview", label: "Preview" },
  { id: "targets", label: "Doelschermen" },
  { id: "preflight", label: "Preflight" },
  { id: "confirm", label: "Bevestigen" }
] as const;

type PreflightState = {
  heartbeatAt: string | null;
  preflight: ReleasePreflightResult;
  screen: {
    assignedReleaseId: string | null;
    id: string;
    location: string | null;
    name: string;
    orientation: string;
    status: string;
  };
};

type PublishJourneyProps = {
  birthdayTimingChecks: Array<{
    actualDurationSeconds: number;
    itemId: string;
    minimumDurationSeconds: number;
    name: string;
    pageCount: number;
  }>;
  canPublish: boolean;
  idempotencyKey: string;
  nextVersion: number;
  playlist: { id: string; name: string; revision: number };
  preflightStates: PreflightState[];
  previewItems: PlaylistPreviewItem[];
  readiness: {
    canPublish: boolean;
    itemCount: number;
    reasons: string[];
    totalBytes: number;
    totalDurationSeconds: number;
  };
  tenantName: string;
};

export function PublishJourney({
  birthdayTimingChecks,
  canPublish,
  idempotencyKey,
  nextVersion,
  playlist,
  preflightStates,
  previewItems,
  readiness,
  tenantName
}: PublishJourneyProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedStates = useMemo(
    () => preflightStates.filter((state) => selectedIds.includes(state.screen.id)),
    [preflightStates, selectedIds]
  );
  const hasBlocked = selectedStates.some((state) => state.preflight.status === "blocked");
  const hasBirthdayTimingRisk = birthdayTimingChecks.some(
    (check) => check.actualDurationSeconds < check.minimumDurationSeconds
  );
  const hasRisk = hasBirthdayTimingRisk || selectedStates.some(
    (state) => state.preflight.status === "warning" || state.preflight.status === "unknown"
  );
  const currentStep = steps[stepIndex] ?? steps[0];
  const canContinue = stepIndex < 2 || selectedIds.length > 0;

  const toggleScreen = (screenId: string) => {
    setSelectedIds((current) => current.includes(screenId)
      ? current.filter((id) => id !== screenId)
      : [...current, screenId]);
  };

  return (
    <JourneyShell
      actions={<Button asChild variant="secondary"><Link href={`/dashboard/playlists/${playlist.id}`}>Terug naar editor</Link></Button>}
      aside={(
        <div className="publish-journey-summary" aria-label="Publicatie-impact">
          <div><span>Release</span><strong>{playlist.name} · versie {nextVersion}</strong></div>
          <div><span>Inhoud</span><strong>{readiness.itemCount} items · {formatDuration(readiness.totalDurationSeconds)}</strong></div>
          <div><span>Download</span><strong>{formatBytes(readiness.totalBytes)}</strong></div>
          <div><span>Doelen</span><strong>{selectedIds.length} {selectedIds.length === 1 ? "scherm" : "schermen"}</strong></div>
          <p>De huidige release blijft spelen totdat de Player de nieuwe release volledig heeft gedownload, geverifieerd en veilig geactiveerd.</p>
        </div>
      )}
      currentStep={currentStep.id}
      description="Controleer inhoud en impact stap voor stap. Er wordt pas bij de laatste bevestiging één immutable release gemaakt."
      eyebrow={`${tenantName} · Publisher · stap ${stepIndex + 1} van ${steps.length}`}
      steps={steps}
      title={`${playlist.name} publiceren`}
    >
      <div className="publish-journey-step" key={currentStep.id}>
        {currentStep.id === "readiness" ? (
          <section aria-labelledby="publish-readiness-title" className="workspace-section">
            <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="publish-readiness-title">Concept controleren</h2><p className="work-panel__meta">Dezelfde readiness-engine wordt vlak vóór publicatie server-side opnieuw uitgevoerd.</p></div><StatusPill label={readiness.canPublish ? "Gereed" : "Geblokkeerd"} tone={readiness.canPublish ? "success" : "critical"} /></div>
            <dl className="meta-list"><div><dt>Conceptrevisie</dt><dd>{playlist.revision}</dd></div><div><dt>Items</dt><dd>{readiness.itemCount}</dd></div><div><dt>Duur</dt><dd>{formatDuration(readiness.totalDurationSeconds)}</dd></div><div><dt>Download</dt><dd>{formatBytes(readiness.totalBytes)}</dd></div></dl>
            {!readiness.canPublish ? <div className="notice notice--critical" role="alert"><strong>Herstel eerst de conceptblokkades.</strong>{readiness.reasons.length ? <ul>{readiness.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>Open de editor om de ongeldige inhoud te herstellen.</p>}<Link href={`/dashboard/playlists/${playlist.id}`}>Terug naar de playlisteditor</Link></div> : null}
          </section>
        ) : null}

        {currentStep.id === "preview" ? (
          <section aria-labelledby="publish-preview-title" className="workspace-section"><div className="workspace-section__header"><div><h2 className="workspace-section__title" id="publish-preview-title">Playerpreview</h2><p className="work-panel__meta">Bekijk volgorde, duur, fit, geluid en oriëntatie zoals deze in het manifest terechtkomen.</p></div><StatusPill label={`${previewItems.length} items`} tone="info" /></div><div className="publish-preview-frame"><PlaylistPreview items={previewItems} /></div></section>
        ) : null}

        {currentStep.id === "targets" ? (
          <section aria-labelledby="publish-targets-title" className="workspace-section"><div className="workspace-section__header"><div><h2 className="workspace-section__title" id="publish-targets-title">Doelschermen kiezen</h2><p className="work-panel__meta">Kies alleen schermen die deze release moeten ontvangen. Uitgeschakelde schermen blijven buiten de uitrol.</p></div><StatusPill label={`${selectedIds.length} gekozen`} tone={selectedIds.length ? "info" : "neutral"} /></div><fieldset className="checkbox-fieldset"><legend>Actieve en onderhoudsschermen</legend>{preflightStates.filter((state) => state.screen.status !== "disabled").map((state) => <label className="check-row" key={state.screen.id}><input checked={selectedIds.includes(state.screen.id)} onChange={() => toggleScreen(state.screen.id)} type="checkbox" /><span><strong>{state.screen.name}</strong><span className="work-panel__meta">{state.screen.location || "Geen locatie"} · {state.screen.orientation === "portrait" ? "staand" : "liggend"} · {screenStatusLabel(state.screen.status)}</span></span></label>)}</fieldset>{!preflightStates.some((state) => state.screen.status !== "disabled") ? <p className="notice" role="status">Er zijn nog geen beschikbare doelschermen. Koppel of activeer eerst een scherm.</p> : null}</section>
        ) : null}

        {currentStep.id === "preflight" ? (
          <section aria-labelledby="publish-preflight-title" className="workspace-section"><div className="workspace-section__header"><div><h2 className="workspace-section__title" id="publish-preflight-title">Preflight per scherm</h2><p className="work-panel__meta">Capability, manifestcompatibiliteit, actuele telemetry, opslag en dynamische paginaduur worden per doel beoordeeld. Onbekend blijft onbekend.</p></div><StatusPill label={hasBlocked ? "Geblokkeerd" : hasRisk ? "Bevestiging nodig" : "Alle doelen gereed"} tone={hasBlocked ? "critical" : hasRisk ? "warning" : "success"} /></div>{birthdayTimingChecks.length ? <BirthdayTimingPreflight checks={birthdayTimingChecks} playlistId={playlist.id} /> : null}<PreflightTable states={selectedStates} /></section>
        ) : null}

        {currentStep.id === "confirm" ? (
          <section aria-labelledby="publish-confirm-title" className="publish-workspace"><div className="workspace-section__header"><div><h2 className="workspace-section__title" id="publish-confirm-title">Impact bevestigen</h2><p className="work-panel__meta">De server controleert revisie, readiness, targets en preflight nogmaals in dezelfde beveiligde publicatieactie.</p></div><StatusPill label={`Versie ${nextVersion}`} tone="neutral" /></div><form action={publishPlaylistGuided} className="playlist-form" id="guided-publish-form"><input name="playlistId" type="hidden" value={playlist.id} /><input name="expectedRevision" type="hidden" value={playlist.revision} /><input name="idempotencyKey" type="hidden" value={idempotencyKey} />{selectedIds.map((screenId) => <input key={screenId} name="screenIds" type="hidden" value={screenId} />)}<div className="field"><label htmlFor="guided-release-notes">Releasenotitie</label><textarea disabled={!canPublish} id="guided-release-notes" maxLength={500} name="releaseNotes" placeholder="Wat verandert er en waarom?" rows={3} /></div>{hasRisk ? <label className="check-row"><input disabled={!canPublish || hasBlocked} name="confirmRisk" required type="checkbox" /><span><strong>Ik bevestig bewust de waarschuwingen en onbekende telemetry</strong><span className="work-panel__meta">De ontbrekende zekerheid is hierboven per scherm toegelicht.</span></span></label> : null}<label className="check-row"><input disabled={!canPublish || hasBlocked || !selectedIds.length} name="confirmPublish" required type="checkbox" /><span><strong>Maak één nieuwe immutable release voor {selectedIds.length} {selectedIds.length === 1 ? "scherm" : "schermen"}</strong><span className="work-panel__meta">Na publicatie kan deze versie niet worden gewijzigd of verwijderd.</span></span></label><Button disabled={!canPublish || hasBlocked || !selectedIds.length} type="submit">Release publiceren en uitrol volgen</Button></form>{!canPublish ? <p className="notice notice--critical" role="alert">Je kunt deze release nog niet publiceren. Controleer readiness, tenantstatus en je publicatierechten.</p> : null}</section>
        ) : null}
      </div>

      <StickyActionBar aside={<span aria-live="polite">{selectedIds.length} {selectedIds.length === 1 ? "doelscherm" : "doelschermen"} geselecteerd</span>}>
        <Button disabled={stepIndex === 0} onClick={() => setStepIndex((index) => index - 1)} type="button" variant="secondary">Vorige</Button>
        {stepIndex < steps.length - 1 ? <Button disabled={!canContinue || (stepIndex === 3 && hasBlocked)} onClick={() => setStepIndex((index) => index + 1)} type="button">Volgende</Button> : null}
      </StickyActionBar>
    </JourneyShell>
  );
}

function BirthdayTimingPreflight({
  checks,
  playlistId
}: {
  checks: PublishJourneyProps["birthdayTimingChecks"];
  playlistId: string;
}) {
  const insufficient = checks.filter(
    (check) => check.actualDurationSeconds < check.minimumDurationSeconds
  );
  return insufficient.length ? (
    <div className="notice notice--warning" role="alert">
      <strong>De verjaardagspaginering heeft meer zichtbaarheidstijd nodig.</strong>
      <ul>{insufficient.map((check) => <li key={check.itemId}>{check.name}: minimaal {check.minimumDurationSeconds} sec. voor {check.pageCount} pagina&apos;s; nu {check.actualDurationSeconds} sec.</li>)}</ul>
      <Link href={`/dashboard/playlists/${playlistId}`}>Duur automatisch aanpassen in Playlist Studio</Link>
    </div>
  ) : (
    <div className="notice" role="status">
      <strong>Duur automatisch aanpassen is actief.</strong>
      <ul>{checks.map((check) => <li key={check.itemId}>{check.name}: {check.pageCount} {check.pageCount === 1 ? "pagina" : "pagina's"} · minimaal {check.minimumDurationSeconds} sec. · ingesteld op {check.actualDurationSeconds} sec.</li>)}</ul>
    </div>
  );
}

function PreflightTable({ states }: { states: PreflightState[] }) {
  return <div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Publicatiepreflight voor de gekozen schermen.</caption><thead><tr><th scope="col">Scherm</th><th scope="col">Status</th><th scope="col">Ontbrekend</th><th scope="col">Vrije opslag</th><th scope="col">Onderbouwing</th></tr></thead><tbody>{states.map((state) => <tr key={state.screen.id}><td data-label="Scherm"><span className="table-primary">{state.screen.name}</span><span className="table-secondary">{state.heartbeatAt ? `Heartbeat ${formatDate(state.heartbeatAt)}` : "Geen heartbeat"}</span></td><td data-label="Status"><StatusPill {...preflightStatus(state.preflight.status)} /></td><td data-label="Ontbrekend">{state.preflight.missingBytes === null ? "Onbekend" : formatBytes(state.preflight.missingBytes)}</td><td data-label="Vrije opslag">{state.preflight.availableBytes === null ? "Onbekend" : formatBytes(state.preflight.availableBytes)}</td><td data-label="Onderbouwing">{state.preflight.reasons.map(reasonLabel).join(" · ") || "Capability, compatibiliteit, telemetry en opslag zijn voldoende."}</td></tr>)}</tbody></table></div>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function formatDuration(seconds: number) { return `${Math.floor(seconds / 60)} min ${seconds % 60} sec`; }
function formatBytes(bytes: number) { if (!bytes) return "0 MB"; return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`; }
function screenStatusLabel(status: string) { return status === "maintenance" ? "onderhoud" : status === "active" ? "actief" : status; }
function preflightStatus(status: string) { return status === "ready" ? { label: "Gereed", tone: "success" as const } : status === "warning" ? { label: "Waarschuwing", tone: "warning" as const } : status === "blocked" ? { label: "Geblokkeerd", tone: "critical" as const } : { label: "Onbekend", tone: "info" as const }; }
function reasonLabel(code: ReleasePreflightReasonCode) { return ({ SCREEN_DISABLED: "scherm uitgeschakeld", SCREEN_MAINTENANCE: "onderhoudsmodus", DEVICE_MISSING: "Player niet gekoppeld", HEARTBEAT_MISSING: "heartbeat ontbreekt", HEARTBEAT_STALE: "heartbeat verouderd", MANIFEST_INCOMPATIBLE: "manifest incompatibel", MANIFEST_COMPATIBILITY_UNKNOWN: "compatibiliteit onbekend", STORAGE_UNKNOWN: "opslag onbekend", STORAGE_INSUFFICIENT: "opslag onvoldoende", STORAGE_MARGIN_LOW: "weinig opslagmarge" } satisfies Record<ReleasePreflightReasonCode, string>)[code]; }
