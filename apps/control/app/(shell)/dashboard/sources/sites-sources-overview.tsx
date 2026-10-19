"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowUpRight, CheckCircle, Coffee, Play, Plug, Plus, Radio, Rss, Info, ShieldCheck, Trophy } from "lucide-react";
import { StatusPill } from "@veyocast/ui";
import { sourceOverviewHealth, sourceSelectionHref, type SourceOverviewData, type SourceOverviewHealth } from "./sites-sources-model";
import styles from "./sync-source-dialogs.module.css";

const providers = [
  { id: "sportlink", name: "Sportlink", intro: "Alle clubinformatie, op de juiste plek.", color: "#f58b3a", icon: Trophy, href: "/dashboard/sources/sportlink", studio: "/dashboard/studio/new?group=Sport&mode=connected" },
  { id: "twelve", name: "Twelve", intro: "Van productexport naar een actuele menukaart.", color: "#9676ef", icon: Coffee, href: "/dashboard/integrations/twelve-products", studio: "/dashboard/slides/menu-studio/new" },
  { id: "rss", name: "RSS & nieuws", intro: "Het verhaal van je club, automatisch in beeld.", color: "#df8c3b", icon: Rss, href: "/dashboard/sources#rss-source-title", studio: "/dashboard/studio/new?family=rss&mode=connected" },
  { id: "led", name: "LED Scores", intro: "Live scores en momenten die je samen beleeft.", color: "#e86572", icon: Radio, href: "/dashboard/sources/led-scores", studio: "/dashboard/studio/led-scores" },
  { id: "youtube", name: "YouTube", intro: "Video’s en playlists met een veilige fallback.", color: "#ed5d5d", icon: Play, href: "/dashboard/sources/youtube", studio: null }
] as const;
type Provider = (typeof providers)[number];
type Source = { id: string; name: string; provider: Provider; health: SourceOverviewHealth; detail: string; count: number; success: string | null };

export function SourcesOverview({ data, canManage, canDesign, canReadProducts, children }: { data: SourceOverviewData; canManage: boolean; canDesign: boolean; canReadProducts: boolean; children?: ReactNode }) {
  const [filter, setFilter] = useState("Alles");
  const sources: Source[] = [
    ...data.sources.filter(source => ["rss", "manual_products", "twelve_excel"].includes(source.kind)).map(source => ({ id: source.id, name: source.name, provider: providers.find(provider => provider.id === (source.kind === "rss" ? "rss" : "twelve"))!, health: sourceOverviewHealth(source), detail: source.kind === "rss" ? "De laatste geldige nieuwsinhoud blijft bij bronuitval behouden." : "Handmatige catalogus of gecontroleerde CSV/XLSX-import; geen automatische Twelve-API-sync.", count: 1, success: source.last_successful_sync_at })),
    ...data.resources.map(resource => ({ id: resource.id, name: resource.name, provider: providers.find(provider => provider.id === resource.provider)!, health: resource.health, detail: "Opgeslagen brongegevens voor deze vereniging.", count: 1, success: resource.lastSuccessAt }))
  ];
  const visible = sources.filter(source => filter === "Alles" || source.provider.name.includes(filter));
  const count = sources.reduce((sum, source) => sum + source.count, 0);
  const healthy = sources.filter(source => source.health.tone === "success").reduce((sum, source) => sum + source.count, 0);
  const attention = sources.filter(source => ["critical", "warning"].includes(source.health.tone)).reduce((sum, source) => sum + source.count, 0);
  const canOpen = (provider: Provider) => provider.id !== "twelve" || canReadProducts;
  return <div className={`admin-page ${styles.overview}`}>
    <header className="section-header"><div><div className="eyebrow">BEHEER / BRONNEN</div><h1>Alles begint bij goede gegevens.</h1><p>Verbind je club. Zie wat binnenkomt en wat aandacht vraagt.</p></div><div className="header-actions">{canManage && <Link className="btn btn-primary" href={sourceSelectionHref({ mode: "create", provider: "sportlink" })} scroll={false}><Plus size={18} />Bron toevoegen</Link>}</div></header>
    {data.failed ? <p className="notice notice--warning" role="alert">Niet alle bronstatussen konden veilig worden gelezen. Je bestaande inhoud blijft behouden. Vernieuw de pagina of open de betreffende koppeling.</p> : null}
    <div className="grid-3"><Metric icon={<Plug size={18} />} label="Verbonden bronnen" value={data.failed ? "—" : count} note="Alle gegevens op één plek" /><Metric icon={<CheckCircle size={18} />} label="Actueel" value={data.failed ? "—" : healthy} note="Laatste synchronisatie geslaagd" /><Metric icon={<ShieldCheck size={18} />} label="Aandacht nodig" value={data.failed ? "—" : attention} note="Laatste goede gegevens blijven staan" /></div>
    <div className="ad-section-head"><div className="ad-tabs" aria-label="Bronsoort">{["Alles", "Sportlink", "Twelve", "RSS", "LED Scores", "YouTube"].map(name => <button type="button" key={name} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}</button>)}</div><span className="ad-demo-label">Opgeslagen bronstatus</span></div>
    <div className="ad-source-grid">{visible.filter(source => canOpen(source.provider)).map(source => <Link className="card ad-source" key={source.id} href={sourceSelectionHref({ mode: "detail", provider: source.provider.id, id: source.id })} scroll={false}><div className="row between"><span className="ad-provider" style={{ background: `${source.provider.color}16`, color: source.provider.color }}><source.provider.icon size={18} /></span><StatusPill {...source.health} /></div><div><span className="ad-overline">{source.provider.name}</span><h2 className="sync-source-name">{source.name}</h2><p>{source.provider.intro}</p></div><div className="ad-source-footer"><span><i className={`ad-dot ${source.health.tone === "critical" ? "error" : ""}`} />{source.success && Number.isFinite(Date.parse(source.success)) ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(source.success)) : `${source.count} opgeslagen koppeling${source.count === 1 ? "" : "en"}`}</span><ArrowUpRight size={18} /></div></Link>)}</div>
    {!visible.length ? <div className="empty"><Plug size={36} strokeWidth={1.7} aria-hidden="true" /><h2 className="sync-empty-title">{data.failed ? "Bronnen tijdelijk niet beschikbaar" : filter === "Alles" ? "Nog geen bronnen verbonden" : "Geen bronnen van deze soort"}</h2><p>{data.failed ? "Vernieuw de pagina om de opgeslagen bronnen opnieuw te lezen." : canManage ? "Kies Bron toevoegen om je eerste bron te verbinden." : "Je kunt gekoppelde bronnen bekijken. Een beheerder kan een nieuwe bron verbinden."}</p></div> : null}
    <div className="ad-notice ad-notice-blue"><Info size={18} /><div>Gegevens verversen binnen je gepubliceerde selectie. Een synchronisatie verandert de opmaak, volgorde en afspeeltimer van je playlist niet.</div></div>

    {canDesign && <div className="row">{providers.filter(provider => provider.studio && sources.some(source => source.provider.id === provider.id) && canOpen(provider)).map(provider => <Link className="btn btn-secondary" key={provider.id} href={provider.studio!}>Open {provider.name} Studio</Link>)}</div>}
    {children}
  </div>;
}
function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: ReactNode; note: string }) { return <div className="card ad-metric"><span className="ad-square">{icon}</span><span className="muted">{label}</span><strong>{value}</strong><small>{note}</small></div>; }
