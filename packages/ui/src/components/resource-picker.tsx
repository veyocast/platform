"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { cn } from "../utils";
import { Badge, type BadgeStatus } from "./badge";
import { Button } from "./button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "./dialog";
import { TextInput } from "./field";

export type ResourceKind =
  | "dynamic"
  | "element"
  | "integration"
  | "media"
  | "slide"
  | "template";

export type ResourcePickerItem = Readonly<{
  category?: string;
  description?: string;
  disabledReason?: string;
  id: string;
  kind: ResourceKind;
  keywords?: readonly string[];
  name: string;
  preview?: ReactNode;
  source?: string;
  status?: Readonly<{ label: string; tone: BadgeStatus }>;
}>;

const kindLabels: Record<ResourceKind, string> = {
  dynamic: "Dynamische bronnen",
  element: "Elementen",
  integration: "Integraties",
  media: "Media",
  slide: "Slides",
  template: "Templates"
};

export type ResourcePickerProps = {
  description?: string;
  emptyLabel?: string;
  items: readonly ResourcePickerItem[];
  kinds?: readonly ResourceKind[];
  onSelect: (item: ResourcePickerItem) => void;
  onSelectMany?: (items: readonly ResourcePickerItem[]) => void;
  selectionMode?: "multiple" | "single";
  title?: string;
  trigger?: ReactNode;
};

export function ResourcePicker({
  description = "Zoek en kies uit beschikbare bronnen binnen de actieve vereniging.",
  emptyLabel = "Geen passende bronnen gevonden.",
  items,
  kinds,
  onSelect,
  onSelectMany,
  selectionMode = "single",
  title = "Bron toevoegen",
  trigger
}: ResourcePickerProps) {
  const [category, setCategory] = useState("all");
  const [kind, setKind] = useState<ResourceKind | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [source, setSource] = useState("all");
  const categories = useMemo(
    () => [...new Set(items.flatMap((item) => item.category ? [item.category] : []))].sort((a, b) => a.localeCompare(b, "nl")),
    [items]
  );
  const sources = useMemo(
    () => [...new Set(items.flatMap((item) => item.source ? [item.source] : []))].sort((a, b) => a.localeCompare(b, "nl")),
    [items]
  );
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("nl");
    return items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (category !== "all" && item.category !== category) return false;
      if (source !== "all" && item.source !== source) return false;
      if (!normalizedQuery) return true;
      return `${item.name} ${item.description ?? ""} ${(item.keywords ?? []).join(" ")}`
        .toLocaleLowerCase("nl")
        .includes(normalizedQuery);
    });
  }, [category, items, kind, query, source]);
  const availableKinds = useMemo(
    () => kinds ?? [...new Set(items.map((item) => item.kind))],
    [items, kinds]
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger ?? <Button>Bron toevoegen</Button>}</DialogTrigger>
      <DialogContent className="vc-resource-picker">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="vc-resource-picker__search">
            <TextInput
              aria-label="Bronnen zoeken"
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Zoek media, slides, templates of bronnen"
              type="search"
              value={query}
            />
          </div>
          {categories.length > 0 || sources.length > 0 ? (
            <div className="vc-resource-picker__facets">
              {sources.length > 0 ? (
                <label>
                  <span>Bron</span>
                  <select onChange={(event) => setSource(event.currentTarget.value)} value={source}>
                    <option value="all">Alle bronnen</option>
                    {sources.map((availableSource) => <option key={availableSource} value={availableSource}>{availableSource}</option>)}
                  </select>
                </label>
              ) : null}
              {categories.length > 0 ? (
                <label>
                  <span>Categorie</span>
                  <select onChange={(event) => setCategory(event.currentTarget.value)} value={category}>
                    <option value="all">Alle categorieën</option>
                    {categories.map((availableCategory) => <option key={availableCategory} value={availableCategory}>{availableCategory}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
          <div aria-label="Brontype" className="vc-resource-picker__kinds" role="tablist">
            <button
              aria-selected={kind === "all"}
              className="vc-resource-picker__kind"
              onClick={() => setKind("all")}
              role="tab"
              type="button"
            >
              Alles <span>{items.length}</span>
            </button>
            {availableKinds.map((availableKind) => (
              <button
                aria-selected={kind === availableKind}
                className="vc-resource-picker__kind"
                key={availableKind}
                onClick={() => setKind(availableKind)}
                role="tab"
                type="button"
              >
                {kindLabels[availableKind]}
                <span>{items.filter((item) => item.kind === availableKind).length}</span>
              </button>
            ))}
          </div>
          <p aria-live="polite" className="vc-resource-picker__summary">
            {visibleItems.length} {visibleItems.length === 1 ? "bron" : "bronnen"}
          </p>
          {visibleItems.length > 0 ? (
            <div className="vc-resource-picker__grid" role="list">
              {visibleItems.map((item) => (
                <div key={item.id} role="listitem">
                  {selectionMode === "single" ? <DialogClose asChild><button
                    className="vc-resource-picker__item"
                    disabled={Boolean(item.disabledReason)}
                    onClick={() => onSelect(item)}
                    type="button"
                  >
                      <span className={cn("vc-resource-picker__preview", !item.preview && "vc-resource-picker__preview--empty")}>
                        {item.preview ?? kindLabels[item.kind]}
                      </span>
                      <span className="vc-resource-picker__item-copy">
                        <strong>{item.name}</strong>
                        {item.description ? <span>{item.description}</span> : null}
                        <span className="vc-resource-picker__item-meta">
                          <span>{kindLabels[item.kind]}</span>
                          {item.status ? <Badge status={item.status.tone}>{item.status.label}</Badge> : null}
                        </span>
                        {item.disabledReason ? <span className="vc-resource-picker__reason">{item.disabledReason}</span> : null}
                      </span>
                    </button></DialogClose> : <button
                      aria-pressed={selectedIds.has(item.id)}
                      className="vc-resource-picker__item"
                      disabled={Boolean(item.disabledReason)}
                      onClick={() => setSelectedIds((current) => {
                        const next = new Set(current);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })}
                      type="button"
                    >
                      <span className={cn("vc-resource-picker__preview", !item.preview && "vc-resource-picker__preview--empty")}>
                        {item.preview ?? kindLabels[item.kind]}
                      </span>
                      <span className="vc-resource-picker__item-copy">
                        <strong>{item.name}</strong>
                        {item.description ? <span>{item.description}</span> : null}
                        <span className="vc-resource-picker__item-meta">
                          <span>{kindLabels[item.kind]}</span>
                          {item.status ? <Badge status={item.status.tone}>{item.status.label}</Badge> : null}
                        </span>
                        {item.disabledReason ? <span className="vc-resource-picker__reason">{item.disabledReason}</span> : null}
                      </span>
                    </button>}
                </div>
              ))}
            </div>
          ) : (
            <p className="vc-resource-picker__empty">{emptyLabel}</p>
          )}
        </DialogBody>
        <DialogFooter aside={selectionMode === "multiple" ? `${selectedIds.size} geselecteerd` : "De gekozen bron wordt aan je huidige werk toegevoegd."}>
          <DialogClose asChild>
            <Button variant="secondary">Annuleren</Button>
          </DialogClose>
          {selectionMode === "multiple" ? (
            <DialogClose asChild>
              <Button
                disabled={selectedIds.size === 0}
                onClick={() => {
                  const selected = items.filter((item) => selectedIds.has(item.id));
                  if (onSelectMany) onSelectMany(selected);
                  else for (const item of selected) onSelect(item);
                  setSelectedIds(new Set());
                }}
              >
                {selectedIds.size === 1 ? "1 bron toevoegen" : `${selectedIds.size} bronnen toevoegen`}
              </Button>
            </DialogClose>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
