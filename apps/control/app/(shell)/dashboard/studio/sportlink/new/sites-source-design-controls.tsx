"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { type SitesAssetReference, type SitesDynamicConfiguration } from "@veyocast/contracts";
import { sitesSystemBackground } from "./sites-source-design";
import theme from "./sites-source-theme.module.css";
import styles from "./sites-source-design.module.css";

export type SitesSourceMedia = { id: string; name: string; checksumSha256: string; url: string };
const backgrounds = [
  ["Clubhuis", "/fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-3840x2160-web.webp"],
  ["Clubpartners", "/fieldflow/photos/FF-PHOTO-05-sponsor-hub-3840x2160-web.webp"],
  ["Samen bij de club", "/fieldflow/photos/FF-PHOTO-06-community-3840x2560-web.webp"],
  ["Wedstrijddag", "/fieldflow/photos/FF-PHOTO-04-matchday-live-3840x2160-web.webp"],
  ["Clubhuis · OnzeTrots", "/onzetrots/premium/clubhuis.png"],
  ["Havenlicht", "/onzetrots/premium/havenlicht.png"],
  ["Kerk", "/onzetrots/premium/kerk.png"],
  ["Duindorp luchtfoto", "/onzetrots/premium/duindorp-luchtfoto.png"],
  ["Historische poort", "/onzetrots/premium/historische-poort.png"]
] as const;
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="demo-field"><span>{label}</span>{children}</label>; }

export function SitesSourceThemePicker({ value, onChange }: { value: SitesDynamicConfiguration["themeId"]; onChange: (value: SitesDynamicConfiguration["themeId"]) => void }) {
  return <fieldset className={theme.picker}><legend>Schermthema</legend><div className={theme.choices}>{[
    { id: "fieldflow" as const, name: "FieldFlow", description: "Herkenbaar, rustig en helder voor je club." },
    { id: "onzetrots-tv" as const, name: "OnzeTrots TV", description: "Een krachtig clubgevoel op ieder scherm." }
  ].map(item => <button type="button" key={item.id} className={theme.choice} aria-pressed={value === item.id} onClick={() => onChange(item.id)}><span className={theme.swatch} data-theme={item.id} aria-hidden="true"><b>{item.id === "onzetrots-tv" ? "ONZE TROTS." : "Samen voor de club."}</b><i /></span><span className={theme.copy}><strong>{item.name}</strong><small>{item.description}</small></span><span className={theme.check}>{value === item.id && <Check size={15} />}</span></button>)}</div><p>Het thema gaat mee naar je playlist en publicatie. Je inhoud blijft bewerkbaar.</p></fieldset>;
}

export function SitesSourceDesignControls({ design, onChange, media = [], showTitle = true, showPaging = true, showLayout = true }: { design: SitesDynamicConfiguration; onChange: (patch: Partial<SitesDynamicConfiguration>) => void; media?: SitesSourceMedia[]; showTitle?: boolean; showPaging?: boolean; showLayout?: boolean }) {
  const maxRows = design.provider === "led-scores" ? 8 : 12;
  const backgroundValue = design.background?.kind === "system" ? design.background.path : design.background?.mediaAssetId;
  const pictures: { name: string; url: string; asset: SitesAssetReference }[] = [
    ...backgrounds.flatMap(([name, path]) => { const asset = sitesSystemBackground(path); return asset ? [{ name, url: path, asset }] : []; }),
    ...media.map(item => ({ name: item.name, url: item.url, asset: { kind: "tenant" as const, mediaAssetId: item.id, checksumSha256: item.checksumSha256 } }))
  ];
  return <div className={styles.controls}>
    <SitesSourceThemePicker value={design.themeId} onChange={themeId => onChange({ themeId })} />
    {showTitle && <><Field label="Titel op het scherm"><input value={design.title} maxLength={240} onChange={event => onChange({ title: event.target.value })} /></Field><Field label="Ondertitel"><input value={design.subtitle} maxLength={1000} onChange={event => onChange({ subtitle: event.target.value })} /></Field></>}
    <div className={styles.backgroundPicker}><div className={styles.pickerHeading}><div><strong>Achtergrondafbeelding</strong><small>Kies een clubbeeld of een foto uit je mediabibliotheek.</small></div></div><div className={styles.photos}>{pictures.map(picture => { const key = picture.asset.kind === "system" ? picture.asset.path : picture.asset.mediaAssetId; return <button type="button" key={key} className={backgroundValue === key ? styles.selected : ""} aria-pressed={backgroundValue === key} onClick={() => onChange({ background: picture.asset })}><Image src={picture.url} alt="" width={320} height={200} unoptimized /><span>{picture.name}</span>{backgroundValue === key && <Check size={16} />}</button>; })}</div><button type="button" className={styles.textButton} onClick={() => onChange({ background: undefined })}>Zonder foto</button><a className={styles.textButton} href="/dashboard/media">Eigen foto uploaden</a></div>
    {showLayout && (design.themeId === "onzetrots-tv" ? <p className={styles.hint}>OnzeTrots TV past de compositie aan op het gekozen schermformaat.</p> : <div className={styles.layoutChoices} aria-label="Indeling">{([{ id: "full", label: "Volledig beeld" }, { id: "split", label: "Beeld & inhoud" }, { id: "sidebar", label: "Zijpaneel" }] as const).map(item => <button key={item.id} type="button" aria-pressed={design.layout === item.id} onClick={() => onChange({ layout: item.id })}><span className={styles.layoutMini} data-layout={item.id}><i /><i /></span>{item.label}</button>)}</div>)}
    <div className={styles.fields}><Field label="Schermformaat"><select value={design.orientation} onChange={event => onChange({ orientation: event.target.value as SitesDynamicConfiguration["orientation"] })}><option value="landscape">Liggend · 16:9</option><option value="portrait">Staand · 9:16</option></select></Field><Field label="Uitlijning"><select value={design.align} onChange={event => onChange({ align: event.target.value as SitesDynamicConfiguration["align"] })}><option value="left">Links</option><option value="center">Midden</option><option value="right">Rechts</option></select></Field><Field label="Accentkleur"><input type="color" value={design.accent.slice(0, 7)} onChange={event => onChange({ accent: event.target.value })} /></Field><Field label="Duur per pagina (seconden)"><input type="number" min={5} max={120} value={design.seconds} onChange={event => onChange({ seconds: Math.max(5, Math.min(120, Number(event.target.value) || 5)) })} /></Field>{showPaging && <Field label="Inhoud per pagina"><input type="number" min={1} max={maxRows} value={design.rowsPerPage} onChange={event => onChange({ rowsPerPage: Math.max(1, Math.min(maxRows, Number(event.target.value) || 1)) })} /></Field>}</div>
    <Field label={`Tekstgrootte · ${design.scale}%`}><input type="range" min={70} max={design.provider === "led-scores" ? 200 : 140} step={5} value={design.scale} onChange={event => onChange({ scale: Number(event.target.value) })} /></Field>
    <Field label={`${design.provider === "led-scores" || design.themeId === "onzetrots-tv" ? "Contrastlaag" : "Foto verduisteren"} · ${design.overlay}%`}><input type="range" min={design.provider === "led-scores" || design.provider === "menu" ? 0 : 10} max={95} step={5} value={design.overlay} onChange={event => onChange({ overlay: Number(event.target.value) })} /></Field>
    <Field label={`Veilige marge · ${design.safeArea}%`}><input type="range" min={3} max={12} value={design.safeArea} onChange={event => onChange({ safeArea: Number(event.target.value) })} /></Field>
    {design.provider === "menu" && <Field label="Achtergrond passen"><select value={design.backgroundFit} onChange={event => onChange({ backgroundFit: event.target.value as "contain" | "cover" })}><option value="contain">Volledig beeld</option><option value="cover">Scherm vullen</option></select></Field>}
    {design.provider === "led-scores" && <><Field label="LED-stijl"><select value={design.ledTheme} onChange={event => onChange({ ledTheme: event.target.value as SitesDynamicConfiguration["ledTheme"] })}><option value="blue">OnzeTrots blauw</option><option value="paper">OnzeTrots wit</option><option value="fieldflow">FieldFlow</option></select></Field>{(["titleScale", "scoreScale", "logoScale", "teamScale"] as const).map((key, index) => <Field key={key} label={`${["Titel", "Stand", "Logo's", "Teams"][index]} · ${design[key]}%`}><input type="range" min={70} max={200} step={5} value={design[key]} onChange={event => onChange({ [key]: Number(event.target.value) })} /></Field>)}<button type="button" onClick={() => onChange({ scale: 125, titleScale: 110, scoreScale: 120, logoScale: 130, teamScale: 110, safeArea: 3, showBranding: false, showSceneLabel: false })}>Schermvullend</button><Field label="Achtergrond passen"><select value={design.backgroundFit} onChange={event => onChange({ backgroundFit: event.target.value as "contain" | "cover" })}><option value="contain">Volledig beeld</option><option value="cover">Scherm vullen</option></select></Field>{(["showBranding", "showSceneLabel"] as const).map((key, index) => <label key={key}><input type="checkbox" checked={design[key]} onChange={event => onChange({ [key]: event.target.checked })} />{["Clubbranding", "Momentlabel"][index]}</label>)}</>}
  </div>;
}
