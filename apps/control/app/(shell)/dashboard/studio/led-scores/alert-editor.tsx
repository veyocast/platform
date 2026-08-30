"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Eye, RadioTower } from "lucide-react";

import { Button } from "@veyocast/ui";

import { saveLedScoresGoalAlert } from "./actions";
import styles from "./led-scores-studio.module.css";

export type AlertEditorValue = {
  config: Record<string, unknown>;
  connectionId: string;
  durationMs: number;
  groupIds: string[];
  id: string | null;
  name: string;
  priority: number;
  revision: number;
  underlayPolicy: string;
};
type Group = { id: string; name: string; screenIds: string[] };
type Asset = { id: string; kind: string; title: string };
type ExistingAlert = { groupIds: string[]; id: string; name: string; priority: number; status: string };
type Connection = {
  id: string;
  mappings: Array<{ side: "opponent" | "own"; teamKey: string; teamName: string }>;
  name: string;
};
type Screen = { id: string; name: string; status: "offline" | "online" | "stale" };

export function LedScoresAlertEditor({
  alerts,
  assets,
  connections,
  groups,
  initial,
  screens,
  sponsors
}: {
  alerts: ExistingAlert[];
  assets: Asset[];
  connections: Connection[];
  groups: Group[];
  initial: AlertEditorValue;
  screens: Screen[];
  sponsors: Array<{ id: string; label: string }>;
}) {
  const [selectedGroups, setSelectedGroups] = useState(initial.groupIds);
  const [groupSearch, setGroupSearch] = useState("");
  const [connectionId, setConnectionId] = useState(initial.connectionId);
  const [priority, setPriority] = useState(initial.priority);
  const [previewSide, setPreviewSide] = useState<"missing-scorer" | "opponent" | "own" | "unknown">("own");
  const initialOwn = readDesign(initial.config.ownDesign, "GOOOAAAL!", "Voor de club");
  const initialOpponent = readDesign(initial.config.opponentDesign, "Tegendoelpunt", "We blijven gaan");
  const initialUnknown = readDesign(initial.config.unknownDesign, "GOAL!", "Team nog niet gekoppeld");
  const [ownHeadline, setOwnHeadline] = useState(initialOwn.headline);
  const [opponentHeadline, setOpponentHeadline] = useState(initialOpponent.headline);
  const [ownPalette, setOwnPalette] = useState(initialOwn.palette);
  const [opponentPalette, setOpponentPalette] = useState(initialOpponent.palette);
  const [unknownHeadline, setUnknownHeadline] = useState(initialUnknown.headline);
  const [unknownPalette, setUnknownPalette] = useState(initialUnknown.palette);
  const connection = connections.find((item) => item.id === connectionId) ?? connections[0];
  const ownMappings = connection?.mappings.filter((mapping) => mapping.side === "own") ?? [];
  const normalizedGroupSearch = groupSearch.trim().toLocaleLowerCase("nl-NL");
  const selection = useMemo(() => summarizeSelection(groups, selectedGroups), [groups, selectedGroups]);
  const conflict = useMemo(() => {
    const selectedScreens = selection.screenIds;
    return alerts.find((alert) => {
      if (alert.id === initial.id || alert.status !== "published") return false;
      const other = summarizeSelection(groups, alert.groupIds).screenIds;
      return other.some((screenId) => selectedScreens.includes(screenId));
    });
  }, [alerts, groups, initial.id, priority, selection.screenIds]);
  const preview = previewSide === "own" || previewSide === "missing-scorer"
    ? { headline: ownHeadline, palette: ownPalette, secondary: initialOwn.secondaryText }
    : previewSide === "opponent"
      ? { headline: opponentHeadline, palette: opponentPalette, secondary: initialOpponent.secondaryText }
      : { headline: unknownHeadline, palette: unknownPalette, secondary: initialUnknown.secondaryText };

  return <form action={saveLedScoresGoalAlert} className={styles.editor}>
    {initial.id ? <input name="alertId" type="hidden" value={initial.id} /> : null}
    <input name="expectedRevision" type="hidden" value={initial.revision} />
    <section className={styles.formPanel}>
      <div className={styles.sectionHeading}><div><span>1</span><div><h2>Bron en gedrag</h2><p>Koppel dit concept aan één actieve websocketbron.</p></div></div><RadioTower aria-hidden="true" /></div>
      <div className={styles.fieldGrid}>
        <label><span>Naam</span><input defaultValue={initial.name} maxLength={120} name="name" placeholder="Goal Alert hoofdveld" required /></label>
        <label><span>LED Scores-verbinding</span><select name="connectionId" onChange={(event) => setConnectionId(event.target.value)} required value={connectionId}>{connections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Prioriteit</span><input max={1000} min={0} name="priority" onChange={(event) => setPriority(Number(event.target.value))} type="number" value={priority} /></label>
        <label><span>Duur</span><select defaultValue={initial.durationMs} name="durationMs"><option value="5000">5 seconden</option><option value="8000">8 seconden</option><option value="12000">12 seconden</option><option value="20000">20 seconden</option></select></label>
        <label><span>Onderliggende playlist</span><select defaultValue={initial.underlayPolicy} name="underlayPolicy"><option value="continue">Laat doorgaan</option><option value="pause">Pauzeer en hervat exact</option></select></label>
        <label><span>Actief vanaf (UTC, optioneel)</span><input defaultValue={dateTimeValue(initial.config.activeFrom)} name="activeFrom" type="datetime-local" /></label>
        <label><span>Actief tot (UTC, optioneel)</span><input defaultValue={dateTimeValue(initial.config.activeUntil)} name="activeUntil" type="datetime-local" /></label>
      </div>
      <fieldset className={styles.triggerFields}><legend>Triggerbeleid</legend><label><input defaultChecked={readBoolean(initial.config.triggerOwn, true)} name="triggerOwn" type="checkbox" />Eigen goals tonen</label><label><input defaultChecked={readBoolean(initial.config.triggerOpponent, true)} name="triggerOpponent" type="checkbox" />Goals van tegenstanders tonen</label><label><span>Onbekende teammapping</span><select defaultValue={readString(initial.config.unknownPolicy) || "suppress"} name="unknownPolicy"><option value="suppress">Veilig onderdrukken</option><option value="generic">Generieke GOAL tonen</option></select></label></fieldset>
      {ownMappings.length ? <fieldset className={styles.triggerFields}><legend>Eigen teams</legend><p>Geen selectie betekent: ieder als eigen geclassificeerd team op deze verbinding.</p>{ownMappings.map((mapping) => <label key={mapping.teamKey}><input defaultChecked={readStringArray(initial.config.ownTeamKeys).includes(mapping.teamKey)} name="ownTeamKeys" type="checkbox" value={mapping.teamKey} />{mapping.teamName}</label>)}</fieldset> : <p className="notice notice--warning"><strong>Nog geen eigen teammapping.</strong> Classificeer eerst minimaal één LED team-ID als eigen team; onbekende scorers volgen het gekozen fallbackbeleid.</p>}
    </section>

    <section className={styles.formPanel}>
      <div className={styles.sectionHeading}><div><span>2</span><div><h2>Doelschermen</h2><p>Groepen zijn many-to-many; de union ontvangt ieder event maximaal één keer.</p></div></div></div>
      <label><span>Zoek schermgroep</span><input onChange={(event) => setGroupSearch(event.target.value)} placeholder="Zoek op groepsnaam" type="search" value={groupSearch} /></label>
      <div className={styles.groupGrid}>{groups.map((group) => <label className={styles.groupChoice} hidden={Boolean(normalizedGroupSearch) && !group.name.toLocaleLowerCase("nl-NL").includes(normalizedGroupSearch)} key={group.id}><input checked={selectedGroups.includes(group.id)} name="targetGroupIds" onChange={(event) => setSelectedGroups((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} type="checkbox" value={group.id} /><span><strong>{group.name}</strong><small>{group.screenIds.length} scherm{group.screenIds.length === 1 ? "" : "en"}</small></span></label>)}</div>
      <p className={styles.unionSummary}><strong>{selection.screenIds.length} unieke schermen.</strong> {selection.overlapCount ? `${selection.overlapCount} schermen zitten in meerdere gekozen groepen en ontvangen de alert één keer.` : "Geen overlap tussen de gekozen groepen."}</p>
      <details><summary>Definitieve doelschermen bekijken</summary><ul className={styles.screenList}>{selection.screenIds.map((screenId) => { const screen = screens.find((item) => item.id === screenId); return <li key={screenId}><span>{screen?.name ?? "Onbekend scherm"}</span><small>{screen?.status === "online" ? "Online" : screen?.status === "stale" ? "Status verouderd" : "Offline"}</small></li>; })}</ul></details>
      {conflict ? <p className="notice notice--warning" role="status"><AlertTriangle aria-hidden="true" /><strong>Overlappende actieve regel.</strong> ‘{conflict.name}’ raakt dezelfde schermen met prioriteit {conflict.priority}. Per goal en scherm wint hoogste prioriteit; bij gelijkstand wint de nieuwste publicatie deterministisch.</p> : null}
    </section>

    <section className={styles.formPanel}>
      <div className={styles.sectionHeading}><div><span>3</span><div><h2>Eigen goal</h2><p>Tekst, score, klok, doelpuntenmaker, media en animatie.</p></div></div></div>
      <DesignFields design={initialOwn} headline={ownHeadline} onHeadline={setOwnHeadline} onPalette={setOwnPalette} palette={ownPalette} prefix="own" />
    </section>
    <section className={styles.formPanel}>
      <div className={styles.sectionHeading}><div><span>4</span><div><h2>Goal tegenstander</h2><p>Een rustige, duidelijk afwijkende variant voor een tegendoelpunt.</p></div></div></div>
      <DesignFields design={initialOpponent} headline={opponentHeadline} onHeadline={setOpponentHeadline} onPalette={setOpponentPalette} palette={opponentPalette} prefix="opponent" />
      <h3>Onbekend team</h3><p>Deze generieke variant noemt geen extern team-ID en wordt alleen gebruikt wanneer het fallbackbeleid op tonen staat.</p>
      <DesignFields design={initialUnknown} headline={unknownHeadline} onHeadline={setUnknownHeadline} onPalette={setUnknownPalette} palette={unknownPalette} prefix="unknown" />
    </section>

    <section className={styles.formPanel}>
      <div className={styles.sectionHeading}><div><span>5</span><div><h2>Media en sponsor</h2><p>Alle gekozen media wordt in de immutable versie vastgelegd en vooraf naar doelschermen gestuurd.</p></div></div></div>
      <div className={styles.fieldGrid}>
        <AssetSelect assets={assets} defaultValue={readString(initial.config.logoMediaAssetId)} label="Clublogo" name="logoMediaAssetId" />
        <AssetSelect assets={assets} defaultValue={readString(initial.config.ownMediaAssetId)} label="Media eigen goal" name="ownMediaAssetId" />
        <AssetSelect assets={assets} defaultValue={readString(initial.config.opponentMediaAssetId)} label="Media tegenstander" name="opponentMediaAssetId" />
        <AssetSelect assets={assets} defaultValue={readString(initial.config.unknownMediaAssetId)} label="Media onbekend team" name="unknownMediaAssetId" />
        <AssetSelect assets={assets.filter((asset) => asset.kind === "video")} defaultValue={readString(initial.config.ownSoundMediaAssetId)} label="Geluid eigen goal (audio uit MP4)" name="ownSoundMediaAssetId" />
        <label><span>Volume eigen goal</span><input defaultValue={readNumber(initial.config.ownSoundVolume, 70)} max={100} min={0} name="ownSoundVolume" type="number" /></label>
        <AssetSelect assets={assets.filter((asset) => asset.kind === "video")} defaultValue={readString(initial.config.opponentSoundMediaAssetId)} label="Geluid tegenstander (audio uit MP4)" name="opponentSoundMediaAssetId" />
        <label><span>Volume tegenstander</span><input defaultValue={readNumber(initial.config.opponentSoundVolume, 45)} max={100} min={0} name="opponentSoundVolume" type="number" /></label>
        <label><span>Bestaand sponsorblok</span><select defaultValue={readString(initial.config.sponsorCreativeId)} name="sponsorCreativeId"><option value="">Geen sponsorblok</option>{sponsors.map((sponsor) => <option key={sponsor.id} value={sponsor.id}>{sponsor.label}</option>)}</select></label>
      </div>
      <label><input defaultChecked={readBoolean(initial.config.sponsorOnlyOwn, true)} name="sponsorOnlyOwn" type="checkbox" />Sponsorblok alleen bij een eigen goal tonen</label>
      <p className="notice"><strong>Audio is aanvullend.</strong> De visuele alert start altijd; een Playerplatform dat autoplay met geluid blokkeert, valt zonder onderbreking terug op beeld en tekst.</p>
    </section>

    <aside className={styles.previewPanel} aria-label="Live voorbeeld">
      <div className={styles.previewToolbar}><div><Eye aria-hidden="true" /><strong>Live voorbeeld</strong></div><div><button aria-pressed={previewSide === "own"} onClick={() => setPreviewSide("own")} type="button">Eigen goal</button><button aria-pressed={previewSide === "opponent"} onClick={() => setPreviewSide("opponent")} type="button">Tegenstander</button><button aria-pressed={previewSide === "unknown"} onClick={() => setPreviewSide("unknown")} type="button">Onbekend</button><button aria-pressed={previewSide === "missing-scorer"} onClick={() => setPreviewSide("missing-scorer")} type="button">Zonder doelpuntenmaker</button></div></div>
      <div className={styles.preview} data-palette={preview.palette}><span className={styles.previewClub}>{previewSide === "unknown" ? "Team nog niet gekoppeld" : "VeyoCast club"}</span><strong>{preview.headline}</strong><div className={styles.previewScore}><span>4</span><small>–</small><span>2</span></div><p>{preview.secondary}</p><small>{previewSide === "missing-scorer" ? "12:34 · Doelpunt!" : "12:34 · Testdoelpunt"}</small></div>
      <p>De definitieve Playeroverlay gebruikt dezelfde semantische tokens, maar schaalt responsief naar de schermresolutie.</p>
    </aside>

    <div className={styles.saveBar}><div><strong>{initial.id ? "Concept wijzigen" : "Nieuw concept"}</strong><span>Publiceren gebeurt daarna als aparte immutable versie.</span></div><Button disabled={!selectedGroups.length || !connections.length} type="submit">Concept opslaan</Button></div>
  </form>;
}

function DesignFields({ design, headline, onHeadline, onPalette, palette, prefix }: { design: ReturnType<typeof readDesign>; headline: string; onHeadline: (value: string) => void; onPalette: (value: string) => void; palette: string; prefix: "opponent" | "own" | "unknown" }) {
  return <div className={styles.fieldGrid}>
    <label><span>Hoofdtekst</span><input maxLength={80} name={`${prefix}Headline`} onChange={(event) => onHeadline(event.target.value)} required value={headline} /></label>
    <label><span>Secundaire tekst</span><input defaultValue={design.secondaryText} maxLength={160} name={`${prefix}SecondaryText`} /></label>
    <label><span>Fallback doelpuntenmaker</span><input defaultValue={design.scorerFallback} maxLength={120} name={`${prefix}ScorerFallback`} /></label>
    <label><span>Kleurthema</span><select name={`${prefix}Palette`} onChange={(event) => onPalette(event.target.value)} value={palette}><option value="electric-orange">Electric Orange</option><option value="ink-black">Ink Black</option><option value="signal-red">Signal Red</option><option value="white">Wit</option></select></label>
    <label><span>Animatie</span><select defaultValue={design.animation} name={`${prefix}Animation`}><option value="impact">Impact</option><option value="pulse">Pulse</option><option value="slide">Inschuiven</option><option value="none">Geen</option></select></label>
    <label><span>Typografie</span><select defaultValue={design.typography} name={`${prefix}Typography`}><option value="display">Inter Tight display</option><option value="body">Inter body</option></select></label>
    <label><span>Uitlijning logo en inhoud</span><select defaultValue={design.logoPosition} name={`${prefix}LogoPosition`}><option value="left">Links</option><option value="center">Midden</option></select></label>
    <label><span>Logoschaal</span><select defaultValue={design.logoScale} name={`${prefix}LogoScale`}><option value="small">Compact</option><option value="medium">Normaal</option><option value="large">Groot</option></select></label>
    <div className={styles.checks}><label><input defaultChecked={design.showPreviousScore} name={`${prefix}ShowPreviousScore`} type="checkbox" />Vorige score</label><label><input defaultChecked={design.showScorer} name={`${prefix}ShowScorer`} type="checkbox" />Doelpuntenmaker</label><label><input defaultChecked={design.showClock} name={`${prefix}ShowClock`} type="checkbox" />Wedstrijdklok</label></div>
  </div>;
}
function AssetSelect({ assets, defaultValue, label, name }: { assets: Asset[]; defaultValue: string; label: string; name: string }) { return <label><span>{label}</span><select defaultValue={defaultValue} name={name}><option value="">Geen</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.kind === "video" ? "Video" : "Afbeelding"}</option>)}</select></label>; }
function summarizeSelection(groups: Group[], selected: string[]) { const counts = new Map<string, number>(); for (const group of groups) if (selected.includes(group.id)) for (const screen of group.screenIds) counts.set(screen, (counts.get(screen) ?? 0) + 1); return { overlapCount: [...counts.values()].filter((count) => count > 1).length, screenIds: [...counts.keys()] }; }
function readDesign(value: unknown, headline: string, secondaryText: string) { const data = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; return { animation: readString(data.animation) || "impact", headline: readString(data.headline) || headline, logoPosition: readString(data.logoPosition) || "left", logoScale: readString(data.logoScale) || "medium", palette: readString(data.palette) || "ink-black", scorerFallback: readString(data.scorerFallback) || "Doelpunt!", secondaryText: readString(data.secondaryText) || secondaryText, showClock: data.showClock === true, showPreviousScore: data.showPreviousScore === true, showScorer: data.showScorer !== false, typography: readString(data.typography) || "display" }; }
function readString(value: unknown) { return typeof value === "string" ? value : ""; }
function readBoolean(value: unknown, fallback: boolean) { return typeof value === "boolean" ? value : fallback; }
function readNumber(value: unknown, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function readStringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function dateTimeValue(value: unknown) { const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN; return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 16) : ""; }
