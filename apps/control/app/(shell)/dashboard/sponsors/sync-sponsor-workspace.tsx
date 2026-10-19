"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { BarChart3, Handshake, Plus, Radio, Settings, X } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogTitle, StatusPill } from "@veyocast/ui";
import { SitesSponsorsPrimary, sponsorCampaignLabels, type SitesSponsorCampaign } from "./sites-sponsors-primary";
import styles from "./sync-sponsor-workspace.module.css";

const tabs = ["Campagnes", "Partners", "Pipeline & taken", "Afspeelregistratie"] as const;
type Tab = typeof tabs[number];
type Operation = "create" | "partner" | "manage" | "material" | "placement" | "settings";
type Partner = { id: string; name: string; website_url: string | null; status: string };

export type SyncSponsorWorkspaceProps = {
  campaigns: SitesSponsorCampaign[];
  partners: Partner[];
  canWrite: boolean;
  unavailable: boolean;
  playCount: number;
  initialCrm: boolean;
  creationForm: ReactNode;
  sponsorForm: ReactNode;
  materialForms: ReactNode;
  placementForm: ReactNode;
  settings: ReactNode;
  reports: ReactNode;
  crm: ReactNode;
  actionsByCampaign: Record<string, ReactNode>;
};

/** One Source workspace; all guarded server forms remain their real actions. */
export function SyncSponsorWorkspace(props: SyncSponsorWorkspaceProps) {
  const [tab, setTab] = useState<Tab>(props.initialCrm ? "Pipeline & taken" : "Campagnes");
  const [operation, setOperation] = useState<Operation | null>(null);
  const [campaign, setCampaign] = useState<SitesSponsorCampaign | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  const currentCampaign = campaign ? props.campaigns.find(value => value.id === campaign.id) ?? null : null;
  const returnFocus = useRef<HTMLElement | null>(null);
  const handledHash = useRef<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]), id = useId();
  const now = Date.now();
  const active = props.campaigns.filter(value => value.status === "published" && (!value.startsAt || Date.parse(value.startsAt) <= now) && Date.parse(value.endsAt) >= now).length;

  function show(value: Operation, trigger?: HTMLElement, selected?: SitesSponsorCampaign, selectedSponsor?: string) {
    if (trigger) returnFocus.current = trigger;
    setCampaign(selected ?? null); setSponsorId(selectedSponsor ?? null);
    setPartner(null); setOperation(value);
  }
  useEffect(() => {
    function selectHash() {
      const hash = window.location.hash.slice(1);
      if (hash === handledHash.current) return;
      if (hash.startsWith("sponsor-campaign-") && !props.campaigns.some(value => `sponsor-campaign-${value.id}` === hash)) return;
      handledHash.current = hash;
      if (hash.startsWith("sponsor-campaign-")) {
        const selected = props.campaigns.find(value => `sponsor-campaign-${value.id}` === hash);
        if (selected) { setTab("Campagnes"); setCampaign(selected); setOperation("manage"); }
      } else if (["kansen"].includes(hash)) setTab("Pipeline & taken");
      else if (hash === "sponsors") setTab("Partners");
      else if (["rapporten", "activiteit"].includes(hash)) setTab("Afspeelregistratie");
      else if (["actie", "sponsor-advanced", "schermen"].includes(hash)) setOperation("settings");
      else if (hash === "media") setOperation("material");
      else if (["campagnes", "sync-sponsor-campaigns"].includes(hash)) setTab("Campagnes");
    }
    selectHash(); window.addEventListener("hashchange", selectHash);
    return () => window.removeEventListener("hashchange", selectHash);
  }, [props.campaigns]);

  // Seed only after the actual portal fields mount. Stable resource-ID deps
  // preserve uncontrolled user input across unrelated server refreshes.
  const seedCampaignId = currentCampaign?.status === "draft" ? currentCampaign.id : null;
  const seedSponsorId = operation === "create" ? sponsorId : operation === "material" && seedCampaignId ? currentCampaign?.sponsorId ?? null : null;
  const mountForm = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    if (seedCampaignId && ["material", "placement"].includes(operation ?? "")) {
      node.querySelectorAll<HTMLSelectElement>('select[name="campaignId"]').forEach(select => {
        if ([...select.options].some(option => option.value === seedCampaignId)) select.value = seedCampaignId;
      });
    }
    if (seedSponsorId) {
      const select = node.querySelector<HTMLSelectElement>('select[name="sponsorId"]');
      if (select && [...select.options].some(option => option.value === seedSponsorId)) select.value = seedSponsorId;
    }
  }, [seedCampaignId, seedSponsorId, operation]);

  const title = partner ? "Clubpartner" : operation === "create" ? "Nieuwe sponsorcampagne" : operation === "partner" ? "Nieuwe clubpartner"
    : operation === "manage" ? currentCampaign?.name ?? "Campagne niet beschikbaar" : operation === "material" ? "Campagnemateriaal"
    : operation === "placement" ? "Campagne plaatsen" : "Publicatie en posities";
  return <div className={`admin-page ${styles.workspace}`}>
    <header className="section-header"><div><div className="eyebrow">BEHEER / PARTNERS</div><h1>Geef je partners een podium.</h1><p>Van campagne tot afspeelregistratie. Altijd herkenbaar in jouw clubstijl.</p></div><div className="header-actions">
      <button className="btn btn-secondary" type="button" disabled={!props.canWrite} onClick={event => show("partner", event.currentTarget)}>Sponsor toevoegen</button>
      <button className="btn btn-primary" type="button" disabled={!props.canWrite} onClick={event => show("create", event.currentTarget)}><Plus size={18} />Nieuwe campagne</button>
      <button className="icon-button" type="button" aria-label="Publicatie en posities" onClick={event => show("settings", event.currentTarget)}><Settings size={18} /></button>
    </div></header>
    {props.unavailable ? <p className="notice notice--critical" role="alert">Sponsorbeheer kon niet volledig worden geladen. Bestaande campagnes blijven behouden. Vernieuw de pagina voordat je wijzigingen maakt.</p> : null}
    <div className="grid-3">{[{ label: "Clubpartners", value: props.partners.length, Icon: Handshake }, { label: "Actieve campagnes", value: active, Icon: Radio }, { label: "Gemelde afspeelbeurten", value: props.playCount, Icon: BarChart3 }].map(({ label, value, Icon }) => <div className="card ad-metric" key={label}><span className="ad-square"><Icon size={18} /></span><span className="muted">{label}</span><strong>{props.unavailable ? "—" : value}</strong>{label === "Gemelde afspeelbeurten" ? <small>Technische registratie, geen publieksbereik · laatste 30 dagen</small> : null}</div>)}</div>
    <div className={`ad-tabs ${styles.tabs}`} role="tablist" aria-label="Sponsoronderdelen">{tabs.map((value, index) => <button type="button" role="tab" key={value} id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} ref={node => { tabRefs.current[index] = node; }} onClick={() => setTab(value)} onKeyDown={event => {
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : null;
      if (next !== null) { event.preventDefault(); setTab(tabs[next]!); tabRefs.current[next]?.focus(); }
    }}>{value}</button>)}</div>
    {tabs.map((value, index) => <section className={styles.panel} hidden={tab !== value} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} key={value}>
      {value === "Campagnes" ? <SitesSponsorsPrimary embedded campaigns={props.campaigns} canWrite={props.canWrite} unavailable={props.unavailable} creationForm={null} actionsByCampaign={props.actionsByCampaign} onManageCampaign={(value, trigger) => show("manage", trigger, value)} onViewDelivery={trigger => show("settings", trigger)} />
        : value === "Partners" ? <div className={`ad-source-grid ${styles.partners}`}>{props.partners.map(value => <article className="card ad-padding stack" key={value.id}><span className="ad-sponsor-initials" aria-hidden="true">{value.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</span><h2>{value.name}</h2><p>{value.website_url ?? "Geen website vastgelegd"}</p><span className="badge badge-neutral">{value.status === "active" ? "Actief" : "Niet actief"}</span><button className="btn btn-ghost" type="button" onClick={event => { returnFocus.current = event.currentTarget; setPartner(value); setOperation(null); }}>Partner bekijken</button><button className="btn btn-secondary" type="button" disabled={!props.canWrite} onClick={event => show("create", event.currentTarget, undefined, value.id)}>Campagne maken</button></article>)}{!props.partners.length ? <div className="empty"><Handshake size={36} /><h2>{props.unavailable ? "Clubpartners niet beschikbaar" : "Nog geen clubpartners"}</h2><p>{props.unavailable ? "Vernieuw de pagina zodra je verbinding terug is." : "Voeg de eerste sponsor toe om een campagne te maken."}</p></div> : null}</div>
        : value === "Pipeline & taken" ? props.crm : props.reports}
    </section>)}
    <Dialog open={operation !== null || partner !== null} onOpenChange={open => { if (!open) { setOperation(null); setPartner(null); } }}>
      <DialogContent className={styles.dialog} size={operation === "material" || operation === "settings" ? "wide" : "standard"} showClose={false} onCloseAutoFocus={event => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); } }}>
        <header className={styles.modalHeader}><DialogTitle className={styles.title}>{title}</DialogTitle><button type="button" className={`icon-button ${styles.close}`} aria-label="Sluiten" onClick={() => { setOperation(null); setPartner(null); }}><X size={18} /></button></header>
        <DialogBody className={styles.body}><DialogDescription className={styles.description}>{partner ? "De vastgelegde gegevens van je clubpartner." : "Wijzigingen verschijnen pas op schermen na de vereiste goedkeuring en publicatie."}</DialogDescription><div ref={mountForm}>
          {partner ? <dl className={styles.details}><dt>Naam</dt><dd>{partner.name}</dd><dt>Website</dt><dd>{partner.website_url ?? "Niet vastgelegd"}</dd><dt>Status</dt><dd>{partner.status === "active" ? "Actief" : "Niet actief"}</dd></dl>
            : operation === "create" ? props.creationForm : operation === "partner" ? props.sponsorForm : operation === "material" || operation === "placement" ? campaign && currentCampaign?.status !== "draft" ? <p>Deze campagne is geen bewerkbaar concept meer. Sluit dit venster en open de actuele campagne. Er is niets verstuurd.</p> : operation === "material" ? props.materialForms : props.placementForm : operation === "settings" ? <div className={styles.stack}>{props.settings}<button type="button" className="btn btn-secondary" onClick={() => { setCampaign(null); setOperation("material"); }}>Materiaal beheren</button><button type="button" className="btn btn-secondary" onClick={() => { setCampaign(null); setOperation("placement"); }}>Plaatsingen bekijken</button></div>
            : <div className={styles.stack}><p>{currentCampaign?.partner} · {currentCampaign?.name}</p>{currentCampaign ? <><StatusPill label={sponsorCampaignLabels[currentCampaign.status] ?? "Status onbekend"} tone={currentCampaign.status === "published" || currentCampaign.status === "approved" ? "success" : currentCampaign.status === "rejected" ? "critical" : "neutral"} />{props.actionsByCampaign[currentCampaign.id]}</> : null}<p>Voeg materiaal en een plaatsing toe voordat je de campagne ter goedkeuring indient. Een andere bevoegde beheerder controleert de campagne.</p><button type="button" className="btn btn-secondary" disabled={!props.canWrite || currentCampaign?.status !== "draft"} onClick={() => setOperation("material")}>Materiaal koppelen</button><button type="button" className="btn btn-secondary" disabled={!props.canWrite || currentCampaign?.status !== "draft"} onClick={() => setOperation("placement")}>Plaatsing instellen</button><button type="button" className="btn btn-secondary" onClick={() => setOperation("settings")}>Publicatie en posities bekijken</button></div>}
        </div></DialogBody>
      </DialogContent>
    </Dialog>
  </div>;
}
