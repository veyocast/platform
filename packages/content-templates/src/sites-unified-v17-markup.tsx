import React, { type CSSProperties, type Ref } from "react";
import { sitesSystemImageChecksums, type SitesAssetReference, type SitesPresentation, type SitesStudioSlide, type SitesTvContent, type SitesUnifiedKind } from "@veyocast/contracts";
import qrcode from "qrcode-generator";
import type { SitesAssetResolver } from "./sites-presentation-model";

type Row = SitesTvContent["rows"][number];
type V17Options = Pick<SitesStudioSlide, "paintTone" | "photoMotion" | "rssLayout" | "menuLayout" | "showPrices" | "showCategories" | "currency" | "extraType" | "arrivalCards" | "arrivalShowLogo" | "arrivalShowKickoff" | "qrUrl" | "body" | "vacancyContact" | "welcomeImage">;

export type SitesUnifiedV17MarkupProps = {
  presentation: SitesPresentation;
  resolveAsset: SitesAssetResolver;
  active?: boolean;
  frameWidth?: number;
  rootRef?: Ref<HTMLDivElement>;
  width?: number;
  children?: React.ReactNode;
  canvasClassName?: string;
  canvasStyle?: CSSProperties;
  backgroundOverride?: { src?: string; fit: "contain" | "cover"; overlay: number };
};

const defaultOptions: V17Options = {
  paintTone: "white", photoMotion: true, rssLayout: "accordion", menuLayout: "columns", showPrices: true, showCategories: true, currency: "EUR", extraType: "periodestand", arrivalCards: 4, arrivalShowLogo: true, arrivalShowKickoff: true, qrUrl: "https://veyocast.nl", body: "", vacancyContact: "", welcomeImage: undefined
};

function resolveReference(asset: SitesAssetReference | undefined, resolveAsset: SitesAssetResolver) { return asset ? resolveAsset(asset) : undefined; }
function resolveSystem(path: keyof typeof sitesSystemImageChecksums, resolveAsset: SitesAssetResolver) { return resolveAsset({ kind: "system", path, checksumSha256: sitesSystemImageChecksums[path] }); }
function initials(value: string) { return value.replace(/^(sv|fc|vv|zvv)\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CL"; }
function ownTeam(row: Row, side: "home" | "away") { return side === "home" ? row.homeOwn === true : row.awayOwn === true; }

function Icon({ name }: { name: "arrow" | "cake" | "calendar" | "coffee" | "pin" | "megaphone" | "users" }) {
  const path = name === "arrow" ? "M7 17 17 7M8 7h9v9" : name === "pin" ? "M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 6Z" : name === "cake" ? "M4 11h16v10H4V11Zm2-4h12v4H6V7Zm3-4v4m6-4v4" : name === "coffee" ? "M4 8h13v8a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm13 2h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2" : name === "users" ? "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87m0-8.26a4 4 0 0 1 0 7.75" : name === "megaphone" ? "m3 11 18-5v12L3 13v-2Zm4 3 2 7h4l-1.5-5.5" : "M4 5h16v16H4V5Zm4-3v6m8-6v6M4 10h16";
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>;
}

function TeamBadge({ name, image, large = false, resolveAsset }: { name: string; image?: SitesAssetReference; large?: boolean; resolveAsset: SitesAssetResolver }) {
  const url = resolveReference(image, resolveAsset);
  if (url) return <img className={`ucs-badge${large ? " ucs-badge-large" : ""}`} src={url} alt=""/>;
  return <span className={`ucs-badge ucs-crest${large ? " ucs-badge-large" : ""}`} data-club={name.charCodeAt(0) % 4} aria-hidden="true"><span>{initials(name)}</span></span>;
}
function Team({ name, image, resolveAsset }: { name: string; image?: SitesAssetReference; resolveAsset: SitesAssetResolver }) { return <span className="ucs-team"><TeamBadge name={name} image={image} resolveAsset={resolveAsset}/><span>{name}</span></span>; }
function PanelMeta({ primary, secondary }: { primary: string; secondary?: string }) { return <div className="ucs-panel-meta"><span>{primary}</span>{secondary && <span>{secondary}</span>}</div>; }
function Empty({ text }: { text: string }) { return <div className="ucc-empty"><Icon name="calendar"/><h3>{text}</h3><p>Er zijn geen items voor deze selectie.</p></div>; }
function Metadata({ label, detail }: { label: string; detail?: string }) { return <div className="ucc-meta"><span>{label}</span>{detail && <span>{detail}</span>}</div>; }

function Standing({ content, resolveAsset }: { content: SitesTvContent; resolveAsset: SitesAssetResolver }) {
  const visible = content.rows;
  const own = visible.find((row) => row.own);
  return <section className="ucs-panel ucs-standing-panel">
    <PanelMeta primary={content.subtitle || content.eyebrow || "Competitie"} secondary={content.footer}/>
    <div className="ucs-standing-summary"><span><i/> {own?.primary || content.clubName || "Eigen team"}</span><span>{own?.rank ? <>{own.rank}e plaats <b>·</b> {own.points ?? own.value ?? "–"} punten</> : `${content.rows.length} teams`}</span></div>
    <div className="ucs-standing-cols" aria-hidden="true"><span>#</span><span>Team</span><span>G</span><span>W</span><span>GL</span><span>V</span><span>P</span><span>DS</span><span>Vorm</span></div>
    <div className="ucs-standing-scroll" role="table" aria-label={content.title}>
      {visible.map((row, index) => <div key={row.id} className={`ucs-standing-row${row.own ? " ucs-own-row" : ""}`} role="row" data-own={row.own || undefined}>
        <span className="ucs-rank" role="cell">{row.rank ?? index + 1}</span><span role="cell"><Team name={row.primary} image={row.image} resolveAsset={resolveAsset}/></span><span role="cell">{row.played ?? "–"}</span><span role="cell">{row.won ?? "–"}</span><span role="cell">{row.drawn ?? "–"}</span><span role="cell">{row.lost ?? "–"}</span><strong role="cell">{row.points ?? row.value ?? "–"}</strong><span role="cell">{row.difference ?? "–"}</span><span className="ucs-form" role="cell" aria-label={(row.form ?? []).join(", ")}>{(row.form ?? []).map((value, formIndex) => <i key={`${row.id}-${formIndex}`} data-result={value}>{value}</i>)}</span>
      </div>)}
    </div><div className="ucs-list-footer"><span>{content.rows.length} teams in de poule</span><span><i className="ucs-motion-dot"/> Rustig doorlopend · eigen team blijft in beeld</span></div>
  </section>;
}

function FixtureList({ content, results, resolveAsset }: { content: SitesTvContent; results: boolean; resolveAsset: SitesAssetResolver }) {
  return <section className="ucs-panel ucs-fixture-panel"><PanelMeta primary={content.clubName || "De hele club"} secondary={content.subtitle}/>
    <div className="ucs-fixture-filters"><span>Veld & zaal</span><span>Uit & thuis</span><span>{content.rows.length} wedstrijden</span></div>
    <div className="ucs-fixture-scroll">{content.rows.length ? content.rows.map((row) => {
      const home = row.home || row.primary; const away = row.away || row.secondary || "Tegenstander";
      const homeImage = row.homeImage ?? (ownTeam(row, "home") ? row.image : undefined); const awayImage = row.awayImage ?? (ownTeam(row, "away") ? row.image : undefined);
      const score = row.homeScore !== undefined || row.awayScore !== undefined ? `${row.homeScore ?? "–"} – ${row.awayScore ?? "–"}` : row.value || "–";
      return <div className="ucs-fixture" key={row.id}><div className="ucs-fixture-when"><strong>{row.time || row.tag || "–"}</strong><span>{row.tag || (results ? "UITSLAG" : "PROGRAMMA")}</span></div><div className="ucs-fixture-match"><Team name={home} image={homeImage} resolveAsset={resolveAsset}/><strong className={results ? "ucs-score" : "ucs-vs"}>{results ? score : "–"}</strong><Team name={away} image={awayImage} resolveAsset={resolveAsset}/>{(row.field || row.secondary) && <div className="ucs-fixture-details">{row.field && <span>{row.field}</span>}{row.secondary && <span>{row.secondary}</span>}</div>}</div><span className={`ucs-venue-tag${row.homeOwn ? " is-home" : ""}`}>{row.homeOwn ? "THUIS" : "UIT"}</span></div>;
    }) : <div className="ucs-empty"><strong>Geen wedstrijden</strong><span>Geen wedstrijden binnen deze selectie.</span></div>}</div>
    <div className="ucs-list-footer"><span>{results ? "Alle uitslagen in één overzicht" : "Actueel programma"}</span><span>Sportlink</span></div>
  </section>;
}

function Matchday({ content, resolveAsset }: { content: SitesTvContent; resolveAsset: SitesAssetResolver }) {
  const row = content.rows[0]; const match = content.match; const home = match?.home || row?.home || content.clubName || "Thuis"; const away = match?.away || row?.away || row?.primary || "Uit";
  const homeImage = match?.homeLogo ?? row?.homeImage; const awayImage = match?.awayLogo ?? row?.awayImage ?? row?.image;
  return <section className="ucs-matchday"><div className="ucs-match-top ucs-card"><span className="ucs-eyebrow">{content.eyebrow || "Volgende wedstrijd"}</span><span className="ucs-match-date">{row?.tag || content.subtitle || "WEDSTRIJDDAG"} <b>·</b> {row?.time || content.time || "–"}</span></div>
    <div className="ucs-match-clubs ucs-card"><div><TeamBadge name={home} image={homeImage} large resolveAsset={resolveAsset}/><strong>{home}</strong><span>THUIS</span></div><span className="ucs-match-vs">VS</span><div><TeamBadge name={away} image={awayImage} large resolveAsset={resolveAsset}/><strong>{away}</strong><span>UIT</span></div></div>
    <div className="ucs-match-info ucs-card"><span><small>LOCATIE</small><strong>{content.location || row?.field || "Sportpark"}</strong></span><span><small>COMPETITIE</small><strong>{row?.secondary || content.subtitle || "Competitie"}</strong></span><span><small>AFTRAP</small><strong>{row?.time || content.time || "–"}</strong></span></div>
  </section>;
}

function Training({ content, resolveAsset }: { content: SitesTvContent; resolveAsset: SitesAssetResolver }) {
  return <section className="ucs-panel"><PanelMeta primary={content.location || "Trainingsschema"} secondary={content.subtitle}/><div className="ucs-training-cols"><span>Tijd</span><span>Team</span><span>Veld</span><span>Kleedkamer</span></div><div className="ucs-training-scroll">{content.rows.length ? content.rows.map((row) => <div className="ucs-training-row" key={row.id}><span><strong>{row.time || row.value || "–"}</strong><small>{row.tag || ""}</small></span><Team name={row.primary} image={row.image} resolveAsset={resolveAsset}/><strong>{row.field || "–"}</strong><span className="ucs-room">{row.secondary || "–"}</span></div>) : <div className="ucs-empty"><strong>Geen trainingen</strong><span>Vandaag staan geen trainingen gepland.</span></div>}</div><div className="ucs-list-footer"><span>{content.rows.length} trainingen</span><span>Sportlink · trainingsschema</span></div></section>;
}

function Visitors({ content, options, resolveAsset }: { content: SitesTvContent; options: V17Options; resolveAsset: SitesAssetResolver }) {
  const rows = content.rows.slice(0, options.arrivalCards);
  const [contextTime, contextLabel] = (content.time || "").split("·").map((value) => value.trim());
  return <section className="ucs-panel ucs-visitors-panel"><div className="ucs-visitors-context"><span><i/> {content.subtitle || "Welkom op ons sportpark"}</span><strong>{contextTime || ""}{contextLabel && <small>{contextLabel}</small>}</strong></div><div className="ucs-visitors-grid">{rows.length ? rows.map((row) => {
    const home = row.home || content.clubName || "Thuisteam"; const away = row.away || row.primary; const opponent = row.homeOwn ? away : home; const own = row.homeOwn ? home : row.awayOwn ? away : content.clubName || home; const image = row.homeOwn ? row.awayImage : row.awayOwn ? row.homeImage : row.image;
    return <article className="ucs-visitor-card" key={row.id}>{options.arrivalShowLogo && <div className="ucs-visitor-watermark" aria-hidden="true"><TeamBadge name={opponent} image={image} resolveAsset={resolveAsset}/></div>}<div className="ucs-visitor-team">{options.arrivalShowLogo && <TeamBadge name={opponent} image={image} resolveAsset={resolveAsset}/>}<div><span>TE GAST BIJ {String(content.clubName || "ONZE CLUB").toUpperCase()}</span><h3>{opponent}</h3><p>Tegen {own}</p></div>{options.arrivalShowKickoff && <span className="ucs-visitor-kickoff"><small>AFTRAP</small><strong>{row.time || "–"}</strong></span>}</div><div className="ucs-visitor-details">{row.field && <span><small>VELD</small><strong>{row.field.replace(/^Veld\s*/i, "")}</strong></span>}{row.secondary && <span><small>KLEEDKAMER</small><strong>{row.secondary}</strong></span>}{row.tag && <span className="ucs-visitor-venue"><small>SPORTPARK</small><strong>{row.tag.replace(/^Sportpark\s*/i, "")}</strong></span>}</div></article>;
  }) : <div className="ucs-empty"><strong>Geen bezoekende teams</strong><span>Binnen dit tijdvenster zijn er geen thuiswedstrijden.</span></div>}</div><div className="ucs-list-footer"><span>Meld je bij het wedstrijdsecretariaat</span><span>{content.rows.length} {content.rows.length === 1 ? "team" : "teams"}</span></div></section>;
}

function Led({ content, resolveAsset }: { content: SitesTvContent; resolveAsset: SitesAssetResolver }) {
  if (content.kind === "lineup") return <section className="ucs-panel ucs-lineup"><PanelMeta primary={content.match?.home || content.clubName || content.title}/><div className="ucs-lineup-grid">{content.rows.map((row, index) => <div key={row.id}><b>{row.rank ?? index + 1}</b><span>{row.primary}</span>{row.secondary && <small>{row.secondary}</small>}</div>)}</div><div className="ucs-list-footer"><span>Wedstrijdselectie</span><span>{content.footer || ""}</span></div></section>;
  const match = content.match; const home = match?.home || content.rows[0]?.primary || "Thuis"; const away = match?.away || content.rows[1]?.primary || "Uit"; const homeLogo = match?.homeLogo || content.rows[0]?.image; const awayLogo = match?.awayLogo || content.rows[1]?.image;
  return <section className={`ucs-led${content.kind === "goal" ? " ucs-led-goal" : ""}`}><div className="ucs-led-status ucs-card"><span className="ucs-motion-dot"/>{match?.clock || match?.label || content.eyebrow || "LIVE"}</div><div className="ucs-led-score ucs-card"><div><TeamBadge name={home} image={homeLogo} large resolveAsset={resolveAsset}/><strong>{home}</strong></div><span>{match?.homeScore ?? content.rows[0]?.value ?? "0"}<i>–</i>{match?.awayScore ?? content.rows[1]?.value ?? "0"}</span><div><TeamBadge name={away} image={awayLogo} large resolveAsset={resolveAsset}/><strong>{away}</strong></div></div>{content.timeline?.length ? <div className="ucs-match-events">{content.timeline.slice(-3).reverse().map((row) => <span className="ucs-card" key={row.id}><b>{row.primary}</b> {row.secondary} <strong>{row.value}</strong></span>)}</div> : <div className="ucs-led-caption ucs-card">{content.subtitle || "Wedstrijd in uitvoering"}</div>}</section>;
}

function Extras({ content, kind, options, resolveAsset }: { content: SitesTvContent; kind: SitesUnifiedKind; options: V17Options; resolveAsset: SitesAssetResolver }) {
  if (options.extraType === "periodestand") return <Standing content={content} resolveAsset={resolveAsset}/>;
  if (options.extraType === "nextmatch") return <Matchday content={content} resolveAsset={resolveAsset}/>;
  if (options.extraType === "welkom-bezoekers") return <Visitors content={content} options={options} resolveAsset={resolveAsset}/>;
  return <section className={`ucs-panel ucs-extra-panel${options.extraType === "afgelastingen" ? " ucs-cancel-panel" : ""}`}><div className="ucs-extra-scroll">{content.rows.map((row) => <div className="ucs-extra-row" key={row.id}><span>{row.time || row.tag || row.value || ""}</span><div><strong>{row.primary}</strong><small>{row.secondary}</small></div>{options.extraType === "afgelastingen" && <b>AFGELAST</b>}</div>)}</div><div className="ucs-list-footer"><span>{kind === "sportlink-extra" ? "Actuele clubinformatie" : content.title}</span><span>{content.rows.length} items</span></div></section>;
}

function Sports({ kind, content, options, resolveAsset }: { kind: SitesUnifiedKind; content: SitesTvContent; options: V17Options; resolveAsset: SitesAssetResolver }) {
  if (kind === "competitie" && content.kind === "stand") return <Standing content={content} resolveAsset={resolveAsset}/>;
  if (kind === "competitie" || kind === "programma" || kind === "uitslagen") return <FixtureList content={content} results={kind === "uitslagen" || content.kind === "uitslagen"} resolveAsset={resolveAsset}/>;
  if (kind === "matchday") return <Matchday content={content} resolveAsset={resolveAsset}/>;
  if (kind === "trainingen") return <Training content={content} resolveAsset={resolveAsset}/>;
  if (kind === "bezoekers") return <Visitors content={content} options={options} resolveAsset={resolveAsset}/>;
  if (kind === "led") return <Led content={content} resolveAsset={resolveAsset}/>;
  return <Extras content={content} kind={kind} options={options} resolveAsset={resolveAsset}/>;
}

function QrCode({ url }: { url: string }) {
  try {
    const qr = qrcode(0, "M"); qr.addData(url); qr.make(); const count = qr.getModuleCount(); const cells: string[] = [];
    for (let row = 0; row < count; row++) for (let column = 0; column < count; column++) if (qr.isDark(row, column)) cells.push(`M${column} ${row}h1v1h-1z`);
    return <svg viewBox={`-2.4 -2.4 ${count + 4.8} ${count + 4.8}`} role="img" aria-label="QR-code" shapeRendering="crispEdges" style={{ width: "100%", height: "100%", background: "#fff" }}><path d={cells.join("")} fill="#000"/></svg>;
  } catch { return <Icon name="arrow"/>; }
}
function NewsLink({ url, label, compact = false }: { url: string; label: string; compact?: boolean }) {
  let host = "veyocast.nl"; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* schema already guards persisted URLs */ }
  return <span className={`ucc-news-link${compact ? " ucc-news-link-compact" : ""}`}><span className="ucc-qr-slot" aria-label={compact ? "Koppeling beschikbaar" : "Scan de QR-code"}>{compact ? <Icon name="arrow"/> : <QrCode url={url}/>}</span><span><strong>{label}</strong><small>{host}</small></span></span>;
}
function Agenda({ content }: { content: SitesTvContent }) { return <div className="ucc-content"><Metadata label={content.subtitle || content.location || "Clubagenda"}/><div className="ucc-agenda">{content.rows.length ? content.rows.map((row) => <article key={row.id} className="ucc-agenda-row"><div className="ucc-date"><strong>{row.value || row.time?.slice(0, 2) || "–"}</strong><span>{row.tag || ""}</span></div><div className="ucc-agenda-main"><span>{row.tag || content.eyebrow}</span><h3>{row.primary}</h3>{row.secondary && <p><Icon name="pin"/>{row.secondary}</p>}</div><div className="ucc-agenda-time"><strong>{row.time || ""}</strong><span>{row.field || ""}</span></div></article>) : <Empty text="Geen activiteiten"/>}</div></div>; }
function newsMeta(row: Row) { return [row.tag, row.value].filter((value, index, values) => value && values.indexOf(value) === index).join(" · ") || "Nieuws"; }
function Rss({ content, options, resolveAsset }: { content: SitesTvContent; options: V17Options; resolveAsset: SitesAssetResolver }) {
  const items = content.rows.length ? content.rows : [{ id: "empty", primary: content.title, secondary: content.subtitle } as Row]; const current = items[0]!;
  const progress = `Bericht 1 van ${items.length}`;
  if (options.rssLayout === "accordion") return <div className="ucc-content"><Metadata label={content.clubName || "Clubnieuws"} detail={progress}/><div className="ucc-news-accordion">{items.slice(0, 5).map((row, index) => <article key={row.id} className={`ucc-news-row${index === 0 ? " ucc-open" : ""}`}><div className="ucc-news-number">{String(index + 1).padStart(2, "0")}</div><div className="ucc-news-copy"><span>{newsMeta(row)}</span><h3>{row.primary}</h3>{index === 0 && <div className="ucc-news-expand"><p>{row.secondary}</p><NewsLink url={options.qrUrl} label="Lees het bericht" compact/></div>}</div>{resolveReference(row.image, resolveAsset) && <img src={resolveReference(row.image, resolveAsset)} alt=""/>}</article>)}</div></div>;
  return <div className={`ucc-content ucc-news-feature ucc-news-${options.rssLayout}`}><Metadata label={content.clubName || "Clubnieuws"} detail={progress}/><article className="ucc-feature-card"><img src={resolveReference(current.image, resolveAsset) || resolveSystem("/onzetrots/originals/clubhuis.jpg", resolveAsset)} alt=""/><div className="ucc-feature-copy"><span>{newsMeta(current)}</span><h3>{current.primary}</h3><p>{current.secondary}</p><NewsLink url={options.qrUrl} label="Scan en lees verder"/></div></article></div>;
}
function Birthdays({ content, resolveAsset }: { content: SitesTvContent; resolveAsset: SitesAssetResolver }) { return <div className="ucc-content"><Metadata label={content.subtitle || "Aankomende verjaardagen"} detail={`${content.rows.length} jarigen`}/>{content.rows.length ? <div className="ucc-six-grid ucc-birthday-grid">{content.rows.slice(0, 6).map((row) => <article key={row.id} className="ucc-birthday"><span className="ucc-birthday-date">{row.tag}</span><div className="ucc-initial">{resolveReference(row.image, resolveAsset) ? <img src={resolveReference(row.image, resolveAsset)} alt=""/> : <><span>{initials(row.primary).slice(0, 1)}</span><Icon name="cake"/></>}</div><h3>{row.primary}</h3>{row.secondary && <p>{row.secondary}</p>}{row.value && <strong className="ucc-age">{row.value}</strong>}</article>)}</div> : <Empty text="Geen jarigen"/>}<div className="ucc-grid-bottom"><span>Onze Club. Onze Trots.</span></div></div>; }
function Partners({ content, resolveAsset }: { content: SitesTvContent; resolveAsset: SitesAssetResolver }) { return <div className="ucc-content"><div className="ucc-six-grid ucc-partner-grid">{content.rows.slice(0, 6).map((row) => <article className="ucc-partner" key={row.id}>{resolveReference(row.image, resolveAsset) ? <img src={resolveReference(row.image, resolveAsset)} alt={row.primary}/> : <strong>{row.primary}</strong>}</article>)}</div><div className="ucc-grid-bottom"><span>{content.footer || "Partners van de club"}</span></div></div>; }
function Canteen({ content, options }: { content: SitesTvContent; options: V17Options }) {
  const categories = new Map<string, Row[]>(); for (const row of content.rows) { const key = row.tag || "Assortiment"; categories.set(key, [...(categories.get(key) || []), row]); }
  return <div className={`ucc-content ucc-canteen ucc-menu-${options.menuLayout}`}><Metadata label={content.subtitle || "Prijslijst"}/>{options.menuLayout === "featured" && content.rows[0] ? <div className="ucc-menu-highlight"><div className="ucc-coffee-mark"><Icon name="coffee"/></div><div><span>{content.rows[0].tag}</span><h3>{content.rows[0].primary}</h3><p>{content.rows[0].secondary}</p></div>{options.showPrices && <strong>{content.rows[0].value}</strong>}</div> : options.menuLayout === "list" ? <div className="ucc-menu-list-items">{content.rows.map((row) => <div className="ucc-menu-item" key={row.id}><span>{options.showCategories && <small>{row.tag}</small>}{row.primary}</span>{options.showPrices && <b>{row.value}</b>}</div>)}</div> : <div className="ucc-menu-grid">{[...categories.entries()].map(([category, rows], index) => <section className="ucc-menu-category" key={category}>{options.showCategories && <header><span>{String(index + 1).padStart(2, "0")}</span><h3>{category}</h3></header>}<div>{rows.map((row) => <div className="ucc-menu-item" key={row.id}><span>{row.primary}</span>{options.showPrices && <b>{row.value}</b>}</div>)}</div></section>)}</div>}<div className="ucc-menu-foot"><Icon name="coffee"/><span>{content.footer || "Bestellen en afrekenen aan de bar."}</span><strong>Onze Club. Onze Trots.</strong></div></div>;
}
function Vacancies({ content, options }: { content: SitesTvContent; options: V17Options }) { return <div className="ucc-content ucc-vacancy-content">{(options.body || content.subtitle) && <p className="ucc-vacancy-intro">{options.body || content.subtitle}</p>}<div className="ucc-vacancies">{content.rows.slice(0, 3).map((row, index) => <article key={row.id}><div className="ucc-role-icon"><Icon name={index === 0 ? "coffee" : index === 1 ? "users" : "calendar"}/><span>{String(index + 1).padStart(2, "0")}</span></div><span>{row.value || row.tag}</span><h3>{row.primary}</h3><p>{row.secondary}</p></article>)}</div><div className="ucc-vacancy-contact"><Icon name="megaphone"/><p>{options.vacancyContact || content.footer}</p><NewsLink url={options.qrUrl} label="Bekijk de vacatures"/></div></div>; }
function Welcome({ content, options, resolveAsset }: { content: SitesTvContent; options: V17Options; resolveAsset: SitesAssetResolver }) { return <div className="ucc-welcome"><div className="ucc-welcome-intro"><div className="ucc-welcome-brand"><div className="ucc-welcome-wordmark" role="img" aria-label="OnzeTrots"/></div><div className="ucc-welcome-copy"><span>{content.location || content.clubName}</span><p>{options.body || content.subtitle || "Onze Club. Onze Trots."}</p></div></div><div className="ucc-welcome-photo"><img src={resolveReference(options.welcomeImage || content.heroImage, resolveAsset) || resolveSystem("/onzetrots/premium/clubhuis.png", resolveAsset)} alt="Clubhuis"/></div><div className="ucc-welcome-values">{(content.values?.slice(0, 3) || ["Onze Wijk.", "Onze Club.", "Onze Trots."]).map((value, index) => <div key={value}><span>{String(index + 1).padStart(2, "0")}</span><strong>{value}</strong></div>)}</div></div>; }
function Free({ content, options, resolveAsset }: { content: SitesTvContent; options: V17Options; resolveAsset: SitesAssetResolver }) { return <div className="ucc-freeform"><p>{options.body || content.subtitle || content.rows[0]?.primary}</p><NewsLink url={options.qrUrl} label="Meer informatie"/><img src={resolveReference(content.logo, resolveAsset) || resolveSystem("/onzetrots-tv/assets/logo.png", resolveAsset)} alt={content.clubName || "Clublogo"}/></div>; }

function Club({ kind, content, options, resolveAsset }: { kind: SitesUnifiedKind; content: SitesTvContent; options: V17Options; resolveAsset: SitesAssetResolver }) {
  let body: React.ReactNode;
  switch (kind) { case "agenda": body = <Agenda content={content}/>; break; case "rss": body = <Rss content={content} options={options} resolveAsset={resolveAsset}/>; break; case "verjaardagen": body = <Birthdays content={content} resolveAsset={resolveAsset}/>; break; case "partners": body = <Partners content={content} resolveAsset={resolveAsset}/>; break; case "kantine": body = <Canteen content={content} options={options}/>; break; case "vacatures": body = <Vacancies content={content} options={options}/>; break; case "welkom": body = <Welcome content={content} options={options} resolveAsset={resolveAsset}/>; break; default: body = <Free content={content} options={options} resolveAsset={resolveAsset}/>; }
  return <div className="ucc-body">{body}</div>;
}

function model(presentation: SitesPresentation) {
  if (presentation.kind === "dynamic") return { kind: presentation.configuration.unifiedKind || fallbackKind(presentation.content), orientation: presentation.configuration.orientation, theme: presentation.configuration.themeId, title: presentation.configuration.title || presentation.content.title, content: presentation.content, options: { ...defaultOptions, ...presentation.configuration }, moving: presentation.configuration.animation !== "none" };
  const slide = presentation.slide; const content = slide.tv || { kind: "generic" as const, title: slide.title, subtitle: slide.subtitle, clubName: slide.clubName, logo: slide.logo, background: slide.photo, rows: [] };
  return { kind: slide.unifiedKind || fallbackKind(content), orientation: slide.orientation, theme: slide.themeId, title: slide.title || content.title, content, options: { ...defaultOptions, ...slide }, moving: slide.animation !== "Geen" };
}
function fallbackKind(content: SitesTvContent): SitesUnifiedKind { return content.kind === "stand" ? "competitie" : content.kind === "programma" ? "programma" : content.kind === "uitslagen" ? "uitslagen" : content.kind === "wedstrijd" ? "matchday" : content.kind === "kantine" ? "kantine" : content.kind === "clubnieuws" ? "rss" : content.kind === "partners" ? "partners" : content.kind === "welkom" ? "welkom" : content.kind === "score" || content.kind === "goal" || content.kind === "lineup" ? "led" : "vrij"; }
function slidePhoto(kind: SitesUnifiedKind, orientation: "landscape" | "portrait", extraType: string, resolveAsset: SitesAssetResolver) { const subject = ["welkom", "bezoekers", "kantine", "trainingen"].includes(kind) || (kind === "sportlink-extra" && extraType === "welkom-bezoekers") ? "houtrust" : ["agenda", "vacatures", "partners"].includes(kind) ? "de-wijk" : "aan-zee"; const path = `/onzetrots/website-brush/${subject}-${orientation === "portrait" ? "portrait-941" : "wide-1672"}.webp` as keyof typeof sitesSystemImageChecksums; return resolveSystem(path, resolveAsset); }

export function SitesUnifiedV17Markup({ presentation, resolveAsset, active = false, frameWidth, rootRef, width, children, canvasClassName = "", canvasStyle, backgroundOverride }: SitesUnifiedV17MarkupProps) {
  const view = model(presentation); const nativeWidth = view.orientation === "portrait" ? 1080 : 1920; const nativeHeight = view.orientation === "portrait" ? 1920 : 1080; const renderedWidth = width || frameWidth || nativeWidth; const scale = renderedWidth / nativeWidth; const sports = ["competitie", "programma", "uitslagen", "matchday", "trainingen", "led", "sportlink-extra", "bezoekers"].includes(view.kind); const titleLength = view.title.length > 50 ? "long" : view.title.length > 28 ? "medium" : "short"; const clubLogo = resolveReference(view.content.logo || view.content.brandLogo, resolveAsset) || resolveSystem("/onzetrots-tv/assets/logo.png", resolveAsset);
  const frameStyle: CSSProperties = { aspectRatio: `${nativeWidth}/${nativeHeight}`, ...(frameWidth ? { margin: "auto", maxHeight: "100%", maxWidth: "100%", width: frameWidth } : { width: "100%" }) };
  return <div ref={rootRef} className="uc-preview" style={frameStyle} aria-label={`Voorbeeld ${view.title}, ${view.orientation === "portrait" ? "9:16" : "16:9"}`}><div className={`uc-slide uc-${view.orientation}${active && view.moving ? " uc-active" : ""} ${canvasClassName}`} data-theme={view.theme} data-kind={view.kind} data-paint={view.options.paintTone} data-photo-motion={view.options.photoMotion !== false} style={{ width: nativeWidth, height: nativeHeight, transform: `scale(${scale})`, ...canvasStyle }}>
    {(backgroundOverride || view.theme === "onzetrots-tv") && <><div className="uc-photo" aria-hidden="true"><img className={backgroundOverride ? "vm-background" : undefined} src={backgroundOverride?.src || slidePhoto(view.kind, view.orientation, view.options.extraType, resolveAsset)} style={backgroundOverride ? { objectFit: backgroundOverride.fit } : undefined} alt=""/></div><div className={`uc-photo-shade${backgroundOverride ? " vm-shade" : ""}`} style={backgroundOverride ? { display: "block", background: "#071329", opacity: backgroundOverride.overlay / 100 } : undefined} aria-hidden="true"/></>}
    <div className="uc-texture" aria-hidden="true"/><header className="uc-header"><img className="uc-header-logo" src={clubLogo} alt={view.content.clubName || "Clublogo"}/><div className="uc-header-copy"><span className="uc-header-brand">{String(view.content.clubName || "ONZE CLUB").toUpperCase()}</span><h1 className="uc-slide-title" data-length={titleLength}>{view.title}</h1></div></header><div className="uc-body">{children ?? (sports ? <Sports kind={view.kind} content={view.content} options={view.options} resolveAsset={resolveAsset}/> : <Club kind={view.kind} content={view.content} options={view.options} resolveAsset={resolveAsset}/>)}</div><footer className="uc-footer">{view.theme === "onzetrots-tv" ? <span className="uc-wordmark" role="img" aria-label="OnzeTrots"/> : <strong className="uc-fieldflow-wordmark">{String(view.content.clubName || "ONZE CLUB").toUpperCase()}</strong>}</footer>
  </div></div>;
}
