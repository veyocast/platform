"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { BulkActionBar, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, IconButton } from "@veyocast/ui";
import { archivePlaylists } from "./actions";
import type { PlaylistListRow } from "./data";

export function PlaylistLibraryWorkspace({ rows, canWrite }: { rows: readonly PlaylistListRow[]; canWrite: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const editable = rows.filter((row) => row.status !== "archived");
  const all = editable.length > 0 && editable.every((row) => selected.has(row.id));
  const toggleAll = () => setSelected(all ? new Set() : new Set(editable.map((row) => row.id)));
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <>
    {canWrite ? <div className="selection-row"><label className="check-row"><input checked={all} onChange={toggleAll} type="checkbox" /><span>Alle bewerkbare playlists selecteren</span></label><span aria-live="polite">{selected.size} geselecteerd</span></div> : null}
    <div className="listFrame"><table className="data-table data-table--responsive"><caption>Playlists binnen de actieve vereniging.</caption><thead><tr><th>Selectie</th><th>Playlist</th><th>Status</th><th>Inhoud</th><th>Schermen</th><th>Acties</th></tr></thead><tbody>
      {rows.map((row) => <tr data-selected={selected.has(row.id)} key={row.id}><td data-label="Selectie"><input aria-label={`${row.name} selecteren`} checked={selected.has(row.id)} disabled={!canWrite || row.status === "archived"} onChange={() => toggle(row.id)} type="checkbox" /></td><td data-label="Playlist"><span className="table-primary">{row.name}</span><span className="table-secondary">{row.description || "Geen beschrijving"}</span></td><td data-label="Status">{row.status}</td><td data-label="Inhoud">{row.itemCount} items</td><td data-label="Schermen">{row.assignedScreenCount}</td><td data-label="Acties"><span className="actions-inline"><IconButton asChild aria-label={`${row.name} bewerken`} title="Bewerken"><Link href={`/dashboard/playlists/${row.id}`}><Pencil aria-hidden="true" /></Link></IconButton>{canWrite && row.status !== "archived" ? <ConfirmArchive label={row.name} targets={[row]} /> : null}</span></td></tr>)}
    </tbody></table></div>
    {selected.size ? <BulkActionBar title={`${selected.size} geselecteerd`} description="Gearchiveerde playlists blijven herstelbaar; releases blijven ongewijzigd." actions={<><ConfirmArchive label={`${selected.size} geselecteerde playlists`} targets={rows.filter((row) => selected.has(row.id))} /><Button onClick={() => setSelected(new Set())} type="button" variant="secondary">Selectie wissen</Button></>} /> : null}
  </>;
}

function ConfirmArchive({ label, targets }: { label: string; targets: readonly PlaylistListRow[] }) {
  const [open, setOpen] = useState(false);
  return <Dialog onOpenChange={setOpen} open={open}><Button onClick={() => setOpen(true)} type="button" variant="destructive"><Trash2 aria-hidden="true" />Verwijderen</Button><DialogContent><DialogHeader><DialogTitle>{label} verwijderen?</DialogTitle><DialogDescription>De playlist wordt gearchiveerd. Gepubliceerde releases blijven beschikbaar.</DialogDescription></DialogHeader><form action={archivePlaylists}><input name="playlists" type="hidden" value={JSON.stringify(targets.map(({ id, revision }) => ({ id, revision })))} /><DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuleren</Button><Button type="submit" variant="destructive">Bevestigen en verwijderen</Button></DialogFooter></form></DialogContent></Dialog>;
}
