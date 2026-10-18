"use client";

/* eslint-disable @next/next/no-img-element -- Uses an existing private immutable publication preview. */
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3, Eye, Layers3, Maximize2, Monitor, Send, Settings2, ShieldCheck, Signal } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@veyocast/ui";
import { screenPlaybackEvidence, type SyncScreenTab } from "./sync-screen-detail-model";
import type { FleetDevice, FleetRelease, FleetScreen } from "./data";
import type { FrozenReleasePreview } from "../../../../lib/release-preview.server";
import styles from "./sync-screen-detail.module.css";

const tabs = [
  ["overview", "Overzicht", Signal], ["layout", "Schermindeling", Layers3],
  ["hours", "Bedrijfstijden", Clock3], ["health", "Gezondheid", ShieldCheck],
  ["device", "Apparaat", Settings2],
] as const;

export function SyncScreenDetail({ screen, device, releases, groupLabel, preview, activeTab, legacyTab, canManage, canAssign, notices, overview, content, planning, layout, hours, health, deviceContent, player, settings, activity, assignment }: {
  screen: FleetScreen; device: FleetDevice | null; releases: readonly FleetRelease[];
  groupLabel: string; preview?: FrozenReleasePreview; activeTab: SyncScreenTab; legacyTab?: string;
  canManage: boolean; canAssign: boolean;
  notices: ReactNode; overview: ReactNode; content: ReactNode; planning: ReactNode; layout: ReactNode;
  hours: ReactNode; health: ReactNode; deviceContent: ReactNode; player: ReactNode; settings: ReactNode; activity: ReactNode; assignment: ReactNode;
}) {
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const editTrigger = useRef<HTMLButtonElement>(null);
  const assignmentTrigger = useRef<HTMLButtonElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const evidence = screenPlaybackEvidence(device);
  const confirmed = releases.find(release => release.id === evidence.confirmedReleaseId);
  const desired = releases.find(release => release.id === device?.desiredReleaseId);
  const status = screen.status === "disabled" ? "Uitgeschakeld" : screen.status === "maintenance" ? "Onderhoud" : evidence.contact === "online" ? "Bereikbaar" : evidence.contact === "offline" ? "Offline" : "Status onbekend";
  const headline = evidence.desiredConfirmed ? "Je verhaal is in beeld." : evidence.confirmedReleaseId && device?.desiredReleaseId === evidence.confirmedReleaseId ? "Je laatste bevestigde verhaal." : device?.desiredReleaseId ? "Een nieuwe versie staat klaar." : "Klaar voor de eerste publicatie.";
  const healthDescription = !device ? "Koppel eerst een Player. Er is nog geen publicatie door dit apparaat bevestigd." : evidence.desiredConfirmed ? "De Player heeft een zichtbaar frame van de gewenste publicatie bevestigd." : evidence.confirmedReleaseId ? "De vorige inhoud blijft spelen totdat alle bestanden klaar zijn en een nieuw beeld is bevestigd." : "De Player wacht op de eerste volledig voorbereide en bevestigde publicatie.";
  const version = (release: FleetRelease | undefined) => release ? `v${release.version}` : "Nog niet bevestigd";
  const image = preview ? <img alt={`Publicatievoorbeeld: ${preview.title}`} src={preview.url} /> : <div className={styles.noPreview}><Monitor size={34} aria-hidden="true" /><strong>Nog geen bevestigd publicatievoorbeeld</strong><p>Een toewijzing is nog geen bevestiging door de Player.</p></div>;

  return <div className={`px-pages ${styles.root}`}>
    <Link className="px-back" href="/dashboard/screens"><ArrowLeft size={16} aria-hidden="true" />Alle schermen</Link>
    <header className="section-header"><div><div className="eyebrow">SCHERMDETAIL</div><h1>{screen.name}</h1><p>{screen.location || "Geen locatie"} · {device?.platform || "Nog geen Player"} · {groupLabel || "Geen groep"}</p></div><div className="header-actions"><button className="btn btn-secondary" disabled={!canManage} type="button" onClick={event => { editTrigger.current = event.currentTarget; setEditOpen(true); }}>Bewerken</button><button className="btn btn-primary" disabled={!preview} type="button" onClick={event => { previewTrigger.current = event.currentTarget; setPreviewOpen(true); }}>Voorbeeld bekijken <Eye size={15} aria-hidden="true" /></button></div></header>
    {notices}
    <div className="px-detail-top">
      <div className={`px-detail-preview ${styles.preview}${screen.orientation === "portrait" ? ` portrait ${styles.portrait}` : ""}`}>{image}{preview ? <button className="px-preview-launch" type="button" onClick={event => { previewTrigger.current = event.currentTarget; setPreviewOpen(true); }}><Maximize2 size={16} aria-hidden="true" />Publicatievoorbeeld</button> : null}</div>
      <div className="card px-health-panel"><div className="row between"><span className="px-overline">HET SCHERM VANDAAG</span><span className={`badge ${evidence.contact === "online" && screen.status === "active" ? "badge-green" : ""}`}>{status}</span></div><h2 className={styles.healthHeading}>{headline}</h2><p className="muted">{healthDescription}</p><div className="px-confirmation"><div><Eye size={18} aria-hidden="true" /><span>Laatst bevestigd<strong>{version(confirmed)}</strong></span></div><div><Send size={18} aria-hidden="true" /><span>Klaargezet<strong>{desired ? `v${desired.version}` : "Nog geen publicatie"}</strong></span></div></div><button className="btn btn-secondary" disabled={!canAssign} type="button" onClick={event => { assignmentTrigger.current = event.currentTarget; setAssignmentOpen(true); }}>Playlist toewijzen <ArrowRight size={15} aria-hidden="true" /></button><div className="px-demo-note">Publicatievoorbeeld uit opgeslagen bytes · geen live screenshot van het scherm</div></div>
    </div>
    <div className="px-detail-shell"><nav className={`px-tabs ${styles.tabs}`} aria-label="Schermdetails">{tabs.map(([id, label, Icon]) => <Link aria-current={activeTab === id ? "page" : undefined} className={activeTab === id ? "active" : ""} href={`/dashboard/screens/${screen.id}?tab=${id}`} key={id}><Icon size={16} aria-hidden="true" />{label}</Link>)}</nav><div className={`px-tab-content ${styles.content}`}>
      {activeTab === "overview" ? <>{overview}<details open={legacyTab === "content"} className={styles.advanced}><summary>Content en publicaties</summary>{content}</details><details open={legacyTab === "planning"} className={styles.advanced}><summary>Planning en prioriteit</summary>{planning}</details></> : null}
      {activeTab === "layout" ? layout : null}
      {activeTab === "hours" ? hours : null}
      {activeTab === "health" ? <>{health}<details open={legacyTab === "activity"} className={styles.advanced}><summary>Activiteit en historie</summary>{activity}</details></> : null}
      {activeTab === "device" ? <>{deviceContent}<details open={legacyTab === "player"} className={styles.advanced}><summary>Playerbeheer en devicehistorie</summary>{player}</details>{!editOpen ? <details open={legacyTab === "settings"} className={styles.advanced}><summary>Schermgegevens, groepen en lifecycle</summary>{settings}</details> : null}</> : null}
    </div></div>
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}><DialogContent className={styles.dialog} size="wide" onCloseAutoFocus={event => { event.preventDefault(); previewTrigger.current?.focus(); }}><DialogHeader><DialogTitle>Publicatievoorbeeld</DialogTitle><DialogDescription>Opgeslagen voorbeeld van de laatst bevestigde publicatie. Dit is geen live screenshot of fysieke beeldcontrole.</DialogDescription></DialogHeader><DialogBody><div className={`${styles.previewImage}${screen.orientation === "portrait" ? ` ${styles.portrait}` : ""}`}>{image}</div></DialogBody></DialogContent></Dialog>
    <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className={styles.dialog} size="wide" onCloseAutoFocus={event => { event.preventDefault(); editTrigger.current?.focus(); }}><DialogHeader><DialogTitle>Schermgegevens</DialogTitle><DialogDescription>Bewaar bestaande scherminstellingen, groepen en beveiligde beheeracties.</DialogDescription></DialogHeader><DialogBody>{editOpen ? settings : null}</DialogBody></DialogContent></Dialog>
    <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}><DialogContent className={styles.dialog} onCloseAutoFocus={event => { event.preventDefault(); assignmentTrigger.current?.focus(); }}><DialogHeader><DialogTitle>Playlist klaarzetten</DialogTitle><DialogDescription>De laatste goede versie blijft spelen tot de nieuwe publicatie volledig is voorbereid en bevestigd.</DialogDescription></DialogHeader><DialogBody>{assignmentOpen ? assignment : null}</DialogBody></DialogContent></Dialog>
  </div>;
}
