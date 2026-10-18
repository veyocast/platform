"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, Database, Info, Shield, X } from "lucide-react";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogTitle, StatusPill } from "@veyocast/ui";
import { formatTenantDateTime } from "../../../../lib/tenant-time";
import { sourceSelectionHref, type SourceDetail, type SourceProvider, type SourceSelection } from "./sites-sources-model";
import styles from "./sync-source-dialogs.module.css";

const names: Record<SourceProvider, string> = { sportlink: "Sportlink", twelve: "Twelve", rss: "RSS & nieuws", led: "LED Scores", youtube: "YouTube" };
const tabs = ["Overzicht", "Gegevens", "Instellingen"] as const;
const CommandLock = createContext<(locked: boolean) => void>(() => {});
/** An inline presentation shares its existing controller lock with the host. */
export function useSourceDialogCommandLock(locked: boolean) {
  const setLocked = useContext(CommandLock);
  useEffect(() => { setLocked(locked); return () => setLocked(false); }, [locked, setLocked]);
}
export type SyncSourceDialogsProps = {
  selection: SourceSelection | null; detail: SourceDetail | null; failed?: boolean;
  canManage: boolean; timezoneName: string; canReadProducts: boolean;
  createContent?: ReactNode; dataContent?: ReactNode; settingsContent?: ReactNode; actions?: ReactNode;
};

export function SyncSourceDialogs({ selection, detail, failed = false, canManage, timezoneName, canReadProducts, createContent, dataContent, settingsContent, actions }: SyncSourceDialogsProps) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overzicht");
  const [locked, setLocked] = useState(false);
  if (!selection) return null;
  const creating = selection.mode === "create";
  return <CommandLock.Provider value={setLocked}><Dialog open onOpenChange={open => { if (!open && !locked) router.replace("/dashboard/sources", { scroll: false }); }}>
    <DialogContent showClose={false} className={`${styles.dialog} ${creating ? styles.create : styles.detail}`}>
      <header className={styles.header}><DialogTitle className={styles.title}>{creating ? "Een bron verbinden" : detail?.name ?? "Bron niet beschikbaar"}</DialogTitle><DialogClose disabled={locked} className={`icon-button ${styles.close}`} aria-label="Sluiten"><X size={18} /></DialogClose></header>
      <DialogBody className={styles.body}>
        <DialogDescription className="sr-only">{creating ? "Kies een bronsoort en controleer je eigen gegevens voordat je de koppeling opslaat." : "Opgeslagen brongegevens en bestaande beheeracties voor je huidige vereniging."}</DialogDescription>
        {creating ? <div className={styles.stack}>
          <label className={styles.field}><span>Bronsoort</span><select value={selection.provider} disabled={!canManage || locked} onChange={event => router.replace(sourceSelectionHref({ mode: "create", provider: event.target.value as SourceProvider }), { scroll: false })}>{Object.entries(names).filter(([id]) => id !== "twelve" || canReadProducts).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
          {locked && <p role="status">Wacht op bevestiging van de lopende opdracht. Probeer bij een ontbrekend antwoord dezelfde opslag opnieuw.</p>}
          {!canManage ? <SourceNotice>Je hebt hier leesrechten. Een beheerder kan een nieuwe bron verbinden.</SourceNotice> : failed ? <SourceNotice critical>De brongegevens konden niet veilig worden geladen. Er is niets opgeslagen. Vernieuw de pagina en probeer opnieuw.</SourceNotice> : createContent}
        </div> : !detail ? <SourceNotice critical>Deze bron is niet beschikbaar binnen je huidige vereniging. Er is niets gewijzigd. Sluit het venster en kies een actuele bron.</SourceNotice> : <div className={styles.stack}>
          <div className={styles.statusRow}><StatusPill {...detail.health} /><fieldset disabled={locked} className={styles.actions}>{actions}</fieldset></div>
          {failed && <SourceNotice critical>Niet alle brongegevens konden worden gelezen. Je bestaande inhoud blijft behouden. Vernieuw de pagina voordat je verdergaat.</SourceNotice>}
          <div className={styles.tabs} role="tablist" aria-label="Brongegevens">{tabs.map(value => <button type="button" role="tab" id={`source-tab-${value}`} aria-controls={`source-panel-${value}`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} key={value} onClick={() => setTab(value)} onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault(); const index = tabs.indexOf(value), rtl = getComputedStyle(event.currentTarget).direction === "rtl", delta = event.key === "ArrowLeft" ? (rtl ? 1 : -1) : (rtl ? -1 : 1), target = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + delta + tabs.length) % tabs.length;
            setTab(tabs[target]!); (event.currentTarget.parentElement?.children[target] as HTMLButtonElement | undefined)?.focus();
          }}>{value}</button>)}</div>
          {/* Keep controllers mounted: changing a tab must not discard a pending command or its validation proof. */}
          <section role="tabpanel" id="source-panel-Overzicht" aria-labelledby="source-tab-Overzicht" hidden={tab !== "Overzicht"} className={styles.stack}>
            <div className={styles.metrics}><Metric icon={<Clock size={18} />} label="Laatste succes" value={formatTenantDateTime(detail.lastSuccessAt, timezoneName, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} note={detail.lastAttemptAt ? `Laatste poging: ${formatTenantDateTime(detail.lastAttemptAt, timezoneName, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Geen recente poging beschikbaar"} /><Metric icon={<Database size={18} />} label="Gegevens" value={detail.itemCount ?? "Nog onbekend"} note={detail.provider === "led" ? "Geregistreerde events in de laatste 24 uur" : "Opgeslagen bij je vereniging"} /><Metric icon={<Shield size={18} />} label="Publicatie" value="Behouden" note="Bronbeheer maakt geen nieuwe publicatie" /></div>
            <SourceNotice critical={detail.health.tone === "critical"}>{detail.health.tone === "critical" ? detail.issue ?? "De laatste synchronisatie is mislukt. Eerder opgeslagen gegevens blijven bewaard; controleer de broninstellingen en probeer synchroniseren opnieuw." : detail.health.tone === "warning" ? "Deze bron vraagt aandacht. Eerder opgeslagen gegevens blijven bewaard; controleer de beschikbaarheid en instellingen voordat je nieuwe inhoud gebruikt." : "Deze bron is gekoppeld aan de contentbibliotheek. Selecteer in Studio alleen de informatie die je wilt tonen."}</SourceNotice>
          </section>
          <section role="tabpanel" id="source-panel-Gegevens" aria-labelledby="source-tab-Gegevens" hidden={tab !== "Gegevens"} className={styles.stack}>
            {dataContent ?? <div className={styles.list}>{detail.items.length ? detail.items.map(item => <article className={styles.item} key={item.id}><div><h3>{item.title}</h3><p>{item.detail}</p>{item.href && <a href={item.href} target="_blank" rel="noopener noreferrer">Artikel openen</a>}</div></article>) : <p>Er zijn nog geen opgeslagen gegevens beschikbaar voor deze bron.</p>}</div>}
            {detail.truncated && <SourceNotice>Dit is een begrensde selectie van de opgeslagen gegevens. Open het bronbeheer voor de overige details.</SourceNotice>}
          </section>
          <section role="tabpanel" id="source-panel-Instellingen" aria-labelledby="source-tab-Instellingen" hidden={tab !== "Instellingen"} className={styles.stack}>
            <dl className={styles.fields}>{detail.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
            {settingsContent}
          </section>
        </div>}
      </DialogBody>
    </DialogContent>
  </Dialog></CommandLock.Provider>;
}

export function SourceNotice({ children, critical = false }: { children: ReactNode; critical?: boolean }) {
  const Icon = critical ? AlertTriangle : Info;
  return <div className={`${styles.notice} ${critical ? styles.critical : ""}`} role={critical ? "alert" : undefined}><Icon size={18} aria-hidden="true" /><div>{children}</div></div>;
}
function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: ReactNode; note: string }) {
  return <div className={styles.metric}><span className={styles.square}>{icon}</span><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
