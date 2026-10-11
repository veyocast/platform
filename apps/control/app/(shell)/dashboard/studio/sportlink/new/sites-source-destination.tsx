"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@veyocast/ui";
import { prepareSitesSourceDestination, type SitesSourceDestinationPrepareResult } from "./sites-source-destination-actions";
import { toggleSitesSourceDestinationScreens, type SitesSourceDestination, type SitesSourceDestinationOptions } from "./sites-source-destination-model";
import { pollSitesSourceDestination } from "./sites-source-destination-poll";
import styles from "./sites-source-destination.module.css";
export function SitesSourceDestinationPicker({ options, value, onChange }: { options: SitesSourceDestinationOptions; value: SitesSourceDestination; onChange: (value: SitesSourceDestination) => void }) {
  const modeId = useId();
  return <div className={styles.picker}><label><input type="radio" name={modeId} checked={value.mode === "save"} onChange={() => onChange({ ...value, mode: "save" })} />Alleen ontwerp opslaan</label><label><input type="radio" name={modeId} disabled={!options.canPublish || options.unavailable} checked={value.mode === "publish"} onChange={() => onChange({ ...value, mode: "publish" })} />Toevoegen aan playlist en schermpublicatie voorbereiden</label>
    {options.unavailable && <p role="alert">De bestemmingen konden niet worden geladen. Je kunt het ontwerp veilig opslaan. Vernieuw de pagina om een bestemming te kiezen.</p>}
    {value.mode === "publish" && <><label className={styles.field}><span>Playlist</span><select value={value.playlistId} onChange={event => { const playlist = options.playlists.find(item => item.id === event.target.value); onChange({ ...value, playlistId: playlist?.id ?? "", expectedRevision: playlist?.revision ?? 0 }); }}><option value="">Kies een opgeslagen playlist</option>{options.playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select></label><Button asChild variant="secondary"><Link href="/dashboard/playlists" target="_blank" rel="noopener noreferrer">Nieuwe playlist maken</Link></Button><fieldset><legend>Schermen of schermgroepen</legend>{options.groups.filter(group => group.screenIds.length).map(group => <label key={group.id}><input type="checkbox" checked={group.screenIds.every(id => value.screenIds.includes(id))} disabled={!group.screenIds.every(id => value.screenIds.includes(id)) && new Set([...value.screenIds, ...group.screenIds]).size > 100} onChange={event => onChange({ ...value, screenIds: toggleSitesSourceDestinationScreens(value.screenIds, group.screenIds, event.target.checked) })} />{group.name} · {group.screenIds.length} schermen</label>)}{options.screens.map(screen => <label key={screen.id}><input type="checkbox" checked={value.screenIds.includes(screen.id)} disabled={!value.screenIds.includes(screen.id) && value.screenIds.length >= 100} onChange={event => onChange({ ...value, screenIds: toggleSitesSourceDestinationScreens(value.screenIds, [screen.id], event.target.checked) })} />{screen.name} · {screen.orientation === "portrait" ? "staand" : "liggend"}</label>)}{!options.screens.length && <p>Er zijn geen actieve schermen. Koppel eerst een scherm via Schermen.</p>}</fieldset><p>{value.screenIds.length} unieke schermen. Na opslaan worden gereedstaande ontwerpen atomair toegevoegd. Een ontwerp speelt minimaal vijf seconden per playlistitem. Daarna controleer en bevestig je de daadwerkelijke schermpublicatie.</p></>}
  </div>;
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
  if (destination.mode !== "publish") return null;
  return <section className={styles.afterSave} aria-label="Gekozen bestemming"><h3>Je gekozen bestemming</h3>{result?.outcome === "ready" ? <><p>De ontwerpen zijn aan je gekozen conceptplaylist toegevoegd. Je huidige schermpublicatie blijft actief totdat je de volgende controle bevestigt.</p><Button asChild variant="primary"><Link href={result.url}>Schermen controleren en publiceren</Link></Button></> : <><p role={result?.outcome === "failed" || result?.outcome === "conflict" ? "alert" : "status"}>{result?.message ?? "Je opgeslagen ontwerpen en bestemming worden gecontroleerd…"}</p><Button type="button" variant="secondary" disabled={pending} onClick={() => setRetry(value => value + 1)}>Status controleren of opnieuw proberen</Button><Button asChild variant="secondary"><Link href={`/dashboard/playlists/${destination.playlistId}`}>Gekozen playlist openen</Link></Button></>}</section>;
}
