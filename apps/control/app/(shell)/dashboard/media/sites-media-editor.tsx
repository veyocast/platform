"use client";

/* eslint-disable @next/next/no-img-element */
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@veyocast/ui";
import type { MediaLibraryAsset } from "./media-library-workspace";
import { saveSitesMediaMetadata, type SitesMediaMetadataResult } from "./sites-media-metadata-actions";
import styles from "./sites-media.module.css";

export function SitesMediaEditor({ asset, canWrite, folders, onClose, addAction, archiveAction }: {
  asset: MediaLibraryAsset;
  canWrite: boolean;
  folders: readonly { id: string; name: string }[];
  onClose: () => void;
  addAction: (pending: boolean) => ReactNode;
  archiveAction: (pending: boolean) => ReactNode;
}) {
  const router = useRouter(), pendingRef = useRef(false);
  const [title, setTitle] = useState(asset.title), [folderId, setFolderId] = useState(asset.folderId ?? ""), [tags, setTags] = useState(asset.tagLabels.join(",")), [collections, setCollections] = useState((asset.collectionLabels ?? []).join(",")), [favorite, setFavorite] = useState(asset.isFavorite);
  const [pending, setPending] = useState(false), [notice, setNotice] = useState<SitesMediaMetadataResult | null>(null), [confirmClose, setConfirmClose] = useState(false);
  const command = useRef<string | null>(null);
  const dirty = title !== asset.title || folderId !== (asset.folderId ?? "") || tags !== asset.tagLabels.join(",") || collections !== (asset.collectionLabels ?? []).join(",") || favorite !== asset.isFavorite;
  function close() { if (pendingRef.current) return; if (dirty) setConfirmClose(true); else onClose(); }
  async function save() {
    if (pendingRef.current || !canWrite) return;
    if (!command.current) command.current = crypto.randomUUID();
    pendingRef.current = true; setPending(true); setNotice(null);
    const form = new FormData();
    for (const [name, value] of Object.entries({ assetId: asset.id, expectedUpdatedAt: asset.updatedAt ?? "", idempotencyKey: command.current, title, folderId, tags, collections })) form.set(name, value);
    if (favorite) form.set("favorite", "on");
    try {
      const result = await saveSitesMediaMetadata(form); setNotice(result);
      if (result.status === "saved") { router.refresh(); onClose(); }
    } catch { setNotice({ status: "error", message: "De opslagbevestiging kon niet worden ontvangen. Je invoer blijft behouden; probeer dezelfde opslagactie opnieuw." }); }
    finally { pendingRef.current = false; setPending(false); }
  }
  function changed(change: () => void) { if (pendingRef.current) return; change(); command.current = null; setNotice(null); }
  return <Dialog open onOpenChange={next => { if (!next) close(); }}>
    <DialogContent className={`sites-control demo-modal wide ${styles.page} ${styles.mobileMedia} ${styles.metadataDialog}`} size="wide" showClose={false} onEscapeKeyDown={event => { if (dirty || pending) { event.preventDefault(); close(); } }} onPointerDownOutside={event => { if (dirty || pending) { event.preventDefault(); close(); } }}>
      <div className="demo-modal-heading"><DialogTitle>{asset.title}</DialogTitle><button aria-label="Mediavenster sluiten" className="demo-icon" disabled={pending} onClick={close} type="button"><X aria-hidden="true" size={20} /></button></div>
      <div className={styles.previewLayout}>
        <div className={styles.imagePreview}>{asset.previewUrl ? asset.kind === "video" ? <video controls muted preload="metadata" src={asset.previewUrl}><track kind="captions" /></video> : <img alt={asset.title} src={asset.previewUrl} /> : <p>Voorbeeld niet beschikbaar. Controleer de verwerking en probeer opnieuw.</p>}</div>
        <div className={styles.inspector}>
          <span className={`demo-badge ${asset.status === "ready" ? "" : "orange"}`}><i aria-hidden="true" />{asset.status === "ready" ? asset.draftCount + asset.releaseCount > 0 ? "In gebruik" : "Klaar voor gebruik" : asset.statusLabel}</span>
          <label className="demo-field"><span>Naam</span><input disabled={!canWrite || pending} maxLength={120} onChange={event => changed(() => setTitle(event.target.value))} value={title} /></label>
          <label className="demo-field"><span>Map</span><select disabled={!canWrite || pending} onChange={event => changed(() => setFolderId(event.target.value))} value={folderId}><option value="">Hoofdniveau</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
          <label className="demo-field"><span>Tags · gescheiden door komma’s</span><input disabled={!canWrite || pending} maxLength={2500} onChange={event => changed(() => setTags(event.target.value))} placeholder="club, zomer, jeugd" value={tags} /></label>
          <label className="demo-field"><span>Collecties · gescheiden door komma’s</span><input disabled={!canWrite || pending} maxLength={2500} onChange={event => changed(() => setCollections(event.target.value))} placeholder="Seizoensopening, Wedstrijddag" value={collections} /></label>
          <label className={styles.checkLabel}><input checked={favorite} disabled={!canWrite || pending} onChange={event => changed(() => setFavorite(event.target.checked))} type="checkbox" />Favoriet beeld</label>
          <div className={styles.usageBox}><strong>{asset.usage}</strong>{asset.draftCount + asset.releaseCount === 0 ? <span>Nog geen playlistgebruik</span> : null}</div>
          {notice ? <p className={styles.metadataNotice} role="alert">{notice.message}</p> : null}
          <button className="demo-button primary" disabled={!canWrite || pending || title.trim().length < 2 || !asset.updatedAt} onClick={() => void save()} type="button">{pending ? "Opslaan…" : "Wijzigingen opslaan"}</button>
          {addAction(pending)}<div className={styles.archiveAction}>{archiveAction(pending)}</div>
          <a className={styles.metadataDetails} href={asset.manageHref} onClick={event => { if (dirty || pending) { event.preventDefault(); close(); } }}>Bestandsdetails en gebruik bekijken</a>
          {!canWrite ? <p className={styles.metadataNotice}>Alleen lezen. Je hebt geen rechten om deze media te wijzigen.</p> : null}
        </div>
      </div>
      {confirmClose ? <div className={styles.metadataConfirm} role="alert"><strong>Je hebt nog wijzigingen</strong><p>Bewaar je invoer of sluit zonder deze wijzigingen op te slaan.</p><button className="demo-button" onClick={() => setConfirmClose(false)} type="button">Verder bewerken</button><button className="demo-button" onClick={onClose} type="button">Wijzigingen verwerpen</button></div> : null}
    </DialogContent>
  </Dialog>;
}
