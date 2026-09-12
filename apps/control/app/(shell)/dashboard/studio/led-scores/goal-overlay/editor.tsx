"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoalOverlay, royalCurrentDefaultStyle, royalCurrentEditorialTokens } from "@veyocast/content-templates";
import { goalTemplateVariables, validGoalTemplate, type GoalOverlayConfiguration, type GoalOverlayEvent } from "@veyocast/contracts";
import { Badge, Button, MultiSelectDropdown } from "@veyocast/ui";
import { CanvasMediaUploadDialog } from "../canvas-media-upload-dialog";
import { publishGoalOverlay, saveGoalOverlay, testGoalOverlay, toggleGoalOverlay, savePlayerPhoto } from "./actions";
import styles from "./goal-overlay.module.css";
import { GoalColorField, isGoalColor } from "./color-field";

type Identity = { connectionId: string; clubId: string; teamKey: string };
type Team = Identity & { name: string; clubName: string; active: boolean; category: string | null; logoUrl?: string | null };
type Props = {
  initial: GoalOverlayConfiguration;
  alert: { id: string; revision: number; status: string } | null;
  canWrite: boolean; canPublish: boolean;
  teams: Team[]; selectedTeams: Identity[]; publishedTeams: (Identity & { name: string })[];
  groups: { id: string; name: string; screenIds: string[] }[];
  selectedGroups: string[]; publishedGroupIds: string[];
  assets: { id: string; title: string; previewUrl: string | null; width: number | null; height: number | null }[];
  photos: { id: string; title: string; previewUrl: string | null }[];
  players: { photoMediaId: string | null; id: string; name: string; connectionId: string; teamKey: string }[];
  uploadConfig: { anonKey: string; supabaseUrl: string; canUpload: boolean } | null;
};
const key = (t: Identity) => `${t.connectionId}:${t.clubId}:${t.teamKey}`;
const sections = ["Algemeen", "Introvideo", "Inhoud", "Teksten", "Design", "Timing"] as const;
const colors = [
  ["lightOuterColor", "Buitenachtergrond · light"], ["darkOuterColor", "Buitenachtergrond · dark"],
  ["lightCardColor", "Kaart · light"], ["darkCardColor", "Kaart · dark"],
  ["lightTextColor", "Tekst · light"], ["darkTextColor", "Tekst · dark"], ["accentTextColor", "Accentteksten"]
] as const;
const toggles = [["showScorer", "Doelpuntenmaker"], ["showPlayerPhoto", "Spelersfoto"], ["showShirtNumber", "Rugnummer"], ["showMinute", "Wedstrijdminuut en blessuretijd"], ["showTeamNames", "Teamnamen"], ["showTeamLogos", "Clublogo’s"], ["showCompetition", "Competitie"], ["showMatchName", "Wedstrijdnaam"], ["showRound", "Speelronde"], ["showVenue", "Sportpark of stadion"]] as const;

export function GoalOverlayEditor(props: Props) {
  const { alert, teams, groups, assets } = props;
  const router = useRouter();
  const [config, setConfig] = useState(props.initial);
  const [selected, setSelected] = useState(props.selectedTeams.map(key));
  const [groupIds, setGroupIds] = useState(props.selectedGroups);
  const [section, setSection] = useState<typeof sections[number]>("Algemeen");
  const [category, setCategory] = useState("");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [appearance, setAppearance] = useState<"light" | "dark">("light");
  const [side, setSide] = useState<"home" | "away">("home");
  const [previewPhoto, setPreviewPhoto] = useState("");
  const [photoPlayerId, setPhotoPlayerId] = useState(props.players[0]?.id ?? "");
  const [previewScorer, setPreviewScorer] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [testTeam, setTestTeam] = useState(key(props.publishedTeams[0] ?? { connectionId: "", clubId: "", teamKey: "" }));
  const patch = <K extends keyof GoalOverlayConfiguration>(name: K, value: GoalOverlayConfiguration[K]) => setConfig((c) => ({ ...c, [name]: value }));
  const categories = [...new Set(teams.flatMap((t) => t.category ? [t.category] : []))];
  const selectedRows = teams.filter((t) => selected.includes(key(t)));
  const dirty = JSON.stringify(config) !== JSON.stringify(props.initial) || JSON.stringify(selected) !== JSON.stringify(props.selectedTeams.map(key)) || JSON.stringify(groupIds) !== JSON.stringify(props.selectedGroups);
  const testSelection = props.publishedTeams.find((t) => key(t) === testTeam);
  const previewTeam = selectedRows[0]?.name ?? "Duindorp SV 2";
  const event: GoalOverlayEvent = { eventId: "studio-preview", homeTeam: side === "home" ? previewTeam : "VUC 2", awayTeam: side === "away" ? previewTeam : "VUC 2", homeScore: 2, awayScore: 1, scoreboardSide: side, scorer: previewScorer ? "Jack Morauw" : null, playerPhoto: props.photos.find((p) => p.id === previewPhoto)?.previewUrl ?? null, shirtNumber: previewScorer ? "9" : null, minute: "67′", homeLogo: side === "home" ? selectedRows[0]?.logoUrl ?? null : null, awayLogo: side === "away" ? selectedRows[0]?.logoUrl ?? null : null, competition: "Voorbeeldcompetitie", matchName: "Voorbeeldwedstrijd", round: "Speelronde 7", venue: "Sportpark", test: true };
  const selectedScreens = new Set(groups.filter((g) => groupIds.includes(g.id)).flatMap((g) => g.screenIds));
  const invalidTemplate = [config.headlineTemplate, config.subtitleTemplate, config.goalTextTemplate].some((t) => !validGoalTemplate(t)) || !config.headlineTemplate.trim();
  const invalidColors = colors.some(([field]) => !isGoalColor(config[field]));
  const primary = config.defaults?.primary ?? royalCurrentDefaultStyle.primary;
  const automaticColor = (field: typeof colors[number][0]) => field.includes("Outer") || field === "lightTextColor" ? primary
    : field === "darkCardColor" ? config.defaults?.darkSurface ?? royalCurrentEditorialTokens(royalCurrentDefaultStyle, "dark").surface
    : field === "accentTextColor" ? (appearance === "light" ? config.lightTextColor ?? primary : config.darkTextColor ?? "#FFFFFF") : "#FFFFFF";
  const identityFields = <><input type="hidden" name="alertId" value={alert?.id ?? ""} /><input type="hidden" name="revision" value={alert?.revision ?? 0} /></>;
  return <div className={styles.workspace}>
    <div className={styles.toolbar}>
      <div><Badge status={alert?.status === "published" ? "success" : "neutral"}>{alert?.status === "published" ? "Actief" : alert?.status === "paused" ? "Uit" : "Concept"}</Badge><span>{selected.length} teams · {selectedScreens.size} schermen</span></div>
      <div className={styles.actions}>
        {alert && props.canWrite && ["published", "paused"].includes(alert.status) ? <form action={toggleGoalOverlay}>{identityFields}<input type="hidden" name="status" value={alert.status === "published" ? "paused" : "published"} /><Button type="submit" variant="secondary">{alert.status === "published" ? "Uitzetten" : "Activeren"}</Button></form> : null}
        {alert && props.canPublish ? <form action={publishGoalOverlay}>{identityFields}<Button type="submit" disabled={dirty}>Publiceren</Button></form> : null}
      </div>
    </div>
    <div className={styles.split}>
      <form action={saveGoalOverlay} className={styles.settings}>
        {identityFields}<input name="configuration" type="hidden" value={JSON.stringify(config)} />
        <input name="teams" type="hidden" value={JSON.stringify(selectedRows.map(({ connectionId, clubId, teamKey }) => ({ connectionId, clubId, teamKey })))} />
        {groupIds.map((id) => <input key={id} name="groupIds" type="hidden" value={id} />)}
        <nav className={styles.sections} aria-label="Overlay-instellingen">{sections.map((s) => <Button key={s} type="button" size="sm" variant={section === s ? "secondary" : "ghost"} aria-pressed={section === s} onClick={() => setSection(s)}>{s}</Button>)}</nav>
        <fieldset disabled={!props.canWrite} className={styles.panel}>
          <legend>{section}</legend>
          {section === "Algemeen" ? <>
            <p>Selecteer de eigen teams waarvoor LED Scores wedstrijddata levert. Nieuwe teams verschijnen automatisch na bronverversing.</p>
            {!teams.length ? <p className="notice notice--warning">Er zijn nog geen geverifieerde clubteams. <Link href="/dashboard/data-sources/led-scores">Controleer de clubkoppeling</Link>. De connector ververst de catalogus bij verbinden en iedere vijf minuten.</p> : null}
            {categories.length ? <label>Categorie<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Alle categorieën</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></label> : null}
            <MultiSelectDropdown label="Teams waarop Goal Alerts actief zijn" description="Club-ID en team-ID komen uit de gekoppelde bron. Inactieve teams kunnen niet worden toegevoegd." searchable allowSelectAll allowClear maximumSelected={250} value={selected} onValueChange={setSelected} options={teams.filter((t) => !category || t.category === category || selected.includes(key(t))).map((t) => ({ value: key(t), label: t.name, imageUrl: t.logoUrl, description: `${t.active ? "Actief" : "Inactief"} · ${t.category ? `${t.category} · ` : ""}${t.clubName}`, disabled: !t.active && !selected.includes(key(t)), keywords: [t.clubName, t.teamKey, t.category ?? ""] }))} selectionNoun={{ singular: "team", plural: "teams" }} />
            {selectedRows.some((t) => !t.active) ? <p className="notice notice--warning">Een geselecteerd team is niet meer actief in de bron. Deselecteer het team voordat je opslaat.</p> : null}
            <MultiSelectDropdown label="Tonen op" searchable value={groupIds} onValueChange={setGroupIds} options={groups.map((g) => ({ value: g.id, label: g.name, description: `${g.screenIds.length} actieve schermen` }))} description="Een scherm in meerdere geselecteerde groepen ontvangt één Goal Alert." selectionNoun={{ singular: "groep", plural: "groepen" }} />
            <label>Thema<select value={config.themeMode} onChange={(e) => patch("themeMode", e.target.value as GoalOverlayConfiguration["themeMode"])}><option value="auto">Automatisch · tenantthema volgen</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          </> : null}
          {section === "Introvideo" ? <>
            <label className={styles.check}><input type="checkbox" checked={config.introEnabled} onChange={(e) => patch("introEnabled", e.target.checked)} />Introvideo afspelen</label>
            <p>MP4 en WebM gaan via de bestaande mediabibliotheek. De verwerkte player-variant speelt gemute en volledig af. Daarna begint de overlay.</p>
            {(["landscape", "portrait"] as const).map((format) => {
              const field = format === "landscape" ? "introLandscapeMediaId" : "introPortraitMediaId";
              const asset = assets.find((a) => a.id === config[field]);
              return <div key={format} className={styles.media}><label>{format === "landscape" ? "Landscape · 16:9" : "Portrait · 9:16"}<select value={config[field] ?? ""} onChange={(e) => patch(field, e.target.value || null)}><option value="">Geen video ingesteld</option>{assets.map((a) => <option key={a.id} value={a.id}>{a.title}{a.width && a.height ? ` · ${a.width} × ${a.height}` : ""}</option>)}</select></label>
                {asset?.previewUrl ? <video key={asset.previewUrl} src={asset.previewUrl} controls muted playsInline preload="metadata" aria-label={`${format} introvideo bekijken`} /> : <p>{config.introLandscapeMediaId || config.introPortraitMediaId ? "Deze variant ontbreekt. Zonder toestemming voor de andere oriëntatie verschijnt direct de overlay." : "Zonder introvideo verschijnt direct de Goal Overlay."}</p>}
                {asset ? <Button type="button" variant="ghost" size="sm" onClick={() => patch(field, null)}>Video verwijderen uit overlay</Button> : null}
              </div>;
            })}
            <label><input type="checkbox" checked={config.introAllowOrientationFallback === true} onChange={(event) => patch("introAllowOrientationFallback", event.target.checked)} /> Andere video gebruiken als de schermvariant ontbreekt</label>
            {props.uploadConfig ? <Button type="button" variant="secondary" onClick={() => setUploadOpen(true)}>Media uploaden</Button> : null}
            <Button type="button" variant="ghost" onClick={() => router.refresh()}>Mediabibliotheek vernieuwen</Button>
          </> : null}
          {section === "Inhoud" ? <><p>De actuele score blijft altijd zichtbaar. Optionele onderdelen verdwijnen wanneer de bron geen gegevens levert.</p><div className={styles.checks}>{toggles.map(([field, label]) => <label className={styles.check} key={field}><input type="checkbox" checked={config[field]} onChange={(e) => patch(field, e.target.checked)} />{label}</label>)}</div><p>Spelers worden gekoppeld met team-ID en speler-ID. Een scoreknop-ID wordt nooit als speler gebruikt.</p></> : null}
          {section === "Teksten" ? <>
            {([["headlineTemplate", "Hoofdtekst", 80], ["subtitleTemplate", "Extra subtitel", 160], ["goalTextTemplate", "Korte goaltekst", 160]] as const).map(([field, label, max]) => <label key={field}>{label}<input value={config[field]} maxLength={max} required={field === "headlineTemplate"} aria-invalid={!validGoalTemplate(config[field])} onChange={(e) => patch(field, e.target.value)} /></label>)}
            <p>Beschikbare variabelen:</p><div className={styles.variables}>{goalTemplateVariables.map((v) => <code key={v}>{`{${v}}`}</code>)}</div><p>Bijvoorbeeld: <strong>GOAL {"{team}"}!</strong></p>
            {invalidTemplate ? <p role="alert" className="notice notice--critical">Gebruik een hoofdtekst en alleen de getoonde variabelen tussen accolades.</p> : null}
          </> : null}
          {section === "Design" ? <>
            <p>Automatische kleuren volgen de clubstijl. Stel alleen een eigen kleur in waar je wilt afwijken.</p>
            <div className={styles.colors}>{colors.map(([field, label]) => <GoalColorField key={field} label={label} value={config[field]} automatic={automaticColor(field)} onChange={(value) => patch(field, value)} />)}</div>
            <Button type="button" variant="secondary" onClick={() => setConfig((c) => ({ ...c, ...Object.fromEntries(colors.map(([f]) => [f, null])) }))}>Herstel clubkleuren</Button>
            <div className={styles.fields}>
              <label>Compositie<select value={config.layout} onChange={(e) => patch("layout", e.target.value as GoalOverlayConfiguration["layout"])}><option value="centered">Gecentreerd</option><option value="player-focus">Speler centraal</option></select></label>
              <label>Lettertype<select value={config.font} onChange={(e) => patch("font", e.target.value as "display" | "body")}><option value="display">VeyoCast koppen</option><option value="body">VeyoCast tekst</option></select></label>
              <label>Hoekafronding<input type="number" value={config.radius} min={0} max={64} onChange={(e) => patch("radius", Number(e.target.value))} /></label>
              <label>Witruimte<select value={config.spacing} onChange={(e) => patch("spacing", e.target.value as GoalOverlayConfiguration["spacing"])}><option value="compact">Compact</option><option value="comfortable">Comfortabel</option><option value="generous">Ruim</option></select></label>
              {([["logoSize", "Logoformaat"], ["photoSize", "Fotoformaat"]] as const).map(([f, label]) => <label key={f}>{label}<select value={config[f]} onChange={(e) => patch(f, e.target.value as "small" | "medium" | "large")}><option value="small">Klein</option><option value="medium">Gemiddeld</option><option value="large">Groot</option></select></label>)}
            </div><label className={styles.check}><input type="checkbox" checked={config.shadow} onChange={(e) => patch("shadow", e.target.checked)} />Schaduw</label>
          </> : null}
          {section === "Timing" ? <>
            <p>De zichtduur begint na het einde van de introvideo en de entreeanimatie. Goals wachten op elkaar; de playlist hervat na de laatste goal.</p>
            <label>Overlayduur (seconden)<input type="number" min={2} max={30} step={0.5} value={config.overlayDurationMs / 1000} onChange={(e) => patch("overlayDurationMs", Number(e.target.value) * 1000)} /></label>
            <label>Entree<select value={config.enterAnimation} onChange={(e) => patch("enterAnimation", e.target.value as GoalOverlayConfiguration["enterAnimation"])}><option value="rise">Omhoog verschijnen</option><option value="fade">Infaden</option><option value="none">Direct</option></select></label>
            <label>Uitgang<select value={config.exitAnimation} onChange={(e) => patch("exitAnimation", e.target.value as GoalOverlayConfiguration["exitAnimation"])}><option value="fade">Uitfaden</option><option value="none">Direct</option></select></label>
            <label>Overgang (milliseconden)<input type="number" min={0} max={1500} step={50} value={config.transitionDurationMs} onChange={(e) => patch("transitionDurationMs", Number(e.target.value))} /></label>
          </> : null}
        </fieldset>
        <footer className={styles.save}><p>{invalidColors ? "Een kleurcode is nog niet compleet. Controleer de kleuren onder Design." : dirty ? "Je hebt niet-opgeslagen wijzigingen." : "Publiceren maakt het opgeslagen ontwerp actief op je schermen."}</p><Button type="submit" disabled={!props.canWrite || !selectedRows.length || selectedRows.some((t) => !t.active) || !groupIds.length || invalidTemplate || invalidColors}>Concept opslaan</Button></footer>
      </form>
      <aside className={styles.preview} aria-label="Live voorbeeld">
        <div className={styles.previewHeader}><div><span className={styles.eyebrow}>Live preview</span><h2>Het moment is van jullie</h2></div><Badge status="info">Voorbeelddata</Badge></div>
        <div className={styles.previewControls}>
          <label>Oriëntatie<select value={orientation} onChange={(e) => setOrientation(e.target.value as typeof orientation)}><option value="landscape">Landscape · 16:9</option><option value="portrait">Portrait · 9:16</option></select></label>
          <label>Weergave<select value={appearance} onChange={(e) => setAppearance(e.target.value as typeof appearance)}><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label>Doelpunt<select value={side} onChange={(e) => setSide(e.target.value as typeof side)}><option value="home">Thuisgoal</option><option value="away">Uitgoal</option></select></label>
        </div>
        <div className={styles.stage} data-orientation={orientation}><GoalOverlay event={event} configuration={config} orientation={orientation} appearance={appearance} /></div>
        <label className={styles.check}><input type="checkbox" checked={previewScorer} onChange={(e) => setPreviewScorer(e.target.checked)} />Voorbeeld met doelpuntenmaker</label>
        <label>Voorbeeldfoto<select value={previewPhoto} onChange={(e) => setPreviewPhoto(e.target.value)}><option value="">Zonder spelersfoto</option>{props.photos.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <p>Introvideo → Goal Overlay → playlist hervatten. De preview gebruikt dezelfde renderer als de player.</p>
      </aside>
    </div>
    <section className={styles.test} aria-labelledby="goal-test-title"><div><span className={styles.eyebrow}>Test op je schermen</span><h2 id="goal-test-title">Test Goal Alert</h2><p>Test de gepubliceerde versie op één schermgroep. Alle testbeelden zijn herkenbaar gemarkeerd; echte wedstrijdstatistieken blijven intact.</p></div>
      {props.canPublish && alert?.status === "published" ? <form action={testGoalOverlay}>{identityFields}<input type="hidden" name="testTeam" value={JSON.stringify(testSelection ? { connectionId: testSelection.connectionId, clubId: testSelection.clubId, teamKey: testSelection.teamKey } : null)} />
        <div className={styles.fields}><label>Team<select required value={testTeam} onChange={(e) => setTestTeam(e.target.value)}>{props.publishedTeams.map((t) => <option key={key(t)} value={key(t)}>{t.name}</option>)}</select></label>
          <label>Testschermgroep<select required name="testGroup">{groups.filter((g) => props.publishedGroupIds.includes(g.id)).map((g) => <option value={g.id} key={g.id}>{g.name} · {g.screenIds.length} schermen</option>)}</select></label>
          <label>Doelpunt<select name="testSide"><option value="home">Geselecteerd team thuis</option><option value="away">Geselecteerd team uit</option></select></label>
          <label>Thuisstand<input type="number" name="homeScore" defaultValue={2} min={0} max={999} required /></label><label>Uitstand<input type="number" name="awayScore" defaultValue={1} min={0} max={999} required /></label>
          <label>Gekoppelde speler<select name="scorerId" key={testTeam}><option value="">Geen gekoppelde speler</option>{props.players.filter((p) => p.connectionId === testSelection?.connectionId && p.teamKey === testSelection?.teamKey).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Of een testnaam<input name="scorerName" maxLength={160} placeholder="Optioneel" /></label><label>Wedstrijdminuut<input name="minute" maxLength={20} placeholder="67′" /></label>
        </div><Button type="submit" variant="secondary" disabled={!testSelection}>Start test Goal Alert</Button>
      </form> : <p>Publiceer en activeer eerst de overlay. Je hebt publicatierechten nodig om een test naar echte schermen te sturen.</p>}
    </section>
    {props.canWrite ? <section className={styles.test} aria-labelledby="goal-photo-title"><div><h2 id="goal-photo-title">Spelersfoto koppelen</h2><p>Kies een speler die LED Scores eerder heeft aangeleverd. De koppeling gebruikt diens team- en speler-ID; een eigen foto heeft voorrang op de bronfoto.</p></div>{props.players.length ? <form action={savePlayerPhoto}><div className={styles.fields}><label>Speler<select name="playerId" value={photoPlayerId} onChange={(e) => setPhotoPlayerId(e.target.value)}>{props.players.map((p) => <option key={p.id} value={p.id}>{p.name} · team {p.teamKey}</option>)}</select></label><label>Foto uit mediabibliotheek<select name="mediaId" key={photoPlayerId} defaultValue={props.players.find((p) => p.id === photoPlayerId)?.photoMediaId ?? ""}><option value="">Automatische bronfoto gebruiken</option>{props.photos.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label></div><Button type="submit" variant="secondary">Spelersfoto opslaan</Button></form> : <p>Nog geen speleridentiteiten ontvangen. Een goal zonder bekende speler blijft gewoon zichtbaar.</p>}</section> : null}
    {props.uploadConfig ? <CanvasMediaUploadDialog {...props.uploadConfig} open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) router.refresh(); }} /> : null}
  </div>;
}
