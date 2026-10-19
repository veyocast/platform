"use client";

/* eslint-disable @next/next/no-img-element -- Serves the existing locked Source logo byte-for-byte. */
import { ArrowRight, Globe, Monitor, Plus, Smartphone, Tv, X } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button, Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@veyocast/ui";
import { createScreenOnboarding } from "./actions";
import { CompositionPreview } from "./screen-composition-editor";
import type { CompositionPlaylistOption } from "./screen-composition-data";
import styles from "./sync-screen-setup.module.css";

const platforms = [["Android", Smartphone], ["LG webOS", Tv], ["Web", Globe]] as const;

/** Platform is an installation instruction, never fabricated device telemetry. */
export function ScreenPlayerInstructions({ onContinue, disabled = false }: { onContinue?: () => void; disabled?: boolean }) {
  const [platform, setPlatform] = useState("Android");
  const instructions = platform === "LG webOS" ? "Open de bestaande webOS Player op je LG-scherm. Wacht totdat de tijdelijke koppelcode op dat scherm verschijnt." : platform === "Web" ? "Open de VeyoCast Player in de browser op het scherm dat je wilt koppelen. Neem de code van dat scherm over." : "Open de VeyoCast Player op je Android-apparaat. De Player toont zelf een tijdelijke koppelcode.";
  return <div className={`px-pair-flow ${styles.intro}`}>
    <div className="px-pair-illustration"><div><img src="/assets/full-light.svg" alt="VeyoCast" /><span>READY TO CONNECT</span><Monitor size={56} aria-hidden="true" /><small>Je eigen code verschijnt op de Player</small></div><div className="px-pair-rings" /></div>
    <div><span className="px-overline">BEGIN BIJ JE PLAYER</span><h2>Open VeyoCast op je scherm</h2><p className="muted">Kies je player. Op het scherm verschijnt een tijdelijke koppelcode.</p><div className="px-platform-picks" role="group" aria-label="Installatie-instructie voor je Player">{platforms.map(([label, PlatformIcon]) => <button aria-pressed={platform === label} className={platform === label ? "active" : ""} key={String(label)} type="button" onClick={() => setPlatform(String(label))}><PlatformIcon size={23} aria-hidden="true" /><strong>{String(label)}</strong></button>)}</div><p className="px-caption" role="status">{instructions}</p>{onContinue ? <Button disabled={disabled} onClick={onContinue} type="button">Ik heb een koppelcode <ArrowRight size={16} aria-hidden="true" /></Button> : null}</div>
  </div>;
}

export function ScreenSetupDialog({ disabled, defaultOpen = false, groups, releases, previews, settings, pairingCode = "", triggerLabel = "Nieuw scherm" }: {
  disabled: boolean; defaultOpen?: boolean;
  groups: readonly { id: string; name: string }[];
  releases: readonly { id: string; playlistId: string; playlistName: string }[];
  previews: readonly CompositionPlaylistOption[];
  settings: { width: number; height: number; orientation: string };
  pairingCode?: string; triggerLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={disabled}><Plus aria-hidden="true" size={17} />{triggerLabel}</Button></DialogTrigger>
    <DialogContent className={styles.dialog} showClose={false} size="wide"><header className={styles.header}><DialogTitle className={styles.title}>Een scherm toevoegen</DialogTitle><DialogClose className={`icon-button ${styles.close}`} aria-label="Scherm instellen sluiten"><X size={18} aria-hidden="true" /></DialogClose></header><DialogBody className={styles.body} data-screen-setup-surface>
      <DialogDescription className={styles.srOnly}>Open eerst de echte Player. Bewaar daarna schermgegevens en koppel de Player met zijn eigen tijdelijke code.</DialogDescription>
      {open ? <ScreenSetup disabled={disabled} groups={groups} releases={releases} previews={previews} settings={settings} pairingCode={pairingCode} onClose={() => setOpen(false)} /> : null}
    </DialogBody></DialogContent>
  </Dialog>;
}

function ScreenSetup({ disabled, groups, releases, previews, settings, pairingCode, onClose }: {
  disabled: boolean; groups: readonly { id: string; name: string }[];
  releases: readonly { id: string; playlistId: string; playlistName: string }[];
  previews: readonly CompositionPlaylistOption[]; settings: { width: number; height: number; orientation: string };
  pairingCode: string; onClose: () => void;
}) {
  const [details, setDetails] = useState(false);
  const codeLabelId = useId();
  const [name, setName] = useState("");
  const [group, setGroup] = useState(groups[0]?.id ?? "");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(settings.orientation === "portrait" ? "portrait" : "landscape");
  const [releaseId, setReleaseId] = useState("");
  const [code, setCode] = useState(pairingCode);
  const [location, setLocation] = useState("");
  const [width, setWidth] = useState(settings.width);
  const [height, setHeight] = useState(settings.height);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const key = useRef<string | null>(null);
  const selectedRelease = releases.find(release => release.id === releaseId);
  function submit(event: FormEvent<HTMLFormElement>) {
    if (disabled || submitting) { event.preventDefault(); return; }
    if (name.trim().length < 2) { event.preventDefault(); setError("Geef het scherm een herkenbare naam van minimaal twee tekens."); return; }
    setError(""); key.current ??= crypto.randomUUID();
    const input = event.currentTarget.elements.namedItem("idempotencyKey");
    if (input instanceof HTMLInputElement) input.value = key.current;
    setSubmitting(true);
  }
  if (!details) return <><ScreenPlayerInstructions disabled={disabled} onContinue={() => setDetails(true)} />{disabled ? <p className={styles.notice} role="status">Schermbeheer is niet beschikbaar voor deze sessie of de schermlimiet is bereikt. Er wordt niets aangemaakt.</p> : null}</>;
  return <form action={createScreenOnboarding} aria-busy={submitting} className={styles.form} onSubmit={submit}>
    <input name="name" type="hidden" value={name.trim()} /><input name="groupId" type="hidden" value={group} /><input name="orientation" type="hidden" value={orientation} /><input name="initialReleaseId" type="hidden" value={releaseId} /><input name="location" type="hidden" value={location} /><input name="resolutionWidth" type="hidden" value={width} /><input name="resolutionHeight" type="hidden" value={height} /><input name="pairingCode" type="hidden" value={code} /><input name="idempotencyKey" type="hidden" />
    <div className={styles.grid} data-screen-setup-grid>
      <label className="field"><span id={codeLabelId}>Koppelcode</span><input aria-labelledby={codeLabelId} aria-describedby={`${codeLabelId}-hint`} autoFocus autoCapitalize="characters" autoComplete="one-time-code" className="px-code-input" disabled={disabled || submitting} maxLength={7} pattern="[A-Za-z2-9]{3}[ -]?[A-Za-z2-9]{3}" placeholder="Code van je Player" value={code} onChange={event => setCode(event.currentTarget.value.toUpperCase())} /><small id={`${codeLabelId}-hint`}>Je kunt de code ook bij de volgende stap invoeren.</small></label>
      <label className="field"><span>Schermnaam</span><input disabled={disabled || submitting} maxLength={120} minLength={2} required placeholder="Bijvoorbeeld Kantine hoofdbalk" value={name} onChange={event => setName(event.currentTarget.value)} /></label>
      <label className="field"><span>Locatie</span><input disabled={disabled || submitting} maxLength={160} value={location} onChange={event => setLocation(event.currentTarget.value)} /></label>
      <label className="field"><span>Schermgroep</span><select aria-label="Schermgroep" disabled={disabled || submitting} value={group} onChange={event => setGroup(event.currentTarget.value)}><option value="">Geen groep</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="field"><span>Oriëntatie</span><select aria-label="Oriëntatie" disabled={disabled || submitting} value={orientation} onChange={event => setOrientation(event.currentTarget.value === "portrait" ? "portrait" : "landscape")}><option value="landscape">Liggend (16:9)</option><option value="portrait">Staand (9:16)</option></select></label>
      <label className="field"><span>Eerste playlist</span><select aria-label="Eerste playlist" disabled={disabled || submitting} value={releaseId} onChange={event => setReleaseId(event.currentTarget.value)}><option value="">Later kiezen</option>{releases.map(release => <option key={release.id} value={release.id}>{release.playlistName}</option>)}</select></label>
    </div>
    <details className={styles.advanced}><summary>Resolutie en publicatievoorbeeld</summary><div className={styles.grid} data-screen-setup-grid><label className="field"><span>Breedte</span><input disabled={disabled || submitting} min={320} max={7680} type="number" required value={width} onChange={event => setWidth(Number(event.currentTarget.value))} /></label><label className="field"><span>Hoogte</span><input disabled={disabled || submitting} min={240} max={4320} type="number" required value={height} onChange={event => setHeight(Number(event.currentTarget.value))} /></label></div><CompositionPreview configuration={{ layout: "full", orientation, mainWidthPercent: 70, bottomHeightPercent: 20 }} content={{ main: selectedRelease ? `playlist:${selectedRelease.playlistId}` : "" }} playlists={[...previews]} /></details>
    <p className={styles.notice}>Eerst worden je schermgegevens opgeslagen. Daarna bevestig je de tijdelijke code om de echte Player veilig te koppelen. Het scherm wordt pas als bereikbaar getoond na echt contact.</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}<div className="row between"><Button disabled={submitting} type="button" variant="secondary" onClick={() => setDetails(false)}>Vorige</Button><div className="row"><Button disabled={submitting} type="button" variant="secondary" onClick={onClose}>Annuleren</Button><Button disabled={disabled || submitting} type="submit">{submitting ? "Scherm opslaan…" : "Scherm opslaan en verder"}<ArrowRight aria-hidden="true" size={16} /></Button></div></div>
  </form>;
}
