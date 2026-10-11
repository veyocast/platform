"use client";

import Link from "next/link";
import {
  Check,
  LayoutGrid, CalendarDays, Trophy, MapPin, ShieldCheck, Gift, ArrowLeft, ArrowRight
} from "lucide-react";
import {
  useMemo,
  useState,
  useTransition,
  type Dispatch,
  type FormEvent,
  type SetStateAction
} from "react";

import {
  sportlinkArrivalConfigSchema,
  sportlinkDisplayConfigSchema,
  sportlinkSlideBlueprints,
  sportlinkSlideBatchMaxDrafts,
  sportlinkSlideTeamContextsMax,
  type SelectableThemeId,
  type SportlinkArrivalConfig,
  type SportlinkDisplayConfig,
  type SportlinkMatchLocation,
  type SportlinkSlideBlueprintKey,
  type SportlinkSlideContext,
  type SportlinkSlideDraft,
  type ThemeAppearanceSettings,
  type ThemeSelection
} from "@veyocast/contracts";
import { themeCatalog } from "@veyocast/content-templates/theme-catalog";
import { buildSportlinkSlideDrafts } from "@veyocast/domain";
import {
  Button,
  Field,
  MultiSelectDropdown,
  StatusPill
} from "@veyocast/ui";

import { FieldFlowStyleStep } from "../../../slides/_components/fieldflow-style-step";
import {
  sportlinkMatchRowPreviewKind
} from "../../../slides/_components/sportlink-match-row-preview";
import { SportlinkMatchLocationsField } from "../../../slides/_components/sportlink-match-location-field";
import {
  SportlinkArrivalFields,
  type SportlinkMediaOption
} from "../../../slides/_components/sportlink-arrival-fields";
import {
  type SportlinkSlideBatchActionResult
} from "./actions";
import styles from "./sportlink-bulk-wizard.module.css";
import sites from "./sites-source-wizard.module.css";
import { createSitesSourceDesign, updateSitesSourceDesign } from "./sites-source-design";
import { SitesSportlinkFamilyWizard } from "./sites-sportlink-family-wizard";
import { SitesSportlinkDraftPreview } from "./sites-sportlink-preview";
import { SitesSourceDesignControls } from "./sites-source-design-controls";
import { SitesSourceDestinationPicker, SitesSourceDestinationAfterSave } from "./sites-source-destination";
import { emptySitesSourceDestinationOptions, initialSitesSourceDestination, validSitesSourceDestination, type SitesSourceDestinationOptions } from "./sites-source-destination-model";

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

type BlueprintTeamSelection = {
  mode: "all" | "selected";
  teamIds: string[];
};

const steps = [
  "Inhoud kiezen",
  "Teams & gegevens",
  "Vormgeving",
  "Schermen",
  "Controleren"
] as const;
const blueprintKeys = Object.keys(
  sportlinkSlideBlueprints
) as SportlinkSlideBlueprintKey[];
const arrivalKeys = blueprintKeys.filter(isArrivalKey);
const regularKeys = blueprintKeys.filter((key) => !isArrivalKey(key));
const allTeamsValue = "__all_teams__";

export function SportlinkBulkWizard({
  action,
  defaultThemeSelection,
  media,
  sources,
  teams,
  templates,
  destinationOptions = emptySitesSourceDestinationOptions
}: {
  destinationOptions?: SitesSourceDestinationOptions;
  action: (formData: FormData) => Promise<SportlinkSlideBatchActionResult>;
  defaultThemeAppearance: ThemeAppearanceSettings;
  defaultThemeSelection: ThemeSelection;
  media: Array<SportlinkMediaOption & { checksumSha256?: string; url?: string }>;
  sources: Array<{ id: string; name: string }>;
  teams: Team[];
  templates: Template[];
}) {
  const [destination, setDestination] = useState(initialSitesSourceDestination);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [selectedBlueprints, setSelectedBlueprints] = useState<
    SportlinkSlideBlueprintKey[]
  >([]);
  const [teamSelections, setTeamSelections] = useState<
    Partial<Record<SportlinkSlideBlueprintKey, BlueprintTeamSelection>>
  >({});
  const [arrivalSelections, setArrivalSelections] = useState<
    Partial<Record<SportlinkSlideBlueprintKey, string[]>>
  >({});
  const [matchLocations, setMatchLocations] = useState<
    Partial<Record<SportlinkSlideBlueprintKey, SportlinkMatchLocation[]>>
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
  const [display, setDisplay] = useState<SportlinkDisplayConfig>(() =>
    sportlinkDisplayConfigSchema.parse({})
  );
  const [arrivalConfig, setArrivalConfig] = useState<SportlinkArrivalConfig>(
    () => sportlinkArrivalConfigSchema.parse({})
  );
  const [sitesDesign, setSitesDesign] = useState(() => createSitesSourceDesign("sportlink", "Dit weekend op de club"));
  const [mobilePreview, setMobilePreview] = useState(false);
  const [creationResult, setCreationResult] = useState<
    SportlinkSlideBatchActionResult | null
  >(null);
  const [isCreating, startCreating] = useTransition();
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
    for (const key of selectedBlueprints) {
      if (isArrivalKey(key)) {
        for (const teamId of arrivalSelections[key] ?? []) ids.add(teamId);
        continue;
      }
      const selection = teamSelections[key];
      if (selection?.mode === "all") {
        for (const team of sourceTeams) ids.add(team.externalId);
        continue;
      }
      for (const teamId of selection?.teamIds ?? []) ids.add(teamId);
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
      const regularDrafts = selectedBlueprints.flatMap((key) => {
        if (isArrivalKey(key)) return [];
        const selection = teamSelections[key];
        if (!selection) return [];
        const selected = (
          selection.mode === "all"
            ? sourceTeams
            : selection.teamIds.flatMap((teamId) => {
                const team = sourceTeamById.get(teamId);
                return team ? [team] : [];
              })
        ).map((team) => ({
          context: teamContexts[team.externalId] ?? initialContext(team),
          name: team.name
        }));
        if (!selected.length) return [];
        const clubwide = isClubwideMatchKey(key);
        return buildSportlinkSlideDrafts({
          blueprintKeys: [key],
          matchLocations: clubwide
            ? matchLocations[key] ?? ["both"]
            : undefined,
          orientation,
          teamSelectionMode: clubwide ? selection.mode : undefined,
          teams: selected,
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
        name: draftNames[draftKey(draft)] ?? draft.name,
        arrival: isArrivalKey(draft.blueprintKey) ? arrivalConfig : undefined,
        display,
        themeSelection,
        sitesConfiguration: { ...sitesDesign, orientation }
      }));
    } catch {
      return [];
    }
  }, [
    arrivalConfig,
    arrivalSelections,
    display,
    draftNames,
    matchLocations,
    orientation,
    selectedBlueprints,
    sourceTeamById,
    sourceTeams,
    teamContexts,
    teamSelections,
    templateMap,
    themeSelection,
    sitesDesign
  ]);

  const requiredSlideTypes = [
    ...new Set(
      selectedBlueprints.map((key) => sportlinkSlideBlueprints[key].slideType)
    )
  ];
  const missingTemplates = requiredSlideTypes.filter(
    (type) => !templateMap[type]
  );
  const everyPurposeHasTeams = selectedBlueprints.every((key) => {
    if (isArrivalKey(key)) return (arrivalSelections[key]?.length ?? 0) > 0;
    const selection = teamSelections[key];
    return selection?.mode === "all"
      ? sourceTeams.length > 0
      : Boolean(selection?.teamIds.length);
  });
  const batchTooLarge = drafts.length > sportlinkSlideBatchMaxDrafts;
  const canNext = step === 0
    ? Boolean(sourceId && selectedBlueprints.length)
    : step === 1
      ? everyPurposeHasTeams && drafts.length > 0 && !batchTooLarge && !missingTemplates.length
      : step < 4
        ? drafts.length > 0 && !batchTooLarge && (step !== 3 || validSitesSourceDestination(destination, destinationOptions))
        : false;
  const payload = { dataSourceId: sourceId, drafts, idempotencyKey };
  const firstDraft = drafts[0] ?? null;
  const previewDraft = drafts.find((draft) =>
    sportlinkMatchRowPreviewKind(draft.blueprintKey)
  ) ?? firstDraft;
  const created = creationResult?.ok === true;

  function resetSource(nextSourceId: string) {
    setSourceId(nextSourceId);
    setTeamSelections({});
    setArrivalSelections({});
    setMatchLocations({});
    setTeamContexts({});
    setCreationResult(null);
  }

  function toggleBlueprint(key: SportlinkSlideBlueprintKey) {
    const selected = selectedBlueprints.includes(key);
    setSelectedBlueprints((current) => selected
      ? current.filter((candidate) => candidate !== key)
      : [...current, key]
    );
    setCreationResult(null);
    if (!selected) return;
    if (isArrivalKey(key)) {
      setArrivalSelections((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    setTeamSelections((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setMatchLocations((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
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
    ensureTeamContexts(validIds);
    setCreationResult(null);
  }

  function updateRegularSelection(
    key: SportlinkSlideBlueprintKey,
    values: string[]
  ) {
    const validIds = sourceTeams
      .filter((team) => values.includes(team.externalId))
      .map((team) => team.externalId)
      .slice(0, sportlinkSlideTeamContextsMax);
    const current = teamSelections[key];
    const selectingSpecificFromAll = current?.mode === "all" &&
      validIds.length > 0;
    const nextSelection: BlueprintTeamSelection =
      isClubwideMatchKey(key) &&
      values.includes(allTeamsValue) &&
      !selectingSpecificFromAll
        ? { mode: "all", teamIds: [] }
        : { mode: "selected", teamIds: validIds };
    setTeamSelections((all) => ({ ...all, [key]: nextSelection }));
    ensureTeamContexts(
      nextSelection.mode === "all"
        ? sourceTeams.map((team) => team.externalId)
        : nextSelection.teamIds
    );
    setCreationResult(null);
  }

  function ensureTeamContexts(teamIds: string[]) {
    setTeamContexts((current) => {
      const next = { ...current };
      for (const teamId of teamIds) {
        const team = sourceTeamById.get(teamId);
        if (team && !next[teamId]) next[teamId] = initialContext(team);
      }
      return next;
    });
  }

  function submitBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (
      !(submitter instanceof HTMLElement) ||
      submitter.dataset.createSportlinkBatch !== "true" ||
      step !== 4 ||
      !validSitesSourceDestination(destination, destinationOptions) ||
      !drafts.length ||
      batchTooLarge ||
      missingTemplates.length ||
      isCreating ||
      created
    ) return;
    const formData = new FormData(event.currentTarget);
    startCreating(async () => {
      try {
        setCreationResult(await action(formData));
      } catch {
        setCreationResult({
          message: "De slides konden niet worden gemaakt. Probeer het opnieuw; je selectie is bewaard.",
          ok: false
        });
      }
    });
  }

  return (
    <>
    <SitesSportlinkFamilyWizard destinationOptions={destinationOptions} sources={sources} teams={teams} templates={templates} media={media.flatMap(item => item.checksumSha256 && item.url ? [{ id: item.id, name: item.name, checksumSha256: item.checksumSha256, url: item.url }] : [])} themeSelection={themeSelection} />
    <form className={`${styles.wizard} ${sites.page}`} onSubmit={submitBatch}>
      <input name="payload" type="hidden" value={JSON.stringify(payload)} />
      <h1 className="sr-only">Sportlink Studio</h1><div className={sites.header}><div><Link className={sites.back} href="/dashboard/studio"><ArrowLeft size={16} />Terug naar Studio</Link><div className={sites.eyebrow}>SPORTLINK STUDIO</div><h2>De club, altijd in beeld.</h2><p>Kies je inhoud, teams en vormgeving. Controleer je ontwerpen voordat je opslaat.</p></div></div>
      <nav className={sites.wizardSteps} aria-label="Sportlink-wizardstappen">{steps.map((label, index) => <button key={label} type="button" disabled={index > step || isCreating || created} data-active={index === step} data-done={index < step} aria-current={index === step ? "step" : undefined} onClick={() => setStep(index)}><span>{index < step ? <Check size={15} /> : index + 1}</span><b>{label}</b></button>)}</nav>
      <div className={sites.mobileSwitch}><button type="button" data-active={!mobilePreview} onClick={() => setMobilePreview(false)}>Instellen</button><button type="button" data-active={mobilePreview} onClick={() => setMobilePreview(true)}>Schermvoorbeeld</button></div>
      <div className={sites.workspace}>
        <section className={`${sites.panel} ${sites.controls} ${mobilePreview ? sites.mobileHidden : ""}`}>

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
              matchLocations={matchLocations}
              teams={sourceTeams}
              updateArrivalSelection={updateArrivalSelection}
              updateMatchLocation={(key, value) => {
                setMatchLocations((current) => ({ ...current, [key]: value }));
                setCreationResult(null);
              }}
              updateRegularSelection={updateRegularSelection}
            />
          ) : null}
          {step === 1 && selectedTeams.length ? (
            <CompetitionStep
              setTeamContexts={setTeamContexts}
              teamContexts={teamContexts}
              teams={selectedTeams}
              usage={(teamId) => selectedBlueprints.filter((key) => {
                if (isArrivalKey(key)) {
                  return (arrivalSelections[key] ?? []).includes(teamId);
                }
                const selection = teamSelections[key];
                return selection?.mode === "all"
                  ? sourceTeamById.has(teamId)
                  : selection?.teamIds.includes(teamId);
              })}
            />
          ) : null}
          {step === 2 ? (<>
            <SitesSourceDesignControls media={media.flatMap(item => item.url && item.checksumSha256 ? [{ id: item.id, name: item.name, url: item.url, checksumSha256: item.checksumSha256 }] : [])} design={{ ...sitesDesign, orientation }} onChange={(patch) => {
              setSitesDesign((current) => updateSitesSourceDesign(current, patch));
              if (patch.orientation) setOrientation(patch.orientation);
              setCreationResult(null);
            }} />
            <details><summary>Wedstrijdinformatie en uitgebreide instellingen</summary>
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
            </details>
          </>) : null}
          {step === 3 ? <><StepHeading eyebrow="Bestemming" title="Waar komt je ontwerp in beeld?" description="Bewaar het ontwerp of kies een echte playlist en doelschermen. Je bevestigt de daadwerkelijke publicatie pas na opslaan en de gereedheidscontrole." /><SitesSourceDestinationPicker options={destinationOptions} value={destination} onChange={setDestination} /></> : null}
          {step === 4 ? (
            <ReviewStep
              creationResult={creationResult}
              drafts={drafts}
              onNameChange={(draft, name) => setDraftNames((current) => ({ ...current, [draftKey(draft)]: name }))}
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
              Deze selectie maakt {drafts.length} slides. Kies maximaal {sportlinkSlideBatchMaxDrafts} slides per batch; één clubbrede slide mag tot {sportlinkSlideTeamContextsMax} teams bevatten.
            </p>
          ) : null}
        {creationResult?.ok && <SitesSourceDestinationAfterSave destination={destination} designs={creationResult.slides.map(slide => ({ slideId: slide.slideId, snapshotId: slide.snapshotId, durationSeconds: Math.max(5, sitesDesign.seconds) }))} />}
        </section>
        <aside className={`${sites.previewPanel} ${!mobilePreview ? sites.mobileHidden : ""}`}>
          <SitesSportlinkDraftPreview draft={previewDraft} sourceId={sourceId} />
          <div className={sites.previewMeta}><span>{orientation === "portrait" ? "9:16" : "16:9"}</span><span>{sitesDesign.seconds} sec per pagina</span><span>{sitesDesign.rowsPerPage} rijen</span></div>
        </aside>
      </div>

      <footer className={styles.actions}>
        <div>
          <span>Stap {step + 1} van {steps.length}</span>
          <strong>{drafts.length} {drafts.length === 1 ? "slide" : "slides"}</strong>
        </div>
        <div>
          <Button
            disabled={step === 0 || isCreating || created}
            onClick={() => {
              setCreationResult(null);
              setStep((value) => value - 1);
            }}
            type="button"
            variant="secondary"
          >
            Vorige
          </Button>
          {step < 4 ? (
            <Button
              key="continue"
              disabled={!canNext}
              onClick={() => { setStep((value) => value + 1); setMobilePreview(false); }}
              type="button"
            >
              Volgende
            </Button>
          ) : created ? (
            <Button key="created" asChild>
              <Link href="/dashboard/slides">Naar Slides</Link>
            </Button>
          ) : (
            <Button
              key="create"
              data-create-sportlink-batch="true"
              disabled={!drafts.length || batchTooLarge || Boolean(missingTemplates.length) || isCreating || !validSitesSourceDestination(destination, destinationOptions)}
              type="submit"
            >
              {isCreating
                ? "Slides maken…"
                : drafts.length + " " + (drafts.length === 1 ? "slide" : "slides") + " aanmaken"}
            </Button>
          )}
        </div>
      </footer>
    </form>
    </>
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
      <div className={sites.kindGrid}>{([
        { name: "Programma", description: "De komende wedstrijden van je club of poule.", icon: CalendarDays, key: "sportlink.club_schedule_next_7_days" },
        { name: "Uitslagen", description: "De laatste resultaten, helder op één scherm.", icon: Trophy, key: "sportlink.club_results_previous_7_days" },
        { name: "Stand", description: "Poulepositie, punten en doelsaldo.", icon: LayoutGrid, key: "sportlink.pool_standings" },
        { name: "Bezoekers welkom", description: "Een warm welkom met veld en kleedkamer.", icon: MapPin, key: "sportlink.visitor_arrivals" },
        { name: "Scheidsrechters welkom", description: "Wedstrijdinformatie voor de arbitrage.", icon: ShieldCheck, key: "sportlink.referee_arrivals" }
      ] as const).map(({ name, description, icon: Icon, key }) => <button className={sites.kind} key={key} type="button" data-selected={selected.includes(key)} aria-pressed={selected.includes(key)} onClick={() => toggle(key)}><div><Icon size={25} /><span className={sites.tick}>{selected.includes(key) && <Check size={13} />}</span></div><strong>{name}</strong><p>{description}</p></button>)}<Link className={sites.kind} href="/dashboard/studio/sportlink/birthdays/new"><div><Gift size={25} /><ArrowRight size={16} /></div><strong>Verjaardagen</strong><p>Zet jarige leden in het zonnetje.</p></Link></div>
      <details><summary>Periode, poule en alle aanvullende varianten</summary>
      <ChoiceGroup
        description="Eén gekoppeld component dat automatisch over de geselecteerde teams en pagina’s wisselt."
        keys={arrivalKeys}
        label="Welkom bij de club"
        selected={selected}
        toggle={toggle}
      />
      <ChoiceGroup
        description="Clubprogramma en -uitslagen worden één slide met teamfilter; poules behouden hun eigen teamcontext."
        keys={regularKeys}
        label="Wedstrijden en poules"
        selected={selected}
        toggle={toggle}
      />
      <Button asChild type="button" variant="secondary"><Link href="/dashboard/slides/new">Alle Sportlink-slidefamilies openen</Link></Button>
      </details>
    </>
  );
}

function ChoiceGroup({ description, keys, label, selected, toggle }: {
  description: string;
  keys: SportlinkSlideBlueprintKey[];
  label: string;
  selected: SportlinkSlideBlueprintKey[];
  toggle: (key: SportlinkSlideBlueprintKey) => void;
}) {
  const families = keys.reduce<Array<{ label: string; keys: SportlinkSlideBlueprintKey[] }>>((result, key) => {
    const blueprint = sportlinkSlideBlueprints[key];
    const names: Record<string, string> = { sport_program: "Programma", sport_results: "Uitslagen", sport_standing: "Stand", sport_visitor_arrivals: "Bezoekers welkom", sport_referee_arrivals: "Scheidsrechters welkom" };
    const name = `${names[blueprint.slideType] ?? shortBlueprintLabel(key)}${isArrivalKey(key) ? "" : blueprint.scope === "pool" ? " · poule" : " · club"}`;
    const family = result.find((candidate) => candidate.label === name);
    if (family) family.keys.push(key); else result.push({ label: name, keys: [key] });
    return result;
  }, []);
  return <section className={styles.choiceGroup}>
    <header><div><h3>{label}</h3><p>{description}</p></div></header>
    <div className={styles.familyChoices}>
      {families.map((family) => <fieldset key={family.label}>
        <legend><LayoutGrid aria-hidden="true" />{family.label}</legend>
        <p>{family.keys.length > 1 ? "Kies de periode die je wilt tonen." : "Automatische inhoud vanuit Sportlink."}</p>
        <div role="group" aria-label={`${family.label} selecteren`}>
          {family.keys.map((key) => <button aria-pressed={selected.includes(key)}
            aria-label={`${shortBlueprintLabel(key)} ${windowLabel(sportlinkSlideBlueprints[key].window)}`}
            key={key} onClick={() => toggle(key)} type="button">
            <span>{family.keys.length > 1 ? windowLabel(sportlinkSlideBlueprints[key].window) : "Toevoegen"}</span>
            <span aria-hidden="true">{selected.includes(key) ? <Check /> : null}</span>
          </button>)}
        </div>
      </fieldset>)}
    </div>
  </section>;
}

function TeamStep({
  arrivalSelections,
  selectedBlueprints,
  selections,
  matchLocations,
  teams,
  updateArrivalSelection,
  updateMatchLocation,
  updateRegularSelection
}: {
  arrivalSelections: Partial<Record<SportlinkSlideBlueprintKey, string[]>>;
  selectedBlueprints: SportlinkSlideBlueprintKey[];
  selections: Partial<
    Record<SportlinkSlideBlueprintKey, BlueprintTeamSelection>
  >;
  matchLocations: Partial<
    Record<SportlinkSlideBlueprintKey, SportlinkMatchLocation[]>
  >;
  teams: Team[];
  updateArrivalSelection: (
    key: SportlinkSlideBlueprintKey,
    teamIds: string[]
  ) => void;
  updateMatchLocation: (
    key: SportlinkSlideBlueprintKey,
    value: SportlinkMatchLocation[]
  ) => void;
  updateRegularSelection: (
    key: SportlinkSlideBlueprintKey,
    teamIds: string[]
  ) => void;
}) {
  return (
    <>
      <StepHeading
        description="Kies per onderdeel meerdere teams in één compacte dropdown. Zoek op teamnaam of kies Alle teams voor een clubbrede slide die toekomstige teams automatisch meeneemt."
        eyebrow="Selectie"
        title="Welke teams horen erbij?"
      />
      <div className={styles.teamSelectors}>
        {selectedBlueprints.map((key) => {
          const arrival = isArrivalKey(key);
          const clubwide = isClubwideMatchKey(key);
          const selection = selections[key];
          const selectedIds = arrival
            ? arrivalSelections[key] ?? []
            : selection?.mode === "all"
              ? [allTeamsValue]
              : selection?.teamIds ?? [];
          const maximumSelected = clubwide
            ? sportlinkSlideTeamContextsMax + 1
            : arrival
              ? sportlinkSlideTeamContextsMax
              : sportlinkSlideBatchMaxDrafts;
          const options = [
            ...(clubwide ? [{
              description: "Volgt ook teams die later via Sportlink worden toegevoegd.",
              label: "Alle teams (ook toekomstige)",
              value: allTeamsValue
            }] : []),
            ...teams.map((team) => ({
              description: clubwide
                ? "Team opnemen in deze clubbrede slide"
                : "Actuele competitie als standaard",
              label: team.name,
              value: team.externalId
            }))
          ];
          return (
            <section className={styles.teamSelectorCard} key={key}>
              <MultiSelectDropdown
                allowSelectAll={!clubwide}
                description={arrival
                  ? "Eén gekoppeld welkomstcomponent verdeelt deze teams automatisch over schermpagina’s."
                  : clubwide
                    ? "Alle keuzes komen als teamfilter in precies één clubbrede slide; er worden geen losse teamslides gemaakt."
                    : "Voor poulecontent blijft ieder gekozen team een eigen teamcontext."}
                emptyLabel="Er zijn nog geen gesynchroniseerde teams beschikbaar."
                label={shortBlueprintLabel(key)}
                maximumSelected={maximumSelected}
                onValueChange={(teamIds) => arrival
                  ? updateArrivalSelection(key, teamIds)
                  : updateRegularSelection(key, teamIds)}
                options={options}
                placeholder="Kies minimaal één team of Alle teams"
                searchLabel="Teams zoeken"
                searchPlaceholder="Typ een teamnaam"
                searchable
                selectAllLabel={teams.length > maximumSelected
                  ? "Eerste " + maximumSelected + " teams selecteren"
                  : "Alle huidige teams selecteren"}
                selectionNoun={{ plural: "teams", singular: "team" }}
                showSelectedChips={selectedIds.length <= 24}
                value={selectedIds}
              />
              {clubwide ? (
                <SportlinkMatchLocationsField
                  onChange={(value) => updateMatchLocation(key, value)}
                  values={matchLocations[key] ?? ["both"]}
                />
              ) : null}
            </section>
          );
        })}
      </div>
      {!teams.length ? (
        <p className="notice notice--warning">
          Er zijn nog geen gesynchroniseerde teams beschikbaar.
        </p>
      ) : null}
    </>
  );
}

function CompetitionStep({ setTeamContexts, teamContexts, teams, usage }: {
  setTeamContexts: Dispatch<SetStateAction<Record<string, SportlinkSlideContext>>>;
  teamContexts: Record<string, SportlinkSlideContext>;
  teams: Team[];
  usage: (teamId: string) => SportlinkSlideBlueprintKey[];
}) {
  const [activeTeamId, setActiveTeamId] = useState(teams[0]?.externalId ?? "");
  const activeTeam = teams.find((team) => team.externalId === activeTeamId) ??
    teams[0];
  const pinnedCount = teams.filter((team) =>
    (teamContexts[team.externalId] ?? initialContext(team))
      .competitionSelectionMode === "pinned"
  ).length;

  if (!activeTeam) {
    return (
      <>
        <StepHeading
          description="Selecteer eerst minimaal één team."
          eyebrow="Context"
          title="Geen teams geselecteerd"
        />
        <p className="notice notice--warning">
          Ga terug naar Teams selecteren en voeg een team of Alle teams toe.
        </p>
      </>
    );
  }

  const context = teamContexts[activeTeam.externalId] ??
    initialContext(activeTeam);
  const usedBy = usage(activeTeam.externalId);

  return (
    <>
      <StepHeading
        description="Alle teams volgen standaard automatisch hun actuele competitie. Kies hieronder alleen het team waarvoor je bewust een andere competitie, fase of poule wilt vastzetten."
        eyebrow="Context"
        title="Actuele competitie, tenzij jij afwijkt"
      />
      <div className={styles.contextToolbar}>
        <Field label="Team aanpassen">
          {({ controlProps }) => (
            <select
              {...controlProps}
              onChange={(event) => setActiveTeamId(event.target.value)}
              value={activeTeam.externalId}
            >
              {teams.map((team) => {
                const teamContext = teamContexts[team.externalId] ??
                  initialContext(team);
                return (
                  <option key={team.externalId} value={team.externalId}>
                    {team.name}
                    {teamContext.competitionSelectionMode === "pinned"
                      ? " · Vastgezet"
                      : ""}
                  </option>
                );
              })}
            </select>
          )}
        </Field>
        <div className={styles.contextSummary} role="status">
          <strong>{teams.length} {teams.length === 1 ? "team" : "teams"}</strong>
          <span>
            {pinnedCount
              ? pinnedCount + " individueel vastgezet"
              : "Alle teams volgen de actuele competitie"}
          </span>
        </div>
      </div>
      <div className={styles.contextList}>
        <section>
          <header>
            <div>
              <h3>{activeTeam.name}</h3>
              <p>{usedBy.map(shortBlueprintLabel).join(" · ")}</p>
            </div>
            <StatusPill
              label={context.competitionSelectionMode === "auto_current"
                ? "Actuele competitie"
                : "Vastgezet"}
              tone={context.competitionSelectionMode === "auto_current"
                ? "success"
                : "info"}
            />
          </header>
          <fieldset className={styles.contextModes}>
            <legend className="vc-visually-hidden">
              Competitiekeuze voor {activeTeam.name}
            </legend>
            <label data-selected={context.competitionSelectionMode === "auto_current"}>
              <input
                checked={context.competitionSelectionMode === "auto_current"}
                name={"competition-" + activeTeam.externalId}
                onChange={() => setTeamContexts((all) => ({
                  ...all,
                  [activeTeam.externalId]: initialContext(activeTeam)
                }))}
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
                disabled={!activeTeam.contexts.length}
                name={"competition-" + activeTeam.externalId}
                onChange={() => setTeamContexts((all) => ({
                  ...all,
                  [activeTeam.externalId]: pinnedContext(activeTeam, context)
                }))}
                type="radio"
              />
              <span>
                <strong>Zelf kiezen</strong>
                <small>Voor een beker, fase of specifieke poule.</small>
              </span>
            </label>
          </fieldset>
          {context.competitionSelectionMode === "pinned" ? (
            <ContextSelect
              contexts={activeTeam.contexts}
              onChange={(next) => setTeamContexts((all) => ({
                ...all,
                [activeTeam.externalId]: next
              }))}
              teamId={activeTeam.externalId}
              value={context}
            />
          ) : null}
        </section>
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
  const hasProgram = drafts.some((draft) =>
    sportlinkSlideBlueprints[draft.blueprintKey].slideType === "sport_program"
  );
  const hasResults = drafts.some((draft) =>
    sportlinkSlideBlueprints[draft.blueprintKey].slideType === "sport_results"
  );
  const hasMatchRows = hasProgram || hasResults;
  function updateDisplay(patch: Partial<SportlinkDisplayConfig>) {
    setDisplay((current) => sportlinkDisplayConfigSchema.parse({
      ...current,
      ...patch
    }));
  }
  return (
    <>
      <StepHeading
        description="Kies welke wedstrijdinformatie zichtbaar is. De gekozen vormgeving wordt samen met je ontwerp bewaard."
        eyebrow="Vormgeving"
        title="Rustig, herkenbaar en leesbaar op afstand"
      />
      <FieldFlowStyleStep
        label="Slidehuisstijl voor deze onderdelen"
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
              onClick={() => {
                setOrientation(value);
                if (value === "portrait") {
                  setDisplay((current) => ({ ...current, columns: "one" }));
                }
              }}
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
        <div className={styles.displayGroups}>
          <fieldset className={styles.displayGroup}>
            <legend>Indeling</legend>
            <label>
              <input
                checked={orientation === "landscape" && display.columns === "two"}
                disabled={orientation === "portrait"}
                onChange={(event) => updateDisplay({
                  columns: event.target.checked ? "two" : "one"
                })}
                type="checkbox"
              />
              Twee kolommen (alleen liggend)
            </label>
          </fieldset>
          {hasMatchRows ? (
            <fieldset className={styles.displayGroup}>
              <legend>Eerste regel</legend>
              <label><input checked={display.showDate} onChange={(event) => updateDisplay({ showDate: event.target.checked })} type="checkbox" /> Datum tonen</label>
              <label><input checked={display.showTime} onChange={(event) => updateDisplay({ showTime: event.target.checked })} type="checkbox" /> Tijd tonen</label>
              <label><input checked={display.showHomeLogo} onChange={(event) => updateDisplay({ showHomeLogo: event.target.checked })} type="checkbox" /> Logo thuisclub tonen</label>
              <label><input checked={display.showAwayLogo} onChange={(event) => updateDisplay({ showAwayLogo: event.target.checked })} type="checkbox" /> Logo uitclub tonen</label>
              {hasProgram ? <>
                <label><input checked={display.showHomeDressingRoom} onChange={(event) => updateDisplay({ showHomeDressingRoom: event.target.checked })} type="checkbox" /> Kleedkamer thuis tonen</label>
                <label><input checked={display.showAwayDressingRoom} onChange={(event) => updateDisplay({ showAwayDressingRoom: event.target.checked })} type="checkbox" /> Kleedkamer uit tonen</label>
              </> : null}
            </fieldset>
          ) : null}
          {hasProgram ? (
            <fieldset className={styles.displayGroup}>
              <legend>Tweede regel</legend>
              <label><input checked={display.showReferee} onChange={(event) => updateDisplay({ showReferee: event.target.checked })} type="checkbox" /> Scheidsrechter tonen</label>
              <label><input checked={display.showField} onChange={(event) => updateDisplay({ showField: event.target.checked })} type="checkbox" /> Veld tonen</label>
              <label><input checked={display.showSportpark} onChange={(event) => updateDisplay({ showSportpark: event.target.checked })} type="checkbox" /> Sportpark tonen</label>
            </fieldset>
          ) : null}
          {!hasMatchRows ? (
            <p>Voor een poulestand zijn alleen kolommen relevant.</p>
          ) : null}
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

function ReviewStep({ creationResult, drafts, onNameChange, teamName, themeSelection }: {
  onNameChange: (draft: SportlinkSlideDraft, name: string) => void;
  creationResult: SportlinkSlideBatchActionResult | null;
  drafts: SportlinkSlideDraft[];
  teamName: (teamId: string) => string;
  themeSelection: ThemeSelection;
}) {
  return (
    <>
      <StepHeading
        description="Controleer de complete selectie. VeyoCast maakt pas slides nadat je onderaan expliciet op Aanmaken klikt; deze pagina blijft daarna staan met het echte resultaat."
        eyebrow="Klaarzetten"
        title={drafts.length + " " +
          (drafts.length === 1 ? "slide staat" : "slides staan") + " klaar"}
      />
      {creationResult ? (
        <p
          className={creationResult.ok
            ? "notice notice--success"
            : "notice notice--critical"}
          role={creationResult.ok ? "status" : "alert"}
        >
          <strong>
            {creationResult.ok ? "Slides gemaakt." : "Slides niet gemaakt."}
          </strong>{" "}
          {creationResult.ok
            ? creationResult.count + " " +
              (creationResult.count === 1 ? "slide is" : "slides zijn") +
              " als concept aangemaakt en staat in de renderwachtrij."
            : creationResult.message}
        </p>
      ) : (
        <p className="notice" role="note">
          Er is nog niets aangemaakt. Controleer de regels hieronder en bevestig
          daarna één keer met de knop Aanmaken.
        </p>
      )}
      {creationResult && !creationResult.ok && creationResult.existingSlides?.length ? (
        <div className={styles.createdList} aria-label="Bestaande slides">
          {creationResult.existingSlides.map((slide) => <Link href={`/dashboard/slides/${slide.slideId}/edit`} key={slide.slideId}><span>{slide.name}</span><StatusPill label="Bestaat al · bewerken" tone="info" /></Link>)}
        </div>
      ) : null}
      {creationResult?.ok ? (
        <div className={styles.createdList}>
          {creationResult.slides.map((slide) => (
            <Link href={"/dashboard/slides/" + slide.slideId} key={slide.slideId}>
              <span>{slide.name}</span>
              <StatusPill label="Concept aangemaakt" tone="success" />
            </Link>
          ))}
        </div>
      ) : null}
      <div className={styles.reviewList}>
        {drafts.map((draft) => {
          const slideType = sportlinkSlideBlueprints[draft.blueprintKey].slideType;
          const matchRows = slideType === "sport_program" ||
            slideType === "sport_results";
          const clubSelection = draft.teamSelection;
          const contexts = clubSelection?.teamContexts ??
            draft.teamContexts ??
            [draft.context];
          const arrival = isArrivalKey(draft.blueprintKey);
          const clubwide = Boolean(clubSelection);
          const visibleContexts = contexts.slice(0, 8);
          const pinnedContexts = contexts.filter((context) =>
            context.competitionSelectionMode === "pinned"
          );
          return (
            <section key={draftKey(draft)}>
              <span className={styles.reviewIcon}>
                <Check aria-hidden="true" />
              </span>
              <div>
                <span className={styles.kicker}>
                  {clubwide
                    ? "Eén clubbrede slide"
                    : arrival
                      ? "Gekoppeld welkomstcomponent"
                      : "Dynamische teamslide"}
                </span>
                <h3>{shortBlueprintLabel(draft.blueprintKey)}</h3>
                <label className={styles.slideNameField}>
                  <span>Naam in bibliotheek</span>
                  <input aria-label={`Slidenaam ${teamName(draft.context.providerTeamId)} · ${shortBlueprintLabel(draft.blueprintKey)}`} disabled={Boolean(creationResult?.ok)} minLength={2} maxLength={120} required
                    value={draft.name} onChange={(event) => onNameChange(draft, event.target.value)} />
                  <small>Bijvoorbeeld: Kantine · {shortBlueprintLabel(draft.blueprintKey)}. Deze naam helpt je de slide terug te vinden.</small>
                </label>
                <p>
                  {clubSelection?.mode === "all"
                    ? "Alle teams, inclusief later toegevoegde Sportlink-teams"
                    : clubwide
                      ? contexts.length + " " +
                        (contexts.length === 1 ? "team" : "teams") +
                        " als filter in dezelfde slide"
                      : arrival
                        ? contexts.length + " " +
                          (contexts.length === 1 ? "team" : "teams") +
                          " · automatisch gepagineerd"
                        : teamName(draft.context.providerTeamId) + " · " +
                          (draft.context.competitionSelectionMode === "auto_current"
                            ? "actuele competitie"
                            : contextLabel(draft.context))}
                </p>
                {(clubwide || arrival) &&
                clubSelection?.mode !== "all" ? (
                  <div className={styles.reviewTags}>
                    {visibleContexts.map((context) => (
                      <span key={context.providerTeamId}>
                        {teamName(context.providerTeamId)}
                      </span>
                    ))}
                    {contexts.length > visibleContexts.length ? (
                      <span>+{contexts.length - visibleContexts.length} meer</span>
                    ) : null}
                  </div>
                ) : null}
                {clubwide || arrival ? (
                  <details className={styles.reviewDetails}>
                    <summary>
                      Competities per team · {clubSelection?.mode === "all"
                        ? pinnedContexts.length + " " +
                          (pinnedContexts.length === 1 ? "afwijking" : "afwijkingen")
                        : contexts.length + " " +
                          (contexts.length === 1 ? "team" : "teams")}
                    </summary>
                    {contexts.length ? (
                      <ul>
                        {contexts.map((context) => (
                          <li key={context.providerTeamId}>
                            <strong>{teamName(context.providerTeamId)}</strong>
                            <span>
                              {context.competitionSelectionMode === "auto_current"
                                ? "Actuele competitie"
                                : contextLabel(context)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Alle teams volgen automatisch hun actuele competitie.</p>
                    )}
                  </details>
                ) : null}
                <ul className={styles.reviewOptions} aria-label="Weergavekeuzes">
                  <li>{draft.display.columns === "one" ? "1 kolom" : "2 kolommen"}</li>
                  {matchRows ? <>
                    <li>Datum {draft.display.showDate ? "aan" : "uit"}</li>
                    <li>Tijd {draft.display.showTime ? "aan" : "uit"}</li>
                    <li>Thuislogo {draft.display.showHomeLogo ? "aan" : "uit"}</li>
                    <li>Uitlogo {draft.display.showAwayLogo ? "aan" : "uit"}</li>
                  </> : null}
                  {clubwide ? (
                    <li>{matchLocationLabel(clubSelection?.matchLocation)}</li>
                  ) : null}
                  {slideType === "sport_program" ? <>
                    <li>Kleedkamer thuis {draft.display.showHomeDressingRoom ? "aan" : "uit"}</li>
                    <li>Kleedkamer uit {draft.display.showAwayDressingRoom ? "aan" : "uit"}</li>
                    <li>Scheidsrechter {draft.display.showReferee ? "aan" : "uit"}</li>
                    <li>Veld {draft.display.showField ? "aan" : "uit"}</li>
                    <li>Sportpark {draft.display.showSportpark ? "aan" : "uit"}</li>
                  </> : null}
                </ul>
              </div>
              <StatusPill
                label={themeCatalog[themeId(draft.themeSelection)].name}
                tone="success"
              />
            </section>
          );
        })}
      </div>
      <dl className={styles.reviewSummary}>
        <div>
          <dt>Standaardthema</dt>
          <dd>{themeCatalog[themeId(themeSelection)].name}</dd>
        </div>
        <div>
          <dt>Formaat</dt>
          <dd>
            {[...new Set(drafts.map((draft) =>
              draft.orientation === "portrait" ? "Staand" : "Liggend"
            ))].join(", ")}
          </dd>
        </div>
        <div><dt>Publicatie</dt><dd>Eerst als bewerkbaar concept</dd></div>
      </dl>
    </>
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

function matchLocationLabel(
  value: SportlinkMatchLocation | undefined
) {
  if (value === "home") return "Alleen eigen teams thuis";
  if (value === "away") return "Alleen eigen teams uit";
  return "Eigen teams thuis en uit";
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
  const contexts = draft.teamSelection?.teamContexts ?? draft.teamContexts;
  return [
    draft.blueprintKey,
    draft.teamSelection?.mode,
    draft.teamSelection?.matchLocation,
    contexts?.map((context) => context.providerTeamId).join(",") ??
      draft.context.providerTeamId
  ].filter(Boolean).join(":");
}

function isClubwideMatchKey(key: SportlinkSlideBlueprintKey) {
  const blueprint = sportlinkSlideBlueprints[key];
  return blueprint.scope === "club" && (
    blueprint.slideType === "sport_program" ||
    blueprint.slideType === "sport_results"
  );
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
    "sportlink.pool_schedule_today": "Programma poule vandaag",
    "sportlink.pool_schedule_next_7_days": "Programma poule",
    "sportlink.pool_results_today": "Uitslagen poule vandaag",
    "sportlink.pool_results_previous_7_days": "Uitslagen poule",
    "sportlink.pool_standings": "Poulestand",
    "sportlink.visitor_arrivals": "Bezoekers welkom",
    "sportlink.referee_arrivals": "Scheidsrechters welkom"
  };
  return labels[key];
}
