"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@veyocast/ui";
import { prepareSitesSourceDestination, type SitesSourceDestinationPrepareResult } from "./sites-source-destination-actions";
import { type SitesSourceDestination, type SitesSourceDestinationOptions } from "./sites-source-destination-model";
import { pollSitesSourceDestination } from "./sites-source-destination-poll";
import styles from "./sites-source-destination.module.css";
export function SitesSourceDestinationPicker({ options, value, onChange }: { options: SitesSourceDestinationOptions; value: SitesSourceDestination; onChange: (value: SitesSourceDestination) => void }) {
  useEffect(()=>{if(value.mode!=="save")onChange({...value,mode:"save",playlistId:"",screenIds:[]});},[value,onChange]);
  return <div className={styles.picker}><p>Je ontwerp wordt opgeslagen in de slidebibliotheek. Open daarna een playlist en kies Inhoud toevoegen om je slides te selecteren.</p><Button asChild variant="secondary"><Link href="/dashboard/playlists">Playlists openen</Link></Button>{options.unavailable&&<p>De schermstatus is niet beschikbaar. Dat verhindert het opslaan van je ontwerp niet.</p>}</div>;
}
export function SitesSourceDestinationAfterSave({ destination, designs }: { destination: SitesSourceDestination; designs: Array<{ slideId: string; snapshotId?: string; menuRevision?: number; durationSeconds: number }> }) {
  const [result, setResult] = useState<SitesSourceDestinationPrepareResult | null>(null); const [pending, setPending] = useState(false); const [retry, setRetry] = useState(0);
  const command = useRef<{ signature: string; key: string; designs: Parameters<typeof prepareSitesSourceDestination>[0]["designs"] } | null>(null);
  const signature = JSON.stringify({ destination, designs });
  if (command.current?.signature !== signature) command.current = { signature, key: crypto.randomUUID(), designs: designs.map(design => ({ ...design, clientId: crypto.randomUUID() })) };
  useEffect(() => {
    if (destination.mode !== "publish") return;
    const saved = command.current!;
    return pollSitesSourceDestination({ command: { destination, designs: saved.designs, idempotencyKey: saved.key }, prepare: prepareSitesSourceDestination, onResult: setResult, onPending: setPending });
  // The serialized destination/identities are the effect dependency; a rerender
  // must not regenerate a batch key or add the same design again.
  }, [signature, retry]);
  if (destination.mode !== "publish") return <section className={styles.afterSave}><p>Voeg je opgeslagen ontwerp vanuit de slidebibliotheek aan een playlist toe.</p><Button asChild variant="primary"><Link href="/dashboard/playlists">Naar playlists</Link></Button></section>;
  return <section className={styles.afterSave} aria-label="Gekozen bestemming"><h3>Je gekozen bestemming</h3>{result?.outcome === "ready" ? <><p>De ontwerpen zijn aan je gekozen conceptplaylist toegevoegd. Je huidige schermpublicatie blijft actief totdat je de volgende controle bevestigt.</p><Button asChild variant="primary"><Link href={result.url}>Schermen controleren en publiceren</Link></Button></> : <><p role={result?.outcome === "failed" || result?.outcome === "conflict" ? "alert" : "status"}>{result?.message ?? "Je opgeslagen ontwerpen en bestemming worden gecontroleerd…"}</p><Button type="button" variant="secondary" disabled={pending} onClick={() => setRetry(value => value + 1)}>Status controleren of opnieuw proberen</Button><Button asChild variant="secondary"><Link href={`/dashboard/playlists/${destination.playlistId}`}>Gekozen playlist openen</Link></Button></>}</section>;
}
