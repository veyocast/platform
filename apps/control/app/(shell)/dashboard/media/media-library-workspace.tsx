"use client";

/* eslint-disable @next/next/no-img-element */
import { FileWarning, Image as ImageIcon, Video } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, DataTable, StatusPill } from "@veyocast/ui";

import { bulkOrganizeMediaAssets } from "./actions";

export type MediaLibraryAsset = {
  createdLabel: string;
  details: string;
  fileName: string;
  id: string;
  isFavorite: boolean;
  kind: "image" | "video";
  manageHref: string;
  previewUrl: string | null;
  status: string;
  statusLabel: string;
  statusTone: "critical" | "neutral" | "success" | "warning";
  title: string;
  usage: string;
};

type Option = { id: string; name: string };

export function MediaLibraryWorkspace({
  assets,
  canBulk,
  collections,
  folders,
  tags,
  view
}: {
  assets: readonly MediaLibraryAsset[];
  canBulk: boolean;
  collections: readonly Option[];
  folders: readonly Option[];
  tags: readonly Option[];
  view: "grid" | "list";
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const selectedIds = useMemo(() => [...selected], [selected]);

  if (!assets.length) {
    return <div className="notice" role="status"><strong>Nog geen media.</strong> Upload een afbeelding of video om je bibliotheek te vullen.</div>;
  }

  function toggle(assetId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  const selectionControl = (asset: MediaLibraryAsset) => (
    <label className="media-checkbox">
      <input
        aria-label={`${asset.title} selecteren`}
        checked={selected.has(asset.id)}
        disabled={!canBulk}
        onChange={() => toggle(asset.id)}
        type="checkbox"
      />
    </label>
  );

  return <>
    {canBulk ? <div className="media-selection-row">
      <label className="check-row">
        <input
          checked={selected.size === assets.length}
          onChange={() => setSelected(selected.size === assets.length ? new Set() : new Set(assets.map((asset) => asset.id)))}
          type="checkbox"
        />
        <span>Alles op deze pagina selecteren</span>
      </label>
      <span aria-live="polite">{selected.size} geselecteerd</span>
    </div> : null}

    {view === "grid" ? <div className="media-library-grid">
      {assets.map((asset) => <article className="media-library-card" data-selected={selected.has(asset.id)} key={asset.id}>
        <div className="media-card-selection">{selectionControl(asset)}</div>
        <LibraryPreview asset={asset} />
        <div className="media-library-card__body">
          <div className="work-panel__header"><div><h3>{asset.title}</h3><p className="work-panel__meta">{asset.fileName}</p></div><StatusPill label={asset.statusLabel} tone={asset.statusTone} /></div>
          <p className="work-panel__meta">{asset.isFavorite ? "Favoriet · " : ""}{asset.details} · {asset.usage}</p>
          <Button asChild size="sm" variant="ghost"><a href={asset.manageHref}>Beheren en verwijderen</a></Button>
        </div>
      </article>)}
    </div> : <DataTable caption="Media binnen de actieve vereniging." tableKey="media">
      <thead><tr><th scope="col">Selectie</th><th data-column="type" scope="col">Type</th><th data-column="name" scope="col">Media</th><th data-column="details" scope="col">Details</th><th data-column="status" scope="col">Status</th><th data-column="usage" scope="col">Gebruik</th><th data-column="created" scope="col">Toegevoegd</th><th data-column="actions" scope="col">Actie</th></tr></thead>
      <tbody>{assets.map((asset) => <tr data-selected={selected.has(asset.id)} key={asset.id}>
        <td data-label="Selectie">{selectionControl(asset)}</td>
        <td data-column="type" data-label="Type"><MediaType asset={asset} /></td>
        <td data-column="name" data-label="Media"><span className="table-primary">{asset.isFavorite ? "★ " : ""}{asset.title}</span><span className="table-secondary">{asset.fileName}</span></td>
        <td data-column="details" data-label="Details">{asset.details}</td>
        <td data-column="status" data-label="Status"><StatusPill label={asset.statusLabel} tone={asset.statusTone} /></td>
        <td data-column="usage" data-label="Gebruik">{asset.usage}</td>
        <td data-column="created" data-label="Toegevoegd">{asset.createdLabel}</td>
        <td data-column="actions" data-label="Actie"><Button asChild size="sm" variant="ghost"><a href={asset.manageHref}>Beheren</a></Button></td>
      </tr>)}</tbody>
    </DataTable>}

    {selected.size > 0 ? <form action={async (formData) => {
      const message = await bulkOrganizeMediaAssets(formData);
      window.location.assign(`/dashboard/media?succes=${encodeURIComponent(message)}`);
    }} aria-label="Bulkacties voor geselecteerde media" className="media-bulk-bar">
      <input name="assetIds" type="hidden" value={JSON.stringify(selectedIds)} />
      <div><strong>{selected.size} geselecteerd</strong><span>Pas één organisatieactie toe; onbeschikbare items worden expliciet overgeslagen.</span></div>
      <label><span>Actie</span><select name="bulkCommand" required defaultValue="">
        <option disabled value="">Kies een actie</option>
        <option value="favorite">Favoriet maken</option>
        <option value="unfavorite">Uit favorieten verwijderen</option>
        <optgroup label="Verplaatsen naar map"><option value="move:root">Hoofdniveau</option>{folders.map((folder) => <option key={folder.id} value={`move:${folder.id}`}>{folder.name}</option>)}</optgroup>
        {tags.length ? <optgroup label="Tag toevoegen">{tags.map((tag) => <option key={tag.id} value={`tag:add:${tag.id}`}>{tag.name}</option>)}</optgroup> : null}
        {tags.length ? <optgroup label="Tag verwijderen">{tags.map((tag) => <option key={tag.id} value={`tag:remove:${tag.id}`}>{tag.name}</option>)}</optgroup> : null}
        {collections.length ? <optgroup label="Aan collectie toevoegen">{collections.map((collection) => <option key={collection.id} value={`collection:add:${collection.id}`}>Toevoegen: {collection.name}</option>)}</optgroup> : null}
        {collections.length ? <optgroup label="Uit collectie verwijderen">{collections.map((collection) => <option key={collection.id} value={`collection:remove:${collection.id}`}>Verwijderen: {collection.name}</option>)}</optgroup> : null}
      </select></label>
      <Button type="submit">Toepassen</Button>
      <Button onClick={() => setSelected(new Set())} type="button" variant="secondary">Selectie wissen</Button>
    </form> : null}
  </>;
}

function LibraryPreview({ asset }: { asset: MediaLibraryAsset }) {
  if (!asset.previewUrl) return <div className="media-card__preview" data-kind={asset.kind}>{asset.statusLabel}</div>;
  if (asset.kind === "video") return <div className="media-card__preview" data-kind="video"><Video aria-hidden="true" /><span>Video</span></div>;
  return <img alt={`Voorbeeld van ${asset.title}`} className="media-card__preview" src={asset.previewUrl} />;
}

function MediaType({ asset }: { asset: MediaLibraryAsset }) {
  if (["validation_failed", "quarantined"].includes(asset.status)) return <span className="media-type media-type--failed" aria-label="Afgewezen media" role="img"><FileWarning aria-hidden="true" /></span>;
  if (asset.kind === "video") return <span className="media-type media-type--video" aria-label="Video" role="img"><Video aria-hidden="true" /></span>;
  return <span className="media-type" aria-label="Afbeelding" role="img"><ImageIcon aria-hidden="true" /></span>;
}
