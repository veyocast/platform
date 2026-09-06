"use client";

import {
  Archive,
  CheckCircle2,
  Clock3,
  Eye,
  ListPlus,
  Pencil,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useMemo,
  useState,
  type ReactNode
} from "react";

import {
  BulkActionBar,
  Button,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  IconButton,
  StatusPill
} from "@veyocast/ui";

import { addDynamicSlideToPlaylist } from "./actions";
import { DynamicSlideLivePreview } from "./new/dynamic-slide-live-preview";
import {
  archiveSlideResources,
  loadSlideResourcePreview,
  type SlideArchiveState,
  type SlideResourcePreviewResult
} from "./slide-resource-actions";
import {
  slideResourceStatusLabel,
  slideResourceStatusTone
} from "./slide-resource";
import type {
  SlidePlaylistOption,
  SlideResourceRow
} from "./slide-resource-data";
import styles from "./slide-resource.module.css";

export type SlideLibraryRow = SlideResourceRow & {
  createdLabel: string;
  updatedLabel: string;
};

export function SlideLibraryWorkspace({
  canAddToPlaylist,
  canWrite,
  playlists,
  rows
}: {
  canAddToPlaylist: boolean;
  canWrite: boolean;
  playlists: readonly SlidePlaylistOption[];
  rows: readonly SlideLibraryRow[];
}) {
  const selectableIds = useMemo(
    () => rows.filter((row) => row.resourceStatus !== "inactive").map((row) => row.id),
    [rows]
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const selectedIds = useMemo(
    () => selectableIds.filter((id) => selected.has(id)),
    [selectableIds, selected]
  );
  const allSelected = selectableIds.length > 0 && selectedIds.length === selectableIds.length;

  function toggle(slideId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slideId)) next.delete(slideId);
      else next.add(slideId);
      return next;
    });
  }

  if (!rows.length) {
    return (
      <div className={`empty-state ${styles.emptyState}`} role="status">
        <h2>Geen passende slides</h2>
        <p>Pas de zoekopdracht of filters aan, of maak een nieuwe slide.</p>
      </div>
    );
  }

  return (
    <>
      {canWrite ? (
        <div className={styles.selectionRow}>
          <label className="check-row">
            <input
              checked={allSelected}
              disabled={!selectableIds.length}
              onChange={() => setSelected(allSelected ? new Set() : new Set(selectableIds))}
              type="checkbox"
            />
            <span>Alle bewerkbare slides op deze pagina selecteren</span>
          </label>
          <span aria-live="polite">{selectedIds.length} geselecteerd</span>
        </div>
      ) : null}

      <DataTable caption="Slides binnen de actieve vereniging." tableKey="tenant-slides">
        <thead>
          <tr>
            <th scope="col">Selectie</th>
            <th data-column="name" scope="col">Naam slide</th>
            <th data-column="status" scope="col">Status</th>
            <th data-column="created" scope="col">Aangemaakt op</th>
            <th data-column="updated" scope="col">Bijgewerkt op</th>
            <th data-column="actions" scope="col">Acties</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const canSelect = canWrite && row.resourceStatus !== "inactive";
            return (
              <tr data-selected={selected.has(row.id)} key={row.id}>
                <td data-label="Selectie">
                  <label className={styles.checkbox}>
                    <input
                      aria-label={`${row.name} selecteren`}
                      checked={selected.has(row.id)}
                      disabled={!canSelect}
                      onChange={() => toggle(row.id)}
                      type="checkbox"
                    />
                  </label>
                </td>
                <td data-column="name" data-label="Naam slide">
                  <span className="table-primary">{row.name}</span>
                  <span className="table-secondary">
                    {row.slideTypeLabel} · {row.orientationLabel} · {row.selectionLabel}
                  </span>
                  <span className="table-secondary">
                    {row.dataLabel}{row.currentVersionNumber ? ` · versie ${row.currentVersionNumber}` : ""}
                  </span>
                </td>
                <td data-column="status" data-label="Status">
                  <SlideStatus status={row.resourceStatus} />
                </td>
                <td data-column="created" data-label="Aangemaakt op">{row.createdLabel}</td>
                <td data-column="updated" data-label="Bijgewerkt op">{row.updatedLabel}</td>
                <td data-column="actions" data-label="Acties">
                  <div className={styles.actions}>
                    <SlidePreviewDialog row={row} />
                    {canWrite && row.resourceStatus !== "inactive" ? (
                      <IconButton asChild aria-label={`${row.name} bewerken`} title="Bewerken">
                        <Link href={row.editHref}><Pencil aria-hidden="true" /></Link>
                      </IconButton>
                    ) : (
                      <IconButton aria-label={`${row.name} kan niet worden bewerkt`} disabled title="Geen schrijfrechten">
                        <Pencil aria-hidden="true" />
                      </IconButton>
                    )}
                    <SlideArchiveDialog
                      disabled={!canSelect}
                      label={row.name}
                      onSuccess={() => setSelected((current) => {
                        const next = new Set(current);
                        next.delete(row.id);
                        return next;
                      })}
                      slideIds={[row.id]}
                      trigger={(
                        <IconButton
                          aria-label={`${row.name} verwijderen`}
                          disabled={!canSelect}
                          title={row.resourceStatus === "inactive" ? "Al inactief" : "Verwijderen"}
                          variant="destructive"
                        >
                          <Trash2 aria-hidden="true" />
                        </IconButton>
                      )}
                    />
                    <AddSlideToPlaylistDialog
                      disabled={!canAddToPlaylist || row.resourceStatus !== "active" || !playlists.length}
                      playlists={playlists}
                      row={row}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>

      {selectedIds.length ? (
        <BulkActionBar
          actions={(
            <>
              <SlideArchiveDialog
                label={`${selectedIds.length} geselecteerde ${selectedIds.length === 1 ? "slide" : "slides"}`}
                onSuccess={() => setSelected(new Set())}
                slideIds={selectedIds}
                trigger={(
                  <Button type="button" variant="destructive">
                    <Trash2 aria-hidden="true" />
                    Verwijderen
                  </Button>
                )}
              />
              <Button onClick={() => setSelected(new Set())} type="button" variant="secondary">
                Selectie wissen
              </Button>
            </>
          )}
          description="De server bewaakt conceptplaylistverwijzingen; immutable releases worden nooit gewijzigd."
          title={`${selectedIds.length} ${selectedIds.length === 1 ? "slide geselecteerd" : "slides geselecteerd"}`}
        />
      ) : null}
    </>
  );
}

function SlideStatus({ status }: { status: SlideLibraryRow["resourceStatus"] }) {
  const Icon = status === "active" ? CheckCircle2 : status === "inactive" ? Archive : Clock3;
  return (
    <span className={styles.status}>
      <Icon aria-hidden="true" />
      <StatusPill label={slideResourceStatusLabel(status)} tone={slideResourceStatusTone(status)} />
    </span>
  );
}

function SlidePreviewDialog({ row }: { row: SlideLibraryRow }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SlideResourcePreviewResult | null>(null);

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen || result || loading) return;
    setLoading(true);
    startTransition(async () => {
      try {
        setResult(await loadSlideResourcePreview(row.id));
      } catch {
        setResult({
          code: "PREVIEW_REQUEST_FAILED",
          message: "De previewverbinding werd onderbroken. De slide is niet gewijzigd; sluit dit venster en probeer opnieuw.",
          ok: false
        });
      } finally {
        setLoading(false);
      }
    });
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>
        <IconButton aria-label={`${row.name} tonen`} title="Tonen">
          <Eye aria-hidden="true" />
        </IconButton>
      </DialogTrigger>
      <DialogContent closeLabel="Slidevoorbeeld sluiten">
        <DialogHeader>
          <DialogTitle>{row.name}</DialogTitle>
          <DialogDescription>
            Dit is dezelfde HTML/CSS-renderer als op de Player, gevoed met de huidige immutable snapshot.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {loading && !result ? (
            <div aria-live="polite" className={styles.previewLoading} role="status">
              <Clock3 aria-hidden="true" />
              <strong>Player-preview laden…</strong>
              <span>De huidige immutable snapshot en bijbehorende assets worden veilig geladen.</span>
            </div>
          ) : (
            <DynamicSlideLivePreview loading={false} result={result} />
          )}
          <dl className={styles.previewMeta}>
            <div><dt>Status</dt><dd>{slideResourceStatusLabel(row.resourceStatus)}</dd></div>
            <div><dt>Type</dt><dd>{row.slideTypeLabel}</dd></div>
            <div><dt>Formaat</dt><dd>{row.orientationLabel}</dd></div>
            <div><dt>Inhoud</dt><dd>{row.dataLabel}</dd></div>
            <div><dt>Bijgewerkt</dt><dd>{row.updatedLabel}</dd></div>
          </dl>
        </DialogBody>
        <DialogFooter>
          {row.resourceStatus === "inactive" ? (
            <Button disabled type="button" variant="secondary">
              Inactieve slide
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <Link href={row.editHref}>Slide openen</Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SlideArchiveDialog({
  disabled = false,
  label,
  onSuccess,
  slideIds,
  trigger
}: {
  disabled?: boolean;
  label: string;
  onSuccess: () => void;
  slideIds: readonly string[];
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<SlideArchiveState>(initialArchiveState);

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setState(initialArchiveState);
  }

  async function submit(formData: FormData) {
    setPending(true);
    try {
      const next = await archiveSlideResources(initialArchiveState, formData);
      setState(next);
      if (next.status === "success") {
        onSuccess();
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  // De eerste servercall is atomisch. Een override moet daarom exact dezelfde
  // selectie herhalen en niet alleen de geblokkeerde subset archiveren.
  const targetIds = [...slideIds];

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild disabled={disabled}>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label} verwijderen?</DialogTitle>
          <DialogDescription>
            De selectie wordt herstelbaar inactief. Gepubliceerde releases en actieve Player-output blijven onveranderlijk.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {state.message ? (
            <div
              className={`notice ${state.status === "error" ? "notice--critical" : state.status === "success" ? "notice--success" : "notice--warning"}`}
              role={state.status === "error" ? "alert" : "status"}
            >
              <strong>{state.status === "blocked" ? "Conceptgebruik blokkeert de actie." : state.status === "success" ? "Slides bijgewerkt." : "Verwijderen mislukt."}</strong>{" "}
              {state.message}
            </div>
          ) : (
            <div className="notice notice--warning" role="status">
              <strong>Veilige controle.</strong> De server stopt bij verwijzingen vanuit conceptplaylists en toont daarna pas de override.
            </div>
          )}

          {state.status === "blocked" ? (
            <form action={submit} className={styles.archiveForm}>
              <input name="slideIds" type="hidden" value={JSON.stringify(targetIds)} />
              <input name="override" type="hidden" value="true" />
              <label className="check-row">
                <input name="confirmOverride" required type="checkbox" />
                <span>
                  <strong>Override bevestigen</strong>
                  <span className="work-panel__meta">Verwijder ook de genoemde conceptplaatsingen. Releasehistorie blijft behouden.</span>
                </span>
              </label>
              <DialogFooter>
                <Button disabled={pending} type="submit" variant="destructive">
                  {pending ? "Override uitvoeren…" : "Override en verwijderen"}
                </Button>
              </DialogFooter>
            </form>
          ) : state.status !== "success" ? (
            <form action={submit}>
              <input name="slideIds" type="hidden" value={JSON.stringify(slideIds)} />
              <input name="override" type="hidden" value="false" />
              <DialogFooter>
                <Button disabled={pending} type="submit" variant="destructive">
                  {pending ? "Controleren…" : "Veilig verwijderen"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function AddSlideToPlaylistDialog({
  disabled,
  playlists,
  row
}: {
  disabled: boolean;
  playlists: readonly SlidePlaylistOption[];
  row: SlideLibraryRow;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <IconButton
          aria-label={`${row.name} aan playlist toevoegen`}
          disabled={disabled}
          title={disabled ? "Alleen actieve slides kunnen aan een playlist worden toegevoegd" : "Aan playlist toevoegen"}
        >
          <ListPlus aria-hidden="true" />
        </IconButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row.name} toevoegen</DialogTitle>
          <DialogDescription>
            Kies één playlistconcept. De huidige snapshot wordt met revisiecontrole toegevoegd.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form action={addDynamicSlideToPlaylist} className={styles.playlistForm}>
            <input name="slideId" type="hidden" value={row.id} />
            <label>
              <span>Playlist</span>
              <select name="playlistId" required>
                <option value="">Kies een playlist</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Duur in seconden</span>
              <input defaultValue="10" max="3600" min="5" name="duration" type="number" />
            </label>
            <DialogFooter>
              <Button type="submit"><ListPlus aria-hidden="true" />Toevoegen</Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

const initialArchiveState: SlideArchiveState = {
  archivedCount: 0,
  blockedSlideIds: [],
  draftReferenceCount: 0,
  message: "",
  status: "idle"
};
