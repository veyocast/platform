import { screenSourceEvidence, readScreenSourceMetadata } from "../../../../lib/screen-source-evidence";
import type { syncPlaybackEvidence } from "../../../../lib/sync-playback-evidence";

import styles from "./sync-screen-detail.module.css";

export function ScreenSourceStatus({ metadata, reported, now, timeZone = "Europe/Amsterdam" }: {
  metadata: unknown; reported: ReturnType<typeof syncPlaybackEvidence>["reportedSource"]; now: number; timeZone?: string;
}) {
  const rows = readScreenSourceMetadata(metadata).map(row => screenSourceEvidence(row, reported, now));
  return <section className="workspace-section" aria-labelledby="screen-source-status-title"><div className="workspace-section__header"><div><h2 id="screen-source-status-title" className="workspace-section__title">Bronactualiteit</h2><p className="work-panel__meta">Broncontrole en door de Player gemelde gegevens staan los van bereikbaarheid en publicatie.</p></div></div>{rows.length ? <div className={styles.sourceRows}>{rows.map(row => <div key={`${row.snapshotId}:${row.datasetKey}`}><span>{row.sourceName} · {datasetLabel(row.datasetKey)}<br />Laatst geslaagde broncontrole: {time(row.lastSuccessAt, timeZone)}<br />Publicatie gecontroleerd: {time(row.checkedAt, timeZone)}{row.lastErrorCode ? <><br />Laatste bronpoging mislukt · geldige gegevens blijven beschikbaar</> : null}</span><b>Beschikbaar: {row.dataRevision ?? "onbekend"}<br />Player gemeld: {row.reportedRevision ?? "onbekend"}<br />{row.contentConfirmed ? "Deze gegevens zijn door de Player gemeld" : "Actuele gegevensweergave niet bevestigd"}</b></div>)}</div> : <p className="notice" role="status">Bronactualiteit onbekend. Er is geen beschikbaar bronbewijs voor deze publicatie. Dit zegt niets over het Playercontact.</p>}</section>;
}
function datasetLabel(value: string) { return value === "matches" ? "Programma en uitslagen" : value === "competitions" ? "Officiële stand" : value === "rss" ? "Nieuws" : value === "menu" ? "Menu" : "Brongegevens"; }
function time(value: string | null, timeZone: string) {return value ? new Intl.DateTimeFormat("nl-NL", {dateStyle:"short",timeStyle:"short",timeZone}).format(new Date(value)) : "Onbekend";}
