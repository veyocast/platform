"use client";
/* eslint-disable @next/next/no-img-element -- Private signed tenant previews. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCheck,
  FileImage,
  Film,
  Grid2X2,
  Layers3,
  List,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@veyocast/ui";
import type { PlaylistBatchCommand } from "@veyocast/contracts";
import { savePlaylistBatch } from "../playlists/sites-batch-actions";
import { listContentPlaylists } from "./actions";
import { contentPlacementOperations, type ContentItem } from "./model";

const labels: Record<string, string> = {
  ready: "Gereed",
  published: "Gepubliceerd",
  draft: "Concept",
  active: "Concept",
  uploading: "Uploaden",
  processing: "In verwerking",
  rendering: "In verwerking",
  error: "Aandacht nodig",
  validation_failed: "Validatie mislukt",
  quarantined: "In quarantaine",
  archived: "Gearchiveerd",
};
export function ContentWorkspace({
  items,
  canCreate,
  canAdd,
  children,
  query,
  filter,
}: {
  items: ContentItem[];
  canCreate: boolean;
  canAdd: boolean;
  children: React.ReactNode;
  query: string;
  filter: string;
}) {
  const [view, setView] = useState("grid"),
    [selection, setSelection] = useState<string[]>([]),
    [open, setOpen] = useState(false);
  const selected = selection.flatMap(
    (key) => items.find((item) => item.key === key) ?? [],
  );
  function toggle(key: string) {
    setSelection((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key],
    );
  }
  return (
    <>
      <div className="vc-library-toolbar">
        {children}
        <form className="vc-library-search" action="/dashboard/content">
          <Search size={17} />
          <input type="hidden" name="filter" value={filter} />
          <input
            name="q"
            aria-label="Zoek content"
            defaultValue={query}
            placeholder="Zoek in je bibliotheek…"
          />
          <button className="sr-only" type="submit">
            Zoekopdracht uitvoeren
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={view === "grid" ? "Lijstweergave" : "Kaartweergave"}
            onClick={() => setView(view === "grid" ? "list" : "grid")}
          >
            {view === "grid" ? <List size={19} /> : <Grid2X2 size={19} />}
          </button>
        </form>
      </div>
      {selected.length > 0 && (
        <div className="vc-selection-bar">
          <span>
            <CheckCheck size={18} />
            <strong>{selected.length} geselecteerd</strong>
          </span>
          <div className="row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSelection([])}
            >
              Selectie wissen
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canAdd}
              onClick={() => setOpen(true)}
            >
              <Plus size={16} />
              Aan playlist toevoegen
            </button>
          </div>
        </div>
      )}
      <div className={`vc-content-grid ${view === "list" ? "is-list" : ""}`}>
        {items.map((item) => (
          <article
            className={`vc-content-card ${selection.includes(item.key) ? "is-selected" : ""}`}
            key={item.key}
          >
            <div className="vc-content-image">
              <Link
                className="vc-content-preview-link"
                href={item.href}
                aria-label={`${item.title} bewerken`}
              >
                {item.preview ? (
                  <img
                    src={item.preview}
                    alt={item.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <span className="sync-content-placeholder">
                    <Layers3 size={40} />
                    <span>
                      {item.kind === "media"
                        ? "Voorbeeld niet beschikbaar"
                        : "Ontwerp openen"}
                    </span>
                  </span>
                )}
              </Link>
              <button
                type="button"
                className={`vc-content-select ${selection.includes(item.key) ? "selected" : ""}`}
                aria-label={`${item.title} selecteren`}
                aria-pressed={selection.includes(item.key)}
                disabled={!canAdd}
                onClick={() => toggle(item.key)}
              >
                {selection.includes(item.key) && <Check size={15} />}
              </button>
              <span className="vc-content-type">
                {item.family === "video" ? (
                  <Film size={12} />
                ) : item.kind === "media" ? (
                  <FileImage size={12} />
                ) : (
                  <Layers3 size={12} />
                )}{" "}
                {item.kind === "media"
                  ? item.family === "video"
                    ? "Video"
                    : "Afbeelding"
                  : item.kind === "series"
                    ? "Reeks"
                    : "Ontwerp"}
              </span>
              {["processing", "rendering", "uploading"].includes(
                item.status,
              ) && (
                <div className="vc-processing-overlay">
                  <Loader2 className="vc-spin" />
                  <strong>Wordt voorbereid</strong>
                  <span>Je ontwerp blijft beschikbaar.</span>
                </div>
              )}
            </div>
            <div className="vc-content-card-body">
              <div className="vc-content-card-title">
                <Link href={item.href}>{item.title}</Link>
                <span
                  className={`badge ${item.status === "ready" ? "badge-green" : ["error", "validation_failed"].includes(item.status) ? "badge-red" : "badge-neutral"}`}
                >
                  {item.archived
                    ? "Gearchiveerd"
                    : (labels[item.status] ?? "Status onbekend")}
                </span>
              </div>
              <div className="vc-content-meta">
                <span>{item.kind === "media" ? "Upload" : item.kind === "dynamic" ? "Bronontwerp" : "Studio"}</span>
                <i />
                <span>
                  {item.kind === "media"
                    ? item.width && item.height
                      ? `${item.width} × ${item.height} px`
                      : "Maten nog onbekend"
                    : item.orientation === "portrait"
                      ? "9:16"
                      : item.orientation === "landscape"
                        ? "16:9"
                        : "Formaat nog onbekend"}
                </span>
                {item.duration ? (
                  <>
                    <i />
                    <span>{item.duration}s</span>
                  </>
                ) : null}
              </div>
              <div className="vc-content-card-bottom">
                <div className="vc-card-actions">
                  <Link href={item.href} className="vc-edit-link">
                    Bewerken <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}
        {canCreate && (
          <Link className="vc-new-content-card" href="/dashboard/studio/new">
            <span>
              <Plus size={28} />
            </span>
            <strong>Een nieuw verhaal begint hier</strong>
            <p>Kies een template en maak het van jouw club.</p>
            <span className="vc-new-card-link">
              Ontwerp maken <ArrowRight size={15} />
            </span>
          </Link>
        )}
      </div>
      <ContentPlaylistDialog
        key={selection.join(",")}
        open={open}
        onOpenChange={setOpen}
        items={selected}
        onSaved={() => setSelection([])}
      />
    </>
  );
}

function ContentPlaylistDialog({
  open,
  onOpenChange,
  items,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ContentItem[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0),
    [retry, setRetry] = useState(0);
  const [rows, setRows] = useState<
      Array<{ id: string; name: string; revision: number }>
    >([]),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false),
    [pending, setPending] = useState(false),
    [chosen, setChosen] = useState("");
  const [error, setError] = useState("");
  const attempts = useRef(new Map<string, PlaylistBatchCommand>());
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void listContentPlaylists(query, offset)
        .then((result) => {
          if (!alive) return;
          if (result.ok) {
            setRows(result.rows);
            setMore(result.hasMore);
          } else {
            setRows([]);
            setError(result.message);
          }
        })
        .catch(() => {
          if (alive)
            setError(
              "De verbinding is onderbroken. Je selectie blijft bewaard; probeer opnieuw.",
            );
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, query, offset, retry]);
  async function add() {
    if (pending) return;
    const playlist = rows.find((row) => row.id === chosen);
    if (!playlist) return;
    setPending(true);
    setError("");
    try {
      let attempt = attempts.current.get(chosen);
      if (!attempt) {
        attempt = {
          playlistId: chosen,
          expectedRevision: playlist.revision,
          idempotencyKey: crypto.randomUUID(),
          operations: contentPlacementOperations(items, () =>
            crypto.randomUUID(),
          ),
        };
        attempts.current.set(chosen, attempt);
      }
      const result = await savePlaylistBatch(attempt);
      if (result.outcome === "failed") {
        setError(result.message);
        return;
      }
      if (result.outcome === "conflict") {
        setError(
          `De playlist is intussen gewijzigd naar versie ${result.actualRevision}. Je selectie blijft bewaard. Laad de playlists opnieuw en controleer je keuze.`,
        );
        setChosen("");
        attempts.current.delete(chosen);
        return;
      }
      onOpenChange(false);
      onSaved();
      router.push(
        `/dashboard/playlists/${chosen}?succes=${encodeURIComponent("De geselecteerde inhoud is aan het concept toegevoegd. Bestaande publicaties blijven behouden.")}`,
      );
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes("gereed")
          ? e.message
          : "De server heeft het toevoegen niet bevestigd. Je selectie blijft bewaard; probeer dezelfde handeling opnieuw.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <DialogContent closeLabel="Playlistkeuze sluiten">
        <DialogHeader>
          <DialogTitle>Aan playlist toevoegen</DialogTitle>
          <DialogDescription>
            {items.length} geselecteerd. Kies het concept waaraan je deze inhoud
            wilt toevoegen.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <label className="field">
            Playlist zoeken
            <div className="search-field">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOffset(0);
                  setChosen("");
                }}
                maxLength={120}
              />
            </div>
          </label>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          {loading ? (
            <p role="status">Playlists laden…</p>
          ) : (
            <fieldset className="stack" disabled={pending}>
              <legend className="sr-only">Kies een playlist</legend>
              {rows.map((row) => (
                <label className="check-label sync-content-playlist-choice" key={row.id}>
                  <input
                    type="radio"
                    name="content-playlist"
                    value={row.id}
                    checked={chosen === row.id}
                    onChange={() => {
                      setChosen(row.id);
                      setError("");
                    }}
                  />
                  {row.name}
                </label>
              ))}
              {!rows.length && (
                <p>
                  Geen playlists gevonden. Maak eerst een playlist of pas de
                  zoekterm aan.
                </p>
              )}
            </fieldset>
          )}
          <div className="row">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending || loading}
              onClick={() => {
                setRetry((v) => v + 1);
                setError("");
                setChosen("");
              }}
            >
              Opnieuw laden
            </button>
            {offset > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={loading || pending}
                onClick={() => {
                  setOffset((v) => Math.max(0, v - 20));
                  setChosen("");
                }}
              >
                Vorige
              </button>
            )}
            {more && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={loading || pending}
                onClick={() => {
                  setOffset((v) => v + 20);
                  setChosen("");
                }}
              >
                Volgende
              </button>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Annuleren
          </Button>
          <Button
            disabled={pending || loading || !chosen}
            onClick={() => void add()}
          >
            {pending ? "Toevoegen…" : "Toevoegen aan concept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
