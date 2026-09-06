"use client";

import {
  Check,
  Eye,
  LayoutGrid,
  Save,
  Send
} from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  sportlinkSlideBlueprints,
  sportlinkSlideTeamContextsMax,
  type SelectableThemeId,
  type SportlinkSlideBlueprintKey,
  type SportlinkSlideContext,
  type SportlinkSlideDraft
} from "@veyocast/contracts";
import { themeCatalog } from "@veyocast/content-templates/theme-catalog";
import {
  Button,
  Field,
  MultiSelectDropdown,
  StatusPill
} from "@veyocast/ui";

import { FieldFlowStyleStep } from "../../_components/fieldflow-style-step";
import {
  SportlinkArrivalFields,
  type SportlinkMediaOption
} from "../../_components/sportlink-arrival-fields";
import { publishDynamicSlideVersion } from "../../version-actions";
import { saveSportlinkSlideVersion } from "./actions";
import styles from "./sportlink-version-editor.module.css";
import {
  autoCompetitionContext,
  competitionContextFromOption,
  isArrivalBlueprint,
  pinnedCompetitionContext,
  replaceArrivalTeamContext,
  replaceArrivalTeamSelection,
  switchSportlinkBlueprint,
  type SportlinkVersionEditorTeam
} from "./sportlink-version-editor-state";

type Team = SportlinkVersionEditorTeam;
type Template = {
  orientation: "landscape" | "portrait";
  slideType: string;
  versionId: string;
};
type EditorMessage = { text: string; tone: "critical" | "success" | "warning" };

const blueprintKeys = Object.keys(
  sportlinkSlideBlueprints
) as SportlinkSlideBlueprintKey[];

export function SportlinkVersionEditor({
  dataSourceId,
  initialDraft,
  initialDirty,
  initialRevision,
  media,
  slideId,
  teams,
  templates,
  versionId,
  versionNumber
}: {
  dataSourceId: string;
  initialDraft: SportlinkSlideDraft;
  initialDirty: boolean;
  initialRevision: number;
  media: SportlinkMediaOption[];
  slideId: string;
  teams: Team[];
  templates: Template[];
  versionId: string;
  versionNumber: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => ({
    ...initialDraft,
    themeSelection: fieldflowThemeSelection(initialDraft.themeSelection)
  }));
  const [revision, setRevision] = useState(initialRevision);
  const [dirty, setDirty] = useState(initialDirty);
  const [message, setMessage] = useState<EditorMessage | null>(() =>
    initialDirty
      ? {
          text: "Deze conceptversie is veilig omgezet naar de gekoppelde FieldFlow-opbouw. Sla de selectie eerst op voordat je publiceert.",
          tone: "warning"
        }
      : null
  );
  const [pending, startTransition] = useTransition();
  const templateMap = useMemo(
    () => Object.fromEntries(templates.map((template) => [
      `${template.orientation}:${template.slideType}`,
      template.versionId
    ])),
    [templates]
  );
  const arrival = isArrivalBlueprint(draft.blueprintKey);
  const themeId = draft.themeSelection.ref.catalog === "v2"
    ? draft.themeSelection.ref.id
    : "fieldflow";
  const theme = themeCatalog[themeId];

  function update(next: SportlinkSlideDraft) {
    setDraft({
      ...next,
      themeSelection: fieldflowThemeSelection(next.themeSelection)
    });
    setDirty(true);
    setMessage(null);
  }

  function setBlueprint(blueprintKey: SportlinkSlideBlueprintKey) {
    const blueprint = sportlinkSlideBlueprints[blueprintKey];
    const templateVersionId = templateMap[
      `${draft.orientation}:${blueprint.slideType}`
    ];
    if (!templateVersionId) {
      setMessage({
        text: "Dit type heeft nog geen template voor het gekozen schermformaat. Kies een ander formaat en probeer opnieuw.",
        tone: "warning"
      });
      return;
    }
    update(switchSportlinkBlueprint(
      draft,
      blueprintKey,
      templateVersionId
    ));
  }

  function setOrientation(orientation: "landscape" | "portrait") {
    const slideType = sportlinkSlideBlueprints[draft.blueprintKey].slideType;
    const templateVersionId = templateMap[`${orientation}:${slideType}`];
    if (!templateVersionId) {
      setMessage({
        text: "Voor dit onderdeel ontbreekt een template in dat schermformaat. De huidige keuze is behouden.",
        tone: "warning"
      });
      return;
    }
    update({ ...draft, orientation, templateVersionId });
  }

  function setTheme(id: SelectableThemeId) {
    update({
      ...draft,
      themeSelection: {
        ...draft.themeSelection,
        ref: { catalog: "v2", id, version: themeCatalog[id].version }
      }
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveSportlinkSlideVersion({
        dataSourceId,
        draft,
        expectedRevision: revision,
        slideId,
        versionId
      });
      if (!result.ok) {
        setMessage({
          text: result.message ?? "Opslaan is mislukt. De gepubliceerde versie is niet aangepast; controleer de invoer en probeer opnieuw.",
          tone: "critical"
        });
        return;
      }
      setRevision(result.editRevision);
      setDirty(false);
      setMessage({ text: "Conceptversie opgeslagen.", tone: "success" });
      router.refresh();
    });
  }

  function publish() {
    startTransition(async () => {
      const result = await publishDynamicSlideVersion({
        expectedRevision: revision,
        slideId,
        versionId
      });
      if (!result.ok) {
        setMessage({
          text: result.message ?? "Publiceren is mislukt. De huidige versie blijft actief; probeer opnieuw.",
          tone: "critical"
        });
        return;
      }
      router.push(
        `/dashboard/slides/${slideId}?succes=Versie+${versionNumber}+wordt+veilig+gerenderd.+De+huidige+versie+blijft+actief+tot+de+nieuwe+gereed+is.`
      );
    });
  }

  return (
    <div className={styles.editor}>
      <section className={styles.formPanel}>
        <header className={styles.panelHeader}>
          <div>
            <span className={styles.kicker}>Sportlink-versie</span>
            <h2>Conceptversie v{versionNumber}</h2>
            <p>
              Pas dit gekoppelde onderdeel aan. De huidige publicatie blijft
              spelen totdat deze versie volledig gereed is.
            </p>
          </div>
          <StatusPill
            label={dirty ? "Niet opgeslagen" : "Opgeslagen"}
            tone={dirty ? "warning" : "success"}
          />
        </header>

        {message ? (
          <p
            className={`notice notice--${message.tone}`}
            role={message.tone === "critical" ? "alert" : "status"}
          >
            {message.text}
          </p>
        ) : null}

        <Field
          description="Deze naam blijft herkenbaar in Slides en playlists."
          label="Naam van het onderdeel"
        >
          {({ controlProps }) => (
            <input
              {...controlProps}
              maxLength={120}
              minLength={2}
              onChange={(event) => update({ ...draft, name: event.target.value })}
              value={draft.name}
            />
          )}
        </Field>

        <fieldset className={styles.section}>
          <legend>Wat wil je tonen?</legend>
          <p className={styles.sectionDescription}>
            Welkomsttypen blijven één dynamisch onderdeel, ook wanneer meerdere
            teams eraan gekoppeld zijn.
          </p>
          <div className={styles.blueprintGrid}>
            {blueprintKeys.map((key) => {
              const active = draft.blueprintKey === key;
              return (
                <button
                  aria-pressed={active}
                  key={key}
                  onClick={() => setBlueprint(key)}
                  type="button"
                >
                  <span className={styles.choiceIcon}>
                    <LayoutGrid aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{shortLabel(key)}</strong>
                    <small>{blueprintDescription(key)}</small>
                  </span>
                  <span className={styles.choiceCheck} aria-hidden="true">
                    {active ? <Check /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {arrival ? (
          <ArrivalTeamEditor
            draft={draft}
            onChange={update}
            teams={teams}
          />
        ) : (
          <SingleTeamEditor draft={draft} onChange={update} teams={teams} />
        )}

        <fieldset className={styles.section}>
          <legend>Schermformaat</legend>
          <div className={styles.orientationGrid}>
            {(["landscape", "portrait"] as const).map((orientation) => (
              <button
                aria-pressed={draft.orientation === orientation}
                key={orientation}
                onClick={() => setOrientation(orientation)}
                type="button"
              >
                <strong>{orientation === "portrait" ? "Staand" : "Liggend"}</strong>
                <small>{orientation === "portrait" ? "1080 × 1920" : "1920 × 1080"}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <FieldFlowStyleStep
          label="FieldFlow-stijl voor deze versie"
          legacySelected={draft.themeSelection.ref.catalog === "legacy"}
          onActivate={() => setTheme("fieldflow")}
          value={themeId}
        />

        <fieldset className={styles.section}>
          <legend>Weergave</legend>
          <div className={styles.inlineOptions}>
            <label>
              <input
                checked={draft.display.columns === "two"}
                onChange={(event) => update({
                  ...draft,
                  display: {
                    ...draft.display,
                    columns: event.target.checked ? "two" : "one"
                  }
                })}
                type="checkbox"
              />
              Twee kolommen
            </label>
            {sportlinkSlideBlueprints[draft.blueprintKey].slideType !== "sport_standing" ? (
              <>
                <DisplayToggle
                  checked={draft.display.showHomeAway}
                  label="Thuis / uit tonen"
                  onChange={(checked) => update({ ...draft, display: { ...draft.display, showHomeAway: checked } })}
                />
                <DisplayToggle
                  checked={draft.display.showField}
                  label="Veld tonen"
                  onChange={(checked) => update({ ...draft, display: { ...draft.display, showField: checked } })}
                />
                <DisplayToggle
                  checked={draft.display.showDressingRoom}
                  label="Kleedkamer tonen"
                  onChange={(checked) => update({ ...draft, display: { ...draft.display, showDressingRoom: checked } })}
                />
                <DisplayToggle
                  checked={draft.display.showReferee}
                  label="Scheidsrechter tonen"
                  onChange={(checked) => update({ ...draft, display: { ...draft.display, showReferee: checked } })}
                />
              </>
            ) : (
              <p>Voor een poulestand zijn alleen de kolommen relevant.</p>
            )}
          </div>
        </fieldset>

        {draft.arrival && arrival ? (
          <fieldset className={styles.section}>
            <legend>Bezoekers en scheidsrechters</legend>
            <SportlinkArrivalFields
              media={media}
              onChange={(nextArrival) => update({ ...draft, arrival: nextArrival })}
              value={draft.arrival}
            />
          </fieldset>
        ) : null}

        <footer className={styles.actions}>
          <Button
            disabled={!dirty || pending}
            onClick={save}
            type="button"
            variant="secondary"
          >
            <Save aria-hidden="true" />
            Concept opslaan
          </Button>
          <Button disabled={dirty || pending} onClick={publish} type="button">
            <Send aria-hidden="true" />
            Versie publiceren
          </Button>
        </footer>
      </section>

      <VersionPreview draft={draft} teams={teams} theme={theme} themeId={themeId} />
    </div>
  );
}

function ArrivalTeamEditor({ draft, onChange, teams }: {
  draft: SportlinkSlideDraft;
  onChange: (draft: SportlinkSlideDraft) => void;
  teams: Team[];
}) {
  const contexts = draft.teamContexts ?? [draft.context];
  const selectedIds = contexts.map((context) => context.providerTeamId);
  const currentTeamIds = new Set(teams.map((team) => team.externalId));
  const unavailableOptions = contexts
    .filter((context) => !currentTeamIds.has(context.providerTeamId))
    .map((context) => ({
      disabled: true,
      disabledReason: "Niet meer beschikbaar in de actuele Sportlink-lijst.",
      label: `Team ${context.providerTeamId}`,
      value: context.providerTeamId
    }));

  return (
    <section className={styles.teamSection}>
      <MultiSelectDropdown
        description="De selectie voedt één dynamische slide. VeyoCast verdeelt de actuele aankomsten automatisch over schermpagina’s."
        label="Teams in dit onderdeel"
        maximumSelected={sportlinkSlideTeamContextsMax}
        minimumSelected={1}
        onValueChange={(teamIds) => onChange(
          replaceArrivalTeamSelection(draft, teamIds, teams)
        )}
        options={[
          ...teams.map((team) => ({
            description: "Actuele competitie als standaard",
            label: team.name,
            value: team.externalId
          })),
          ...unavailableOptions
        ]}
        placeholder="Kies minimaal één team"
        searchLabel="Teams zoeken"
        searchPlaceholder="Zoek op teamnaam"
        searchable
        selectAllLabel={teams.length > sportlinkSlideTeamContextsMax
          ? `Eerste ${sportlinkSlideTeamContextsMax} teams selecteren`
          : "Alle teams selecteren"}
        selectionNoun={{ plural: "teams", singular: "team" }}
        value={selectedIds}
      />

      {!teams.length ? (
        <p className="notice notice--warning">
          Er zijn geen actuele teams geladen. De bestaande koppeling blijft
          behouden; synchroniseer Sportlink voordat je de selectie wijzigt.
        </p>
      ) : null}

      <div className={styles.contextList}>
        <header>
          <div>
            <h3>Competitie per team</h3>
            <p>
              Standaard volgt ieder team automatisch de actuele competitie.
              Alleen afwijkingen hoef je vast te zetten.
            </p>
          </div>
        </header>
        {contexts.map((context) => {
          const team = teams.find((candidate) =>
            candidate.externalId === context.providerTeamId
          );
          return team ? (
            <TeamCompetitionCard
              context={context}
              key={context.providerTeamId}
              onChange={(nextContext) => onChange(
                replaceArrivalTeamContext(draft, nextContext)
              )}
              team={team}
            />
          ) : (
            <section className={styles.unavailableTeam} key={context.providerTeamId}>
              <strong>Team {context.providerTeamId}</strong>
              <p>
                Dit eerder gekoppelde team staat niet meer in de actuele
                Sportlink-lijst. Verwijder het team of synchroniseer de bron.
              </p>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function SingleTeamEditor({ draft, onChange, teams }: {
  draft: SportlinkSlideDraft;
  onChange: (draft: SportlinkSlideDraft) => void;
  teams: Team[];
}) {
  const team = teams.find((candidate) =>
    candidate.externalId === draft.context.providerTeamId
  );
  return (
    <section className={styles.singleTeamSection}>
      <header>
        <span className={styles.kicker}>Teamcontext</span>
        <h3>Eén team voor dit onderdeel</h3>
        <p>Gewone programma-, uitslag- en pouleslides blijven teamgebonden.</p>
      </header>
      <Field label="Team">
        {({ controlProps }) => (
          <select
            {...controlProps}
            onChange={(event) => {
              const nextTeam = teams.find((candidate) =>
                candidate.externalId === event.target.value
              );
              if (nextTeam) {
                onChange({
                  ...draft,
                  context: autoCompetitionContext(nextTeam.externalId)
                });
              }
            }}
            value={draft.context.providerTeamId}
          >
            {!team ? (
              <option value={draft.context.providerTeamId}>
                Opgeslagen team · niet meer beschikbaar
              </option>
            ) : null}
            {teams.map((option) => (
              <option key={option.externalId} value={option.externalId}>
                {option.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      {team ? (
        <TeamCompetitionCard
          context={draft.context}
          onChange={(context) => onChange({ ...draft, context })}
          team={team}
        />
      ) : (
        <p className="notice notice--warning">
          Het opgeslagen team staat niet meer in Sportlink. Kies een actueel
          team om deze versie veilig te kunnen bijwerken.
        </p>
      )}
    </section>
  );
}

function TeamCompetitionCard({ context, onChange, team }: {
  context: SportlinkSlideContext;
  onChange: (context: SportlinkSlideContext) => void;
  team: Team;
}) {
  const groupName = useId();
  const selectedIndex = team.contexts.findIndex((option) =>
    option.competitionId === context.competitionId &&
    option.phaseId === context.phaseId &&
    option.poolId === context.poolId &&
    option.seasonId === context.seasonId
  );
  const missingPinnedContext = context.competitionSelectionMode === "pinned" &&
    selectedIndex < 0;
  return (
    <section className={styles.contextCard}>
      <header>
        <div>
          <h4>{team.name}</h4>
          <p>
            {context.competitionSelectionMode === "auto_current"
              ? "Beweegt automatisch mee met de actuele Sportlink-competitie."
              : "Gebruikt alleen de hieronder vastgezette competitiecontext."}
          </p>
        </div>
        <StatusPill
          label={context.competitionSelectionMode === "auto_current" ? "Actuele competitie" : "Vastgezet"}
          tone={context.competitionSelectionMode === "auto_current" ? "success" : "info"}
        />
      </header>
      <fieldset className={styles.contextModes}>
        <legend className="sr-only">Competitiekeuze voor {team.name}</legend>
        <label data-selected={context.competitionSelectionMode === "auto_current"}>
          <input
            checked={context.competitionSelectionMode === "auto_current"}
            name={`${groupName}-competition`}
            onChange={() => onChange(autoCompetitionContext(team.externalId))}
            type="radio"
          />
          <span>
            <strong>Actuele competitie</strong>
            <small>Blijft automatisch met Sportlink meebewegen.</small>
          </span>
        </label>
        <label data-selected={context.competitionSelectionMode === "pinned"}>
          <input
            checked={context.competitionSelectionMode === "pinned"}
            disabled={!team.contexts.length}
            name={`${groupName}-competition`}
            onChange={() => onChange(pinnedCompetitionContext(team, context))}
            type="radio"
          />
          <span>
            <strong>Zelf kiezen</strong>
            <small>{team.contexts.length ? "Voor een specifieke competitie, fase of poule." : "Geen alternatieven beschikbaar."}</small>
          </span>
        </label>
      </fieldset>
      {context.competitionSelectionMode === "pinned" ? (
        <Field
          error={missingPinnedContext ? "Deze opgeslagen keuze is niet meer beschikbaar. Kies een actuele optie." : undefined}
          label="Competitie · fase · poule"
        >
          {({ controlProps }) => (
            <select
              {...controlProps}
              onChange={(event) => {
                const option = team.contexts[Number(event.target.value)];
                if (option) {
                  onChange(competitionContextFromOption(team.externalId, option));
                }
              }}
              value={selectedIndex >= 0 ? selectedIndex : "missing"}
            >
              {missingPinnedContext ? (
                <option disabled value="missing">Opgeslagen keuze niet meer beschikbaar</option>
              ) : null}
              {team.contexts.map((option, optionIndex) => (
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
      ) : null}
    </section>
  );
}

function DisplayToggle({ checked, label, onChange }: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label>
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function VersionPreview({ draft, teams, theme, themeId }: {
  draft: SportlinkSlideDraft;
  teams: Team[];
  theme: (typeof themeCatalog)[SelectableThemeId];
  themeId: SelectableThemeId;
}) {
  const contexts = isArrivalBlueprint(draft.blueprintKey)
    ? draft.teamContexts ?? [draft.context]
    : [draft.context];
  const names = contexts.map((context) =>
    teams.find((team) => team.externalId === context.providerTeamId)?.name ??
    `Team ${context.providerTeamId}`
  );
  return (
    <aside className={styles.preview}>
      <header>
        <Eye aria-hidden="true" />
        <span>
          <strong>Live stijlpreview</strong>
          <small>{draft.orientation === "portrait" ? "Staand" : "Liggend"}</small>
        </span>
      </header>
      <div
        className={styles.previewViewport}
        data-orientation={draft.orientation}
        style={{
          "--preview-accent": draft.themeSelection.accent ?? theme.accentDefault,
          "--preview-canvas": theme.light.canvas,
          "--preview-line": theme.light.line,
          "--preview-muted": theme.light.muted,
          "--preview-surface": theme.light.surface,
          "--preview-text": theme.light.text
        } as React.CSSProperties}
      >
        <span>SPORTLINK</span>
        <h2>{shortLabel(draft.blueprintKey)}</h2>
        <p>
          {isArrivalBlueprint(draft.blueprintKey)
            ? `${contexts.length} ${contexts.length === 1 ? "team" : "teams"} gekoppeld`
            : names[0]}
        </p>
        <div><i /><i /><i /></div>
        <footer>{themeCatalog[themeId].name}</footer>
      </div>
      {isArrivalBlueprint(draft.blueprintKey) ? (
        <div className={styles.previewTeams}>
          {names.slice(0, 4).map((name, index) => (
            <span key={`${name}:${index}`}>{name}</span>
          ))}
          {names.length > 4 ? <span>+{names.length - 4} meer</span> : null}
        </div>
      ) : null}
      <p>
        De actuele providerdata blijft dynamisch. Er worden geen fictieve
        scores of aankomsttijden in de preview gezet.
      </p>
    </aside>
  );
}

function blueprintDescription(key: SportlinkSlideBlueprintKey) {
  if (isArrivalBlueprint(key)) return "Eén component · meerdere teams";
  const window = sportlinkSlideBlueprints[key].window;
  if (window === "today") return "Vandaag";
  if (window === "next_7_days") return "Komende 7 dagen";
  if (window === "previous_7_days") return "Afgelopen 7 dagen";
  if (window === "ranking") return "Actuele stand";
  return "Actuele Sportlink-data";
}

function shortLabel(key: SportlinkSlideBlueprintKey) {
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

function fieldflowThemeSelection(
  selection: SportlinkSlideDraft["themeSelection"]
): SportlinkSlideDraft["themeSelection"] {
  return {
    ...selection,
    ref: {
      catalog: "v2",
      id: "fieldflow",
      version: themeCatalog.fieldflow.version
    }
  };
}
