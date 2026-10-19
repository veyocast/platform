"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {motion} from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers3,
  LayoutTemplate,
  ImagePlus,
  Link2,
  Monitor,
  Palette,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Sparkles,
  Settings2,
  ShieldCheck,
  Smartphone,
  Undo2,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@veyocast/ui";
import {
  syncContentFamilies,
  syncSlidePageCount,
  syncSlidePresentationSchema,
  syncSlideTransition,
  type SyncContentFamily,
  type SyncSlideAsset,
  type SyncSlidePresentation,
} from "@veyocast/contracts";
import {
  SyncSlideStaticView,
  type SyncSlideAssetResolver,
} from "@veyocast/content-templates/sync-slide-static-view";
import { syncSlideCss } from "@veyocast/content-templates/sync-slide-styles";
import styles from "./sync-studio-frame.module.css";
import { SyncBackgroundPicker } from "./sync-background-picker";
import { orientSyncBackground } from "../../../../lib/sync-background-choice";
import type { StudioMediaAsset } from "./types";
import {
  syncRowsFromText,
  syncLineupFromText,
  type SyncStudioScratch,
} from "./sync-studio-recovery";
import {
  SyncStudioField as Field,
  SyncStudioCheck as Check,
  SyncStudioFieldGroup as FieldGroup,
} from "./sync-studio-field";

const tabs = [
  ["content", "Inhoud", Layers3],
  ["style", "Vormgeving", Palette],
  ["data", "Gegevensbron", Link2],
  ["settings", "Instellingen", Settings2],
] as const;
type FrameProps = {
  presentation: SyncSlidePresentation;
  previewPresentation?:SyncSlidePresentation;
  /** Optional rawmedia form and preview adapters; existing Studio defaults stay intact. */
  mediaControls?: { content?: ReactNode; style?: ReactNode; settings?: ReactNode; playback?: ReactNode };
  previewContent?: ReactNode;
  compactPreviewContent?: ReactNode;
  templateReadOnly?: boolean;
  templateLabel?: string;
  sectionLabel?: string;
  maxSeconds?: number;
  inputsDisabled?: boolean;
  initialTab?:'content'|'style'|'data'|'settings';
  primarySaveLabel?:string;
  assets: StudioMediaAsset[];
  resolveAsset: SyncSlideAssetResolver;
  secondsPerPage: string;
  onSecondsChange: (value: string) => void;
  onChange: (
    patch: Partial<SyncSlidePresentation>,
    scratch?: Partial<SyncStudioScratch>,
  ) => void;
  scratch: SyncStudioScratch;
  onScratchChange: (patch: Partial<SyncStudioScratch>) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canSave: boolean;
  readOnly: boolean;
  busy: boolean;
  dirty: boolean;
  revision: number;
  saveLabel: string;
  feedback?: ReactNode;
  outputControls?: ReactNode;
  versions?: ReactNode;
  sourceControls?: ReactNode;
  connectedData?:boolean;
  connectedCreateHref?:string;
  allowedFamilies?:readonly SyncContentFamily[];
  onBackgroundUpload?: (file:File)=>Promise<void>;
  uploading?:boolean;
  seriesControls?:ReactNode;
  filmstripContent?:ReactNode;
  onBeforeLibraryNavigate?:()=>boolean;
  filmstrip?:Array<{id:string;name:string;presentation:SyncSlidePresentation;assetUrls?:Record<string,string>}>;
  currentProjectId?:string;
  onSelectDesign?:(id:string)=>void;
};
const rowFamilies = new Set<SyncContentFamily>([
  "fixtures",
  "results",
  "period-standings",
  "cancellations",
  "dressing-rooms",
  "officials",
  "team-info",
  "activities",
  "training",
  "volunteers",
  "visitors",
  "club-program",
  "team-program",
  "pool-program",
  "club-results",
  "team-results",
  "pool-results",
  "standings",
  "team-arrivals",
  "referees",
  "changing-rooms",
  "birthdays",
  "menu",
  "sponsors",
  "agenda",
]);

/** Source Studio layout. Commands, confirmed state and provider controls belong to its controller. */
export function SyncStudioFrame(props: FrameProps) {
  const { presentation, assets, resolveAsset, onChange } = props;
  const [tab, setTab] = useState<(typeof tabs)[number][0]>(props.initialTab??"content"),
    [page, setPage] = useState(0),
    [playing, setPlaying] = useState(false),
    [fullPreview, setFullPreview] = useState(false),
    [sourceTab,setSourceTab]=useState<'manual'|'connected'>('manual'),
    [templatesOpen, setTemplatesOpen] = useState(false);
  const { rowsText, lineupText } = props.scratch;
  const rowsError =
    syncRowsFromText(rowsText) === null
      ? "Gebruik maximaal 200 rijen en vier kolommen, met maximaal 400 tekens per waarde. Je invoer blijft hier bewaard."
      : null;
  const lineupError =
    syncLineupFromText(lineupText) === null
      ? "Gebruik rugnummers van 1 tot 99, met één linie per regel. Je invoer blijft bewaard."
      : null;
  const fullTrigger=useRef<HTMLElement|null>(null),templateTrigger=useRef<HTMLButtonElement|null>(null),imageInput=useRef<HTMLInputElement|null>(null);
  const openFullPreview=(event:{currentTarget:HTMLElement})=>{fullTrigger.current=event.currentTarget;setFullPreview(true);};
  const validation = syncSlidePresentationSchema.safeParse(props.previewPresentation??presentation),
    lastValid = useRef(props.previewPresentation??presentation);
  if (validation.success) lastValid.current = validation.data;
  const preview = lastValid.current,
    definition = syncContentFamilies.find(
      (family) => family.id === presentation.family,
    )!;
  const pages = syncSlidePageCount(preview),
    transition=syncSlideTransition(preview),
    portrait = preview.orientation === "portrait",
    seconds = Number(props.secondsPerPage);
  useEffect(() => {
    setPage(0);
  }, [pages, presentation.family]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setPage((current) => (current + 1) % pages),
      Math.max(3, Number.isFinite(seconds) ? seconds : 12) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [playing, pages, seconds]);
  const imageChoices = useMemo(
    () =>
      assets.flatMap((asset) =>
        asset.kind === "image" && asset.checksumSha256 && asset.sourceUrl
          ? [
              {
                id: asset.id,
                name: asset.title,
                ref: {
                  kind: "tenant" as const,
                  mediaAssetId: asset.id,
                  checksumSha256: asset.checksumSha256,
                },
              },
            ]
          : [],
      ),
    [assets],
  );
  const setStyle = (patch: Partial<SyncSlidePresentation["style"]>) =>
    onChange({ style: { ...presentation.style, ...patch } });
  function rows(value: string) {
    const next = syncRowsFromText(value);
    if (next) onChange({ rows: next, ownRowIndexes: [] }, { rowsText: value });
    else props.onScratchChange({ rowsText: value });
  }
  function lineup(value: string) {
    const next = syncLineupFromText(value);
    if (next) onChange({ lineup: next }, { lineupText: value });
    else props.onScratchChange({ lineupText: value });
  }
  function imageSelect(
    value: SyncSlideAsset | undefined,
    onSelect: (asset: SyncSlideAsset | undefined) => void,
    label: string,
  ) {
    return (
      <Field label={label}>
        <select
          value={value?.kind === "tenant" ? value.mediaAssetId : ""}
          onChange={(event) =>
            onSelect(
              imageChoices.find((image) => image.id === event.target.value)
                ?.ref,
            )
          }
        >
          <option value="">Geen afbeelding</option>
          {imageChoices.map((image) => (
            <option key={image.id} value={image.id}>
              {image.name}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  function chooseFamily(family: SyncContentFamily) {
    if (props.readOnly || props.busy || props.inputsDisabled) return;
    onChange({
      family,
      headline: "",
      poll: family === "engage" ? presentation.poll : undefined,
    });
    setTemplatesOpen(false);
  }
  const matchFamily = ["matchday", "next-match", "scoreboard", "goal"].includes(
    presentation.family,
  );
  const previewNode = props.previewContent ?? (
    <SyncSlideStaticView
      presentation={preview}
      includeStyles={false}
      resolveAsset={resolveAsset}
      page={Math.min(page, pages - 1)}
    />
  );
  return (
    <div className="vc-studio-page sync-studio-frame">
      <style>{syncSlideCss}</style>
      <h1 className="sync-studio-sr-only">Studio: {presentation.name}</h1>
      <div className="vc-studio-topbar">
        <div className="row">
          <Link
            className="vc-back-button"
            aria-label="Terug naar bibliotheek"
            href="/dashboard/content"
            onClick={event => { if (props.onBeforeLibraryNavigate && !props.onBeforeLibraryNavigate()) event.preventDefault(); }}
          >
            <ArrowLeft size={19} />
          </Link>
          <div className="vc-studio-title">
            <span>
              STUDIO <ChevronRight size={11} />
              {props.sectionLabel ?? definition.group.toUpperCase()}
            </span>
            <input
              aria-label="Ontwerpnaam"
              value={presentation.name}
              maxLength={120}
              disabled={props.readOnly || props.busy || props.inputsDisabled}
              onChange={(event) => onChange({ name: event.target.value })}
            />
          </div>
        </div>
        <div className="vc-studio-top-actions">
          <span
            className={`vc-save-indicator ${props.dirty ? "is-dirty" : ""}`}
            role="status"
          >
            <i />
            {props.saveLabel}
          </span>
          <button
            type="button"
            className="vc-icon-button"
            aria-label="Ongedaan maken"
            disabled={!props.canUndo || props.readOnly || props.busy}
            onClick={props.onUndo}
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            className="vc-icon-button"
            aria-label="Opnieuw uitvoeren"
            disabled={!props.canRedo || props.readOnly || props.busy}
            onClick={props.onRedo}
          >
            <Redo2 size={17} />
          </button>
          <Button variant="secondary" onClick={openFullPreview}>
            Voorbeeld
          </Button>
          <Button
            variant="primary"
            disabled={
              !props.canSave ||
              Boolean(rowsError || lineupError) ||
              props.readOnly ||
              props.busy
            }
            onClick={props.onSave}
          >
            <Save size={18} />
            {props.primarySaveLabel??'Opslaan'}
          </Button>
        </div>
      </div>
      {props.readOnly && (
        <div className="vc-recovered-note">
          <ShieldCheck size={16} />
          <span>Je bekijkt dit ontwerp alleen-lezen.</span>
        </div>
      )}
      {props.feedback}
      <div className="vc-studio-workspace">
        <aside className="vc-studio-sidebar">
          <div className="vc-studio-tabs">
            {tabs.map(([key, label, Icon]) => (
              <button
                type="button"
                key={key}
                className={tab === key ? "active" : ""}
                aria-pressed={tab === key}
                title={label}
                onClick={() => setTab(key)}
              >
                <Icon size={19} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <fieldset
            className="vc-studio-properties"
            disabled={props.readOnly || props.busy || props.inputsDisabled}
          >
            {tab === "content" && (props.mediaControls?.content ?? (
              <>
                <div className="vc-properties-heading">
                  <span>MAAK HET VAN JOU</span>
                  <h2>Het verhaal op je scherm</h2>
                  <p>Je aanpassingen zie je meteen in het voorbeeld.</p>
                </div>
                <button
                  type="button"
                  className="vc-template-switch"
                  ref={templateTrigger}
                  disabled={props.templateReadOnly || props.inputsDisabled}
                  onClick={() => setTemplatesOpen(true)}
                >
                  <LayoutTemplate size={20} />
                  <span>
                    <small>TEMPLATE</small>
                    <strong>{props.templateLabel ?? definition.name}</strong>
                  </span>
                  <ChevronDown size={16} />
                </button>
                <Field label="Titel op het scherm">
                  <textarea
                    rows={2}
                    maxLength={400}
                    value={presentation.title}
                    onChange={(event) =>
                      onChange({ title: event.target.value })
                    }
                  />
                </Field>
                <Field label="Boventitel">
                  <input
                    maxLength={400}
                    value={presentation.headline}
                    onChange={(event) =>
                      onChange({ headline: event.target.value })
                    }
                  />
                </Field>
                <Field label="Ondertitel">
                  <input
                    maxLength={400}
                    value={presentation.subtitle}
                    onChange={(event) =>
                      onChange({ subtitle: event.target.value })
                    }
                  />
                </Field>
                {!props.connectedData&&(matchFamily || presentation.family === "welcome") && <>
                  <div className="vc-form-grid">
                    {([['home','Eigen team'],['away','Tegenstander']] as const).map(([side,label])=><Field key={side} label={label}><input maxLength={400} value={presentation[side]?.name??''} onChange={event=>onChange({[side]:{...presentation[side],name:event.target.value,team:presentation[side]?.team??''}})}/></Field>)}
                  </div>
                  <div className="vc-form-grid">
                    {([['time','Aftrap'],['date','Datumregel']] as const).map(([key,label])=><Field key={key} label={label}><input type={key==='time'?'time':'text'} value={presentation.match?.[key]??''} onChange={event=>onChange({match:{homeScore:'',awayScore:'',clock:'',date:'',time:'',...presentation.match,[key]:event.target.value}})}/></Field>)}
                  </div>
                  {['scoreboard','goal'].includes(presentation.family)&&<div className="vc-form-grid">
                    {([['homeScore','Score eigen team'],['awayScore','Score tegenstander']] as const).map(([key,label])=><Field key={key} label={label}><input maxLength={10} inputMode="numeric" value={presentation.match?.[key]??''} onChange={event=>onChange({match:{homeScore:'',awayScore:'',clock:'',date:'',time:'',...presentation.match,[key]:event.target.value}})}/></Field>)}
                  </div>}
                </>}
                {presentation.family === "youtube" && (
                  <Field
                    label="YouTube-link"
                    hint="De lokale kaart blijft beschikbaar wanneer de online video geen verbinding heeft."
                  >
                    <input
                      type="url"
                      value={presentation.youtubeUrl ?? ""}
                      onChange={(event) =>
                        onChange({
                          youtubeUrl: event.target.value || undefined,
                        })
                      }
                    />
                  </Field>
                )}
                {presentation.family === "lineup" && (
                  <>
                    <Field
                      label="Opstelling"
                      hint="Eén linie per regel, rugnummers gescheiden door komma’s."
                    >
                      <textarea
                        value={lineupText}
                        onChange={(event) => lineup(event.target.value)}
                      />
                    </Field>
                    {lineupError && (
                      <p role="alert" className="error-text">
                        {lineupError}
                      </p>
                    )}
                  </>
                )}
                <Field label="Tekst">
                  <textarea
                    rows={4}
                    maxLength={4000}
                    value={presentation.body}
                    onChange={(event) => onChange({ body: event.target.value })}
                  />
                </Field>
                <Field label="Voettekst">
                  <input
                    maxLength={400}
                    value={presentation.footer}
                    onChange={(event) =>
                      onChange({ footer: event.target.value })
                    }
                  />
                </Field>
                <div className="vc-inline-hint">
                  <Sparkles size={16} />
                  <span>Bewaar je ontwerp eerst. Voeg het daarna vanuit de bibliotheek aan een playlist toe.</span>
                </div>
              </>
            ))}
            {tab === "style" && (props.mediaControls?.style ?? (
              <>
                <div className="vc-properties-heading">
                  <span>ÉÉN HERKENBARE CLUB</span>
                  <h2>Vormgeving</h2>
                  <p>Het thema geeft de vorm. Je club maakt het eigen.</p>
                </div>
                <FieldGroup label="Schermthema" className="vc-theme-options" separate>
                  {(["fieldflow", "onzetrots-tv"] as const).map((theme) => (
                    <button
                      type="button"
                      key={theme}
                      className={presentation.theme === theme ? "active" : ""}
                      aria-pressed={presentation.theme === theme}
                      onClick={() => onChange({ theme })}
                    >
                      <div
                        className={`vc-theme-swatch ${theme === "onzetrots-tv" ? "onzetrots" : "fieldflow"}`}
                      ><span>Aa</span><i /></div>
                      <strong>
                        {theme === "fieldflow" ? "FieldFlow" : "OnzeTrots TV"}
                      </strong>
                      <small>
                        {theme === "fieldflow"
                          ? "Helder & modern"
                          : "Karakter & clubgevoel"}
                      </small>
                    </button>
                  ))}
                </FieldGroup>
                <div className="vc-form-grid">
                <Field label="Accentkleur" controlWrapperClassName="vc-color-input" adornment={<span>{presentation.style.accent}</span>}>
                  <input
                    type="color"
                    value={presentation.style.accent}
                    onChange={(event) =>
                      setStyle({ accent: event.target.value })
                    }
                  />
                </Field>
                <Field label="Lettertype">
                  <select
                    value={
                      presentation.style.font === "Inter, sans-serif"
                        ? "Inter"
                        : presentation.style.font
                    }
                    onChange={(event) =>
                      setStyle({
                        font: event.target
                          .value as SyncSlidePresentation["style"]["font"],
                        fontChanged: true,
                      })
                    }
                  >
                    {["Inter", "Manrope", "Arial", "Brush", "Condensed", "Serif"].map(
                      (font) => (
                        <option key={font}>{font}</option>
                      ),
                    )}
                  </select>
                </Field>
                </div>
                <Field label={`Tekstgrootte · ${presentation.style.scale}%`}>
                  <input
                    type="range"
                    min={75}
                    max={125}
                    step={5}
                    value={presentation.style.scale}
                    onChange={(event) =>
                      setStyle({ scale: Number(event.target.value) })
                    }
                  />
                </Field>
                <FieldGroup label="Uitlijning" className="vc-segmented">
                  {([['left','Links'],['center','Midden'],['right','Rechts']] as const).map(([alignment,label])=><button type="button" key={alignment} className={presentation.style.alignment===alignment?'active':''} aria-pressed={presentation.style.alignment===alignment} onClick={()=>setStyle({alignment})}>{label}</button>)}
                </FieldGroup>
                <SyncBackgroundPicker presentation={presentation} onChange={onChange} disabled={props.inputsDisabled} />
                {props.onBackgroundUpload&&<><Button variant="secondary" onClick={()=>imageInput.current?.click()}><ImagePlus size={16}/>{props.uploading?'Achtergrond controleren…':'Eigen achtergrond uploaden'}</Button><input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden aria-label="Achtergrond uploaden" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void props.onBackgroundUpload?.(file);}}/></>}
                <Field label={`Veilige marge · ${presentation.style.safeMargin}%`}>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={presentation.style.safeMargin}
                    onChange={(event) =>
                      setStyle({ safeMargin: Number(event.target.value) })
                    }
                  />
                </Field>
                <Check
                  label="Clublogo tonen"
                  checked={presentation.style.showLogo}
                  onChange={(showLogo) => setStyle({ showLogo })}
                />
                <Check
                  label="Clubvoettekst tonen"
                  checked={presentation.style.showFooter}
                  onChange={(showFooter) => setStyle({ showFooter })}
                />
                <details><summary>Clubbeelden en achtergrond</summary>
                {imageSelect(
                    presentation.style.backgroundAsset,
                    (backgroundAsset) => setStyle({ backgroundAsset,background:backgroundAsset?'photo':'stadium' }),
                    "Achtergrondfoto",
                  )}
                <Field label="Uitsnede foto">
                  <select
                    value={presentation.style.backgroundPosition}
                    onChange={(event) =>
                      setStyle({
                        backgroundPosition: event.target
                          .value as SyncSlidePresentation["style"]["backgroundPosition"],
                      })
                    }
                  >
                    {(
                      ["center", "top", "bottom", "left", "right"] as const
                    ).map((position, index) => (
                      <option key={position} value={position}>
                        {["Midden", "Boven", "Onder", "Links", "Rechts"][index]}
                      </option>
                    ))}
                  </select>
                </Field>
                {imageSelect(
                  presentation.club.logo,
                  (logo) => onChange({ club: { ...presentation.club, logo } }),
                  "Clublogo",
                )}
                <Field label="Clubslogan">
                  <input
                    maxLength={400}
                    value={presentation.club.tagline}
                    onChange={(event) =>
                      onChange({
                        club: {
                          ...presentation.club,
                          tagline: event.target.value,
                        },
                      })
                    }
                  />
                </Field>
                {!props.connectedData&&(matchFamily||presentation.family==='welcome')&&<details><summary>Teamlogo’s</summary>{(['home','away'] as const).map(side=><div key={side}>{imageSelect(presentation[side]?.logo,logo=>onChange({[side]:{name:presentation[side]?.name??'',team:presentation[side]?.team??'',logo}}),side==='home'?'Logo eigen team':'Logo tegenstander')}</div>)}</details>}
                </details>
              </>
            ))}
            {tab === "data" && (
              <>
                <div className="vc-properties-heading">
                  <span>ACTUEEL, ZONDER EXTRA WERK</span>
                  <h2>Gegevensbron</h2>
                  <p>Verbind een bron of beheer de gegevens zelf.</p>
                </div>
                {props.sourceControls ?? <>
                  <div className="vc-segmented" role="group" aria-label="Gegevens beheren">
                    <button type="button" className={sourceTab==='manual'?'active':''} aria-pressed={sourceTab==='manual'} onClick={()=>setSourceTab('manual')}>Handmatig</button>
                    <button type="button" className={sourceTab==='connected'?'active':''} aria-pressed={sourceTab==='connected'} onClick={()=>setSourceTab('connected')}>Gekoppelde bron</button>
                  </div>
                  {sourceTab==='connected'&&<>
                    <div className="vc-source-binding">
                      <strong>Dit ontwerp gebruikt handmatige gegevens</strong>
                      <p>
                        De ingevoerde gegevens horen bij dit ontwerp.
                        {props.connectedCreateHref?'Maak een gekoppelde kopie met de juiste bronselectie. Je handmatige ontwerp blijft behouden.':'Maak een bronontwerp met de juiste selectie bij Bronnen.'}
                      </p>
                    </div>
                    <Button asChild variant="secondary">
                      <Link href={props.connectedCreateHref??'/dashboard/sources'}>
                        {props.connectedCreateHref?'Gekoppelde kopie maken':'Bronnen beheren'} <ArrowRight size={14} />
                      </Link>
                    </Button>
                  </>}
                </>}
                {!props.connectedData&&['scoreboard','goal'].includes(presentation.family)&&<Field label="Wedstrijdklok"><input maxLength={40} value={presentation.match?.clock??''} onChange={event=>onChange({match:{homeScore:'',awayScore:'',date:'',time:'',...presentation.match,clock:event.target.value}})}/></Field>}
                {!props.connectedData&&rowFamilies.has(presentation.family) && (
                  <>
                    <Field label="Rijen · één rij per regel">
                      <textarea
                        rows={7}
                        value={rowsText}
                        onChange={(event) => rows(event.target.value)}
                      />
                    </Field>
                    <p className="vc-property-hint">Scheid kolommen met |. Voor menu’s: product | prijs. Voor wedstrijden: thuis | uit | tijd | veld.</p>
                    {rowsError && (
                      <p role="alert" className="error-text">
                        {rowsError}
                      </p>
                    )}
                    <Field label="Gegevensstatus"><input readOnly value={presentation.state==='error'?'Bron tijdelijk onbereikbaar':presentation.rows.length===0?'Geen gegevens ingevoerd':'Gegevens beschikbaar'}/></Field>
                    <div className="vc-form-grid">
                    <Field label="Rijen per pagina">
                      <input type="number" min={1} max={8}
                        value={presentation.rowsPerPage}
                        onChange={(event) =>
                          onChange({ rowsPerPage: Math.min(8,Math.max(1,Number(event.target.value)||1)) })
                        }
                      />
                    </Field>
                    <Field label="Aantal pagina’s"><input type="number" value={pages} readOnly /></Field>
                    </div>
                  </>
                )}
                {!props.connectedData&&presentation.family === "rss" && (
                  <div className="vc-rss-editor">
                    <div className="row between">
                      <strong>Artikelen · {presentation.news.length}</strong>
                      <button type="button" className="vc-icon-button" aria-label="Artikel toevoegen" disabled={presentation.news.length>=50} onClick={()=>{onChange({news:[...presentation.news,{title:"",intro:"",source:""}]});setPage(presentation.news.length);}}><Plus size={15}/></button>
                    </div>
                    {presentation.news.map((article, index) => (
                      <details key={index} open={index === page}>
                        <summary onClick={()=>setPage(index)}>
                          {index+1}. {article.title || "Nieuw clubartikel"}
                        </summary>
                        {(["title", "intro", "source", "url"] as const).map(
                          (key, fieldIndex) => (
                            <Field
                              key={key}
                              label={
                                [
                                  "Artikeltitel",
                                  "Introductie",
                                  "Bronnaam",
                                  "Artikel-URL voor QR",
                                ][fieldIndex]!
                              }
                            >
                              {key === 'intro' ? <textarea rows={3}
                                value={article[key] ?? ""}
                                onChange={(event) =>
                                  onChange({
                                    news: presentation.news.map((value, i) =>
                                      i === index
                                        ? {
                                            ...value,
                                            intro:event.target.value,
                                          }
                                        : value,
                                    ),
                                  })
                                }
                              /> : <input type={key==='url'?'url':'text'} value={article[key]??''} onChange={event=>onChange({news:presentation.news.map((value,i)=>i===index?{...value,[key]:event.target.value||(key==='url'?undefined:'')}:value)})} />}
                            </Field>
                          ),
                        )}
                        <button
                          type="button"
                          className="vc-rss-remove"
                          onClick={() => {
                            onChange({
                              news: presentation.news.filter(
                                (_, i) => i !== index,
                              ),
                            });setPage(0);
                          }}
                        >
                          Artikel verwijderen
                        </button>
                      </details>
                    ))}
                  </div>
                )}
              </>
            )}
            {tab === "settings" && (props.mediaControls?.settings ?? (
              <>
                <div className="vc-properties-heading">
                  <span>DE LAATSTE DETAILS</span>
                  <h2>Instellingen &amp; versies</h2>
                  <p>Bewaar hoe dit ontwerp gebruikt mag worden.</p>
                </div>
                <FieldGroup label="Schermstand" className="vc-orientation-options">
                  <button type="button" className={!portrait?'active':''} aria-pressed={!portrait} onClick={()=>onChange(orientSyncBackground(presentation,'landscape'))}><Monitor size={24}/><strong>Liggend</strong><span>16:9</span></button>
                  <button type="button" className={portrait?'active':''} aria-pressed={portrait} onClick={()=>onChange(orientSyncBackground(presentation,'portrait'))}><Smartphone size={24}/><strong>Staand</strong><span>9:16</span></button>
                </FieldGroup>
                <Field label="Duur per pagina (seconden)">
                  <input
                    type="number"
                    min={3}
                    max={props.maxSeconds ?? 120}
                    value={props.secondsPerPage}
                    onChange={(event) =>
                      props.onSecondsChange(event.target.value)
                    }
                  />
                </Field>
                <Field label="Motion"><select value={presentation.style.motion??'geen'} onChange={event=>setStyle({motion:event.target.value as NonNullable<SyncSlidePresentation['style']['motion']>})}><option value="rustig">Rustige overgangen</option><option value="dynamisch">Dynamisch</option><option value="geen">Geen animatie</option></select></Field>
                {props.seriesControls}
                {props.versions}
                {props.outputControls}
              </>
            ))}
          </fieldset>
        </aside>
        <section className="vc-studio-stage" aria-label="Schermvoorbeeld">
          <div className="vc-stage-toolbar">
            <div className="vc-stage-breadcrumb">
              <span className="vc-live-dot" />
              LIVE VOORBEELD<span>·</span>
              {portrait ? "1080 × 1920" : "1920 × 1080"}
            </div>
            <div className="vc-stage-controls">
              <button
                type="button"
                className={!portrait ? "active" : ""}
                aria-label="Liggend formaat"
                aria-pressed={!portrait}
                disabled={props.readOnly || props.busy || props.inputsDisabled}
                onClick={() => onChange(orientSyncBackground(presentation, "landscape"))}
              >
                <Monitor size={17} />
              </button>
              <button
                type="button"
                className={portrait ? "active" : ""}
                aria-label="Staand formaat"
                aria-pressed={portrait}
                disabled={props.readOnly || props.busy || props.inputsDisabled}
                onClick={() => onChange(orientSyncBackground(presentation, "portrait"))}
              >
                <Smartphone size={17} />
              </button>
              <span>Passend</span>
            </div>
          </div>
          <div className={`vc-stage-canvas ${portrait ? "portrait" : ""}`}>
            <motion.div key={`${presentation.family}-${page}-${presentation.orientation}-${presentation.style.motion??'geen'}`} initial={transition?{opacity:0,y:transition.offsetPx}:false} animate={{opacity:1,y:0}} transition={{duration:transition?transition.durationMs/1000:0,ease:'easeOut'}}>{previewNode}</motion.div>
          </div>
          {(!validation.success || rowsError || lineupError) && (
            <p role="status" className="vc-property-hint">
              Vul je invoer aan om het voorbeeld bij te werken. Je wijzigingen
              blijven in de velden staan.
            </p>
          )}
          <div className="vc-stage-caption">
            <div>
              <span className="vc-theme-tag">
                <span style={{ background: presentation.style.accent }} />
                {presentation.theme === "fieldflow" ? "FieldFlow" : "OnzeTrots"}
              </span>
              <span>
                {pages} {pages === 1 ? "pagina" : "pagina’s"} ·{" "}
                {props.secondsPerPage || "–"}s per pagina
              </span>
            </div>
            <button type="button" onClick={openFullPreview}>
              Groot voorbeeld <ArrowRight size={14} />
            </button>
          </div>
          {props.mediaControls?.playback ?? <div className="vc-page-controls">
            <button
              type="button"
              aria-label="Vorige pagina"
              onClick={() =>
                setPage((current) => (current - 1 + pages) % pages)
              }
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              className="vc-preview-play"
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? (
                <Pause size={13} />
              ) : (
                <Play size={13} fill="currentColor" />
              )}
              {playing ? "Pauzeren" : "Afspelen"}
            </button>
            <span>
              {Math.min(page + 1, pages)} / {pages}
            </span>
            <button
              type="button"
              aria-label="Volgende pagina"
              onClick={() => setPage((current) => (current + 1) % pages)}
            >
              <ChevronRight size={17} />
            </button>
          </div>}
          <div className="vc-studio-filmstrip">
            <div className="vc-filmstrip-heading">
              <span>
                <Layers3 size={14} />
                ONTWERPEN IN JE BIBLIOTHEEK
              </span>
              <Link href="/dashboard/content" onClick={event => { if (props.onBeforeLibraryNavigate && !props.onBeforeLibraryNavigate()) event.preventDefault(); }}>
                Alles bekijken <ArrowRight size={13} />
              </Link>
            </div>
            <div className={`vc-filmstrip-items ${styles.filmstrip}`}>
              {props.filmstripContent ?? (props.filmstrip?.length?props.filmstrip.map(member=><button type="button"key={member.id}className={member.id===props.currentProjectId?'active':''}disabled={props.busy}aria-label={`${member.id===props.currentProjectId?'Huidig ontwerp':'Ontwerp openen'}: ${member.name}`}onClick={()=>{if(member.id!==props.currentProjectId)props.onSelectDesign?.(member.id);}}><SyncSlideStaticView presentation={member.id===props.currentProjectId?preview:member.presentation}compact resolveAsset={asset=>asset.kind==='tenant'&&member.id!==props.currentProjectId?member.assetUrls?.[asset.mediaAssetId]??resolveAsset(asset):resolveAsset(asset)}includeStyles={false}/><span>{member.name}</span></button>):<button
                type="button"
                className="active"
                aria-label={`Huidig ontwerp: ${presentation.name}`}
              >
                {props.compactPreviewContent ?? <SyncSlideStaticView presentation={preview} compact resolveAsset={resolveAsset} includeStyles={false}/>}
                <span>{presentation.name}</span>
              </button>)}
            </div>
          </div>
        </section>
      </div>
      <Dialog open={fullPreview} onOpenChange={setFullPreview}>
        <DialogContent size="fullscreen" onCloseAutoFocus={event=>{event.preventDefault();fullTrigger.current?.focus();}}>
          <DialogHeader>
            <DialogTitle>Voorbeeld van {presentation.name}</DialogTitle>
            <DialogDescription>
              Pagina {Math.min(page + 1, pages)} van {pages} ·{" "}
              {portrait ? "9:16" : "16:9"}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className={`vc-full-preview ${portrait ? "portrait" : ""}`}>
              {previewNode}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent size="wide" onCloseAutoFocus={event=>{event.preventDefault();templateTrigger.current?.focus();}}>
          <DialogHeader>
            <DialogTitle>Kies een template</DialogTitle>
            <DialogDescription>
              {props.connectedData?'Kies een vormgeving voor dezelfde gecontroleerde bronfamilie.':'Je teksten en handmatige rijen blijven behouden wanneer je de familie wijzigt.'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="vc-template-grid">
              {syncContentFamilies.filter(family=>!props.allowedFamilies||props.allowedFamilies.includes(family.id)).map((family) => (
                <button
                  type="button"
                  key={family.id}
                  className="vc-template-card"
                  aria-pressed={family.id === presentation.family}
                  onClick={() => chooseFamily(family.id)}
                >
                  <SyncSlideStaticView
                    presentation={{
                      ...preview,
                      family: family.id,
                      poll: family.id === "engage" ? preview.poll : undefined,
                    }}
                    resolveAsset={resolveAsset}
                    compact
                    includeStyles={false}
                  />
                  <span>
                    <strong>{family.name}</strong>
                    <small>{family.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
