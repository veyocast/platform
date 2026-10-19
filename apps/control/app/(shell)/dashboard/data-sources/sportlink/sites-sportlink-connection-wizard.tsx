"use client";
import { useRef, useState, useTransition } from "react";
import { ArrowRight, Check, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@veyocast/ui";
import { saveSitesSportlinkConnection, validateSitesSportlinkConnection } from "./sites-sportlink-connection-actions";
import { boundedSourceCommand, sourceCommandError } from "./sites-source-command-state";
import styles from "../../studio/sportlink/new/sites-source-wizard.module.css";
import { useSourceDialogCommandLock } from "../../sources/sync-source-dialogs";

type Initial = { id: string; clubName: string; revision: number; teamCodes: string[]; birthdaysEnabled: boolean };
type Validation = Extract<Awaited<ReturnType<typeof validateSitesSportlinkConnection>>, { ok: true }>;
export function SitesSportlinkConnectionWizard({ initial, canManage, birthdaysAvailable, inline = false }: { initial: Initial | null; canManage: boolean; birthdaysAvailable: boolean; inline?: boolean }) {
  const [open, setOpen] = useState(false); const [step, setStep] = useState(0); const [club, setClub] = useState(initial?.clubName ?? ""); const [clientId, setClientId] = useState("");
  const [selected, setSelected] = useState(initial?.teamCodes ?? []); const [birthdays, setBirthdays] = useState(initial?.birthdaysEnabled ?? false); const [validation, setValidation] = useState<Validation | null>(null); const [query, setQuery] = useState("");
  const [error, setError] = useState(""); const [saved, setSaved] = useState(false); const [key, setKey] = useState(""); const [attempted, setAttempted] = useState(false); const [pending, startTransition] = useTransition();
  const originalCommand = useRef<Parameters<typeof saveSitesSportlinkConnection>[0] | null>(null);
  useSourceDialogCommandLock(inline && (pending || attempted) && !saved);
  function begin() { originalCommand.current = null; setOpen(true); setStep(0); setError(""); setSaved(false); setAttempted(false); setKey(crypto.randomUUID()); setValidation(null); setClientId(""); }
  function next() { if (step === 0) { if (!key) setKey(crypto.randomUUID()); startTransition(async () => { try { const result = await boundedSourceCommand(validateSitesSportlinkConnection({ clubName: club, clientId })); if (!result.ok) { setError(sourceCommandError(result.code)); return; } setValidation(result); setSelected(current => current.filter(code => result.teams.some(team => team.code === code))); setError(""); setStep(1); } catch { setError(sourceCommandError("SOURCE_PROVIDER_UNAVAILABLE")); } }); } else { setError(""); setStep(2); } }
  function save() {
    const wasReplaying = attempted || originalCommand.current !== null;
    let command = originalCommand.current;
    if (!command) {
      if (!validation) return;
      const commandKey = key || crypto.randomUUID();
      if (!key) setKey(commandKey);
      command = { connectionId: initial?.id ?? null, expectedRevision: initial?.revision ?? 0, validationId: validation.validationId, teamCodes: [...selected], birthdaysEnabled: birthdays, idempotencyKey: commandKey };
      originalCommand.current = command;
    }
    const request = command;
    setAttempted(true);
    startTransition(async () => {
      try {
        const result = await boundedSourceCommand(saveSitesSportlinkConnection(request));
        if (!result.ok) {
          setError(sourceCommandError(wasReplaying ? "SOURCE_SAVE_UNCONFIRMED" : result.code));
          if (!wasReplaying && result.code !== "SOURCE_SAVE_UNCONFIRMED") { originalCommand.current = null; setAttempted(false); setKey(crypto.randomUUID()); }
          return;
        }
        originalCommand.current = null; setSaved(true); setClientId(""); setError("");
      } catch { setError(sourceCommandError("SOURCE_SAVE_UNCONFIRMED")); }
    });
  }
  const locked = pending || attempted; const teams = validation?.teams ?? [];
  const content = <><DialogBody><div className={styles.setup}><div className={styles.progress} aria-label="Stappen Sportlink-koppeling">{["Vereniging", "Teams", "Controleren"].map((label, index) => <span key={label} data-active={step === index} data-done={index < step}>{index < step ? <Check size={15} /> : index + 1}<b>{label}</b></span>)}</div>
    {step === 0 && <><div className={styles.info}><ShieldCheck size={20} /><p>De server controleert Sportlink. Je Client ID wordt versleuteld opgeslagen; alleen de laatste vier tekens worden getoond.</p></div><label className="demo-field"><span>Naam vereniging</span><input value={club} maxLength={200} disabled={locked} onChange={event => { setClub(event.target.value); setValidation(null); }} /></label><label className="demo-field"><span>Sportlink Client ID</span><input type="password" autoComplete="off" value={clientId} maxLength={512} disabled={locked} onChange={event => { setClientId(event.target.value); setValidation(null); }} /></label></>}
    {step === 1 && <><h3>Welke teams wil je gebruiken?</h3><div className={styles.teamPicker}><div className={styles.teamSearch}><Search size={16} /><input aria-label="Teams zoeken" placeholder="Zoek een team…" value={query} onChange={event => setQuery(event.target.value)} /></div><div className={styles.sectionHeading}><small>{selected.length} teams geselecteerd</small><button type="button" className={styles.textButton} disabled={locked} onClick={() => setSelected(selected.length === teams.length ? [] : teams.map(team => team.code))}>{selected.length === teams.length ? "Selectie wissen" : "Alle teams"}</button></div><div className={styles.teamList}>{teams.filter(team => team.name.toLocaleLowerCase("nl").includes(query.toLocaleLowerCase("nl"))).map(team => <label className={styles.team} key={team.code} data-selected={selected.includes(team.code)}><input type="checkbox" disabled={locked} checked={selected.includes(team.code)} onChange={event => setSelected(event.target.checked ? [...selected, team.code] : selected.filter(code => code !== team.code))} /><span className={styles.teamMonogram}>{team.name.replace(club, "").trim().slice(0, 3)}</span><span><strong>{team.name}</strong><small>Sportlink-teamcode {team.code}</small></span></label>)}</div></div><label className={styles.check}><input type="checkbox" checked={birthdays} disabled={locked || !birthdaysAvailable} onChange={event => setBirthdays(event.target.checked)} /><span><strong>Ook verjaardagen gebruiken</strong><small>{birthdaysAvailable ? "Expliciete opt-in. Overige personenmodules blijven ongewijzigd." : "Deze module is voor je vereniging nog niet geactiveerd."}</small></span></label></>}
    {step === 2 && <><div className={styles.successIcon}><CheckCircle2 size={32} /></div><h3>{saved ? "Koppeling opgeslagen" : "Klaar om je club in beeld te brengen"}</h3><dl className={styles.definition}><div><dt>Vereniging</dt><dd>{validation?.clubName}</dd></div><div><dt>Client ID</dt><dd>•••• {validation?.clientSuffix}</dd></div><div><dt>Geselecteerde teams</dt><dd>{selected.length}</dd></div><div><dt>Verjaardagen</dt><dd>{birthdays ? "Ingeschakeld na opslaan" : "Uitgeschakeld"}</dd></div><div><dt>Bron</dt><dd>{saved ? "Opslag bevestigd; synchronisatie volgt vanuit de database." : "Gecontroleerd door Sportlink; nog niet opgeslagen."}</dd></div></dl>{saved && <p role="status">De bron is veilig opgeslagen. De datasetstatus hieronder toont wanneer de gegevens werkelijk beschikbaar zijn.</p>}</>}
    {error && <p className="notice notice--critical" role="alert">{error}</p>}</div></DialogBody><DialogFooter>{saved ? <Button variant="primary" onClick={() => { setOpen(false); window.location.reload(); }}>Datasetstatus bekijken</Button> : <>{(!inline || step > 0) && <Button variant="secondary" disabled={pending || attempted} onClick={() => step ? setStep(step - 1) : setOpen(false)}>{step ? "Vorige" : "Annuleren"}</Button>}{step < 2 ? <Button variant="primary" disabled={locked || (step === 0 ? !club.trim() || !clientId.trim() : !selected.length)} onClick={next}>{pending ? "Sportlink controleren…" : step === 0 ? "Verbinding controleren" : "Controleren"}<ArrowRight size={15} /></Button> : <Button variant="primary" disabled={pending} onClick={save}>{pending ? "Opslag bevestigen…" : attempted ? "Dezelfde opslag opnieuw proberen" : "Koppeling opslaan"}<Check size={15} /></Button>}</>}</DialogFooter></>;
  if (inline) return <fieldset disabled={!canManage} style={{border:0,padding:0,margin:0,minWidth:0}}>{content}</fieldset>;
  return <><Button variant="primary" disabled={!canManage} onClick={begin}>{initial ? "Koppeling beheren" : "Koppeling instellen"}<ArrowRight size={16} /></Button><Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}><DialogContent><DialogHeader><DialogTitle>Sportlink instellen</DialogTitle><DialogDescription>Verifieer je vereniging, kies echte teams en controleer de koppeling.</DialogDescription></DialogHeader>{content}</DialogContent></Dialog></>;
}
