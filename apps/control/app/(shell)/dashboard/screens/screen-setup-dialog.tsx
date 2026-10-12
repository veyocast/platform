"use client";

import { CheckCircle2, ChevronRight, Plus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button, Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@veyocast/ui";
import { createScreenOnboarding } from "./actions";
import { CompositionPreview } from "./screen-composition-editor";
import type { CompositionPlaylistOption } from "./screen-composition-data";
import styles from "./screens-overview.module.css";

export function ScreenSetupDialog({ disabled, defaultOpen = false, groups, releases, previews, settings, pairingCode = "" }: {
  disabled: boolean; defaultOpen?: boolean;
  groups: readonly { id: string; name: string }[];
  releases: readonly { id: string; playlistId: string; playlistName: string }[];
  previews: readonly CompositionPlaylistOption[];
  settings: { width: number; height: number; orientation: string };
  pairingCode?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={disabled}><Plus aria-hidden="true" size={16} />Nieuw scherm</Button></DialogTrigger>
    <DialogContent className={styles.sourceDialog} closeLabel="Scherm instellen sluiten" size="wide"><DialogHeader><DialogTitle>Nieuw scherm instellen</DialogTitle></DialogHeader><DialogBody data-screen-setup-surface>
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
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [group, setGroup] = useState(groups[0]?.id ?? "");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(settings.orientation === "portrait" ? "portrait" : "landscape");
  const [releaseId, setReleaseId] = useState("");
  const [location, setLocation] = useState("");
  const [width, setWidth] = useState(settings.width);
  const [height, setHeight] = useState(settings.height);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const key = useRef<string | null>(null);
  const selectedRelease = releases.find(release => release.id === releaseId);
  const orientationLabel = orientation === "portrait" ? "Staand (9:16)" : "Liggend (16:9)";
  function advance(event: FormEvent<HTMLFormElement>) {
    if (disabled || submitting) { event.preventDefault(); return; }
    if (name.trim().length < 2) { event.preventDefault(); setError("Geef het scherm een herkenbare naam van minimaal twee tekens."); return; }
    setError("");
    if (step < 2) { event.preventDefault(); setStep(step + 1); return; }
    key.current ??= crypto.randomUUID();
    const input = event.currentTarget.elements.namedItem("idempotencyKey");
    if (input instanceof HTMLInputElement) input.value = key.current;
    setSubmitting(true);
  }
  return <form action={createScreenOnboarding} aria-busy={submitting} className={styles.editorForm} onSubmit={advance}>
    <input name="name" type="hidden" value={name.trim()} /><input name="groupId" type="hidden" value={group} /><input name="orientation" type="hidden" value={orientation} /><input name="initialReleaseId" type="hidden" value={releaseId} /><input name="location" type="hidden" value={location} /><input name="resolutionWidth" type="hidden" value={width} /><input name="resolutionHeight" type="hidden" value={height} /><input name="pairingCode" type="hidden" value={pairingCode} /><input name="idempotencyKey" type="hidden" />
    <ol className={styles.wizardSteps} aria-label="Scherminstelstappen">{["Scherm", "Content", "Controleren"].map((label, index) => <li aria-current={step === index ? "step" : undefined} data-done={index < step} key={label}><span>{index < step ? <CheckCircle2 aria-hidden="true" size={15} /> : index + 1}</span>{label}</li>)}</ol>
    {step === 0 ? <><p>Begin bij de plek waar je bezoekers dit scherm zien.</p><label className="field"><span>Schermnaam</span><input autoFocus disabled={disabled || submitting} maxLength={80} minLength={2} required placeholder="Bijvoorbeeld Kantine TV 3" value={name} onChange={event => setName(event.currentTarget.value)} /></label><div className={styles.twoFields} data-screen-setup-grid><label className="field"><span>Schermgroep</span><select aria-label="Schermgroep" disabled={disabled || submitting} value={group} onChange={event => setGroup(event.currentTarget.value)}><option value="">Geen groep</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Oriëntatie</span><select aria-label="Oriëntatie" disabled={disabled || submitting} value={orientation} onChange={event => setOrientation(event.currentTarget.value === "portrait" ? "portrait" : "landscape")}><option value="landscape">Liggend (16:9)</option><option value="portrait">Staand (9:16)</option></select></label></div><details><summary>Locatie en resolutie</summary><div className={styles.editorForm}><label className="field"><span>Locatie</span><input disabled={disabled || submitting} maxLength={160} value={location} onChange={event => setLocation(event.currentTarget.value)} /></label><div className={styles.twoFields} data-screen-setup-grid><label className="field"><span>Breedte</span><input disabled={disabled || submitting} min={320} max={7680} type="number" required value={width} onChange={event => setWidth(Number(event.currentTarget.value))} /></label><label className="field"><span>Hoogte</span><input disabled={disabled || submitting} min={240} max={4320} type="number" required value={height} onChange={event => setHeight(Number(event.currentTarget.value))} /></label></div></div></details></> : null}
    {step === 1 ? <><p>Kies wat het scherm standaard laat zien. Je kunt de indeling hierna verder aanpassen met meerdere zones.</p><label className="field"><span>Standaard afspeellijst</span><select aria-label="Standaard afspeellijst" disabled={disabled || submitting} value={releaseId} onChange={event => setReleaseId(event.currentTarget.value)}><option value="">Later kiezen</option>{releases.map(release => <option key={release.id} value={release.id}>{release.playlistName}</option>)}</select></label><CompositionPreview configuration={{ layout: "full", orientation, mainWidthPercent: 70, bottomHeightPercent: 20 }} content={{ main: selectedRelease ? `playlist:${selectedRelease.playlistId}` : "" }} playlists={[...previews]} /></> : null}
    {step === 2 ? <><div className={styles.contentNote}><CheckCircle2 aria-hidden="true" size={24} /><div><strong>{name}</strong><p>{groups.find(item => item.id === group)?.name ?? "Geen groep"} · {orientationLabel}</p></div></div><dl className={styles.healthFacts}><dt>Standaard content</dt><dd>{selectedRelease?.playlistName ?? "Later kiezen"}</dd><dt>Indeling</dt><dd>Volledig scherm</dd></dl><p className={styles.demoNote}>Het scherm wordt veilig opgeslagen. Daarna koppel je de fysieke Player met een tijdelijke code; de status wordt pas actief na de echte Player-bevestiging.</p></> : null}
    {disabled ? <p className={styles.demoNote} role="status">Schermbeheer is niet beschikbaar voor deze sessie of de schermlimiet is bereikt. Er wordt niets aangemaakt; log in met beheerrechten of controleer de schermlimiet.</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}<div className={styles.formActions}><Button disabled={submitting} type="button" variant="secondary" onClick={() => step ? setStep(step - 1) : onClose()}>{step ? "Vorige" : "Annuleren"}</Button><Button disabled={disabled || submitting} type="submit">{submitting ? "Scherm opslaan…" : step === 2 ? "Scherm toevoegen" : "Volgende"}<ChevronRight aria-hidden="true" size={16} /></Button></div>
  </form>;
}
