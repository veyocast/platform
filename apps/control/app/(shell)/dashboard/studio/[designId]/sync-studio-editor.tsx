"use client";
import {patchSyncSlideDraft} from '@veyocast/contracts';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, RotateCcw } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@veyocast/ui";
import {
  syncSlidePageCount,
  type SyncSlidePresentation,
} from "@veyocast/contracts";
import {
  createSyncStudioDocument,
  type StudioDocument,
} from "@veyocast/studio";
import { SyncSlideStaticView } from "@veyocast/content-templates/sync-slide-static-view";
import { SyncStudioFrame } from "../sync-studio-frame";
import {SyncStudioVersionTrigger} from "../sync-studio-version-trigger";
import {SyncEngageControls} from '../sync-engage-controls';
import {SyncYouTubeControls} from '../sync-youtube-controls';
import {syncConnectedAuthoringType} from '../../slides/sync-sportlink-binding';
import {
  clearSyncStudioRecovery,
  readSyncStudioRecovery,
  writeSyncStudioRecovery,
  syncRowsFromText,
  syncLineupFromText,
  type SyncStudioDraft,
  type SyncStudioRecovery,
  type SyncStudioSaveAttempt,
  type SyncStudioScratch,
} from "../sync-studio-recovery";
import { readSyncStudioDraftAction } from "../sync-studio-actions";
import {
  copyStudioConflictAction,
  requestStudioRenderAction,
  restoreStudioRevisionAction,
  saveStudioDraftAction,
} from "../actions";
import { readStudioPlacementThemeRenderAction } from "../sites-placement-theme-actions";
import {uploadBackground} from "../../playlists/_components/sites/upload-media";
import {useSyncStudioSeries} from '../use-sync-studio-series';
import type {SyncStudioLibraryProject} from '../../playlists/_components/sites/model';
import type {
  StudioEditorPermissions,
  StudioMediaAsset,
  StudioProjectDetail,
  StudioRenderJob,
  StudioRevision,
  StudioSeriesDetail,
} from "../types";

export type SyncStudioEditorProps = {
  project: StudioProjectDetail;
  assets: StudioMediaAsset[];
  permissions: StudioEditorPermissions;
  tenantId: string;
  isLive: boolean;
  renderJobs: StudioRenderJob[];
  revisions: StudioRevision[];
  error?: string | null;
  series?:StudioSeriesDetail|null;
  sourceLibrary?:SyncStudioLibraryProject[];
};
const draftOf = (document: StudioDocument): SyncStudioDraft => {
  const presentation = document.syncPresentation;
  if (!presentation) throw Error("Sync document required");
  return {
    presentation,
    seconds: String(
      document.motion.durationMs / syncSlidePageCount(presentation) / 1000,
    ),
    scratch: {
      rowsText: presentation.rows.map((row) => row.join(" | ")).join("\n"),
      lineupText: presentation.lineup.map((line) => line.join(", ")).join("\n"),
    },
  };
};
const serial = (value: unknown) => JSON.stringify(value);

/** Real Studio commands behind the Source frame. Unknown writes keep their complete original command. */
export function SyncStudioEditor({
  project,
  assets,
  permissions,
  tenantId,
  isLive,
  renderJobs,
  revisions,
  error: initialError = null,
  series,
  sourceLibrary=[],
}: SyncStudioEditorProps) {
  const router = useRouter();
  const [initialDocument] = useState(() => project.document),
    [draft, setDraft] = useState(() => draftOf(project.document));
  const [history, setHistory] = useState<SyncStudioDraft[]>([]),
    [uploadedAssets,setUploadedAssets]=useState<StudioMediaAsset[]>([]),
    [uploading,setUploading]=useState(false),
    [future, setFuture] = useState<SyncStudioDraft[]>([]),
    [message, setMessage] = useState<string | null>(null),
    [error, setError] = useState<string | null>(initialError),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [needsRead, setNeedsRead] = useState(false),
    [conflict, setConflict] = useState(false),
    [online, setOnline] = useState(true),
    [recovered, setRecovered] = useState(false),
    [versionsOpen, setVersionsOpen] = useState(false),
    [selectedRevision, setSelectedRevision] = useState<string | null>(null),
    [pendingJob, setPendingJob] = useState<string | null>(() =>
      renderJobs[0] && !["failed", "cancelled"].includes(renderJobs[0].status)
        ? renderJobs[0].id
        : null,
    ),
    [readyDocument, setReadyDocument] = useState<StudioDocument | null>(null),
    [confirmedCopy, setConfirmedCopy] = useState<string | null>(null),
    [renderStatus, setRenderStatus] = useState<
      "pending" | "ready" | "failed" | "unknown" | null
    >(null),
    [cacheWarning, setCacheWarning] = useState<string | null>(null),
    [hydrated, setHydrated] = useState(false);
  const revision = useRef(project.draftRevision),
    baseline = useRef(serial(draft)),
    draftRef = useRef(draft),
    metadata = useRef(initialDocument.metadata),
    saveAttempt = useRef<SyncStudioSaveAttempt | null>(null),
    renderAttempt = useRef<
      Parameters<typeof requestStudioRenderAction>[0] | null
    >(null),
    copyAttempt = useRef<Parameters<typeof copyStudioConflictAction>[0] | null>(
      null,
    ),
    restoreAttempt = useRef<
      Parameters<typeof restoreStudioRevisionAction>[0] | null
    >(null),
    confirmedRead = useRef<SyncStudioRecovery["confirmedRead"]>(undefined),
    jobRef = useRef(pendingJob),
    currentDocument = useRef<StudioDocument | null>(null),
    edited = useRef(false);
  draftRef.current = draft;
  const canEdit = isLive && permissions.canEdit,
    dirty = serial(draft) !== baseline.current;
  const document = useMemo(() => {
    try {
      if(draft.presentation.name.trim().length<2||draft.presentation.name.trim().length>120)return null;
      const rows = syncRowsFromText(draft.scratch.rowsText),
        lineup = syncLineupFromText(draft.scratch.lineupText);
      if (!rows || !lineup) return null;
      const original = initialDocument.syncPresentation!;
      const explicitMotion =
        draft.presentation.style.motion===undefined&&initialDocument.motion.enabled && syncSlidePageCount(original) === 1;
      const next = createSyncStudioDocument(
        { ...draft.presentation, rows, lineup },
        Number(draft.seconds),
        explicitMotion,
      );
      return { ...next, metadata: metadata.current };
    } catch {
      return null;
    }
  }, [draft, initialDocument]);
  currentDocument.current = document;
  jobRef.current = pendingJob;
  const seriesTools=useSyncStudioSeries({tenantId,projectId:project.id,series,canEdit,canCreate:isLive&&permissions.canCreate,canArchive:isLive&&permissions.canArchive,busy:busy||uploading||uncertain||needsRead||!online||!hydrated,prepare:async()=>{
    if(!document||conflict||needsRead||uncertain)return null;
    if(!await save())return null;
    return revision.current;
  }});
  const latestJob =
    renderJobs.find((job) => job.id === pendingJob) ?? renderJobs[0];
  const availableAssets=useMemo(()=>[...new Map([...assets,...uploadedAssets].map(asset=>[asset.id,asset])).values()],[assets,uploadedAssets]);
  const libraryMembers=sourceLibrary.flatMap(group=>group.members);
  const libraryFilmstrip=[...new Map([
    ...libraryMembers,
    ...(series?.items.flatMap(item=>item.document.syncPresentation?[{id:item.id,name:item.name,presentation:item.document.syncPresentation,assetUrls:libraryMembers.find(member=>member.id===item.id)?.assetUrls}]:[])??[]),
    {id:project.id,name:draft.presentation.name,presentation:draft.presentation},
  ].map(member=>[member.id,member])).values()];
  const uploadActive=useRef(true);
  useEffect(()=>{uploadActive.current=true;return()=>{uploadActive.current=false;};},[]);
  const resolveAsset = (
    asset: Parameters<
      NonNullable<
        React.ComponentProps<typeof SyncSlideStaticView>["resolveAsset"]
      >
    >[0],
  ) =>
    asset.kind === "system"
      ? asset.path
      : (availableAssets.find((value) => value.id === asset.mediaAssetId)?.sourceUrl ??
        undefined);

  function persist(value = draftRef.current) {
    try {
      const record: SyncStudioRecovery = {
        tenantId,
        projectId: project.id,
        revision: revision.current,
        draft: value,
        ...(saveAttempt.current ? { pendingSave: saveAttempt.current } : {}),
        ...(renderAttempt.current
          ? { pendingRender: renderAttempt.current }
          : {}),
        ...(copyAttempt.current ? { pendingCopy: copyAttempt.current } : {}),
        ...(restoreAttempt.current
          ? { pendingRestore: restoreAttempt.current }
          : {}),
        ...(confirmedRead.current
          ? { confirmedRead: confirmedRead.current }
          : {}),
        ...(jobRef.current ? { pendingJob: jobRef.current } : {}),
      };
      writeSyncStudioRecovery(record);
      setCacheWarning(null);
    } catch {
      setCacheWarning(
        "Lokaal bewaren is niet gelukt. Je invoer blijft in dit venster; sla op voordat je afsluit.",
      );
    }
  }
  function change(next: SyncStudioDraft) {
    if (!canEdit || busy || uncertain || restoreAttempt.current || seriesTools.blocked) return;
    edited.current = true;
    setHistory((previous) => [...previous.slice(-39), draftRef.current]);
    setFuture([]);
    setDraft(next);
    setMessage(null);
    setError(null);
  }
  function patch(
    presentation: Partial<SyncSlidePresentation>,
    scratch?: Partial<SyncStudioScratch>,
  ) {
    change({
      ...draftRef.current,
      presentation: patchSyncSlideDraft(draftRef.current.presentation,presentation),
      scratch: { ...draftRef.current.scratch, ...scratch },
    });
  }
  async function backgroundFile(file:File){
    if(!canEdit||!permissions.canUploadMedia||busy||uncertain||restoreAttempt.current||uploading||!online||seriesTools.blocked)return;
    setUploading(true);setError(null);setMessage('Je achtergrond wordt privé opgeslagen en gecontroleerd.');
    try{
      const uploaded=await uploadBackground(file);
      if(!uploadActive.current)return;
      if(!uploaded.checksumSha256||! /^[a-f0-9]{64}$/.test(uploaded.checksumSha256))throw new Error('Je upload is opgeslagen, maar de controle kon niet worden bevestigd. Open de beeldbank voordat je opnieuw uploadt.');
      setUploadedAssets(previous=>[...previous,{id:uploaded.assetId,title:file.name,kind:'image',checksumSha256:uploaded.checksumSha256,sourceUrl:uploaded.previewUrl,previewUrl:uploaded.previewUrl,width:null,height:null}]);
      patch({style:{...draftRef.current.presentation.style,background:'photo',backgroundAsset:{kind:'tenant',mediaAssetId:uploaded.assetId,checksumSha256:uploaded.checksumSha256}}});
      setMessage('Je achtergrond is gecontroleerd en geselecteerd. Bewaar je ontwerp om de keuze vast te leggen.');
    }catch(error){if(uploadActive.current){setMessage(null);setError(error instanceof Error&&!(error instanceof TypeError)?error.message:'De upload is niet bevestigd. Je huidige achtergrond blijft behouden. Controleer de beeldbank voordat je opnieuw uploadt.');}}
    finally{if(uploadActive.current)setUploading(false);}
  }
  function applyCanonical(value: StudioDocument, nextRevision: number) {
    if (!value.syncPresentation) {
      clearSyncStudioRecovery(tenantId, project.id);
      window.location.reload();
      return;
    }
    const next = draftOf(value);
    revision.current = nextRevision;
    metadata.current = value.metadata;
    baseline.current = serial(next);
    saveAttempt.current = null;
    confirmedRead.current = undefined;
    setUncertain(false);
    setNeedsRead(false);
    setConflict(false);
    setDraft(next);
    setHistory([]);
    setFuture([]);
    setRecovered(false);
    try {
      persist(next);
    } catch {
      /* The confirmed server read remains authoritative. */
    }
  }

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    try {
      const local = readSyncStudioRecovery(tenantId, project.id);
      if (local && !edited.current) {
        const candidate = local.draft;
        saveAttempt.current = local.pendingSave ?? null;
        renderAttempt.current = local.pendingRender ?? null;
        copyAttempt.current = local.pendingCopy ?? null;
        restoreAttempt.current = local.pendingRestore ?? null;
        confirmedRead.current = local.confirmedRead;
        if (local.pendingJob) setPendingJob(local.pendingJob);
        if (local.confirmedRead) setNeedsRead(true);
        revision.current = local.revision;
        setDraft(candidate);
        setRecovered(true);
        if (local.pendingSave) {
          setUncertain(true);
          setMessage(
            "Een eerdere opslag is nog niet bevestigd. Bevestig dezelfde wijziging opnieuw; je invoer blijft bewaard.",
          );
        } else if (local.revision !== project.draftRevision) {
          setConflict(true);
          setMessage(
            "Er is ook een andere opgeslagen versie. Je lokale invoer blijft hier; laad de huidige versie of bewaar je invoer als kopie.",
          );
        } else {
          try {
            if (
              !syncRowsFromText(candidate.scratch.rowsText) ||
              !syncLineupFromText(candidate.scratch.lineupText)
            )
              throw Error("Incomplete local form");
            const candidateDocument = createSyncStudioDocument(
              {
                ...candidate.presentation,
                rows:
                  syncRowsFromText(candidate.scratch.rowsText) ??
                  candidate.presentation.rows,
                lineup:
                  syncLineupFromText(candidate.scratch.lineupText) ??
                  candidate.presentation.lineup,
              },
              Number(candidate.seconds),
              candidate.presentation.style.motion===undefined&&initialDocument.motion.enabled &&
                syncSlidePageCount(initialDocument.syncPresentation!) === 1,
            );
            if (
              serial({
                ...candidateDocument,
                metadata: project.document.metadata,
              }) === serial(project.document)
            ) {
              baseline.current = serial(candidate);
              setRecovered(false);
            }
          } catch {
            /* Incomplete form input is retained, never promoted to a valid document. */
          }
        }
      }
    } catch {
      setCacheWarning(
        "De lokale herstelversie kan niet veilig worden gelezen. De opgeslagen versie staat open; houd dit venster open als je nieuwe invoer toevoegt.",
      );
    }
    setHydrated(true);
  }, [tenantId, project.id]);
  useEffect(() => {
    if (hydrated && canEdit && (dirty || saveAttempt.current || recovered))
      persist();
  }, [draft, hydrated, canEdit, dirty, recovered]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        !dirty &&
        !saveAttempt.current &&
        !renderAttempt.current &&
        !copyAttempt.current &&
        !restoreAttempt.current && !seriesTools.blocked
      )
        return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty,seriesTools.blocked]);
  useEffect(() => {
    if (project.draftRevision > revision.current && !saveAttempt.current) {
      setConflict(true);
      setMessage(
        "Er is een nieuwere opgeslagen versie. Je invoer blijft hier; laad de huidige versie of bewaar een kopie.",
      );
    }
  }, [project.draftRevision]);
  useEffect(() => {
    if (!pendingJob) return;
    let stopped = false,
      inFlight = false;
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (stopped || inFlight) return;
      if (Date.now() - started > 300000) {
        jobRef.current = null;
        setPendingJob(null);
        setRenderStatus("unknown");
        persist();
        setError(
          "Het schermvoorbeeld duurt langer dan verwacht. Je ontwerp is opgeslagen; bekijk de renderstatus in de bibliotheek en probeer later opnieuw.",
        );
        return;
      }
      inFlight = true;
      void readStudioPlacementThemeRenderAction({ jobId: pendingJob })
        .then((result) => {
          if (stopped) return;
          if (
            (result.projectId && result.projectId !== project.id) ||
            (result.status === "failed" && !result.jobId) ||
            (result.status === "ready" && (!result.ok || !result.document))
          ) {
            setError(
              result.error ??
                "De uitvoer kan nog niet worden geverifieerd. Je opdracht blijft bevestigd; de status wordt opnieuw gecontroleerd.",
            );
            return;
          }
          if (result.status !== "pending") {
            const verified =
              result.status === "ready" && result.ok && result.document;
            setRenderStatus(verified ? "ready" : "failed");
            setReadyDocument(verified ? result.document! : null);
            jobRef.current = null;
            setPendingJob(null);
            persist();
            setMessage(
              verified
                ? "De uitvoer is geverifieerd en staat in de bibliotheek."
                : null,
            );
            if (result.status === "failed")
              setError(
                result.error ??
                  "Het schermvoorbeeld is mislukt. Je ontwerp blijft opgeslagen; probeer de uitvoer opnieuw te maken.",
              );
          }
        })
        .catch(() => {
          if (!stopped)
            setError(
              "De renderstatus kan tijdelijk niet worden gelezen. Je ontwerp is opgeslagen; de verwerking blijft afzonderlijk gecontroleerd.",
            );
        })
        .finally(() => {
          inFlight = false;
        });
    }, 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [pendingJob]);

  async function currentRead(discard: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await readSyncStudioDraftAction({ projectId: project.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.revision < revision.current) {
        setError(
          "De gelezen versie loopt achter op de bevestigde wijziging. Je invoer blijft hier; probeer opnieuw.",
        );
        return;
      }
      if (discard) {
        applyCanonical(result.document, result.revision);
        setMessage("De huidige opgeslagen versie is geladen.");
      } else {
        setNeedsRead(false);
        if (
          serial(result.document) ===
          serial(confirmedRead.current?.document ?? currentDocument.current)
        ) {
          applyCanonical(result.document, result.revision);
          setMessage(`Versie ${result.revision} is bevestigd.`);
        } else {
          setConflict(true);
          setMessage(
            "De wijziging is bevestigd, maar er is inmiddels andere inhoud opgeslagen. Je invoer blijft hier; laad de huidige versie of bewaar een kopie.",
          );
        }
      }
    } catch {
      setError(
        "De huidige versie kon niet worden opgehaald. Je invoer blijft hier; verbind opnieuw en probeer opnieuw.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function save(): Promise<boolean> {
    if (
      !canEdit ||
      busy ||
      !online ||
      conflict ||
      needsRead ||
      seriesTools.blocked ||
      restoreAttempt.current
    )
      return false;
    const replaying = Boolean(saveAttempt.current);
    let command = saveAttempt.current;
    if (!command) {
      if (!document || !dirty) return !dirty;
      command = {
        projectId: project.id,
        expectedRevision: revision.current,
        idempotencyKey: crypto.randomUUID(),
        document,
      };
      saveAttempt.current = command;
      persist();
    }
    setBusy(true);
    setError(null);
    let receiptConfirmed = false;
    try {
      const result = await saveStudioDraftAction(command);
      if (!result.ok) {
        if (result.outcome === "conflict") {
          saveAttempt.current = null;
          setUncertain(false);
          setConflict(true);
        } else if (result.rejected && !replaying) {
          saveAttempt.current = null;
          setUncertain(false);
        } else setUncertain(true);
        setError(
          result.error ??
            "De opslag is nog niet bevestigd. Je invoer blijft hier; bevestig dezelfde wijziging opnieuw.",
        );
        persist();
        return false;
      }
      if (
        !Number.isSafeInteger(result.revision) ||
        Number(result.revision) < command.expectedRevision + 1 ||
        result.outcome !== "saved"
      ) {
        setUncertain(true);
        setError(
          "De opslag gaf geen geldig ontvangstbewijs. Je invoer blijft hier; bevestig dezelfde wijziging opnieuw.",
        );
        persist();
        return false;
      }
      const confirmed = Number(result.revision);
      receiptConfirmed = true;
      saveAttempt.current = null;
      setUncertain(false);
      revision.current = confirmed;
      confirmedRead.current = {
        revision: confirmed,
        document: command.document,
      };
      persist();
      if (document && serial(document) === serial(command.document))
        baseline.current = serial(draftRef.current);
      const read = await readSyncStudioDraftAction({ projectId: project.id });
      if (!read.ok || read.revision < confirmed) {
        setNeedsRead(true);
        setMessage(`Opslag van versie ${confirmed} is bevestigd.`);
        setError(
          read.ok
            ? "De actuele leesversie loopt achter. Je invoer blijft hier; controleer de huidige versie opnieuw."
            : read.error,
        );
        persist();
        return false;
      }
      if (serial(read.document) !== serial(command.document)) {
        setConflict(true);
        setMessage(
          "Je wijziging is bevestigd. Daarna is het ontwerp opnieuw gewijzigd; je eigen invoer blijft hier beschikbaar.",
        );
        persist();
        return false;
      }
      revision.current = read.revision;
      metadata.current = read.document.metadata;
      baseline.current = serial(draftRef.current);
      setNeedsRead(false);
      setConflict(false);
      setRecovered(false);
      confirmedRead.current = undefined;
      setMessage(`Versie ${read.revision} is veilig opgeslagen.`);
      persist();
      return true;
    } catch {
      if (receiptConfirmed) {
        setUncertain(false);
        setNeedsRead(true);
        setError(
          "De opslag is bevestigd, maar de actuele versie kon niet worden gelezen. Je invoer blijft hier; controleer de huidige versie opnieuw.",
        );
      } else {
        setUncertain(true);
        setError(
          "De opslag is niet bevestigd. Je invoer blijft hier; verbind opnieuw en bevestig dezelfde wijziging opnieuw.",
        );
      }
      persist();
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function render() {
    if (!isLive || !permissions.canRender || busy || !online || pendingJob || seriesTools.blocked)
      return;
    const replaying = Boolean(renderAttempt.current);
    let command = renderAttempt.current;
    if (!command) {
      if (
        conflict ||
        needsRead ||
        uncertain ||
        restoreAttempt.current ||
        !document
      )
        return;
      if (dirty && !(await save())) return;
      command = {
        projectId: project.id,
        expectedDraftRevision: revision.current,
        idempotencyKey: crypto.randomUUID(),
        outputKind: document.motion.enabled ? "mp4" : "png",
      };
      renderAttempt.current = command;
      persist();
    }
    setBusy(true);
    setError(null);
    try {
      const result = await requestStudioRenderAction(command);
      if (!result.ok || result.outcome !== "queued" || !result.jobId) {
        if (result.outcome === "conflict" || (result.rejected && !replaying)) {
          renderAttempt.current = null;
          if (result.outcome === "conflict") setConflict(true);
          persist();
        }
        setError(
          result.error ??
            "De uitvoeropdracht is niet bevestigd. Je ontwerp is opgeslagen; bevestig dezelfde opdracht opnieuw.",
        );
        return;
      }
      renderAttempt.current = null;
      jobRef.current = result.jobId;
      setPendingJob(result.jobId);
      setRenderStatus("pending");
      setReadyDocument(null);
      persist();
      setMessage(
        `De uitvoeropdracht voor opgeslagen versie ${command.expectedDraftRevision} is bevestigd.`,
      );
    } catch {
      setError(
        "De uitvoeropdracht is niet bevestigd. Je ontwerp blijft opgeslagen; bevestig dezelfde opdracht opnieuw.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (
      !isLive ||
      !permissions.canCreate ||
      busy ||
      !online ||
      uncertain ||
      seriesTools.blocked ||
      restoreAttempt.current
    )
      return;
    const replaying = Boolean(copyAttempt.current);
    const command =
      copyAttempt.current ??
      (document
        ? {
            projectId: project.id,
            document,
            idempotencyKey: crypto.randomUUID(),
          }
        : null);
    if (!command) return;
    copyAttempt.current = command;
    persist();
    setBusy(true);
    setError(null);
    try {
      const result = await copyStudioConflictAction(command);
      if (!result.ok || result.outcome !== "created" || !result.projectId) {
        if (result.rejected && !replaying) {
          copyAttempt.current = null;
          persist();
        }
        setError(
          result.error ??
            "De kopie is niet bevestigd. Je invoer blijft hier; bevestig dezelfde kopie opnieuw.",
        );
        return;
      }
      copyAttempt.current = null;
      setConfirmedCopy(result.projectId);
      persist();
      if (serial(currentDocument.current) === serial(command.document)) {
        router.push(`/dashboard/studio/${result.projectId}`);
      } else {
        setMessage(
          "De kopie van je eerdere invoer is bevestigd. Je nieuwere invoer blijft hier; je kunt de kopie afzonderlijk openen.",
        );
      }
    } catch {
      setError(
        "De kopie is niet bevestigd. Je invoer blijft hier; bevestig dezelfde kopie opnieuw.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function restore(revisionId?: string) {
    if (!canEdit || busy || !online || uncertain || seriesTools.blocked) return;
    const replaying = Boolean(restoreAttempt.current);
    let command = restoreAttempt.current;
    if (!command) {
      if (!revisionId || dirty || conflict || needsRead || saveAttempt.current)
        return;
      command = {
        projectId: project.id,
        revisionId,
        expectedDraftRevision: revision.current,
        idempotencyKey: crypto.randomUUID(),
      };
      restoreAttempt.current = command;
      persist();
    }
    setBusy(true);
    setError(null);
    let receiptConfirmed = false;
    try {
      const result = await restoreStudioRevisionAction(command);
      if (
        !result.ok ||
        result.outcome !== "restored" ||
        !Number.isSafeInteger(result.revision) ||
        Number(result.revision) < command.expectedDraftRevision + 1
      ) {
        if (result.outcome === "conflict" || (result.rejected && !replaying)) {
          restoreAttempt.current = null;
          if (result.outcome === "conflict") setConflict(true);
          persist();
        }
        setError(
          result.error ??
            "Het herstel is nog niet bevestigd. Bevestig dezelfde versie opnieuw.",
        );
        return;
      }
      receiptConfirmed = true;
      restoreAttempt.current = null;
      revision.current = Number(result.revision);
      const target = revisions.find(
        (value) => value.id === command.revisionId,
      )?.document;
      if (target)
        confirmedRead.current = {
          revision: revision.current,
          document: target,
        };
      setNeedsRead(true);
      persist();
      const read = await readSyncStudioDraftAction({ projectId: project.id });
      if (!read.ok || read.revision < revision.current) {
        setError(
          read.ok
            ? "De leesversie loopt achter op het bevestigde herstel. Controleer de huidige versie opnieuw."
            : read.error,
        );
        return;
      }
      if (!target || serial(read.document) !== serial(target)) {
        setConflict(true);
        setNeedsRead(false);
        setMessage(
          "Het herstel is bevestigd. Inmiddels staat er andere inhoud opgeslagen; je invoer blijft hier totdat je de huidige versie laadt.",
        );
        return;
      }
      applyCanonical(read.document, read.revision);
      setVersionsOpen(false);
      setMessage("De bewaarde versie is hersteld.");
    } catch {
      if (receiptConfirmed) {
        setNeedsRead(true);
        setError(
          "Het herstel is bevestigd, maar de huidige versie kon niet worden gelezen. Controleer de huidige versie opnieuw.",
        );
      } else {
        setError(
          "Het herstel is niet bevestigd. Je invoer blijft hier; bevestig dezelfde versie opnieuw.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const snapshot = revisions.find((value) => value.id === selectedRevision);
  const blocked =
    uncertain || conflict || needsRead || Boolean(restoreAttempt.current) || seriesTools.blocked;
  const feedback = (
    <>
      {seriesTools.feedback}
      {cacheWarning && (
        <div className="vc-recovered-note" role="status">
          <AlertCircle size={16} />
          <span>{cacheWarning}</span>
        </div>
      )}
      {recovered && !uncertain && !conflict && (
        <div className="vc-recovered-note">
          <RotateCcw size={16} />
          <span>
            Je lokale invoer is hersteld. Bewaar je wijzigingen wanneer je klaar
            bent.
          </span>
        </div>
      )}
      {!online && (
        <div className="vc-recovered-note" role="status">
          <span>
            Je bent offline. Je kunt blijven bewerken; bewaar je ontwerp zodra
            je weer verbonden bent.
          </span>
        </div>
      )}
      {message && (
        <div className="vc-recovered-note" role="status">
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="vc-recovered-note" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {!document && (
        <div className="vc-recovered-note" role="status">
          <span>
            Controleer de naam, links, gegevenstekst en duur. Gebruik een naam
            van 2 tot 120 tekens en drie tot
            120 seconden per pagina en maximaal 120 seconden totaal; je invoer
            blijft in de velden staan.
          </span>
        </div>
      )}
      {confirmedCopy && (
        <div className="vc-recovered-note">
          <Link href={`/dashboard/studio/${confirmedCopy}`}>
            Bevestigde kopie openen
          </Link>
        </div>
      )}
      {copyAttempt.current && (
        <div className="vc-recovered-note">
          <Button disabled={busy || !online} onClick={() => void copy()}>
            Dezelfde kopie bevestigen
          </Button>
        </div>
      )}
      {restoreAttempt.current && (
        <div className="vc-recovered-note">
          <Button disabled={busy || !online} onClick={() => void restore()}>
            Dezelfde versie herstellen
          </Button>
        </div>
      )}
      {blocked && (
        <div className="vc-recovered-note">
          <div className="row">
            {uncertain && (
              <Button disabled={busy || !online} onClick={() => void save()}>
                Dezelfde wijziging bevestigen
              </Button>
            )}
            {needsRead && (
              <Button
                disabled={busy || !online}
                onClick={() => void currentRead(false)}
              >
                Huidige versie controleren
              </Button>
            )}
            {conflict && (
              <>
                <Button
                  disabled={busy || !online}
                  onClick={() => void currentRead(true)}
                >
                  Huidige versie laden
                </Button>
                {permissions.canCreate && (
                  <Button
                    variant="secondary"
                    disabled={busy || !online || !document}
                    onClick={() => void copy()}
                  >
                    Mijn invoer als kopie bewaren
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
  const output = (
    <section className="vc-source-binding">
      <strong>Schermvoorbeeld</strong>
      <p>
        {renderStatus === "ready"
          ? serial(readyDocument) === serial(document)
            ? "De geverifieerde uitvoer van dit ontwerp staat in de bibliotheek."
            : "De geverifieerde uitvoer hoort bij een eerdere versie. Maak na het opslaan een nieuw schermvoorbeeld voor je huidige invoer."
          : renderStatus === "pending"
            ? "De bevestigde opdracht wordt verwerkt."
            : renderStatus === "unknown"
              ? "De opdracht is bevestigd, maar de actuele uitvoerstatus is nog onbekend. Controleer de opdracht in de bibliotheek."
              : latestJob
                ? `Laatste opdracht: ${({ queued: "in de wachtrij", preparing: "voorbereiden", rendering: "verwerken", uploading: "opslaan", completed: "uitvoer opgeslagen; controle volgt", failed: "mislukt", cancelled: "geannuleerd" } as Record<string, string>)[latestJob.status] ?? "status wordt gecontroleerd"}.`
                : "Maak na het opslaan de uitvoer voor je bibliotheek."}
      </p>
      <Button
        variant="secondary"
        disabled={
          !permissions.canRender ||
          !isLive ||
          busy ||
          Boolean(pendingJob) ||
          !online ||
          (!renderAttempt.current && (!document || blocked))
        }
        onClick={() => void render()}
      >
        {renderAttempt.current
          ? "Uitvoeropdracht bevestigen"
          : "Schermvoorbeeld maken"}
      </Button>
      <Button asChild variant="ghost">
        <Link href="/dashboard/studio">Naar de bibliotheek</Link>
      </Button>
    </section>
  );
  const versionControls = (
    <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
      <DialogTrigger asChild>
        <SyncStudioVersionTrigger count={revisions.length}/>
      </DialogTrigger>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>Versiegeschiedenis</DialogTitle>
          <DialogDescription>
            Herstellen bewaart een nieuwe conceptversie. Bestaande publicaties
            blijven behouden.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {dirty && <p>Bewaar je invoer voordat je een versie herstelt.</p>}
          {revisions.length === 0 ? (
            <p>Er zijn nog geen bewaarde uitvoer- of herstelversies.</p>
          ) : (
            <div className="stack">
              {revisions.map((value) => (
                <div className="row" key={value.id}>
                  <button
                    type="button"
                    aria-pressed={selectedRevision === value.id}
                    onClick={() => setSelectedRevision(value.id)}
                  >
                    Versie {value.number} ·{" "}
                    {new Date(value.createdAt).toLocaleString("nl-NL")}
                  </button>
                  <Button
                    variant="secondary"
                    disabled={!canEdit || dirty || busy || blocked || !online}
                    onClick={() => void restore(value.id)}
                  >
                    Versie {value.number} herstellen
                  </Button>
                </div>
              ))}
            </div>
          )}
          {snapshot?.document.syncPresentation && (
            <SyncSlideStaticView
              presentation={snapshot.document.syncPresentation}
              resolveAsset={resolveAsset}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
  return (
    <SyncStudioFrame
      sourceControls={draft.presentation.family==='engage'?<SyncEngageControls poll={draft.presentation.poll}disabled={!canEdit||busy||uploading||uncertain||!hydrated||Boolean(restoreAttempt.current)||seriesTools.blocked}onSelect={poll=>patch({poll})}/>:draft.presentation.family==='youtube'?<SyncYouTubeControls url={draft.presentation.youtubeUrl}disabled={!canEdit||busy||uploading||uncertain||!hydrated||Boolean(restoreAttempt.current)||seriesTools.blocked}onSelect={youtubeUrl=>patch({youtubeUrl})}/>:undefined}
      connectedCreateHref={canEdit&&syncConnectedAuthoringType(draft.presentation.family,draft.presentation.rendererVersion)?`/dashboard/slides/new/sync?project=${project.id}`:undefined}
      presentation={draft.presentation}
      scratch={draft.scratch}
      onScratchChange={(scratch) =>
        change({
          ...draftRef.current,
          scratch: { ...draftRef.current.scratch, ...scratch },
        })
      }
      assets={availableAssets}
      onBackgroundUpload={permissions.canUploadMedia?backgroundFile:undefined}
      uploading={uploading}
      seriesControls={seriesTools.controls}
      currentProjectId={project.id}
      filmstrip={libraryFilmstrip}
      onSelectDesign={id=>void seriesTools.navigate(id)}
      resolveAsset={resolveAsset}
      secondsPerPage={draft.seconds}
      onSecondsChange={(seconds) => change({ ...draftRef.current, seconds })}
      onChange={patch}
      onSave={() => void save()}
      onUndo={() => {
        if (!history.length || busy || uncertain || restoreAttempt.current)
          return;
        setFuture((value) => [draftRef.current, ...value]);
        setDraft(history.at(-1)!);
        setHistory((value) => value.slice(0, -1));
      }}
      onRedo={() => {
        if (!future.length || busy || uncertain || restoreAttempt.current)
          return;
        setHistory((value) => [...value, draftRef.current]);
        setDraft(future[0]!);
        setFuture((value) => value.slice(1));
      }}
      canUndo={history.length > 0}
      canRedo={future.length > 0}
      canSave={Boolean(document) && dirty && !blocked && online}
      readOnly={!canEdit}
      busy={busy || uploading || uncertain || Boolean(restoreAttempt.current) || seriesTools.blocked || !hydrated}
      dirty={dirty}
      revision={revision.current}
      saveLabel={
        uncertain
          ? "Nog niet bevestigd"
          : conflict
            ? "Nieuwere versie beschikbaar"
            : busy
              ? "Bezig…"
              : dirty
                ? "Niet opgeslagen"
                : `Versie ${revision.current} · opgeslagen`
      }
      feedback={feedback}
      outputControls={output}
      versions={versionControls}
    />
  );
}
