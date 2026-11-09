import Link from "next/link";
import { syncPlaybackEvidence } from "../../../../lib/sync-playback-evidence";
import { planningDecisionReason, planningSourceLabel, type EffectivePlanningReport, type PlanningWinner } from "./effective-planning";
import styles from "./effective-planning.module.css";

export function EffectivePlanningView({ report }: { report: EffectivePlanningReport }) {
  const now = Date.now();
  return <section aria-label="Nu, Hierna en Waarom" className={styles.report}>
    <p className="work-panel__meta">Gecontroleerd voor {formatPlanningTime(report.evaluatedAt, report.timezone)} · {report.timezone}.
      {report.proposal ? " Voorstel; er is niets opgeslagen of toegewezen." : " Alleen-lezen vooruitblik; de playerbevestiging staat apart."}</p>
    {report.screens.map(screen => {
      const evidence = syncPlaybackEvidence(screen.reportedDevice ?? undefined, now);
      return <article className={styles.screen} key={screen.screenId}>
        <header><h3><Link href={`/dashboard/screens/${screen.screenId}`}>{screen.name}</Link></h3>
          <span>{screen.evaluationApplies ? planningSourceLabel(screen.winner.source) : "Uitgeschakeld · geen nieuwe toewijzing"}</span></header>
        {screen.proposalTieUncertain ? <p className="notice notice--warning" role="status">Regels hebben precies dezelfde rang. De definitieve volgorde is pas na opslaan bekend; controleer de planning daarna opnieuw.</p> : null}
        <dl className={styles.columns}>
          <div><dt>Nu</dt><dd><Winner value={screen.winner} timezone={report.timezone}/></dd></div>
          <div><dt>Hierna</dt><dd>{screen.next ? <><p><strong>{formatPlanningTime(screen.next.at, report.timezone)}</strong></p><Winner value={screen.next.winner} timezone={report.timezone}/></>
            : <>Geen werkelijke wisseling gevonden vóór {formatPlanningTime(screen.searchedUntil, report.timezone)}.{!screen.searchComplete ? " De begrensde zoekperiode is niet volledig beoordeeld." : ""}</>}</dd></div>
          <div><dt>Waarom</dt><dd>{planningDecisionReason(screen.winner, screen.alternatives)}
            {screen.winner.priority !== null ? <p>Prioriteit {screen.winner.priority} · {screen.winner.targetKind === "screen" ? "individueel scherm" : "schermgroep"}.</p> : null}</dd></div>
        </dl>
        <p className={styles.evidence}><strong>Laatst door de player bevestigde weergave:</strong> {evidence.confirmedReleaseId
          ? <>{screen.reportedPublication ? `${screen.reportedPublication.name} · versie ${screen.reportedPublication.version}` : "Publicatie bevestigd"} · {formatPlanningTime(evidence.confirmedAt!, report.timezone)}{evidence.confirmedReleaseId !== screen.desired.releaseId ? " · wijkt af van de gewenste publicatie" : ""}</>
          : "Onbekend; geen passend framebewijs gemeld."} <span>Playercontact: {contactLabel(evidence.contact)}.</span></p>
        {screen.candidateCount > 1 ? <details><summary>Andere passende regels ({screen.candidateCount - 1})</summary><ul>
          {screen.alternatives.filter(item => item.scheduleId !== screen.winner.scheduleId).map(item => <li key={item.scheduleId}>{item.name} · {planningSourceLabel(item.source)} · prioriteit {item.priority}</li>)}
        </ul>{screen.candidateCount > 5 ? <p>De eerste vijf passende regels zijn opgenomen; de winnaar is over alle passende regels bepaald.</p> : null}</details> : null}
      </article>;
    })}
  </section>;
}

function Winner({ value, timezone }: { value: PlanningWinner; timezone: string }) {
  return <><strong>{value.playlistName ?? "Geen standaardpublicatie ingesteld"}</strong><p>{value.name}
    {value.draft ? " · concept, definitieve versie volgt bij publicatie" : value.releaseVersion !== null ? ` · versie ${value.releaseVersion}` : ""}</p>
    {value.startsAt ? <p>{formatPlanningTime(value.startsAt, timezone)}{value.endsAt ? ` tot ${formatPlanningTime(value.endsAt, timezone)}` : " · zonder einddatum"}</p> : null}</>;
}
export function formatPlanningTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
}
function contactLabel(value: string) {
  return value === "online" ? "Online" : value === "stale" ? "Status verouderd" : value === "offline" ? "Offline" : "Onbekend";
}
