"use client";

import Link from "next/link";
import {
  Check,
  ChevronDown,
  Eye,
  LayoutGrid,
  Search,
  Users,
  X
} from "lucide-react";
import {
  useId,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";

import {
  sportlinkArrivalConfigSchema,
  sportlinkSlideBlueprints,
  sportlinkSlideBatchMaxDrafts,
  sportlinkSlideTeamContextsMax,
  type SelectableThemeId,
  type SportlinkArrivalConfig,
  type SportlinkDisplayConfig,
  type SportlinkSlideBlueprintKey,
  type SportlinkSlideContext,
  type SportlinkSlideDraft,
  type ThemeSelection
} from "@veyocast/contracts";
import { themeCatalog } from "@veyocast/content-templates/theme-catalog";
import { buildSportlinkSlideDrafts } from "@veyocast/domain";
import { Button, Field, JourneyShell, StatusPill } from "@veyocast/ui";

import { FieldFlowStyleStep } from "../../../slides/_components/fieldflow-style-step";
import {
  SportlinkArrivalFields,
  type SportlinkMediaOption
} from "../../../slides/_components/sportlink-arrival-fields";
import styles from "./sportlink-bulk-wizard.module.css";

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

type Template = {
  orientation: string;
  slideType: string;
  versionId: string;
};

const steps = [
  "Inhoud kiezen",
  "Teams selecteren",
  "Competitie instellen",
  "Stijl en weergave",
  "Controleren"
] as const;
const blueprintKeys = Object.keys(
  sportlinkSlideBlueprints
) as SportlinkSlideBlueprintKey[];
const arrivalKeys = blueprintKeys.filter(isArrivalKey);
const regularKeys = blueprintKeys.filter((key) => !isArrivalKey(key));

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
  const [selectedBlueprints, setSelectedBlueprints] = useState<
    SportlinkSlideBlueprintKey[]
  >([]);
  const [teamSelections, setTeamSelections] = useState<
    Record<string, SportlinkSlideBlueprintKey[]>
  >({});
  const [arrivalSelections, setArrivalSelections] = useState<
    Partial<Record<SportlinkSlideBlueprintKey, string[]>>
  >({});
  const [teamContexts, setTeamContexts] = useState<
    Record<string, SportlinkSlideContext>
  >({});
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(
    "landscape"
  );
  const [themeSelection, setThemeSelection] = useState(() =>
    withThemeId(defaultThemeSelection, "fieldflow")
  );
  const [display, setDisplay] = useState<SportlinkDisplayConfig>({
    columns: "two",
    showDressingRoom: false,
    showField: true,
    showHomeAway: true,
    showReferee: false
  });
  const [arrivalConfig, setArrivalConfig] = useState<SportlinkArrivalConfig>(
    () => sportlinkArrivalConfigSchema.parse({})
  );
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const sourceTeams = useMemo(
    () => teams.filter((team) => team.dataSourceId === sourceId),
    [sourceId, teams]
  );
  const sourceTeamById = useMemo(
    () => new Map(sourceTeams.map((team) => [team.externalId, team])),
    [sourceTeams]
  );
  const templateMap = useMemo(
    () => Object.fromEntries(
      templates
        .filter((template) => template.orientation === orientation)
        .map((template) => [template.slideType, template.versionId])
    ),
    [orientation, templates]
  );

  const selectedTeamIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [teamId, keys] of Object.entries(teamSelections)) {
      if (keys.some((key) => selectedBlueprints.includes(key))) ids.add(teamId);
    }
    for (const key of arrivalKeys) {
      if (!selectedBlueprints.includes(key)) continue;
      for (const teamId of arrivalSelections[key] ?? []) ids.add(teamId);
    }
    return sourceTeams
      .filter((team) => ids.has(team.externalId))
      .map((team) => team.externalId);
  }, [arrivalSelections, selectedBlueprints, sourceTeams, teamSelections]);

  const selectedTeams = selectedTeamIds.flatMap((teamId) => {
    const team = sourceTeamById.get(teamId);
    return team ? [team] : [];
  });

  const drafts = useMemo(() => {
    try {
      const regularDrafts = sourceTeams.flatMap((team) => {
        const keys = (teamSelections[team.externalId] ?? []).filter(
          (key) => selectedBlueprints.includes(key) && !isArrivalKey(key)
        );
        if (!keys.length) return [];
        return buildSportlinkSlideDrafts({
          blueprintKeys: keys,
          orientation,
          teams: [{
            context: teamContexts[team.externalId] ?? initialContext(team),
            name: team.name
          }],
          templateVersionIdBySlideType: templateMap,
          themeSelection
        });
      });
      const aggregateArrivalDrafts = arrivalKeys.flatMap((key) => {
        if (!selectedBlueprints.includes(key)) return [];
        const selected = (arrivalSelections[key] ?? []).flatMap((teamId) => {
          const team = sourceTeamById.get(teamId);
          return team ? [{
            context: teamContexts[teamId] ?? initialContext(team),
            name: team.name
          }] : [];
        });
        if (!selected.length) return [];
        return buildSportlinkSlideDrafts({
          blueprintKeys: [key],
          orientation,
          teams: selected,
          templateVersionIdBySlideType: templateMap,
          themeSelection
        });
      });
      return [...regularDrafts, ...aggregateArrivalDrafts].map((draft) => ({
        ...draft,
        arrival: isArrivalKey(draft.blueprintKey) ? arrivalConfig : undefined,
        display,
        themeSelection
      }));
    } catch {
      return [];
    }
  }, [
    arrivalConfig,
    arrivalSelections,
    display,
    orientation,
    selectedBlueprints,
    sourceTeamById,
    sourceTeams,
    teamContexts,
    teamSelections,
    templateMap,
    themeSelection
  ]);

  const requiredSlideTypes = [
    ...new Set(
      selectedBlueprints.map((key) => sportlinkSlideBlueprints[key].slideType)
    )
  ];
  const missingTemplates = requiredSlideTypes.filter(
    (type) => !templateMap[type]
  );
  const everyPurposeHasTeams = selectedBlueprints.every((key) =>
    isArrivalKey(key)
      ? (arrivalSelections[key]?.length ?? 0) > 0
      : sourceTeams.some((team) =>
          (teamSelections[team.externalId] ?? []).includes(key)
        )
  );
  const batchTooLarge = drafts.length > sportlinkSlideBatchMaxDrafts;
  const canNext = step === 0
    ? Boolean(sourceId && selectedBlueprints.length)
    : step === 1
      ? everyPurposeHasTeams && drafts.length > 0 && !batchTooLarge && !missingTemplates.length
      : step < 4
        ? drafts.length > 0 && !batchTooLarge
        : false;
  const payload = { dataSourceId: sourceId, drafts, idempotencyKey };
  const firstDraft = drafts[0] ?? null;

  function resetSource(nextSourceId: string) {
    setSourceId(nextSourceId);
    setTeamSelections({});
    setArrivalSelections({});
    setTeamContexts({});
  }

  function toggleBlueprint(key: SportlinkSlideBlueprintKey) {
    const selected = selectedBlueprints.includes(key);
    setSelectedBlueprints((current) => selected
      ? current.filter((candidate) => candidate !== key)
      : [...current, key]
    );
    if (!selected) return;
    if (isArrivalKey(key)) {
      setArrivalSelections((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    setTeamSelections((current) => Object.fromEntries(
      Object.entries(current).map(([teamId, keys]) => [
        teamId,
        keys.filter((candidate) => candidate !== key)
      ])
    ));
  }

  function updateArrivalSelection(
    key: SportlinkSlideBlueprintKey,
    teamIds: string[]
  ) {
    const validIds = sourceTeams
      .filter((team) => teamIds.includes(team.externalId))
      .map((team) => team.externalId)
      .slice(0, sportlinkSlideTeamContextsMax);
    setArrivalSelections((current) => ({ ...current, [key]: validIds }));
    setTeamContexts((current) => {
      const next = { ...current };
      for (const teamId of validIds) {
        const team = sourceTeamById.get(teamId);
        if (team && !next[teamId]) next[teamId] = initialContext(team);
      }
      return next;
    });
  }

  function toggleTeam(team: Team) {
    const available = selectedBlueprints.filter((key) => !isArrivalKey(key));
    const selected = teamSelections[team.externalId] ?? [];
    const allSelected = available.length > 0 && available.every((key) =>
      selected.includes(key)
    );
    setTeamSelections((current) => ({
      ...current,
      [team.externalId]: allSelected ? [] : available
    }));
    setTeamContexts((current) => ({
      ...current,
      [team.externalId]: current[team.externalId] ?? initialContext(team)
    }));
  }

  function toggleMatrixCell(team: Team, key: SportlinkSlideBlueprintKey) {
    const current = teamSelections[team.externalId] ?? [];
    setTeamSelections((all) => ({
      ...all,
      [team.externalId]: current.includes(key)
        ? current.filter((candidate) => candidate !== key)
        : [...current, key]
    }));
    setTeamContexts((all) => ({
      ...all,
      [team.externalId]: all[team.externalId] ?? initialContext(team)
    }));
  }

  return (
    <form action={action} className={styles.wizard}>
      <input name="payload" type="hidden" value={JSON.stringify(payload)} />
      <JourneyShell
        actions={(
          <Button asChild variant="secondary">
            <Link href="/dashboard/studio/new">Annuleren</Link>
          </Button>
        )}
        aside={(
          <WizardPreview
            draft={firstDraft}
            orientation={orientation}
            selection={firstDraft?.themeSelection ?? themeSelection}
          />
        )}
        currentStep={String(step)}
        description={(
          <>
            <strong>{drafts.length}</strong>{" "}
            {drafts.length === 1 ? "gekoppeld onderdeel" : "gekoppelde onderdelen"}
            {selectedTeamIds.length
              ? ` voor ${selectedTeamIds.length} ${selectedTeamIds.length === 1 ? "team" : "teams"}`
              : ""}.
          </>
        )}
        eyebrow={`Studio · stap ${step + 1} van ${steps.length}`}
        steps={steps.map((label, index) => ({ id: String(index), label }))}
        title={steps[step]}
      >
        <section className={styles.panel}>
          {step === 0 ? (
            <PurposeStep
              onSourceChange={resetSource}
              selected={selectedBlueprints}
              sourceId={sourceId}
              sources={sources}
              toggle={toggleBlueprint}
            />
          ) : null}
          {step === 1 ? (
            <TeamStep
              arrivalSelections={arrivalSelections}
              selectedBlueprints={selectedBlueprints}
              selections={teamSelections}
              teams={sourceTeams}
              toggleCell={toggleMatrixCell}
              toggleTeam={toggleTeam}
              updateArrivalSelection={updateArrivalSelection}
            />
          ) : null}
          {step === 2 ? (
            <CompetitionStep
              setTeamContexts={setTeamContexts}
              teamContexts={teamContexts}
              teams={selectedTeams}
              usage={(teamId) => selectedBlueprints.filter((key) =>
                isArrivalKey(key)
                  ? (arrivalSelections[key] ?? []).includes(teamId)
                  : (teamSelections[teamId] ?? []).includes(key)
              )}
            />
          ) : null}
          {step === 3 ? (
            <ThemeDisplayStep
              arrivalConfig={arrivalConfig}
              display={display}
              drafts={drafts}
              media={media}
              orientation={orientation}
              setArrivalConfig={setArrivalConfig}
              setDisplay={setDisplay}
              setOrientation={setOrientation}
              setThemeSelection={setThemeSelection}
              themeSelection={themeSelection}
            />
          ) : null}
          {step === 4 ? (
            <ReviewStep
              drafts={drafts}
              teamName={(teamId) => sourceTeamById.get(teamId)?.name ?? teamId}
              themeSelection={themeSelection}
            />
          ) : null}
          {missingTemplates.length ? (
            <p className="notice notice--critical" role="alert">
              Voor {orientation === "portrait" ? "staand" : "liggend"} ontbreken
              gepubliceerde templates: {missingTemplates.join(", ")}.
            </p>
          ) : null}
          {batchTooLarge ? (
            <p className="notice notice--critical" role="alert">
              Deze selectie maakt {drafts.length} onderdelen. Kies maximaal {sportlinkSlideBatchMaxDrafts} onderdelen per batch; welkomstcomponenten tellen elk maar één keer mee.
            </p>
          ) : null}
        </section>
      </JourneyShell>

      <footer className={styles.actions}>
        <div>
          <span>Stap {step + 1} van {steps.length}</span>
          <strong>{drafts.length} {drafts.length === 1 ? "onderdeel" : "onderdelen"}</strong>
        </div>
        <div>
          <Button
            disabled={step === 0}
            onClick={() => setStep((value) => value - 1)}
            type="button"
            variant="secondary"
          >
            Vorige
          </Button>
          {step < 4 ? (
            <Button
              disabled={!canNext}
              onClick={() => setStep((value) => value + 1)}
              type="button"
            >
              Volgende
            </Button>
          ) : (
            <Button
              disabled={!drafts.length || batchTooLarge || Boolean(missingTemplates.length)}
              type="submit"
            >
              {drafts.length} {drafts.length === 1 ? "onderdeel" : "onderdelen"} aanmaken
            </Button>
          )}
        </div>
      </footer>
    </form>
  );
}

function PurposeStep({
  onSourceChange,
  selected,
  sourceId,
  sources,
  toggle
}: {
  onSourceChange: (value: string) => void;
  selected: SportlinkSlideBlueprintKey[];
  sourceId: string;
  sources: Array<{ id: string; name: string }>;
  toggle: (key: SportlinkSlideBlueprintKey) => void;
}) {
  return (
    <>
      <StepHeading
        description="Kies één of meer dynamische onderdelen. Welkomstcontent blijft één gekoppeld component, ook wanneer je veel teams selecteert."
        eyebrow="Samenstellen"
        title="Wat wil je op de schermen laten zien?"
      />
      {sources.length > 1 ? (
        <Field label="Sportlink-koppeling">
          {({ controlProps }) => (
            <select
              {...controlProps}
              onChange={(event) => onSourceChange(event.target.value)}
              value={sourceId}
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>{source.name}</option>
              ))}
            </select>
          )}
        </Field>
      ) : null}
      {!sources.length ? (
        <p className="notice notice--warning">
          Koppel en synchroniseer eerst Sportlink via Databronnen.
        </p>
      ) : null}
      <ChoiceGroup
        description="Eén gekoppeld component dat automatisch over de geselecteerde teams en pagina’s wisselt."
        keys={arrivalKeys}
        label="Welkom bij de club"
        selected={selected}
        toggle={toggle}
      />
      <ChoiceGroup
        description="Programma’s, uitslagen en standen met een eigen teamcontext."
        keys={regularKeys}
        label="Wedstrijden en poules"
        selected={selected}
        toggle={toggle}
      />
    </>
  );
}

function ChoiceGroup({
  description,
  keys,
  label,
  selected,
  toggle
}: {
  description: string;
  keys: SportlinkSlideBlueprintKey[];
  label: string;
  selected: SportlinkSlideBlueprintKey[];
  toggle: (key: SportlinkSlideBlueprintKey) => void;
}) {
  return (
    <section className={styles.choiceGroup}>
      <header><div><h3>{label}</h3><p>{description}</p></div></header>
      <div className={styles.cardGrid}>
        {keys.map((key) => {
          const blueprint = sportlinkSlideBlueprints[key];
          const active = selected.includes(key);
          return (
            <button
              aria-pressed={active}
              key={key}
              onClick={() => toggle(key)}
              type="button"
            >
              <span className={styles.choiceIcon}><LayoutGrid aria-hidden="true" /></span>
              <span>
                <strong>{shortBlueprintLabel(key)}</strong>
                <small>{windowLabel(blueprint.window)}</small>
              </span>
              <span className={styles.choiceCheck} aria-hidden="true">
                {active ? <Check /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TeamStep({
  arrivalSelections,
  selectedBlueprints,
  selections,
  teams,
  toggleCell,
  toggleTeam,
  updateArrivalSelection
}: {
  arrivalSelections: Partial<Record<SportlinkSlideBlueprintKey, string[]>>;
  selectedBlueprints: SportlinkSlideBlueprintKey[];
  selections: Record<string, SportlinkSlideBlueprintKey[]>;
  teams: Team[];
  toggleCell: (team: Team, key: SportlinkSlideBlueprintKey) => void;
  toggleTeam: (team: Team) => void;
  updateArrivalSelection: (
    key: SportlinkSlideBlueprintKey,
    teamIds: string[]
  ) => void;
}) {
  const selectedArrivalKeys = selectedBlueprints.filter(isArrivalKey);
  const selectedRegularKeys = selectedBlueprints.filter(
    (key) => !isArrivalKey(key)
  );
  return (
    <>
      <StepHeading
        description="Zoek teams, voeg ze in één keer toe en verwijder uitzonderingen als tag. Een welkomsttype blijft altijd één component."
        eyebrow="Selectie"
        title="Welke teams horen erbij?"
      />
      {selectedArrivalKeys.map((key) => (
        <TeamMultiSelect
          key={key}
          label={shortBlueprintLabel(key)}
          onChange={(teamIds) => updateArrivalSelection(key, teamIds)}
          selectedIds={arrivalSelections[key] ?? []}
          teams={teams}
        />
      ))}
      {selectedRegularKeys.length ? (
        <TeamMatrix
          selectedBlueprints={selectedRegularKeys}
          selections={selections}
          teams={teams}
          toggleCell={toggleCell}
          toggleTeam={toggleTeam}
        />
      ) : null}
      {!teams.length ? (
        <p className="notice notice--warning">
          Er zijn nog geen gesynchroniseerde teams beschikbaar.
        </p>
      ) : null}
    </>
  );
}

function TeamMultiSelect({ label, onChange, selectedIds, teams }: {
  label: string;
  onChange: (teamIds: string[]) => void;
  selectedIds: string[];
  teams: Team[];
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("nl-NL");
  const filteredTeams = teams.filter((team) =>
    !normalizedQuery || team.name.toLocaleLowerCase("nl-NL").includes(normalizedQuery)
  );
  const selectableTeams = teams.slice(0, sportlinkSlideTeamContextsMax);
  const allSelected = selectableTeams.length > 0 &&
    selectableTeams.every((team) => selectedIds.includes(team.externalId));
  const selectionLimitReached = selectedIds.length >= sportlinkSlideTeamContextsMax;
  const selectedTeams = teams.filter((team) => selectedIds.includes(team.externalId));

  function toggle(teamId: string) {
    onChange(selectedIds.includes(teamId)
      ? selectedIds.filter((candidate) => candidate !== teamId)
      : [...selectedIds, teamId]
    );
  }

  return (
    <section className={styles.teamPicker} aria-labelledby={`${inputId}-title`}>
      <header>
        <div>
          <span className={styles.kicker}>Gekoppeld welkomstcomponent</span>
          <h3 id={`${inputId}-title`}>{label}</h3>
          <p>Selecteer alle teams die dit component automatisch mag vullen.</p>
        </div>
        <StatusPill
          label={`${selectedIds.length}/${teams.length} teams`}
          tone={selectedIds.length ? "success" : "neutral"}
        />
      </header>
      <div className={styles.tags} aria-live="polite">
        {selectedTeams.map((team) => (
          <button
            aria-label={`${team.name} verwijderen`}
            key={team.externalId}
            onClick={() => toggle(team.externalId)}
            type="button"
          >
            <span>{team.name}</span><X aria-hidden="true" />
          </button>
        ))}
        {!selectedTeams.length ? <p>Kies minimaal één team.</p> : null}
      </div>
      <details className={styles.teamDropdown}>
        <summary>
          <span><Users aria-hidden="true" />Teams toevoegen</span>
          <span>{selectedIds.length ? `${selectedIds.length} geselecteerd` : "Maak een selectie"}</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className={styles.teamDropdownPanel}>
          <label className={styles.searchField} htmlFor={inputId}>
            <Search aria-hidden="true" />
            <span className="sr-only">Zoek een team</span>
            <input
              autoComplete="off"
              id={inputId}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek op teamnaam"
              type="search"
              value={query}
            />
          </label>
          <button
            aria-pressed={allSelected}
            className={styles.selectAll}
            onClick={() => onChange(allSelected
              ? []
              : selectableTeams.map((team) => team.externalId)
            )}
            type="button"
          >
            <span className={styles.checkboxVisual}>{allSelected ? <Check aria-hidden="true" /> : null}</span>
            <span>
              <strong>{teams.length > sportlinkSlideTeamContextsMax
                ? `Eerste ${sportlinkSlideTeamContextsMax} teams`
                : "Alle teams"}</strong>
              <small>{teams.length > sportlinkSlideTeamContextsMax
                ? `Een gekoppeld onderdeel ondersteunt maximaal ${sportlinkSlideTeamContextsMax} teams. Verfijn de selectie indien nodig.`
                : "Vult de selectie automatisch met alle huidige teams."}</small>
            </span>
          </button>
          <div className={styles.teamOptions} role="group" aria-label="Beschikbare teams">
            {filteredTeams.map((team) => (
              <label key={team.externalId}>
                <input
                  checked={selectedIds.includes(team.externalId)}
                  disabled={selectionLimitReached && !selectedIds.includes(team.externalId)}
                  onChange={() => toggle(team.externalId)}
                  type="checkbox"
                />
                <span><strong>{team.name}</strong><small>Actuele competitie als standaard</small></span>
              </label>
            ))}
            {!filteredTeams.length ? <p>Geen teams gevonden voor “{query}”.</p> : null}
          </div>
          {teams.length > sportlinkSlideTeamContextsMax ? (
            <p className="notice notice--warning" role="status">
              Maximaal {sportlinkSlideTeamContextsMax} teams per gekoppeld
              welkomstonderdeel. Verwijder eerst een team om een ander team toe
              te voegen.
            </p>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function TeamMatrix({ selectedBlueprints, selections, teams, toggleCell, toggleTeam }: {
  selectedBlueprints: SportlinkSlideBlueprintKey[];
  selections: Record<string, SportlinkSlideBlueprintKey[]>;
  teams: Team[];
  toggleCell: (team: Team, key: SportlinkSlideBlueprintKey) => void;
  toggleTeam: (team: Team) => void;
}) {
  return (
    <section className={styles.matrixSection}>
      <header><div><h3>Overige Sportlink-onderdelen</h3><p>Kies per team welke programma-, uitslag- of pouleslides je wilt maken.</p></div></header>
      <div
        className={styles.matrix}
        role="table"
        aria-label="Teams en overige slidetypen"
        style={{ "--matrix-columns": selectedBlueprints.length } as React.CSSProperties}
      >
        <div className={styles.matrixHead} role="row">
          <span role="columnheader">Team</span>
          {selectedBlueprints.map((key) => (
            <span key={key} role="columnheader">{shortBlueprintLabel(key)}</span>
          ))}
        </div>
        {teams.map((team) => {
          const selected = selections[team.externalId] ?? [];
          return (
            <div className={styles.matrixRow} key={team.externalId} role="row">
              <div className={styles.matrixTeamCell} role="rowheader">
                <button
                  aria-pressed={selected.length === selectedBlueprints.length}
                  onClick={() => toggleTeam(team)}
                  type="button"
                >
                  <Users aria-hidden="true" />
                  <span><strong>{team.name}</strong><small>{selected.length} gekozen</small></span>
                </button>
              </div>
              {selectedBlueprints.map((key) => (
                <div className={styles.matrixChoiceCell} key={key} role="cell">
                  <label>
                    <input
                      aria-label={`${shortBlueprintLabel(key)} voor ${team.name}`}
                      checked={selected.includes(key)}
                      onChange={() => toggleCell(team, key)}
                      type="checkbox"
                    />
                    <span>{shortBlueprintLabel(key)}</span>
                  </label>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CompetitionStep({ setTeamContexts, teamContexts, teams, usage }: {
  setTeamContexts: Dispatch<SetStateAction<Record<string, SportlinkSlideContext>>>;
  teamContexts: Record<string, SportlinkSlideContext>;
  teams: Team[];
  usage: (teamId: string) => SportlinkSlideBlueprintKey[];
}) {
  return (
    <>
      <StepHeading
        description="VeyoCast kiest standaard automatisch de actuele competitie. Zet alleen een team vast wanneer je bewust een andere competitie, fase of poule wilt tonen."
        eyebrow="Context"
        title="Actuele competitie, tenzij jij afwijkt"
      />
      <div className={styles.contextList}>
        {teams.map((team) => {
          const context = teamContexts[team.externalId] ?? initialContext(team);
          const usedBy = usage(team.externalId);
          return (
            <section key={team.externalId}>
              <header>
                <div><h3>{team.name}</h3><p>{usedBy.map(shortBlueprintLabel).join(" · ")}</p></div>
                <StatusPill
                  label={context.competitionSelectionMode === "auto_current" ? "Actuele competitie" : "Vastgezet"}
                  tone={context.competitionSelectionMode === "auto_current" ? "success" : "info"}
                />
              </header>
              <div className={styles.contextModes}>
                <label data-selected={context.competitionSelectionMode === "auto_current"}>
                  <input
                    checked={context.competitionSelectionMode === "auto_current"}
                    name={`competition-${team.externalId}`}
                    onChange={() => setTeamContexts((all) => ({
                      ...all,
                      [team.externalId]: initialContext(team)
                    }))}
                    type="radio"
                  />
                  <span><strong>Actuele competitie</strong><small>Blijft automatisch met Sportlink meebewegen.</small></span>
                </label>
                <label data-selected={context.competitionSelectionMode === "pinned"}>
                  <input
                    checked={context.competitionSelectionMode === "pinned"}
                    disabled={!team.contexts.length}
                    name={`competition-${team.externalId}`}
                    onChange={() => setTeamContexts((all) => ({
                      ...all,
                      [team.externalId]: pinnedContext(team, context)
                    }))}
                    type="radio"
                  />
                  <span><strong>Zelf kiezen</strong><small>Voor een beker, fase of specifieke poule.</small></span>
                </label>
              </div>
              {context.competitionSelectionMode === "pinned" ? (
                <ContextSelect
                  contexts={team.contexts}
                  onChange={(next) => setTeamContexts((all) => ({
                    ...all,
                    [team.externalId]: next
                  }))}
                  teamId={team.externalId}
                  value={context}
                />
              ) : null}
            </section>
          );
        })}
      </div>
    </>
  );
}

function ContextSelect({ contexts, onChange, teamId, value }: {
  contexts: TeamContext[];
  onChange: (value: SportlinkSlideContext) => void;
  teamId: string;
  value: SportlinkSlideContext;
}) {
  const index = Math.max(0, contexts.findIndex((option) =>
    option.competitionId === value.competitionId &&
    option.phaseId === value.phaseId &&
    option.poolId === value.poolId &&
    option.seasonId === value.seasonId
  ));
  return (
    <Field label="Competitie · fase · poule">
      {({ controlProps }) => (
        <select
          {...controlProps}
          onChange={(event) => {
            const option = contexts[Number(event.target.value)];
            if (option) onChange(contextFromOption(teamId, option));
          }}
          value={index}
        >
          {contexts.map((option, optionIndex) => (
            <option
              key={`${option.competitionId}:${option.phaseId}:${option.poolId}:${option.seasonId}:${optionIndex}`}
              value={optionIndex}
            >
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

function ThemeDisplayStep({
  arrivalConfig,
  display,
  drafts,
  media,
  orientation,
  setArrivalConfig,
  setDisplay,
  setOrientation,
  setThemeSelection,
  themeSelection
}: {
  arrivalConfig: SportlinkArrivalConfig;
  display: SportlinkDisplayConfig;
  drafts: SportlinkSlideDraft[];
  media: SportlinkMediaOption[];
  orientation: "landscape" | "portrait";
  setArrivalConfig: Dispatch<SetStateAction<SportlinkArrivalConfig>>;
  setDisplay: Dispatch<SetStateAction<SportlinkDisplayConfig>>;
  setOrientation: (value: "landscape" | "portrait") => void;
  setThemeSelection: Dispatch<SetStateAction<ThemeSelection>>;
  themeSelection: ThemeSelection;
}) {
  const hasArrivals = drafts.some((draft) => isArrivalKey(draft.blueprintKey));
  const hasFixtureInfo = drafts.some((draft) => [
    "sport_program",
    "sport_results",
    "sport_visitor_arrivals",
    "sport_referee_arrivals"
  ].includes(sportlinkSlideBlueprints[draft.blueprintKey].slideType));
  return (
    <>
      <StepHeading
        description="De gekozen FieldFlow-weergave wordt expliciet in iedere nieuwe versie opgeslagen."
        eyebrow="Vormgeving"
        title="Rustig, herkenbaar en leesbaar op afstand"
      />
      <FieldFlowStyleStep
        label="FieldFlow-stijl voor deze onderdelen"
        onActivate={() => setThemeSelection((current) => withThemeId(current, "fieldflow"))}
        value={themeId(themeSelection)}
      />
      <section className={styles.displaySection}>
        <h3>Schermformaat</h3>
        <div className={styles.formatGrid}>
          {(["landscape", "portrait"] as const).map((value) => (
            <button
              aria-pressed={orientation === value}
              key={value}
              onClick={() => setOrientation(value)}
              type="button"
            >
              <strong>{value === "portrait" ? "Staand" : "Liggend"}</strong>
              <span>{value === "portrait" ? "1080 × 1920" : "1920 × 1080"}</span>
            </button>
          ))}
        </div>
      </section>
      <section className={styles.displaySection}>
        <h3>Kolommen en wedstrijdinformatie</h3>
        <div className={styles.inlineOptions}>
          <label><input checked={display.columns === "two"} onChange={(event) => setDisplay((current) => ({ ...current, columns: event.target.checked ? "two" : "one" }))} type="checkbox" /> Twee kolommen</label>
          {hasFixtureInfo ? <>
            <label><input checked={display.showHomeAway} onChange={(event) => setDisplay((current) => ({ ...current, showHomeAway: event.target.checked }))} type="checkbox" /> Thuis / uit tonen</label>
            <label><input checked={display.showField} onChange={(event) => setDisplay((current) => ({ ...current, showField: event.target.checked }))} type="checkbox" /> Veld tonen</label>
            <label><input checked={display.showDressingRoom} onChange={(event) => setDisplay((current) => ({ ...current, showDressingRoom: event.target.checked }))} type="checkbox" /> Kleedkamer tonen</label>
            <label><input checked={display.showReferee} onChange={(event) => setDisplay((current) => ({ ...current, showReferee: event.target.checked }))} type="checkbox" /> Scheidsrechter tonen</label>
          </> : <p>Voor een poulestand zijn alleen kolommen relevant.</p>}
        </div>
      </section>
      {hasArrivals ? (
        <section className={styles.displaySection}>
          <h3>Bezoekers en scheidsrechters</h3>
          <SportlinkArrivalFields
            media={media}
            onChange={setArrivalConfig}
            value={arrivalConfig}
          />
        </section>
      ) : null}
    </>
  );
}

function ReviewStep({ drafts, teamName, themeSelection }: {
  drafts: SportlinkSlideDraft[];
  teamName: (teamId: string) => string;
  themeSelection: ThemeSelection;
}) {
  return (
    <>
      <StepHeading
        description="Controleer wat VeyoCast maakt. Een welkomstcomponent kan meerdere schermpagina’s vullen, maar blijft één gekoppeld onderdeel."
        eyebrow="Klaarzetten"
        title={`${drafts.length} ${drafts.length === 1 ? "onderdeel staat" : "onderdelen staan"} klaar`}
      />
      <div className={styles.reviewList}>
        {drafts.map((draft) => {
          const contexts = draft.teamContexts ?? [draft.context];
          const aggregate = isArrivalKey(draft.blueprintKey);
          return (
            <section key={draftKey(draft)}>
              <span className={styles.reviewIcon}><Check aria-hidden="true" /></span>
              <div>
                <span className={styles.kicker}>{aggregate ? "Gekoppeld welkomstcomponent" : "Dynamische slide"}</span>
                <h3>{shortBlueprintLabel(draft.blueprintKey)}</h3>
                <p>{aggregate
                  ? `${contexts.length} ${contexts.length === 1 ? "team" : "teams"} · automatisch gepagineerd`
                  : `${teamName(draft.context.providerTeamId)} · ${draft.context.competitionSelectionMode === "auto_current" ? "actuele competitie" : contextLabel(draft.context)}`}
                </p>
                {aggregate ? (
                  <div className={styles.reviewTags}>
                    {contexts.map((context) => <span key={context.providerTeamId}>{teamName(context.providerTeamId)}</span>)}
                  </div>
                ) : null}
              </div>
              <StatusPill label={themeCatalog[themeId(draft.themeSelection)].name} tone="success" />
            </section>
          );
        })}
      </div>
      <dl className={styles.reviewSummary}>
        <div><dt>Standaardthema</dt><dd>{themeCatalog[themeId(themeSelection)].name}</dd></div>
        <div><dt>Formaat</dt><dd>{[...new Set(drafts.map((draft) => draft.orientation === "portrait" ? "Staand" : "Liggend"))].join(", ")}</dd></div>
        <div><dt>Publicatie</dt><dd>Eerst als bewerkbaar concept</dd></div>
      </dl>
    </>
  );
}

function WizardPreview({ draft, orientation, selection }: {
  draft: SportlinkSlideDraft | null;
  orientation: "landscape" | "portrait";
  selection: ThemeSelection;
}) {
  const definition = themeCatalog[themeId(selection)];
  const palette = definition.light;
  const contextCount = draft?.teamContexts?.length ?? (draft ? 1 : 0);
  return (
    <aside className={styles.preview}>
      <header><Eye aria-hidden="true" /><span><strong>Live stijlpreview</strong><small>{orientation === "portrait" ? "Staand" : "Liggend"}</small></span></header>
      <div
        className={styles.previewViewport}
        data-orientation={orientation}
        style={{
          "--preview-accent": selection.accent ?? definition.accentDefault,
          "--preview-canvas": palette.canvas,
          "--preview-line": palette.line,
          "--preview-muted": palette.muted,
          "--preview-surface": palette.surface,
          "--preview-text": palette.text
        } as React.CSSProperties}
      >
        <span>SPORTLINK</span>
        <h2>{draft ? shortBlueprintLabel(draft.blueprintKey) : "Kies je content"}</h2>
        <p>{draft
          ? isArrivalKey(draft.blueprintKey)
            ? `${contextCount} ${contextCount === 1 ? "team" : "teams"} gekoppeld`
            : draft.name.split(" · ")[0]
          : "Je eerste selectie verschijnt hier."}
        </p>
        <div><i /><i /><i /></div>
        <footer>{definition.name}</footer>
      </div>
      <p>Na aanmaken vult VeyoCast dit onderdeel met actuele providerdata. Er worden geen voorbeeldscores verzonnen.</p>
    </aside>
  );
}

function StepHeading({ description, eyebrow, title }: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className={styles.heading}>
      <span className={styles.kicker}>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function initialContext(team: Team): SportlinkSlideContext {
  return {
    competitionId: null,
    competitionSelectionMode: "auto_current",
    phaseId: null,
    poolId: null,
    providerTeamId: team.externalId,
    seasonId: null
  };
}

function pinnedContext(team: Team, current: SportlinkSlideContext) {
  const option = team.contexts.find((candidate) =>
    candidate.competitionId === current.competitionId &&
    candidate.phaseId === current.phaseId &&
    candidate.poolId === current.poolId &&
    candidate.seasonId === current.seasonId
  ) ?? team.contexts[0];
  return option ? contextFromOption(team.externalId, option) : initialContext(team);
}

function contextFromOption(
  teamId: string,
  option: TeamContext
): SportlinkSlideContext {
  return {
    competitionId: option.competitionId,
    competitionSelectionMode: "pinned",
    phaseId: option.phaseId,
    poolId: option.poolId,
    providerTeamId: teamId,
    seasonId: option.seasonId
  };
}

function contextLabel(context: SportlinkSlideContext) {
  return [context.seasonId, context.competitionId, context.phaseId, context.poolId]
    .filter(Boolean)
    .join(" · ") || "Handmatig gekozen";
}

function themeId(selection: ThemeSelection): SelectableThemeId {
  return selection.ref.catalog === "v2" ? selection.ref.id : "fieldflow";
}

function withThemeId(
  selection: ThemeSelection,
  id: SelectableThemeId
): ThemeSelection {
  return {
    ...selection,
    ref: { catalog: "v2", id, version: themeCatalog[id].version }
  };
}

function draftKey(draft: SportlinkSlideDraft) {
  return `${draft.blueprintKey}:${draft.teamContexts?.map((context) => context.providerTeamId).join(",") ?? draft.context.providerTeamId}`;
}

function isArrivalKey(key: SportlinkSlideBlueprintKey) {
  return key === "sportlink.visitor_arrivals" || key === "sportlink.referee_arrivals";
}

function windowLabel(window: (typeof sportlinkSlideBlueprints)[SportlinkSlideBlueprintKey]["window"]) {
  if (window === "today") return "Vandaag";
  if (window === "ranking") return "Actuele stand";
  if (window === "live_window") return "Rond aankomsttijd";
  if (window === "next_7_days") return "Komende 7 dagen";
  return "Afgelopen 7 dagen";
}

function shortBlueprintLabel(key: SportlinkSlideBlueprintKey) {
  const labels: Record<SportlinkSlideBlueprintKey, string> = {
    "sportlink.club_schedule_today": "Programma vandaag",
    "sportlink.club_schedule_next_7_days": "Programma komende 7 dagen",
    "sportlink.club_results_today": "Uitslagen vandaag",
    "sportlink.club_results_previous_7_days": "Uitslagen afgelopen 7 dagen",
    "sportlink.pool_schedule_next_7_days": "Programma poule",
    "sportlink.pool_results_previous_7_days": "Uitslagen poule",
    "sportlink.pool_standings": "Poulestand",
    "sportlink.visitor_arrivals": "Bezoekers welkom",
    "sportlink.referee_arrivals": "Scheidsrechters welkom"
  };
  return labels[key];
}
