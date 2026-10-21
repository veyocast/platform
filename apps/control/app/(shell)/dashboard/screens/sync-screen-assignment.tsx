"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useId, useState } from "react";
import type { FleetRelease, FleetScreen } from "./data";
import { screenAssignmentReviewHref } from "./sync-screen-assignment-context";
import styles from "./sync-screen-assignment.module.css";

export function SyncScreenAssignment({ screen, releases, canAssign, error }: {
  screen: Pick<FleetScreen, "id" | "name" | "status" | "defaultPlaylistId" | "assignedPlaylistId">;
  releases: readonly FleetRelease[];
  canAssign: boolean;
  error: string | null;
}) {
  const selectId = useId(), currentPlaylistId = screen.defaultPlaylistId ?? screen.assignedPlaylistId;
  const [releaseId, setReleaseId] = useState(() => releases.find(release => release.playlistId === currentPlaylistId)?.id ?? "");
  const selected = releases.find(release => release.id === releaseId);
  const href = selected ? screenAssignmentReviewHref(selected.id, screen.id) : null;
  if (error) return <p className={styles.message} role="alert"><strong>De publicatiekeuze kon niet worden geladen.</strong> Er is niets gewijzigd. Sluit dit venster en vernieuw het scherm om opnieuw te proberen.</p>;
  if (!canAssign || screen.status === "disabled") return <p className={styles.message} role="status">{screen.status === "disabled" ? "Dit scherm is uitgeschakeld. Activeer het scherm voordat je een publicatie toewijst." : "Je kunt de huidige publicatie bekijken. Vraag een beheerder om publicatierechten om een andere playlist klaar te zetten."}</p>;
  if (!releases.length) return <div className={styles.picker}><p className={styles.message} role="status"><strong>Nog geen gepubliceerde playlist.</strong> Publiceer eerst bewust een playlist. Hier wordt geen concept automatisch gepubliceerd.</p><Link className={styles.secondary} href="/dashboard/playlists">Open playlists <ArrowRight aria-hidden="true" size={16} /></Link></div>;
  return <div className={styles.picker}>
    <p>Kies een playlist voor <strong>{screen.name}</strong>.</p>
    <label className={styles.field} htmlFor={selectId}><span>Playlist</span><select id={selectId} onChange={event => setReleaseId(event.currentTarget.value)} value={releaseId}><option value="">Kies een gepubliceerde playlist</option>{releases.map(release => <option key={release.id} value={release.id}>{release.playlistName} · versie {release.version}</option>)}</select></label>
    {selected ? <p className={styles.selection}>Bestaande publicatie: <strong>{selected.playlistName} · versie {selected.version}</strong></p> : <p className={styles.selection}>Kies een playlist om de publicatie te controleren. Er is geen andere playlist automatisch geselecteerd.</p>}
    <div className={styles.safety}><ShieldCheck aria-hidden="true" size={20} /><p>De laatste goede versie blijft spelen tot de nieuwe publicatie volledig is voorbereid. Je bevestigt de toewijzing pas bij de volgende controle.</p></div>
    {href ? <Link className={styles.primary} href={href}>Publicatie controleren <ArrowRight aria-hidden="true" size={16} /></Link> : <button className={styles.primary} disabled type="button">Publicatie controleren <ArrowRight aria-hidden="true" size={16} /></button>}
  </div>;
}
