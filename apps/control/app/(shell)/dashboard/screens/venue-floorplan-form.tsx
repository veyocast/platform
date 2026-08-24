"use client";

import { Image as ImageIcon } from "lucide-react";
import { useState } from "react";

import { Button, ResourcePicker, type ResourcePickerItem } from "@veyocast/ui";

import type { ScreenFleetData } from "./screen-types";
import { createVenueFloorplan } from "./venue-actions";
import styles from "./venue-view.module.css";

export function VenueFloorplanForm({
  assets,
  venueId
}: {
  assets: ScreenFleetData["floorplanAssets"];
  venueId: string;
}) {
  const [height, setHeight] = useState("900");
  const [selectedId, setSelectedId] = useState("");
  const [width, setWidth] = useState("1600");
  const selected = assets.find((asset) => asset.id === selectedId) ?? null;
  const resources: ResourcePickerItem[] = assets.map((asset) => ({
    category: "Plattegronden",
    description: asset.width && asset.height ? `${asset.width} × ${asset.height} pixels` : "Afmetingen worden bij opslag gecontroleerd",
    id: `media:${asset.id}`,
    keywords: ["venue", "plattegrond", "floorplan"],
    kind: "media",
    name: asset.title,
    preview: <ImageIcon aria-hidden="true" />,
    source: "Media",
    status: { label: "Gereed", tone: "success" }
  }));

  function selectAsset(item: ResourcePickerItem) {
    const asset = assets.find((candidate) => item.id === `media:${candidate.id}`);
    if (!asset) return;
    setSelectedId(asset.id);
    if (asset.width) setWidth(String(asset.width));
    if (asset.height) setHeight(String(asset.height));
  }

  return <details><summary>Plattegrond instellen</summary>
    <form action={createVenueFloorplan} className={styles.stackForm}>
      <input name="venueId" type="hidden" value={venueId} />
      <input name="mediaAssetId" type="hidden" value={selectedId} />
      <label><span>Naam</span><input maxLength={120} name="name" placeholder="Begane grond" required /></label>
      <div className={styles.formRow}>
        <label><span>Breedte</span><input max={16000} min={320} name="width" onChange={(event) => setWidth(event.currentTarget.value)} required type="number" value={width} /></label>
        <label><span>Hoogte</span><input max={16000} min={240} name="height" onChange={(event) => setHeight(event.currentTarget.value)} required type="number" value={height} /></label>
      </div>
      {assets.length ? <ResourcePicker
        description="Kies een gereedstaande tenantafbeelding uit Media. Technische output en providerassets staan hier bewust niet tussen."
        items={resources}
        kinds={["media"]}
        onSelect={selectAsset}
        title="Plattegrond uit Media kiezen"
        trigger={<Button type="button" variant="secondary"><ImageIcon aria-hidden="true" /> {selected ? "Plattegrond wijzigen" : "Kies uit Media"}</Button>}
      /> : <p>Upload eerst een afbeelding in Media, of sla een code-native plattegrond zonder asset op.</p>}
      {selected ? <p className={styles.readOnly}><strong>Gekozen:</strong> {selected.title} <button onClick={() => setSelectedId("")} type="button">Keuze wissen</button></p> : null}
      <p>Zonder asset gebruikt VeyoCast de code-native kaart en blijft de toegankelijke lijstweergave volledig bruikbaar.</p>
      <Button type="submit">Plattegrond opslaan</Button>
    </form>
  </details>;
}
