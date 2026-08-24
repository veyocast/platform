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
  description?: string;
  id: string;
  kind: ResourceKind;
  name: string;
  preview?: ReactNode;
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
  title?: string;
  trigger?: ReactNode;
};

export function ResourcePicker({
  description = "Zoek en kies uit beschikbare bronnen binnen de actieve vereniging.",
  emptyLabel = "Geen passende bronnen gevonden.",
  items,
  kinds,
  onSelect,
  title = "Bron toevoegen",
  trigger
}: ResourcePickerProps) {
  const [kind, setKind] = useState<ResourceKind | "all">("all");
  const [query, setQuery] = useState("");
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("nl");
    return items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (!normalizedQuery) return true;
      return `${item.name} ${item.description ?? ""}`
        .toLocaleLowerCase("nl")
        .includes(normalizedQuery);
    });
  }, [items, kind, query]);
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
                  <DialogClose asChild>
                    <button
                      className="vc-resource-picker__item"
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
                      </span>
                    </button>
                  </DialogClose>
                </div>
              ))}
            </div>
          ) : (
            <p className="vc-resource-picker__empty">{emptyLabel}</p>
          )}
        </DialogBody>
        <DialogFooter aside="De gekozen bron wordt aan je huidige werk toegevoegd.">
          <DialogClose asChild>
            <Button variant="secondary">Annuleren</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
