"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CakeSlice, FileSpreadsheet, RefreshCw, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@veyocast/ui";

import {
  applyBirthdayImport,
  previewBirthdayImport,
  remapBirthdayImport
} from "./actions";
import styles from "./birthdays.module.css";

type Preview = Exclude<Awaited<ReturnType<typeof previewBirthdayImport>>, { error: string }>;
type Normalized = Preview["normalized"];

const fields = [
  ["", "Niet importeren"], ["full_name", "Volledige naam"], ["first_name", "Voornaam"],
  ["middle_name", "Tussenvoegsel"], ["last_name", "Achternaam"], ["member_code", "Relatie-/lidcode"],
  ["birth_date", "Geboortedatum"], ["birth_year", "Geboortejaar"], ["team", "Team"], ["role", "Rol"]
] as const;

export function BirthdayIntegrationPanel({
  activateAction, canManage, conflicts, connection, deleteAction, imports, members,
  rollbackAction, status, syncAction, resolveAction
}: {
  activateAction: (formData: FormData) => Promise<void>; canManage: boolean;
  conflicts: Array<{ display_name: string; id: string; normalized_name: string }>;
  connection: { id: string; privacy_birthdays_enabled: boolean };
  deleteAction: (formData: FormData) => Promise<void>;
  imports: Array<{ conflict_count: number; created_at: string; duplicate_count: number; id: string; invalid_count: number; source_file_name: string; status: string; valid_count: number }>;
  members: Array<{ display_name: string; id: string; normalized_name: string; role: string | null; team_assignments: unknown }>;
  resolveAction: (formData: FormData) => Promise<void>; rollbackAction: (formData: FormData) => Promise<void>;
  status: { active: boolean; counts: { ambiguous: number; birthdays: number; knownAge: number; matched: number; withPhoto: number }; featureEnabled: boolean; freshness: string; lastErrorCode: string | null; lastSuccessAt: string | null; nextSyncAt: string | null };
  syncAction: (formData: FormData) => Promise<void>;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [normalized, setNormalized] = useState<Normalized>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const counts = normalized.reduce((result, row) => ({ ...result, [row.status]: result[row.status] + 1 }), { conflict: 0, duplicate: 0, invalid: 0, valid: 0 });

  const previewAction = (formData: FormData) => startTransition(async () => {
    setMessage("");
    const result = await previewBirthdayImport(formData);
    if ("error" in result) { setPreview(null); setNormalized([]); setMessage(result.error ?? "De importpreview kon niet worden gemaakt."); return; }
    setPreview(result); setNormalized(result.normalized);
  });
  const changeMapping = (header: string, value: string) => {
    if (!preview) return;
    const next: Preview = { ...preview, mapping: { ...preview.mapping, [header]: (value || null) as Preview["mapping"][string] } };
    setPreview(next);
    startTransition(async () => setNormalized(await remapBirthdayImport({ mapping: next.mapping, rows: next.rows })));
  };
  const apply = () => {
    if (!preview) return;
    startTransition(async () => {
      const result = await applyBirthdayImport({
        checksum: preview.checksum, connectionId: connection.id, fileName: preview.fileName,
        idempotencyKey: crypto.randomUUID(), mapping: preview.mapping, rows: preview.rows
      });
      if ("error" in result) setMessage(result.error ?? "De import kon niet worden toegepast.");
      else { setMessage(`Import verwerkt: ${counts.valid} geldig, ${counts.invalid} ongeldig, ${counts.duplicate} dubbel, ${counts.conflict} conflict.`); setPreview(null); }
    });
  };

  return <section className={styles.section} id="verjaardagen">
    <header className={styles.header}><div><span><CakeSlice aria-hidden="true" /> Sportlink-module</span><h2>Verjaardagen</h2><p>Dagelijkse, geminimaliseerde synchronisatie via alleen de versleutelde Client ID. Een Token Club.Data blokkeert deze module niet.</p></div><strong data-active={status.active || undefined}>{status.active ? "Actief" : "Inactief"}</strong></header>
    <div className={styles.metrics}><Metric label="Binnen 21 dagen" value={status.counts.birthdays} /><Metric label="Bekende leeftijd" value={status.counts.knownAge} /><Metric label="Team of rol" value={status.counts.matched} /><Metric label="Toegestane foto" value={status.counts.withPhoto} /><Metric label="Dubbelzinnig" value={status.counts.ambiguous} /><Metric label="Freshness" value={freshness(status.freshness)} /></div>
    <dl className={styles.times}><div><dt>Laatste succesvolle sync</dt><dd>{date(status.lastSuccessAt)}</dd></div><div><dt>Volgende geplande sync</dt><dd>{date(status.nextSyncAt)}</dd></div></dl>
    {status.lastErrorCode ? <p className="notice notice--warning"><strong>De laatste poging mislukte.</strong> De Last Known Good blijft actief. Controleer de Client ID en probeer daarna opnieuw. Technische code: <code>{status.lastErrorCode}</code></p> : null}
    <div className={styles.commands}>{canManage ? <><form action={activateAction}><input name="connectionId" type="hidden" value={connection.id} /><input name="enabled" type="hidden" value={connection.privacy_birthdays_enabled ? "" : "on"} /><Button type="submit" variant={connection.privacy_birthdays_enabled ? "secondary" : "primary"}><ShieldCheck aria-hidden="true" />{connection.privacy_birthdays_enabled ? "Module pauzeren" : "Module activeren"}</Button></form>{status.active ? <form action={syncAction}><input name="connectionId" type="hidden" value={connection.id} /><Button type="submit" variant="secondary"><RefreshCw aria-hidden="true" />Nu synchroniseren</Button></form> : null}</> : null}<Button asChild variant="secondary"><Link href="/dashboard/studio/sportlink/birthdays/new">Preview en slide openen</Link></Button></div>
    {canManage && status.active ? <details className={styles.details}><summary><FileSpreadsheet aria-hidden="true" />Geboortejaren verrijken</summary><p>Importeer uitsluitend gegevens voor betrouwbare leeftijdsberekening. Het ruwe bestand wordt in het geheugen verwerkt en niet opgeslagen.</p><form action={previewAction} className={styles.upload}><input accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" name="file" required type="file" /><Button disabled={pending} type="submit" variant="secondary">Importpreview maken</Button></form>{message ? <p className="notice" role="status">{message}</p> : null}{preview ? <div className={styles.importPreview}><h3>Kolommen koppelen</h3><div className={styles.mapping}>{preview.headers.map((header) => <label key={header}><span>{header}</span><select onChange={(event) => changeMapping(header, event.target.value)} value={preview.mapping[header] ?? ""}>{fields.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}</div><div className={styles.importCounts}><Metric label="Geldig" value={counts.valid} /><Metric label="Ongeldig" value={counts.invalid} /><Metric label="Dubbel" value={counts.duplicate} /><Metric label="Conflict" value={counts.conflict} /></div><table><thead><tr><th>Regel</th><th>Naam</th><th>Jaar</th><th>Status</th></tr></thead><tbody>{normalized.slice(0, 10).map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.normalized.displayName || "—"}</td><td>{row.normalized.birthYear ?? "—"}</td><td>{row.status}</td></tr>)}</tbody></table><Button disabled={pending || counts.valid === 0} onClick={apply} type="button">Geldige regels samenvoegen</Button></div> : null}</details> : null}
    {conflicts.length ? <details className={styles.details}><summary>Conflicten oplossen · {conflicts.length}</summary><p>Kies alleen wanneer je de identiteit zeker weet. Automatische fuzzy matching wordt nooit gebruikt.</p>{conflicts.map((birthday) => { const candidates = members.filter((member) => member.normalized_name === birthday.normalized_name); return <form action={resolveAction} className={styles.conflict} key={birthday.id}><input name="birthdayId" type="hidden" value={birthday.id} /><strong>{birthday.display_name}</strong><select name="memberId" required><option value="">Kies exacte Sportlink-identiteit</option>{candidates.map((member) => <option key={member.id} value={member.id}>{member.display_name}{member.role ? ` · ${member.role}` : ""}</option>)}</select><Button disabled={!canManage || !candidates.length} size="sm" type="submit" variant="secondary">Koppelen</Button></form>; })}</details> : null}
    {imports.length ? <details className={styles.details}><summary>Importgeschiedenis</summary>{imports.map((item, index) => <div className={styles.importRow} key={item.id}><div><strong>{item.source_file_name}</strong><small>{date(item.created_at)} · {item.valid_count} toegepast · {item.invalid_count} ongeldig · {item.conflict_count} conflict</small></div>{canManage && index === 0 && item.status !== "rolled_back" ? <form action={rollbackAction}><input name="importId" type="hidden" value={item.id} /><Button size="sm" type="submit" variant="ghost"><RotateCcw aria-hidden="true" />Laatste import terugdraaien</Button></form> : <span>{item.status}</span>}</div>)}</details> : null}
    {canManage && (status.counts.knownAge > 0 || imports.length > 0) ? <details className={styles.details}><summary><Trash2 aria-hidden="true" />Privacy en verwijderen</summary><p>Verwijder alle geïmporteerde geboortejaren en handmatige koppelingen. Sportlink-verjaardagen blijven bestaan; leeftijden verdwijnen uit nieuwe snapshots.</p><form action={deleteAction} className={styles.deleteForm}><input name="connectionId" type="hidden" value={connection.id} /><label><input name="confirm" required type="checkbox" value="VERWIJDEREN" /> Ik begrijp dat alle verjaardagsverrijkingen van deze vereniging worden verwijderd.</label><Button type="submit" variant="secondary"><Trash2 aria-hidden="true" />Alle verrijkingen verwijderen</Button></form></details> : null}
  </section>;
}

function Metric({ label, value }: { label: string; value: number | string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function date(value: string | null) { return value ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Nog niet beschikbaar"; }
function freshness(value: string) { return value === "fresh" ? "Actueel" : value === "stale" ? "Oude cache actief" : value === "expired" ? "Verlopen · skip" : "Eerste sync nodig"; }
