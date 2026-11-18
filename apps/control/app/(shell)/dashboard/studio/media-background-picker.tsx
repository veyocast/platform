"use client";

import { useState } from "react";
import { AssetImage } from "@veyocast/content-templates/sites-media";
import Link from "next/link";
import { Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@veyocast/ui";
import styles from "./media-background-picker.module.css";

export type BackgroundImageChoice = {
  id: string;
  title: string;
  url: string | null;
  checksumSha256: string;
};

export function MediaBackgroundPicker({ images, selectedId, onSelect, disabled = false }: {
  images: readonly BackgroundImageChoice[];
  selectedId?: string;
  onSelect: (image: BackgroundImageChoice) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = images.find(image => image.id === selectedId);
  return <div className={styles.picker}>
    {selectedId && <p className={styles.current}>Gekozen achtergrond: <strong>{selected?.title ?? "Eerder gekozen afbeelding"}</strong></p>}
    <Dialog open={open && !disabled} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary" disabled={disabled} onClick={() => setSearch("")}>Kies uit Media</Button></DialogTrigger>
      <DialogContent className={styles.dialog}>
        <DialogHeader><DialogTitle>Achtergrond uit Media kiezen</DialogTitle><DialogDescription>Alleen een afbeelding selecteren wijzigt deze slide. De clubstijl en standaardachtergrond blijven ongewijzigd.</DialogDescription></DialogHeader>
        <DialogBody>
          <label className={styles.search}>Zoek afbeelding<input value={search} onChange={event => setSearch(event.target.value)} type="search" /></label>
          <div className={styles.grid}>
            {images.filter(image => image.title.toLocaleLowerCase("nl").includes(search.toLocaleLowerCase("nl"))).map(image => <button key={image.id} type="button" aria-label={`Gebruik ${image.title} als achtergrond`} aria-pressed={selectedId === image.id} onClick={() => { if (!disabled) { onSelect(image); setOpen(false); } }}>
              {image.url && <AssetImage src={image.url} alt="" />}
              <span>{image.title}</span>
            </button>)}
          </div>
          {!images.length && <p>Er zijn nog geen geschikte, verwerkte afbeeldingen beschikbaar. Upload een afbeelding bij Media en open het ontwerp opnieuw. Video blijft beschikbaar als slide-inhoud, niet als fotoachtergrond.</p>}
          <div className={styles.actions}><Button variant="secondary" onClick={() => setOpen(false)}>Annuleren</Button><Button asChild variant="ghost"><Link href="/dashboard/media">Media openen</Link></Button></div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  </div>;
}
