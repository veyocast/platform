"use client";

import { Eye, Save, Send } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  sportlinkArrivalConfigSchema,
  sportlinkSlideBlueprints,
  type SelectableThemeId,
  type SportlinkSlideBlueprintKey,
  type SportlinkSlideDraft
} from "@veyocast/contracts";
import { themeCatalog } from "@veyocast/content-templates/theme-catalog";
import { Button, Field } from "@veyocast/ui";

import { ThemePicker } from "../../_components/theme-picker";
import { SportlinkArrivalFields, type SportlinkMediaOption } from "../../_components/sportlink-arrival-fields";
import { publishDynamicSlideVersion } from "../../version-actions";
import { saveSportlinkSlideVersion } from "./actions";

type Team = { contexts: Array<{ competitionId: string; label: string; phaseId: string | null; poolId: string | null; seasonId: string | null }>; externalId: string; name: string };
type Template = { orientation: "landscape" | "portrait"; slideType: string; versionId: string };

export function SportlinkVersionEditor({ dataSourceId, defaultThemeId, initialDraft, initialRevision, media, slideId, teams, templates, versionId, versionNumber }: {
  dataSourceId: string;
  defaultThemeId: SelectableThemeId;
  initialDraft: SportlinkSlideDraft;
  initialRevision: number;
  media: SportlinkMediaOption[];
  slideId: string;
  teams: Team[];
  templates: Template[];
  versionId: string;
  versionNumber: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [revision, setRevision] = useState(initialRevision);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const templateMap = useMemo(() => Object.fromEntries(templates.map((template) => [`${template.orientation}:${template.slideType}`, template.versionId])), [templates]);
  const team = teams.find((candidate) => candidate.externalId === draft.context.providerTeamId) ?? teams[0];
  const blueprintKeys = Object.keys(sportlinkSlideBlueprints) as SportlinkSlideBlueprintKey[];
  const themeId = draft.themeSelection.ref.catalog === "v2" ? draft.themeSelection.ref.id : "editorial";
  const theme = themeCatalog[themeId];

  const update = (next: SportlinkSlideDraft) => { setDraft(next); setDirty(true); setMessage(null); };
  const setBlueprint = (blueprintKey: SportlinkSlideBlueprintKey) => {
    const blueprint = sportlinkSlideBlueprints[blueprintKey];
    const templateVersionId = templateMap[`${draft.orientation}:${blueprint.slideType}`];
    if (!templateVersionId) return;
    update({
      ...draft,
      blueprintKey,
      templateVersionId,
      title: blueprint.label,
      ...(blueprintKey.endsWith("arrivals") && !draft.arrival
        ? { arrival: sportlinkArrivalConfigSchema.parse({}) }
        : {})
    });
  };
  const setOrientation = (orientation: "landscape" | "portrait") => {
    const templateVersionId = templateMap[`${orientation}:${sportlinkSlideBlueprints[draft.blueprintKey].slideType}`];
    if (templateVersionId) update({ ...draft, orientation, templateVersionId });
  };
  const setTheme = (id: SelectableThemeId) => update({ ...draft, themeSelection: { ...draft.themeSelection, ref: { catalog: "v2", id, version: themeCatalog[id].version } } });
  const save = () => startTransition(async () => {
    const result = await saveSportlinkSlideVersion({ dataSourceId, draft, expectedRevision: revision, slideId, versionId });
    if (!result.ok) { setMessage(result.message ?? "Opslaan is mislukt."); return; }
    setRevision(result.editRevision); setDirty(false); setMessage("Conceptversie opgeslagen."); router.refresh();
  });
  const publish = () => startTransition(async () => {
    const result = await publishDynamicSlideVersion({ expectedRevision: revision, slideId, versionId });
    if (!result.ok) { setMessage(result.message ?? "Publiceren is mislukt."); return; }
    router.push(`/dashboard/slides/${slideId}?succes=Versie+${versionNumber}+wordt+veilig+gerenderd.+De+huidige+versie+blijft+actief+tot+de+nieuwe+gereed+is.`);
  });

  return (
    <div className="sve">
      <section className="sve-form data-surface">
        <header><div><h2>Conceptversie v{versionNumber}</h2><p>Alle instellingen zijn gekopieerd. Wijzig alleen wat voor deze versie anders moet.</p></div><span>{dirty ? "Niet opgeslagen" : "Opgeslagen"}</span></header>
        {message ? <p className={message.includes("mislukt") || message.includes("geen toestemming") ? "notice notice--critical" : "notice notice--success"} role="status">{message}</p> : null}
        <Field label="Naam in Slides en playlists"><input maxLength={120} minLength={2} onChange={(event) => update({ ...draft, name: event.target.value })} value={draft.name} /></Field>
        <fieldset><legend>Wat wil je tonen?</legend><div className="sve-blueprints">{blueprintKeys.map((key) => <button aria-pressed={draft.blueprintKey === key} key={key} onClick={() => setBlueprint(key)} type="button">{shortLabel(key)}</button>)}</div></fieldset>
        <div className="sve-fields"><Field label="Team"><select onChange={(event) => { const nextTeam = teams.find((candidate) => candidate.externalId === event.target.value); const context = nextTeam?.contexts[0]; if (nextTeam) update({ ...draft, context: context ? contextFromOption(nextTeam.externalId, context) : { competitionId: null, competitionSelectionMode: "auto_current", phaseId: null, poolId: null, providerTeamId: nextTeam.externalId, seasonId: null } }); }} value={draft.context.providerTeamId}>{teams.map((option) => <option key={option.externalId} value={option.externalId}>{option.name}</option>)}</select></Field><Field label="Competitiekeuze"><select onChange={(event) => update({ ...draft, context: event.target.value === "auto_current" ? { ...draft.context, competitionId: null, competitionSelectionMode: "auto_current", phaseId: null, poolId: null, seasonId: null } : team?.contexts[0] ? contextFromOption(draft.context.providerTeamId, team.contexts[0]) : draft.context })} value={draft.context.competitionSelectionMode}><option value="auto_current">Gebruik actuele competitie</option><option value="pinned">Zelf competitie kiezen</option></select></Field>{draft.context.competitionSelectionMode === "pinned" ? <Field label="Competitie · fase · poule"><select onChange={(event) => { const context = team?.contexts[Number(event.target.value)]; if (context) update({ ...draft, context: contextFromOption(draft.context.providerTeamId, context) }); }} value={Math.max(0, team?.contexts.findIndex((context) => context.competitionId === draft.context.competitionId && context.poolId === draft.context.poolId) ?? 0)}>{team?.contexts.map((context, index) => <option key={`${context.competitionId}:${context.poolId}:${index}`} value={index}>{context.label}</option>)}</select></Field> : null}</div>
        <fieldset><legend>Schermformaat</legend><div className="sve-orientation">{(["landscape", "portrait"] as const).map((orientation) => <button aria-pressed={draft.orientation === orientation} key={orientation} onClick={() => setOrientation(orientation)} type="button"><strong>{orientation === "portrait" ? "Staand" : "Liggend"}</strong><small>{orientation === "portrait" ? "1080 × 1920" : "1920 × 1080"}</small></button>)}</div></fieldset>
        <ThemePicker defaultThemeId={defaultThemeId} label="Thema voor versie" legacySelected={draft.themeSelection.ref.catalog === "legacy"} onChange={setTheme} value={themeId} />
        {draft.themeSelection.ref.catalog === "legacy" ? <p className="notice notice--warning">De bestaande Editorial Arena-stijl blijft pixelvast behouden. Kies alleen een ander thema wanneer deze nieuwe versie bewust een nieuw uiterlijk mag krijgen.</p> : null}
        <fieldset><legend>Weergave</legend><div className="sve-options"><label><input checked={draft.display.columns === "two"} onChange={(event) => update({ ...draft, display: { ...draft.display, columns: event.target.checked ? "two" : "one" } })} type="checkbox" /> Twee kolommen</label>{sportlinkSlideBlueprints[draft.blueprintKey].slideType !== "sport_standing" ? <><label><input checked={draft.display.showHomeAway} onChange={(event) => update({ ...draft, display: { ...draft.display, showHomeAway: event.target.checked } })} type="checkbox" /> Thuis / uit</label><label><input checked={draft.display.showField} onChange={(event) => update({ ...draft, display: { ...draft.display, showField: event.target.checked } })} type="checkbox" /> Veld</label><label><input checked={draft.display.showDressingRoom} onChange={(event) => update({ ...draft, display: { ...draft.display, showDressingRoom: event.target.checked } })} type="checkbox" /> Kleedkamer</label><label><input checked={draft.display.showReferee} onChange={(event) => update({ ...draft, display: { ...draft.display, showReferee: event.target.checked } })} type="checkbox" /> Scheidsrechter</label></> : <p>Voor een poulestand zijn alleen de kolommen relevant.</p>}</div></fieldset>
        {draft.arrival && draft.blueprintKey.endsWith("arrivals") ? <fieldset><legend>Aankomstinstellingen</legend><SportlinkArrivalFields media={media} onChange={(arrival) => update({ ...draft, arrival })} value={draft.arrival} /></fieldset> : null}
        <footer><Button disabled={!dirty || pending} onClick={save} type="button" variant="secondary"><Save aria-hidden="true" />Concept opslaan</Button><Button disabled={dirty || pending} onClick={publish} type="button"><Send aria-hidden="true" />Versie publiceren</Button></footer>
      </section>
      <aside className="sve-preview data-surface"><header><Eye aria-hidden="true" /><strong>Preview</strong></header><div data-orientation={draft.orientation} style={{ "--sve-accent": draft.themeSelection.accent ?? theme.accentDefault, "--sve-canvas": theme.light.canvas, "--sve-line": theme.light.line, "--sve-muted": theme.light.muted, "--sve-surface": theme.light.surface, "--sve-text": theme.light.text } as React.CSSProperties}><span>SPORTLINK</span><h2>{draft.title}</h2><p>{team?.name}</p><i /><i /><i /><small>{theme.name} · {draft.display.columns === "two" ? "2 kolommen" : "1 kolom"}</small></div><p>De actuele providerdata blijft dynamisch. Deze preview toont de versie-instellingen zonder een score te bevriezen.</p></aside>
      <style>{`.sve{display:grid;grid-template-columns:minmax(0,1fr) minmax(270px,34%);gap:1rem;align-items:start}.sve-form{display:grid;gap:1.25rem}.sve-form>header{display:flex;justify-content:space-between;gap:1rem}.sve-form h2,.sve-form p{margin:0}.sve-form>header span{align-self:start;padding:.3rem .5rem;background:var(--accent-soft);border-radius:6px;font-size:.78rem}.sve fieldset{margin:0;padding:0;border:0}.sve legend{margin-bottom:.55rem;font-weight:750}.sve-blueprints{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.5rem}.sve-blueprints button,.sve-orientation button{min-height:52px;padding:.55rem;background:var(--surface);border:1px solid var(--border);border-radius:8px}.sve-blueprints button[aria-pressed=true],.sve-orientation button[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent)}.sve-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.sve-orientation{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}.sve-orientation button{display:grid}.sve-options{display:flex;flex-wrap:wrap;gap:.5rem}.sve-options label{display:flex;align-items:center;gap:.4rem;min-height:44px;padding:.5rem .65rem;border:1px solid var(--border);border-radius:8px}.sve-form>footer{position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:.5rem;padding:.7rem;background:var(--surface);border-top:1px solid var(--border)}.sve-preview{position:sticky;top:1rem;display:grid;gap:.7rem}.sve-preview>header{display:flex;align-items:center;gap:.5rem}.sve-preview>div{display:flex;flex-direction:column;aspect-ratio:16/9;padding:8%;color:var(--sve-text);background:var(--sve-canvas);border:1px solid var(--sve-line);border-radius:8px}.sve-preview>div[data-orientation=portrait]{width:min(75%,230px);justify-self:center;aspect-ratio:9/16}.sve-preview>div>span{color:var(--sve-accent);font-size:.55rem;font-weight:800}.sve-preview h2{margin:.4rem 0 .2rem}.sve-preview>div>p{margin:0;color:var(--sve-muted)}.sve-preview i{display:block;height:1.1rem;margin-top:.4rem;background:var(--sve-surface);border-left:3px solid var(--sve-accent)}.sve-preview small{margin-top:auto;padding-top:.5rem;border-top:1px solid var(--sve-line)}.sve-preview>p{color:var(--muted-foreground);font-size:.82rem}@media(max-width:900px){.sve{grid-template-columns:1fr}.sve-preview{position:relative;top:auto;order:-1}}@media(max-width:640px){.sve-fields{grid-template-columns:1fr}.sve-form>footer{padding-bottom:calc(.7rem + env(safe-area-inset-bottom))}}`}</style>
    </div>
  );
}

function contextFromOption(teamId: string, option: Team["contexts"][number]) { return { competitionId: option.competitionId, competitionSelectionMode: "pinned" as const, phaseId: option.phaseId, poolId: option.poolId, providerTeamId: teamId, seasonId: option.seasonId }; }
function shortLabel(key: SportlinkSlideBlueprintKey) { return sportlinkSlideBlueprints[key].label.replace(/^Club/u, "").trim(); }
