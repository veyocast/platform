"use client";
/* eslint-disable @next/next/no-img-element -- Locked local Source artwork and the existing expiring-code QR endpoint. */

import { useEffect, useId, useRef, useState } from "react";
import { syncPlayerStatusCopy, validDisplayedPairingCode, type SyncPlayerStatusStage } from "../_lib/player-status-presentation";
import { parsePlayerTimestamp } from "../_lib/player-time";
import styles from "./sync-player-status.module.css";

type StatusProblem = { code?: string; cause: string; effect: string; recovery: string };
export type SyncPlayerStatusProps = {
  embedded?:boolean;
  stage: SyncPlayerStatusStage;
  landmark: string;
  screenName?: string;
  footer?: string;
  detail?: string;
  title?: string;
  pairingCode?: string;
  expiresAt?: string;
  onRetry?: () => void;
  problem?: StatusProblem;
};

/** Source PlayerExperience status canvas, driven only by real runtime facts. */
export function SyncPlayerStatus({ embedded=false,stage, landmark, screenName, footer, detail, title, pairingCode, expiresAt, onRetry, problem }: SyncPlayerStatusProps) {
  const embeddedId=useId(),Root=embedded?"div":"main",titleId=embedded?embeddedId:"player-title";
  const [qrOpen, setQrOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const qrTrigger = useRef<HTMLButtonElement>(null);
  const code = validDisplayedPairingCode(pairingCode, expiresAt);
  const expired = stage === "pairing" && Boolean(expiresAt) && !code;
  const visibleStage = expired ? "pairing-expired" : stage;
  const copy = syncPlayerStatusCopy[visibleStage];
  const preparing = visibleStage === "download" || visibleStage === "verify";
  const canShowQr = visibleStage === "pairing" && Boolean(code);
  useEffect(() => {
    if (!qrOpen || !canShowQr) { dialog.current?.close(); return; }
    dialog.current?.showModal();
  }, [qrOpen, canShowQr]);
  function closeQr() { setQrOpen(false); dialog.current?.close(); qrTrigger.current?.focus(); }

  return <Root role={embedded?"status":undefined} aria-label={landmark} className={styles.root} data-sync-player-stage={visibleStage}>
    <div className="px-player-canvas">
      <section className={`px-splash has-brand-art ${visibleStage === "error" ? "error" : ""}`} aria-labelledby={titleId}>
        <div className="px-splash-hero" aria-hidden="true"><img src="/assets/brand-hero-800.webp" srcSet="/assets/brand-hero-480.webp 480w, /assets/brand-hero-800.webp 800w, /assets/brand-hero-1254.webp 1254w" sizes="(max-width: 800px) 90vw, 55vw" width="1254" height="1254" alt="" /><span className="px-splash-art-light" /><span className="px-splash-art-shimmer" /></div>
        <div className="px-splash-grid" /><div className="px-splash-halo" /><div className="px-splash-orbit one" /><div className="px-splash-orbit two" />
        <div className="px-splash-brand"><img src="/assets/full-light.svg" alt="VeyoCast" /></div>
        <div className="px-splash-center">
          <div aria-hidden="true" className={`px-splash-icon ${visibleStage}`}><StatusIcon stage={visibleStage} /></div>
          <span className="px-splash-eyebrow">{copy.eyebrow}</span>
          <h1 id={titleId}>{title ?? copy.title}</h1>
          <p>{detail ?? copy.body}</p>
          {visibleStage === "pairing" ? code ? <>
            <div aria-label="Pairingcode" className="px-pairing-screen-code">{code.slice(0, 3)} <b>{code.replace(/ /g, "").slice(3)}</b></div>
            <button className="px-splash-action" type="button" ref={qrTrigger} onClick={() => setQrOpen(true)}>QR-code tonen <Arrow /></button>
          </> : <div aria-label="Koppelcode voorbereiden" className="px-splash-loader"><i /><i /><i /></div> : preparing ? <div className="px-sync-display">
            <div className="px-sync-track" role="progressbar" aria-label="Publicatie voorbereiden" aria-valuetext={visibleStage === "download" ? "Bestanden lokaal voorbereiden" : "Bestanden controleren"}><i className="px-indeterminate" /></div>
            <div><span>{visibleStage === "download" ? "Bestanden lokaal voorbereiden" : "Bestanden controleren"}</span><b>Bezig</b></div>
            <div className="px-sync-steps"><span>Verbinding</span><span className={visibleStage === "download" ? "current" : ""}>Voorbereiden</span><span className={visibleStage === "verify" ? "current" : ""}>Controleren</span><span>In beeld</span></div>
          </div> : ["error", "offline-empty", "pairing-expired", "recovery"].includes(visibleStage) && onRetry ? <button className="px-splash-action" onClick={onRetry} type="button">{visibleStage === "pairing-expired" ? "Nieuwe koppelcode aanvragen" : visibleStage === "offline-empty" ? "Verbinding herstellen" : "Opnieuw proberen"} <Arrow /></button> : visibleStage === "boot" ? <div aria-label="Player initialiseren" className="px-splash-loader"><i /><i /><i /></div> : null}
          {problem ? <details className="px-status-details"><summary>Herstelgegevens</summary><dl>{problem.code ? <><dt>Foutcode</dt><dd>{problem.code}</dd></> : null}<dt>Oorzaak</dt><dd>{problem.cause}</dd><dt>Effect</dt><dd>{problem.effect}</dd><dt>Herstel</dt><dd>{problem.recovery}</dd></dl></details> : null}
        </div>
        <div className="px-splash-footer" aria-label="Device setupstatus"><span>{screenName ?? "VeyoCast Player"}</span><span><i />{expiresAt && code ? `Code geldig tot ${new Date(parsePlayerTimestamp(expiresAt)).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}` : footer ?? "Player starten"}</span></div>
      </section>
    </div>
    {canShowQr ? <dialog className="px-code-dialog" ref={dialog} aria-labelledby="pairing-qr-title" onCancel={closeQr} onClose={() => { setQrOpen(false); qrTrigger.current?.focus(); }}><h2 id="pairing-qr-title">Scherm koppelen</h2><p>Scan deze tijdelijke code met VeyoCast Control.</p><img width="256" height="256" alt="QR-code met tijdelijke VeyoCast-koppelcode" src={`/api/player/pairing/qr?code=${encodeURIComponent(code!.replace(/ /g, ""))}`} /><button onClick={closeQr} type="button">Sluiten</button></dialog> : null}
  </Root>;
}

// Exact Lucide paths used by the immutable Source (ISC, lucide-react).
function Arrow() { return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>; }
function StatusIcon({ stage }: { stage: SyncPlayerStatusStage }) {
  if (stage === "verify") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (stage === "pairing") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><line x1="8" x2="16" y1="12" y2="12" /></svg>;
  if (stage === "recovery") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>;
  if (stage === "error") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
  return <img src="/assets/brand-icon.svg" alt="" />;
}
