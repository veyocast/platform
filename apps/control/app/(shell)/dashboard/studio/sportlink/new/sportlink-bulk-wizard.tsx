"use client";

import { Check, ChevronDown, Eye, LayoutGrid, Users } from "lucide-react";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import {
  selectableThemeIdSchema,
  sportlinkArrivalConfigSchema,
  sportlinkSlideBlueprints,
  type SelectableThemeId,
  type SportlinkArrivalConfig,
  type SportlinkDisplayConfig,
  type SportlinkSlideBlueprintKey,
  type SportlinkSlideContext,
  type SportlinkSlideDraft,
  type ThemeSelection
} from "@veyocast/contracts";
import { themeCatalog, themeCatalogOptions } from "@veyocast/content-templates/theme-catalog";
import { buildSportlinkSlideDrafts } from "@veyocast/domain";
import { Button, Field } from "@veyocast/ui";

import { ThemePicker } from "../../../slides/_components/theme-picker";
import { SportlinkArrivalFields, type SportlinkMediaOption } from "../../../slides/_components/sportlink-arrival-fields";

type TeamContext = {
  competitionId: string;
  label: string;
  phaseId: string | null;
  poolId: string | null;
  seasonId: string | null;
};
type Team = {
  contexts: TeamContext[];
  dataSourceId: string;
  externalId: string;
  name: string;
};
type Template = { orientation: string; slideType: string; versionId: string };

const steps = [
  "Wat wil je tonen?",
  "Teams & slides",
  "Competitie & poule",
  "Thema & weergave",
  "Controleren & aanmaken"
];
const blueprintKeys = Object.keys(sportlinkSlideBlueprints) as SportlinkSlideBlueprintKey[];
const clubKeys = blueprintKeys.filter((key) => sportlinkSlideBlueprints[key].scope === "club");
const teamPoolKeys = blueprintKeys.filter((key) => sportlinkSlideBlueprints[key].scope !== "club");

export function SportlinkBulkWizard({
  action,
  defaultThemeSelection,
  media,
  sources,
  teams,
  templates
}: {
  action: (formData: FormData) => Promise<void>;
  defaultThemeSelection: ThemeSelection;
  media: SportlinkMediaOption[];
  sources: Array<{ id: string; name: string }>;
  teams: Team[];
  templates: Template[];
}) {
  const [step, setStep] = useState(0);
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [selectedBlueprints, setSelectedBlueprints] = useState<SportlinkSlideBlueprintKey[]>([]);
  const [teamSelections, setTeamSelections] = useState<Record<string, SportlinkSlideBlueprintKey[]>>({});
  const [teamContexts, setTeamContexts] = useState<Record<string, SportlinkSlideContext>>({});
  const [contextOverrides, setContextOverrides] = useState<Record<string, SportlinkSlideContext>>({});
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [themeSelection, setThemeSelection] = useState(defaultThemeSelection);
  const [themeOverrides, setThemeOverrides] = useState<Record<string, SelectableThemeId>>({});
  const [display, setDisplay] = useState<SportlinkDisplayConfig>({
    columns: "two",
    showDressingRoom: false,
    showField: true,
    showHomeAway: true,
    showReferee: false
  });
  const [arrivalConfig, setArrivalConfig] = useState<SportlinkArrivalConfig>(() => sportlinkArrivalConfigSchema.parse({}));
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const sourceTeams = teams.filter((team) => team.dataSourceId === sourceId);
  const selectedTeams = sourceTeams.filter((team) => (teamSelections[team.externalId]?.length ?? 0) > 0);
  const templateMap = useMemo(() => Object.fromEntries(
    templates.filter((template) => template.orientation === orientation)
      .map((template) => [template.slideType, template.versionId])
  ), [orientation, templates]);

  const drafts = useMemo(() => selectedTeams.flatMap((team) => {
    const keys = teamSelections[team.externalId] ?? [];
    if (!keys.length) return [];
    const context = teamContexts[team.externalId] ?? initialContext(team);
    try {
      return buildSportlinkSlideDrafts({
        blueprintKeys: keys,
        orientation,
        teams: [{ context, name: team.name }],
        templateVersionIdBySlideType: templateMap,
        themeSelection
      }).map((draft) => {
        const key = draftKey(draft);
        const themeId = themeOverrides[key];
        return {
          ...draft,
          arrival: draft.blueprintKey.endsWith("arrivals") ? arrivalConfig : undefined,
          context: contextOverrides[key] ?? draft.context,
          display,
          themeSelection: themeId ? withThemeId(themeSelection, themeId) : themeSelection
        };
      });
    } catch {
      return [];
    }
  }), [arrivalConfig, contextOverrides, display, orientation, selectedTeams, teamContexts, teamSelections, templateMap, themeOverrides, themeSelection]);

  const requiredSlideTypes = [...new Set(selectedBlueprints.map((key) => sportlinkSlideBlueprints[key].slideType))];
  const missingTemplates = requiredSlideTypes.filter((type) => !templateMap[type]);
  const canNext = step === 0
    ? Boolean(sourceId && selectedBlueprints.length)
    : step === 1
      ? drafts.length > 0 && !missingTemplates.length
      : step < 4
        ? drafts.length > 0
        : false;
  const payload = { dataSourceId: sourceId, drafts, idempotencyKey };
  const firstDraft = drafts[0] ?? null;

  const toggleBlueprint = (key: SportlinkSlideBlueprintKey) => {
    const next = selectedBlueprints.includes(key)
      ? selectedBlueprints.filter((candidate) => candidate !== key)
      : [...selectedBlueprints, key];
    setSelectedBlueprints(next);
    setTeamSelections((current) => Object.fromEntries(Object.entries(current).map(([teamId, keys]) => [
      teamId,
      keys.filter((candidate) => next.includes(candidate))
    ])));
  };
  const toggleTeam = (team: Team) => {
    setTeamSelections((current) => ({
      ...current,
      [team.externalId]: current[team.externalId]?.length ? [] : [...selectedBlueprints]
    }));
    setTeamContexts((current) => ({ ...current, [team.externalId]: current[team.externalId] ?? initialContext(team) }));
  };
  const toggleMatrixCell = (team: Team, key: SportlinkSlideBlueprintKey) => {
    const current = teamSelections[team.externalId] ?? [];
    setTeamSelections((all) => ({
      ...all,
      [team.externalId]: current.includes(key)
        ? current.filter((candidate) => candidate !== key)
        : [...current, key]
    }));
    setTeamContexts((all) => ({ ...all, [team.externalId]: all[team.externalId] ?? initialContext(team) }));
  };

  return (
    <form action={action} className="slw">
      <input name="payload" type="hidden" value={JSON.stringify(payload)} />
      <header className="slw-progress">
        <ol aria-label="Voortgang">
          {steps.map((label, index) => (
            <li data-active={index === step || undefined} data-done={index < step || undefined} key={label}>
              <span>{index < step ? <Check aria-hidden="true" /> : index + 1}</span><b>{label}</b>
            </li>
          ))}
        </ol>
        <output aria-live="polite"><strong>{drafts.length}</strong> {drafts.length === 1 ? "slide geselecteerd" : "slides geselecteerd"}</output>
      </header>

      <div className="slw-layout">
        <section className="slw-panel">
          {step === 0 ? (
            <PurposeStep
              onSourceChange={(value) => { setSourceId(value); setTeamSelections({}); setTeamContexts({}); }}
              selected={selectedBlueprints}
              sourceId={sourceId}
              sources={sources}
              toggle={toggleBlueprint}
            />
          ) : null}
          {step === 1 ? (
            <TeamMatrix
              selectedBlueprints={selectedBlueprints}
              selections={teamSelections}
              teams={sourceTeams}
              toggleCell={toggleMatrixCell}
              toggleTeam={toggleTeam}
            />
          ) : null}
          {step === 2 ? (
            <CompetitionStep
              contextOverrides={contextOverrides}
              drafts={drafts}
              setContextOverrides={setContextOverrides}
              setTeamContexts={setTeamContexts}
              teamContexts={teamContexts}
              teams={selectedTeams}
            />
          ) : null}
          {step === 3 ? (
            <ThemeDisplayStep
              arrivalConfig={arrivalConfig}
              defaultThemeId={themeId(defaultThemeSelection)}
              display={display}
              drafts={drafts}
              media={media}
              orientation={orientation}
              setArrivalConfig={setArrivalConfig}
              setDisplay={setDisplay}
              setOrientation={setOrientation}
              setThemeOverrides={setThemeOverrides}
              setThemeSelection={setThemeSelection}
              themeOverrides={themeOverrides}
              themeSelection={themeSelection}
            />
          ) : null}
          {step === 4 ? <ReviewStep drafts={drafts} themeSelection={themeSelection} /> : null}
          {missingTemplates.length ? (
            <p className="notice notice--critical" role="alert">Voor {orientation === "portrait" ? "staand" : "liggend"} ontbreken gepubliceerde templates: {missingTemplates.join(", ")}.</p>
          ) : null}
        </section>

        <WizardPreview draft={firstDraft} orientation={orientation} selection={firstDraft?.themeSelection ?? themeSelection} />
      </div>

      <footer className="slw-actions">
        <Button disabled={step === 0} onClick={() => setStep((value) => value - 1)} type="button" variant="secondary">Vorige</Button>
        {step < 4 ? (
          <Button disabled={!canNext} onClick={() => setStep((value) => value + 1)} type="button">Volgende</Button>
        ) : (
          <Button disabled={!drafts.length || Boolean(missingTemplates.length)} type="submit">{drafts.length} {drafts.length === 1 ? "slide" : "slides"} aanmaken</Button>
        )}
      </footer>
      <WizardStyles />
    </form>
  );
}

function PurposeStep({ onSourceChange, selected, sourceId, sources, toggle }: {
  onSourceChange: (value: string) => void;
  selected: SportlinkSlideBlueprintKey[];
  sourceId: string;
  sources: Array<{ id: string; name: string }>;
  toggle: (key: SportlinkSlideBlueprintKey) => void;
}) {
  return (
    <>
      <StepHeading description="Kies één of meer soorten. In de volgende stap bepaal je per team welke combinaties worden aangemaakt." title="Wat wil je tonen?" />
      {sources.length > 1 ? <Field label="Sportlink-koppeling"><select onChange={(event) => onSourceChange(event.target.value)} value={sourceId}>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></Field> : null}
      {!sources.length ? <p className="notice notice--warning">Koppel en synchroniseer eerst Sportlink via Databronnen.</p> : null}
      <ChoiceGroup keys={clubKeys} label="Club" selected={selected} toggle={toggle} />
      <ChoiceGroup keys={teamPoolKeys} label="Teams & poules" selected={selected} toggle={toggle} />
    </>
  );
}

function ChoiceGroup({ keys, label, selected, toggle }: {
  keys: SportlinkSlideBlueprintKey[];
  label: string;
  selected: SportlinkSlideBlueprintKey[];
  toggle: (key: SportlinkSlideBlueprintKey) => void;
}) {
  return <section className="slw-choice-group"><h3>{label}</h3><div className="slw-card-grid">{keys.map((key) => {
    const blueprint = sportlinkSlideBlueprints[key];
    return <button aria-pressed={selected.includes(key)} key={key} onClick={() => toggle(key)} type="button"><LayoutGrid aria-hidden="true" /><span><strong>{shortBlueprintLabel(key)}</strong><small>{blueprint.window === "today" ? "Vandaag" : blueprint.window === "ranking" ? "Actuele stand" : blueprint.window === "live_window" ? "Rond aankomsttijd" : blueprint.window === "next_7_days" ? "Komende 7 dagen" : "Afgelopen 7 dagen"}</small></span>{selected.includes(key) ? <Check aria-hidden="true" /> : null}</button>;
  })}</div></section>;
}

function TeamMatrix({ selectedBlueprints, selections, teams, toggleCell, toggleTeam }: {
  selectedBlueprints: SportlinkSlideBlueprintKey[];
  selections: Record<string, SportlinkSlideBlueprintKey[]>;
  teams: Team[];
  toggleCell: (team: Team, key: SportlinkSlideBlueprintKey) => void;
  toggleTeam: (team: Team) => void;
}) {
  return (
    <>
      <StepHeading description="Vink per team de gewenste slides aan. Het totaal blijft bovenaan zichtbaar." title="Teams & slides" />
      <div className="slw-matrix" role="table" aria-label="Teams en slidetypen" style={{ "--matrix-columns": selectedBlueprints.length } as React.CSSProperties}>
        <div className="slw-matrix__head" role="row"><span role="columnheader">Team</span>{selectedBlueprints.map((key) => <span key={key} role="columnheader">{shortBlueprintLabel(key)}</span>)}</div>
        {teams.map((team) => {
          const selected = selections[team.externalId] ?? [];
          return <div className="slw-matrix__row" key={team.externalId} role="row"><button aria-pressed={selected.length > 0} onClick={() => toggleTeam(team)} type="button"><Users aria-hidden="true" /><strong>{team.name}</strong><small>{selected.length} slides</small></button>{selectedBlueprints.map((key) => <label key={key}><input checked={selected.includes(key)} onChange={() => toggleCell(team, key)} type="checkbox" /><span>{shortBlueprintLabel(key)}</span></label>)}</div>;
        })}
      </div>
      {!teams.length ? <p className="notice notice--warning">Er zijn nog geen gesynchroniseerde teams beschikbaar.</p> : null}
    </>
  );
}

function CompetitionStep({ contextOverrides, drafts, setContextOverrides, setTeamContexts, teamContexts, teams }: {
  contextOverrides: Record<string, SportlinkSlideContext>;
  drafts: SportlinkSlideDraft[];
  setContextOverrides: Dispatch<SetStateAction<Record<string, SportlinkSlideContext>>>;
  setTeamContexts: Dispatch<SetStateAction<Record<string, SportlinkSlideContext>>>;
  teamContexts: Record<string, SportlinkSlideContext>;
  teams: Team[];
}) {
  return (
    <>
      <StepHeading description="Kies één context per team en pas die automatisch toe. Alleen afwijkende slides hoef je individueel te openen." title="Competitie & poule" />
      <div className="slw-team-contexts">{teams.map((team) => {
        const teamDrafts = drafts.filter((draft) => draft.context.providerTeamId === team.externalId);
        const context = teamContexts[team.externalId] ?? initialContext(team);
        return <section key={team.externalId}><header><div><h3>{team.name}</h3><p>{teamDrafts.length} slides</p></div><span>Toegepast op alle {teamDrafts.length}</span></header><div className="slw-context-mode"><label><input checked={context.competitionSelectionMode === "auto_current"} onChange={() => setTeamContexts((all) => ({ ...all, [team.externalId]: { ...context, competitionId: null, competitionSelectionMode: "auto_current", phaseId: null, poolId: null, seasonId: null } }))} type="radio" /> <span><strong>Gebruik actuele competitie</strong><small>VeyoCast kiest automatisch de actieve fase en poule.</small></span></label><label><input checked={context.competitionSelectionMode === "pinned"} onChange={() => setTeamContexts((all) => ({ ...all, [team.externalId]: pinnedContext(team, context) }))} type="radio" /> <span><strong>Zelf competitie kiezen</strong><small>Ook geschikt voor beker of een eerdere fase.</small></span></label></div>{context.competitionSelectionMode === "pinned" ? <ContextSelect contexts={team.contexts} onChange={(next) => setTeamContexts((all) => ({ ...all, [team.externalId]: next }))} teamId={team.externalId} value={context} /> : null}<details><summary>Individueel aanpassen <ChevronDown aria-hidden="true" /></summary>{teamDrafts.map((draft) => { const key = draftKey(draft); const individual = contextOverrides[key] ?? context; return <div className="slw-individual-context" key={key}><strong>{shortBlueprintLabel(draft.blueprintKey)}</strong><select aria-label={`Context voor ${shortBlueprintLabel(draft.blueprintKey)}`} onChange={(event) => { if (event.target.value === "team") { setContextOverrides((all) => { const next = { ...all }; delete next[key]; return next; }); return; } const option = team.contexts[Number(event.target.value)]; if (option) setContextOverrides((all) => ({ ...all, [key]: contextFromOption(team.externalId, option) })); }} value={contextOverrides[key] ? String(Math.max(0, team.contexts.findIndex((option) => option.competitionId === individual.competitionId && option.poolId === individual.poolId))) : "team"}><option value="team">Teaminstelling gebruiken</option>{team.contexts.map((option, index) => <option key={`${option.competitionId}:${option.poolId}:${index}`} value={index}>{option.label}</option>)}</select></div>; })}</details></section>;
      })}</div>
    </>
  );
}

function ContextSelect({ contexts, onChange, teamId, value }: { contexts: TeamContext[]; onChange: (value: SportlinkSlideContext) => void; teamId: string; value: SportlinkSlideContext }) {
  const index = Math.max(0, contexts.findIndex((option) => option.competitionId === value.competitionId && option.poolId === value.poolId));
  return <Field label="Competitie · fase · poule"><select onChange={(event) => { const option = contexts[Number(event.target.value)]; if (option) onChange(contextFromOption(teamId, option)); }} value={index}>{contexts.map((option, optionIndex) => <option key={`${option.competitionId}:${option.poolId}:${optionIndex}`} value={optionIndex}>{option.label}</option>)}</select></Field>;
}

function ThemeDisplayStep({ arrivalConfig, defaultThemeId, display, drafts, media, orientation, setArrivalConfig, setDisplay, setOrientation, setThemeOverrides, setThemeSelection, themeOverrides, themeSelection }: {
  arrivalConfig: SportlinkArrivalConfig;
  defaultThemeId: SelectableThemeId;
  display: SportlinkDisplayConfig;
  drafts: SportlinkSlideDraft[];
  media: SportlinkMediaOption[];
  orientation: "landscape" | "portrait";
  setArrivalConfig: Dispatch<SetStateAction<SportlinkArrivalConfig>>;
  setDisplay: Dispatch<SetStateAction<SportlinkDisplayConfig>>;
  setOrientation: (value: "landscape" | "portrait") => void;
  setThemeOverrides: Dispatch<SetStateAction<Record<string, SelectableThemeId>>>;
  setThemeSelection: Dispatch<SetStateAction<ThemeSelection>>;
  themeOverrides: Record<string, SelectableThemeId>;
  themeSelection: ThemeSelection;
}) {
  const hasArrivals = drafts.some((draft) => draft.blueprintKey.endsWith("arrivals"));
  const hasFixtureInfo = drafts.some((draft) => ["sport_program", "sport_results", "sport_visitor_arrivals", "sport_referee_arrivals"].includes(sportlinkSlideBlueprints[draft.blueprintKey].slideType));
  return (
    <>
      <StepHeading description="Het verenigingsthema is voorgeselecteerd. Deze keuze wordt expliciet op iedere nieuwe versie opgeslagen." title="Thema & weergave" />
      <ThemePicker defaultThemeId={defaultThemeId} label="Thema voor deze slides" onChange={(id) => setThemeSelection((current) => withThemeId(current, id))} value={themeId(themeSelection)} />
      <section className="slw-display-section"><h3>Schermformaat</h3><div className="slw-format-grid">{(["landscape", "portrait"] as const).map((value) => <button aria-pressed={orientation === value} key={value} onClick={() => setOrientation(value)} type="button"><strong>{value === "portrait" ? "Staand" : "Liggend"}</strong><span>{value === "portrait" ? "1080 × 1920" : "1920 × 1080"}</span></button>)}</div></section>
      <section className="slw-display-section"><h3>Kolommen en wedstrijdinformatie</h3><div className="slw-inline-options"><label><input checked={display.columns === "two"} onChange={(event) => setDisplay((current) => ({ ...current, columns: event.target.checked ? "two" : "one" }))} type="checkbox" /> Twee kolommen {orientation === "portrait" ? "(aanbevolen voor staand)" : ""}</label>{hasFixtureInfo ? <><label><input checked={display.showHomeAway} onChange={(event) => setDisplay((current) => ({ ...current, showHomeAway: event.target.checked }))} type="checkbox" /> Thuis / uit tonen</label><label><input checked={display.showField} onChange={(event) => setDisplay((current) => ({ ...current, showField: event.target.checked }))} type="checkbox" /> Veld tonen</label><label><input checked={display.showDressingRoom} onChange={(event) => setDisplay((current) => ({ ...current, showDressingRoom: event.target.checked }))} type="checkbox" /> Kleedkamer tonen</label><label><input checked={display.showReferee} onChange={(event) => setDisplay((current) => ({ ...current, showReferee: event.target.checked }))} type="checkbox" /> Scheidsrechter tonen</label></> : <p>Voor een poulestand zijn alleen kolommen relevant.</p>}</div></section>
      {hasArrivals ? <section className="slw-display-section"><h3>Bezoekers en scheidsrechters</h3><SportlinkArrivalFields media={media} onChange={setArrivalConfig} value={arrivalConfig} /></section> : null}
      <details className="slw-theme-overrides"><summary>Individueel thema aanpassen <ChevronDown aria-hidden="true" /></summary>{drafts.map((draft) => { const key = draftKey(draft); return <label key={key}><span>{draft.name}</span><select onChange={(event) => setThemeOverrides((all) => { const next = { ...all }; const value = selectableThemeIdSchema.safeParse(event.target.value); if (!value.success || value.data === themeId(themeSelection)) delete next[key]; else next[key] = value.data; return next; })} value={themeOverrides[key] ?? themeId(themeSelection)}>{themeCatalogOptions.map((option) => <option key={option.id} value={option.id}>{option.name}{option.id === themeId(themeSelection) ? " · voor alle slides" : ""}</option>)}</select></label>; })}</details>
    </>
  );
}

function ReviewStep({ drafts, themeSelection }: { drafts: SportlinkSlideDraft[]; themeSelection: ThemeSelection }) {
  const groups = drafts.reduce<Record<string, SportlinkSlideDraft[]>>((result, draft) => {
    (result[draft.context.providerTeamId] ??= []).push(draft);
    return result;
  }, {});
  return <><StepHeading description="Controleer de leesbare samenvatting. Technische provider-ID's worden niet getoond." title={`${drafts.length} ${drafts.length === 1 ? "slide wordt" : "slides worden"} aangemaakt`} /><div className="slw-review-groups">{Object.entries(groups).map(([teamId, teamDrafts]) => <section key={teamId}><h3>{teamDrafts[0]?.name.split(" · ")[0]}</h3><ul>{teamDrafts.map((draft) => <li key={draftKey(draft)}><Check aria-hidden="true" /><span><strong>{shortBlueprintLabel(draft.blueprintKey)}</strong><small>{draft.context.competitionSelectionMode === "auto_current" ? "Actuele competitie" : contextLabel(draft.context)}</small></span><em>{themeCatalog[themeId(draft.themeSelection)].name}</em></li>)}</ul></section>)}</div><dl className="slw-review-summary"><div><dt>Standaardthema</dt><dd>{themeCatalog[themeId(themeSelection)].name}</dd></div><div><dt>Formaten</dt><dd>{[...new Set(drafts.map((draft) => draft.orientation === "portrait" ? "Staand" : "Liggend"))].join(", ")}</dd></div></dl></>;
}

function WizardPreview({ draft, orientation, selection }: { draft: SportlinkSlideDraft | null; orientation: "landscape" | "portrait"; selection: ThemeSelection }) {
  const definition = themeCatalog[themeId(selection)];
  const palette = definition.light;
  return <aside className="slw-preview"><header><Eye aria-hidden="true" /><span><strong>Live stijlpreview</strong><small>{orientation === "portrait" ? "Staand" : "Liggend"}</small></span></header><div className="slw-preview__viewport" data-orientation={orientation} style={{ "--preview-accent": selection.accent ?? definition.accentDefault, "--preview-canvas": palette.canvas, "--preview-line": palette.line, "--preview-muted": palette.muted, "--preview-surface": palette.surface, "--preview-text": palette.text } as React.CSSProperties}><span>SPORTLINK</span><h2>{draft ? shortBlueprintLabel(draft.blueprintKey) : "Kies je slides"}</h2><p>{draft?.name.split(" · ")[0] ?? "Je eerste selectie verschijnt hier."}</p><div><i /><i /><i /></div><footer>{definition.name}</footer></div><p>Na aanmaken vult VeyoCast deze preview met de actuele providerdata. Er worden geen voorbeeldscores verzonnen.</p></aside>;
}

function StepHeading({ description, title }: { description: string; title: string }) { return <div className="slw-heading"><h2>{title}</h2><p>{description}</p></div>; }
function initialContext(team: Team): SportlinkSlideContext { const first = team.contexts[0]; return first ? contextFromOption(team.externalId, first) : { competitionId: null, competitionSelectionMode: "auto_current", phaseId: null, poolId: null, providerTeamId: team.externalId, seasonId: null }; }
function pinnedContext(team: Team, current: SportlinkSlideContext) { return team.contexts.length ? contextFromOption(team.externalId, team.contexts.find((option) => option.competitionId === current.competitionId) ?? team.contexts[0]!) : { ...current, competitionSelectionMode: "auto_current" as const }; }
function contextFromOption(teamId: string, option: TeamContext): SportlinkSlideContext { return { competitionId: option.competitionId, competitionSelectionMode: "pinned", phaseId: option.phaseId, poolId: option.poolId, providerTeamId: teamId, seasonId: option.seasonId }; }
function contextLabel(context: SportlinkSlideContext) { return [context.seasonId, context.competitionId, context.phaseId, context.poolId].filter(Boolean).join(" · ") || "Handmatig gekozen"; }
function themeId(selection: ThemeSelection): SelectableThemeId { return selection.ref.catalog === "v2" ? selection.ref.id : "editorial"; }
function withThemeId(selection: ThemeSelection, id: SelectableThemeId): ThemeSelection { return { ...selection, ref: { catalog: "v2", id, version: themeCatalog[id].version } }; }
function draftKey(draft: SportlinkSlideDraft) { return `${draft.context.providerTeamId}:${draft.blueprintKey}`; }
function shortBlueprintLabel(key: SportlinkSlideBlueprintKey) { const labels: Record<SportlinkSlideBlueprintKey, string> = { "sportlink.club_schedule_today": "Programma vandaag", "sportlink.club_schedule_next_7_days": "Programma komende 7 dagen", "sportlink.club_results_today": "Uitslagen vandaag", "sportlink.club_results_previous_7_days": "Uitslagen afgelopen 7 dagen", "sportlink.pool_schedule_next_7_days": "Programma poule", "sportlink.pool_results_previous_7_days": "Uitslagen poule", "sportlink.pool_standings": "Poulestand", "sportlink.visitor_arrivals": "Bezoekers welkom", "sportlink.referee_arrivals": "Scheidsrechters welkom" }; return labels[key]; }

function WizardStyles() {
  return <style>{`.slw{display:grid;gap:1rem}.slw-progress{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.75rem 1rem;background:color-mix(in srgb,var(--surface) 96%,transparent);border:1px solid var(--border);border-radius:12px;backdrop-filter:blur(8px)}.slw-progress ol{display:flex;gap:.65rem;min-width:0;margin:0;padding:0;overflow:auto;list-style:none}.slw-progress li{display:flex;align-items:center;gap:.35rem;min-width:max-content;color:var(--muted-foreground);font-size:.78rem}.slw-progress li>span{display:grid;place-items:center;width:26px;height:26px;border:1px solid var(--border);border-radius:50%}.slw-progress li svg{width:14px}.slw-progress li[data-active]{color:var(--foreground)}.slw-progress li[data-active]>span,.slw-progress li[data-done]>span{color:var(--accent-foreground);background:var(--accent);border-color:var(--accent)}.slw-progress output{display:flex;align-items:baseline;gap:.3rem;min-width:max-content;padding:.45rem .65rem;background:var(--accent-soft);border-radius:8px;font-size:.82rem}.slw-progress output strong{font-size:1.1rem}.slw-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(270px,34%);gap:1rem;align-items:start}.slw-panel{display:grid;gap:1.25rem;min-height:520px;padding:1.35rem;background:var(--surface);border:1px solid var(--border);border-radius:12px}.slw-heading h2{margin:0}.slw-heading p{max-width:68ch;margin:.35rem 0 0;color:var(--muted-foreground)}.slw-choice-group{display:grid;gap:.6rem}.slw-choice-group h3,.slw-display-section h3{margin:0;font-size:.9rem;text-transform:uppercase;letter-spacing:.05em}.slw-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.6rem}.slw-card-grid button{position:relative;display:grid;grid-template-columns:24px 1fr;gap:.65rem;min-height:76px;padding:.8rem;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:10px}.slw-card-grid button[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent)}.slw-card-grid button>svg:last-child{position:absolute;right:.65rem;top:.65rem;color:var(--accent)}.slw-card-grid span{display:grid;gap:.2rem}.slw-card-grid small{color:var(--muted-foreground)}.slw-matrix{display:grid;overflow:auto;border:1px solid var(--border);border-radius:10px}.slw-matrix__head,.slw-matrix__row{display:grid;grid-template-columns:minmax(180px,1.35fr) repeat(var(--matrix-columns,6),minmax(116px,1fr));min-width:850px}.slw-matrix__head{position:sticky;top:0;background:var(--surface-subtle)}.slw-matrix__head span{padding:.65rem;border-right:1px solid var(--border);font-size:.75rem}.slw-matrix__row{border-top:1px solid var(--border)}.slw-matrix__row>button{display:grid;grid-template-columns:20px 1fr;align-items:center;gap:.5rem;padding:.65rem;text-align:left;background:transparent;border:0;border-right:1px solid var(--border)}.slw-matrix__row>button small{grid-column:2;color:var(--muted-foreground)}.slw-matrix__row>label{display:grid;place-items:center;gap:.25rem;min-height:64px;padding:.45rem;border-right:1px solid var(--border)}.slw-matrix__row>label span{display:none}.slw-team-contexts{display:grid;gap:.75rem}.slw-team-contexts>section{display:grid;gap:.8rem;padding:1rem;border:1px solid var(--border);border-radius:10px}.slw-team-contexts header{display:flex;justify-content:space-between;gap:1rem}.slw-team-contexts h3,.slw-team-contexts p{margin:0}.slw-team-contexts header>span{align-self:start;padding:.25rem .45rem;background:var(--accent-soft);border-radius:6px;font-size:.75rem}.slw-context-mode{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}.slw-context-mode label{display:flex;gap:.55rem;padding:.7rem;border:1px solid var(--border);border-radius:8px}.slw-context-mode label span{display:grid}.slw-context-mode small{color:var(--muted-foreground)}.slw details summary{display:flex;align-items:center;gap:.3rem;min-height:44px;cursor:pointer;font-weight:700}.slw details summary svg{width:16px}.slw-individual-context,.slw-theme-overrides label{display:grid;grid-template-columns:minmax(150px,1fr) minmax(190px,1fr);align-items:center;gap:.75rem;padding:.5rem 0;border-top:1px solid var(--border)}.slw-display-section{display:grid;gap:.65rem;padding-top:1rem;border-top:1px solid var(--border)}.slw-format-grid{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}.slw-format-grid button{display:grid;gap:.2rem;min-height:64px;background:var(--surface);border:1px solid var(--border);border-radius:8px}.slw-format-grid button[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent)}.slw-inline-options{display:flex;flex-wrap:wrap;gap:.5rem}.slw-inline-options label{display:flex;align-items:center;gap:.4rem;min-height:44px;padding:.5rem .65rem;border:1px solid var(--border);border-radius:8px}.slw-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.slw-theme-overrides{padding:.5rem .75rem;border:1px solid var(--border);border-radius:8px}.slw-preview{position:sticky;top:88px;display:grid;gap:.75rem;padding:1rem;background:var(--surface);border:1px solid var(--border);border-radius:12px}.slw-preview>header{display:flex;align-items:center;gap:.55rem}.slw-preview>header span{display:grid}.slw-preview>header small,.slw-preview>p{color:var(--muted-foreground);font-size:.78rem}.slw-preview__viewport{display:flex;flex-direction:column;aspect-ratio:16/9;padding:8%;overflow:hidden;color:var(--preview-text);background:var(--preview-canvas);border:1px solid var(--preview-line);border-radius:8px}.slw-preview__viewport[data-orientation=portrait]{width:min(75%,230px);justify-self:center;aspect-ratio:9/16}.slw-preview__viewport>span{color:var(--preview-accent);font-size:.55rem;font-weight:800;letter-spacing:.12em}.slw-preview__viewport h2{margin:.35rem 0 .2rem;font-size:clamp(.9rem,2vw,1.45rem)}.slw-preview__viewport p{margin:0;color:var(--preview-muted);font-size:.65rem}.slw-preview__viewport>div{display:grid;gap:.35rem;margin-top:1rem}.slw-preview__viewport i{display:block;height:1.15rem;background:var(--preview-surface);border-left:3px solid var(--preview-accent);border-radius:3px}.slw-preview__viewport footer{margin-top:auto;padding-top:.5rem;border-top:1px solid var(--preview-line);font-size:.5rem}.slw-review-groups{display:grid;gap:.75rem}.slw-review-groups section{padding:.8rem;border:1px solid var(--border);border-radius:8px}.slw-review-groups h3{margin:0 0 .5rem}.slw-review-groups ul{display:grid;gap:.35rem;margin:0;padding:0;list-style:none}.slw-review-groups li{display:grid;grid-template-columns:20px 1fr auto;align-items:center;gap:.5rem;padding:.4rem 0;border-top:1px solid var(--border)}.slw-review-groups li span{display:grid}.slw-review-groups small{color:var(--muted-foreground)}.slw-review-groups em{font-style:normal;font-size:.8rem}.slw-review-summary{display:flex;gap:1rem}.slw-review-summary div{display:grid}.slw-review-summary dt{color:var(--muted-foreground);font-size:.75rem}.slw-review-summary dd{margin:0;font-weight:700}.slw-actions{position:sticky;bottom:0;z-index:20;display:flex;justify-content:space-between;padding:.75rem;background:color-mix(in srgb,var(--surface) 96%,transparent);border:1px solid var(--border);border-radius:10px;backdrop-filter:blur(8px)}@media(max-width:900px){.slw-layout{grid-template-columns:1fr}.slw-preview{position:relative;top:auto;order:-1}.slw-preview__viewport{max-height:260px}.slw-progress li b{display:none}}@media(max-width:640px){.slw-panel{padding:1rem}.slw-progress{align-items:flex-start}.slw-progress output{font-size:0}.slw-progress output strong{font-size:1rem}.slw-progress output strong:after{content:' geselecteerd';font-size:.72rem;font-weight:500}.slw-matrix{border:0;overflow:visible}.slw-matrix__head{display:none}.slw-matrix__row{display:grid;min-width:0;margin-bottom:.75rem;border:1px solid var(--border);border-radius:8px}.slw-matrix__row>button{border-right:0;border-bottom:1px solid var(--border)}.slw-matrix__row>label{display:flex;justify-content:flex-start;min-height:44px;border-right:0;border-bottom:1px solid var(--border)}.slw-matrix__row>label span{display:block}.slw-context-mode,.slw-fields{grid-template-columns:1fr}.slw-individual-context,.slw-theme-overrides label{grid-template-columns:1fr}.slw-review-groups li{grid-template-columns:20px 1fr}.slw-review-groups em{grid-column:2}.slw-preview__viewport[data-orientation=portrait]{max-height:360px}.slw-actions{padding-bottom:calc(.75rem + env(safe-area-inset-bottom))}}`}</style>;
}
