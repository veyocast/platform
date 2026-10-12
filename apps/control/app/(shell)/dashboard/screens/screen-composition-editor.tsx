"use client";

/* eslint-disable @next/next/no-img-element */
import { CheckCircle2, ChevronRight, LayoutGrid } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";

import { compositionZoneIds, type ScreenCompositionDraft } from "@veyocast/contracts";
import { Button, Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger, StatusPill } from "@veyocast/ui";
import { saveScreenComposition, type CompositionSaveResult } from "./screen-composition-actions";
import type { CompositionWorkspaceData } from "./screen-composition-data";
import styles from "./screens-overview.module.css";
import { PlaylistPlacementPreview } from "../playlists/_components/sites/placement-preview";

export type CompositionScreen = { id: string; name: string; orientation: string; defaultPlaylistId: string | null };
type CompositionGroup = { id: string; name: string; memberIds: readonly string[] };
const layoutNames = { full: "Volledig scherm", sidebar: "Hoofdvlak + zijbalk", bottom: "Hoofdvlak + onderbalk", three: "Drie zones" } as const;
const zoneNames = { main: "Hoofdvlak", side: "Zijbalk", bottom: "Onderbalk" } as const;
export function ScreenCompositionEditor({ canPublish, data, groups, initialTarget, screens }: {
  canPublish: boolean; data: CompositionWorkspaceData; groups: readonly CompositionGroup[]; initialTarget: string; screens: readonly CompositionScreen[];
}) {
  const [open, setOpen] = useState(false);
  return <Dialog onOpenChange={setOpen} open={open}>
    <DialogTrigger asChild><Button disabled={!canPublish || Boolean(data.error) || !screens.length} variant="secondary"><LayoutGrid aria-hidden="true" size={16} />Schermindeling</Button></DialogTrigger>
    <DialogContent className={styles.sourceDialog} closeLabel="Schermindeling sluiten" size="wide"><DialogHeader><DialogTitle>Je scherm indelen</DialogTitle></DialogHeader><DialogBody>
      {open ? <LayoutWizard canPublish={canPublish} data={data} groups={groups} initialTarget={initialTarget} onClose={() => setOpen(false)} screens={screens} /> : null}
    </DialogBody></DialogContent>
  </Dialog>;
}
function LayoutWizard({ canPublish, data, groups, initialTarget, onClose, screens }: {
  canPublish: boolean; data: CompositionWorkspaceData; groups: readonly CompositionGroup[]; initialTarget: string; onClose: () => void; screens: readonly CompositionScreen[];
}) {
  const original = screens.find((screen) => screen.id === initialTarget);
  const originalDraft = data.drafts.find((draft) => draft.screenId === original?.id)?.configuration;
  const [destination, setDestination] = useState(initialTarget);
  const [step, setStep] = useState(0);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(originalDraft?.orientation ?? (original?.orientation === "portrait" ? "portrait" : "landscape"));
  const [layout, setLayout] = useState<ScreenCompositionDraft["layout"]>(originalDraft?.layout ?? "full");
  const [mainShare, setMainShare] = useState(originalDraft?.mainWidthPercent ?? 70);
  const [footerShare, setFooterShare] = useState(originalDraft?.bottomHeightPercent ?? 20);
  const [content, setContent] = useState<Partial<Record<"main" | "side" | "bottom", string>>>(() => Object.fromEntries(originalDraft?.zones.map((zone) => [zone.id, `playlist:${zone.playlistId}`]) ?? [["main", original?.defaultPlaylistId ? `playlist:${original.defaultPlaylistId}` : data.playlists.find(playlist => playlist.published)?.id ? `playlist:${data.playlists.find(playlist => playlist.published)!.id}` : ""]]));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CompositionSaveResult | null>(null);
  const commandId = useRef<string | null>(null);
  const router = useRouter();
  const ids = useMemo(() => destination === "all" ? screens.map((screen) => screen.id) : destination.startsWith("group:") ? (groups.find((group) => group.id === destination.slice(6))?.memberIds ?? []).filter((id) => screens.some((screen) => screen.id === id)) : screens.filter((screen) => screen.id === destination).map((screen) => screen.id), [destination, groups, screens]);
  const zones = compositionZoneIds(layout);
  const contentLabel = (value: string | undefined) => value?.startsWith("series:") ? data.series.find((series) => series.id === value.slice(7))?.name : data.playlists.find((playlist) => playlist.id === value?.slice(9))?.name;
  function changed() { commandId.current = null; setResult(null); setError(""); }
  async function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || result?.status === "published") return;
    setError("");
    if (!ids.length || ids.length > 100) { setError("Kies één tot en met 100 bestaande schermen. Verdeel een grotere selectie over groepen."); return; }
    if (step >= 1 && zones.some((zone) => !contentLabel(content[zone]))) { setError("Kies content voor iedere zichtbare zone."); return; }
    if (step < 2) { setStep(step + 1); return; }
    if (!canPublish) { setError("Je hebt geen toestemming om deze schermindeling te publiceren."); return; }
    setPending(true);
    commandId.current ??= crypto.randomUUID();
    try {
      const next = await saveScreenComposition({ commandId: commandId.current, targets: ids.map((screenId) => ({ screenId, expectedDraftRevision: data.drafts.find((draft) => draft.screenId === screenId)?.revision ?? 0 })), configuration: { layout, orientation, mainWidthPercent: mainShare, bottomHeightPercent: footerShare, zones: zones.map((id) => ({ id, content: content[id] })) }, seriesRevisions: Object.fromEntries(data.series.map((series) => [series.id, series.revision])) });
      setResult(next);
      if (next.status === "published") router.refresh();
    } catch {
      setError("De publicatiebevestiging kon niet worden ontvangen. Vernieuw de pagina en controleer de schermindeling voordat je opnieuw opslaat.");
    } finally { setPending(false); }
  }
  return <form aria-busy={pending} className={styles.editorForm} onSubmit={advance} noValidate>
    <ol className={styles.wizardSteps}>{["Indeling", "Zonecontent", "Controleren"].map((label, index) => <li aria-current={step === index ? "step" : undefined} data-done={index < step} key={label}><span>{index < step ? <CheckCircle2 aria-hidden="true" size={15} /> : index + 1}</span>{label}</li>)}</ol>
    <div className={styles.layoutWorkspace}><div className={styles.layoutControls}>
      {step === 0 ? <><p>Kies de indeling die past bij je locatie. Met meerdere zones kunnen score, programma en clubnieuws tegelijk in beeld.</p><label className="field"><span>Toepassen op</span><select aria-label="Toepassen op" disabled={pending} onChange={(event) => { changed(); setDestination(event.currentTarget.value); }} value={destination}><option value="all">Alle schermen ({screens.length})</option><optgroup label="Schermgroepen">{groups.map((group) => <option key={group.id} value={`group:${group.id}`}>{group.name} ({group.memberIds.length})</option>)}</optgroup><optgroup label="Schermen">{screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.name}</option>)}</optgroup></select></label><label className="field"><span>Oriëntatie</span><select aria-label="Oriëntatie" disabled={pending} onChange={(event) => { changed(); setOrientation(event.currentTarget.value === "portrait" ? "portrait" : "landscape"); }} value={orientation}><option value="landscape">Liggend (16:9)</option><option value="portrait">Staand (9:16)</option></select></label><div className={styles.layoutChoices}>{(Object.keys(layoutNames) as Array<keyof typeof layoutNames>).map((kind) => <button aria-pressed={layout === kind} disabled={pending} key={kind} onClick={() => { changed(); setLayout(kind); }} type="button"><span className={styles.layoutGlyph} data-kind={kind}><i /><i /><i /></span><strong>{layoutNames[kind]}</strong></button>)}</div></> : null}
      {step === 1 ? <><p>Vul iedere zone met een afspeellijst of een opgeslagen Studio-ontwerp.</p>{zones.map((zone) => <label className="field" key={zone}><span>{zoneNames[zone]}</span><select aria-label={zoneNames[zone]} disabled={pending} onChange={(event) => { const value = event.currentTarget.value; changed(); setContent((current) => ({ ...current, [zone]: value })); }} required value={content[zone] ?? ""}><option value="">Kies content</option><optgroup label="Afspeellijsten">{data.playlists.map((playlist) => <option disabled={!playlist.published} key={playlist.id} value={`playlist:${playlist.id}`}>{playlist.name}{!playlist.published ? " · eerst publiceren" : ""}</option>)}</optgroup>{data.series.length ? <optgroup label="Studio-ontwerpen">{data.series.map((series) => <option key={series.id} value={`series:${series.id}`}>{series.name}</option>)}</optgroup> : null}</select></label>)}{layout === "sidebar" || layout === "three" ? <label className="field"><span>Breedte hoofdvlak · {mainShare}%</span><input aria-label="Breedte hoofdvlak" disabled={pending} max={80} min={50} onChange={(event) => { changed(); setMainShare(Number(event.currentTarget.value)); }} step={5} type="range" value={mainShare} /></label> : null}{layout === "bottom" || layout === "three" ? <label className="field"><span>Hoogte onderbalk · {footerShare}%</span><input aria-label="Hoogte onderbalk" disabled={pending} max={35} min={15} onChange={(event) => { changed(); setFooterShare(Number(event.currentTarget.value)); }} step={5} type="range" value={footerShare} /></label> : null}<p className={styles.demoNote}>Maak LED Scores- en Sportlink-ontwerpen in Studio. Publiceer de playlist voordat je de content op je scherm indelt.</p></> : null}
      {step === 2 ? <><StatusPill label={`Gereed voor ${ids.length} ${ids.length === 1 ? "scherm" : "schermen"}`} tone="neutral" /><h3>{layoutNames[layout]}</h3><p>{orientation === "portrait" ? "Staand (9:16)" : "Liggend (16:9)"} · {destination === "all" ? "Alle schermen" : destination.startsWith("group:") ? groups.find((group) => group.id === destination.slice(6))?.name : screens.find((screen) => screen.id === destination)?.name}</p><dl className={styles.layoutSummary}>{zones.map((zone) => <div key={zone}><dt>{zoneNames[zone]}</dt><dd>{contentLabel(content[zone])}</dd></div>)}</dl><p className={styles.demoNote}>Alle schermindelingen worden samen gepubliceerd. Bestaande geplande momenten blijven behouden. Een Studio-ontwerp krijgt een gepubliceerde playlist voor de zone.</p></> : null}
    </div><div className={styles.layoutLive}><div><strong>Voorbeeld</strong><span>{orientation === "portrait" ? "9:16" : "16:9"}</span></div><CompositionPreview configuration={{ layout, orientation, mainWidthPercent: mainShare, bottomHeightPercent: footerShare }} content={content} playlists={data.playlists} /></div></div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}{result ? <p className={`notice ${result.status === "published" ? "notice--success" : "notice--critical"}`} role={result.status === "published" ? "status" : "alert"}>{result.message}{result.status === "conflict" ? <Button onClick={() => { router.refresh(); onClose(); }} type="button" variant="secondary">Actuele indeling laden</Button> : null}</p> : null}
    <div className={styles.formActions}><Button disabled={pending} onClick={() => result?.status === "published" ? onClose() : step ? setStep(step - 1) : onClose()} type="button" variant="secondary">{result?.status === "published" ? "Sluiten" : step ? "Vorige" : "Annuleren"}</Button>{result?.status !== "published" ? <Button disabled={pending || result?.status === "conflict"} type="submit">{pending ? "Veilig publiceren…" : step === 2 ? "Indeling opslaan" : "Volgende"}<ChevronRight aria-hidden="true" size={16} /></Button> : null}</div>
  </form>;
}
export function CompositionPreview({ configuration, content, playlists }: {
  configuration: Pick<ScreenCompositionDraft, "layout" | "orientation" | "mainWidthPercent" | "bottomHeightPercent">;
  content: Partial<Record<"main" | "side" | "bottom", string>>;
  playlists: CompositionWorkspaceData["playlists"];
}) {
  return <div className={styles.layoutPreviewWrap}><div className={styles.layoutPreview} data-kind={configuration.layout} data-portrait={configuration.orientation === "portrait"} style={{ "--main-share": `${configuration.mainWidthPercent}%`, "--side-share": `${100 - configuration.mainWidthPercent}%`, "--footer-share": `${configuration.bottomHeightPercent}%`, "--top-share": `${100 - configuration.bottomHeightPercent}%` } as CSSProperties}>{compositionZoneIds(configuration.layout).map((zone) => { const playlist = playlists.find((entry) => `playlist:${entry.id}` === content[zone]); return <div className={styles.layoutZone} data-zone={zone} key={zone}>{playlist?.previewUrl ? playlist.rawPhotoPreview ? <div className={styles.zoneContentFit} data-content="image" style={{ "--zone-ratio": 16/9 } as CSSProperties}><PlaylistPlacementPreview active={false} tenantName={playlist.rawPhotoPreview.clubName} slide={{id:playlist.id,name:playlist.rawPhotoPreview.title,image:playlist.previewUrl,seconds:10,kind:"image",themeId:"fieldflow"}}/></div> : <ImmutablePlaylistImage name={playlist.name} url={playlist.previewUrl}/> : <div className={styles.zonePlaceholder}><span>{zoneNames[zone].toUpperCase()}</span><strong>{playlist?.name ?? (content[zone] ? "Voorbeeld na publicatie beschikbaar" : "Kies je content")}</strong></div>}</div>; })}</div></div>;
}

function ImmutablePlaylistImage({name,url}:{name:string;url:string}){
 const [ratio,setRatio]=useState(16/9);
 return <div className={styles.zoneContentFit} data-content="image" style={{"--zone-ratio":ratio} as CSSProperties}><img alt={`Voorbeeld ${name}`} src={url} onLoad={event=>{const image=event.currentTarget;if(image.naturalWidth>0&&image.naturalHeight>0)setRatio(image.naturalWidth/image.naturalHeight);}}/></div>;
}
