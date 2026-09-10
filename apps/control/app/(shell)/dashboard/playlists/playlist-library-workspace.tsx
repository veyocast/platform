"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { BulkActionBar, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, IconButton } from "@veyocast/ui";
type PlaylistListRow = { id: string; name: string; description: string | null; status: string; revision: number; itemCount: number; assignedScreenCount: number };

export function PlaylistLibraryWorkspace({ rows, canWrite, archiveAction, deleteAction }: { rows: readonly PlaylistListRow[]; canWrite: boolean; archiveAction: (formData: FormData) => Promise<void>; deleteAction: (formData: FormData) => Promise<void> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectable = rows;
  const all = selectable.length > 0 && selectable.every((row) => selected.has(row.id));
  const toggleAll = () => setSelected(all ? new Set() : new Set(selectable.map((row) => row.id)));
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <>
    {canWrite ? <div className="selection-row"><label className="check-row"><input checked={all} onChange={toggleAll} type="checkbox" /><span>Alle playlists selecteren</span></label><span aria-live="polite">{selected.size} geselecteerd</span></div> : null}
    <div className="listFrame"><table className="data-table data-table--responsive"><caption>Playlists binnen de actieve vereniging.</caption><thead><tr><th>Selectie</th><th>Playlist</th><th>Status</th><th>Inhoud</th><th>Schermen</th><th>Acties</th></tr></thead><tbody>
      {rows.map((row) => <tr data-selected={selected.has(row.id)} key={row.id}><td data-label="Selectie"><input aria-label={`${row.name} selecteren`} checked={selected.has(row.id)} disabled={!canWrite} onChange={() => toggle(row.id)} type="checkbox" /></td><td data-label="Playlist"><span className="table-primary">{row.name}</span><span className="table-secondary">{row.description || "Geen beschrijving"}</span></td><td data-label="Status">{row.status}</td><td data-label="Inhoud">{row.itemCount} items</td><td data-label="Schermen">{row.assignedScreenCount}</td><td data-label="Acties"><span className="actions-inline"><IconButton asChild aria-label={`${row.name} bewerken`} title="Bewerken"><Link href={`/dashboard/playlists/${row.id}`}><Pencil aria-hidden="true" /></Link></IconButton>{canWrite ? <ConfirmArchive archiveAction={archiveAction} deleteAction={deleteAction} label={row.name} targets={[row]} /> : null}</span></td></tr>)}
    </tbody></table></div>
    {selected.size ? <BulkActionBar title={`${selected.size} geselecteerd`} description="Gearchiveerde playlists blijven herstelbaar; releases blijven ongewijzigd." actions={<><ConfirmArchive archiveAction={archiveAction} deleteAction={deleteAction} label={`${selected.size} geselecteerde playlists`} targets={rows.filter((row) => selected.has(row.id))} /><Button onClick={() => setSelected(new Set())} type="button" variant="secondary">Selectie wissen</Button></>} /> : null}
  </>;
}

function ConfirmArchive({ label, targets, archiveAction, deleteAction }: { label: string; targets: readonly PlaylistListRow[]; archiveAction: (formData: FormData) => Promise<void>; deleteAction: (formData: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ids = JSON.stringify(targets.map(({ id }) => id));
  return <Dialog onOpenChange={setOpen} open={open}><Button onClick={() => setOpen(true)} type="button" variant="destructive"><Trash2 aria-hidden="true" />Verwijderen</Button><DialogContent><DialogHeader><DialogTitle>{label} verwijderen?</DialogTitle><DialogDescription>Kies archiveren om herstelbaar te verwijderen, of definitief verwijderen om alle playlistdata te wissen.</DialogDescription></DialogHeader><div style={{ display: "flex", gap: 12 }}><form action={archiveAction}><input name="playlists" type="hidden" value={JSON.stringify(targets.map(({ id, revision }) => ({ id, revision })))} /><Button type="submit" variant="secondary">Archiveren</Button></form><form action={deleteAction}><input name="playlists" type="hidden" value={ids} /><Button type="submit" variant="destructive">Definitief verwijderen</Button></form></div><DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuleren</Button></DialogFooter></DialogContent></Dialog>;
}
