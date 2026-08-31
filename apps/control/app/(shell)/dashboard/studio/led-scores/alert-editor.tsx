"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Eye,
  Flag,
  LayoutGrid,
  MonitorPlay,
  RadioTower,
  Sparkles,
  Timer,
  Trophy,
  UsersRound
} from "lucide-react";

import { Badge, Button } from "@veyocast/ui";

import { saveLedScoresGoalAlert } from "./actions";
import {
  enabledMomentCount,
  normalizeProviderTeamKey,
  overlaySteps,
  readLineupBehavior,
  readOverlayDesign,
  readOverlayTriggers,
  type OverlayDesignKey,
  type OverlayDesignValue,
  type OverlayStepId
} from "./live-match-ux";
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
type GoalDesignKey = "opponent" | "own" | "unknown";
type PreviewKind = GoalDesignKey | OverlayDesignKey;
type PreviewChoice = { id: PreviewKind; label: string };
type EditableDesign = OverlayDesignValue & { scorerFallback?: string };

const overlayDesignKeys: OverlayDesignKey[] = [
  "lineupHome",
  "lineupAway",
  "matchStart",
  "halfTime",
  "matchEnd"
];

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
  const initialTriggers = readOverlayTriggers(initial.config);
  const initialLineup = readLineupBehavior(initial.config);
  const [activeStep, setActiveStep] = useState<OverlayStepId>("moments");
  const [experienceName, setExperienceName] = useState(initial.name);
  const [selectedGroups, setSelectedGroups] = useState(initial.groupIds);
  const [groupSearch, setGroupSearch] = useState("");
  const [connectionId, setConnectionId] = useState(initial.connectionId);
  const [priority, setPriority] = useState(initial.priority);
  const [underlayPolicy, setUnderlayPolicy] = useState(initial.underlayPolicy);
  const [previewKind, setPreviewKind] = useState<PreviewKind>("own");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [triggerOwn, setTriggerOwn] = useState(readBoolean(initial.config.triggerOwn, true));
  const [triggerOpponent, setTriggerOpponent] = useState(readBoolean(initial.config.triggerOpponent, true));
  const [triggers, setTriggers] = useState(initialTriggers);
  const [lineupBehavior, setLineupBehavior] = useState(initialLineup);
  const [goalDesigns, setGoalDesigns] = useState<Record<GoalDesignKey, EditableDesign>>({
    opponent: readGoalDesign(initial.config.opponentDesign, "Tegendoelpunt", "We blijven gaan"),
    own: readGoalDesign(initial.config.ownDesign, "GOOOAAAL!", "Voor de club"),
    unknown: readGoalDesign(initial.config.unknownDesign, "GOAL!", "Team nog niet gekoppeld")
  });
  const [overlayDesigns, setOverlayDesigns] = useState<Record<OverlayDesignKey, EditableDesign>>(
    Object.fromEntries(
      overlayDesignKeys.map((key) => [key, readOverlayDesign(initial.config, key)])
    ) as Record<OverlayDesignKey, EditableDesign>
  );
  const connection = connections.find((item) => item.id === connectionId) ?? connections[0];
  const ownMappings = connection?.mappings.filter((mapping) => mapping.side === "own") ?? [];
  const initialOwnTeamKeys = useMemo(
    () => new Set(readStringArray(initial.config.ownTeamKeys).map(normalizeProviderTeamKey)),
    [initial.config]
  );
  const normalizedGroupSearch = groupSearch.trim().toLocaleLowerCase("nl-NL");
  const selection = useMemo(
    () => summarizeSelection(groups, selectedGroups),
    [groups, selectedGroups]
  );
  const conflict = useMemo(() => alerts.find((alert) => {
    if (alert.id === initial.id || alert.status !== "published") return false;
    const other = summarizeSelection(groups, alert.groupIds).screenIds;
    return other.some((screenId) => selection.screenIds.includes(screenId));
  }), [alerts, groups, initial.id, selection.screenIds]);
  const momentCount = enabledMomentCount(triggerOwn, triggerOpponent, triggers);
  const missingDesignHeadline = [
    triggerOwn ? goalDesigns.own.headline : null,
    triggerOpponent ? goalDesigns.opponent.headline : null,
    triggerOwn || triggerOpponent ? goalDesigns.unknown.headline : null,
    triggers.lineup ? overlayDesigns.lineupHome.headline : null,
    triggers.lineup ? overlayDesigns.lineupAway.headline : null,
    triggers.start ? overlayDesigns.matchStart.headline : null,
    triggers.halfTime ? overlayDesigns.halfTime.headline : null,
    triggers.end ? overlayDesigns.matchEnd.headline : null
  ].some((headline) => headline !== null && !headline.trim());
  const activeStepIndex = overlaySteps.findIndex((step) => step.id === activeStep);
  const previewChoices = previewChoicesFor(triggerOwn, triggerOpponent, triggers);
  const effectivePreviewKind = previewChoices.some((choice) => choice.id === previewKind)
    ? previewKind
    : previewChoices[0]?.id ?? "own";
  const previewDesign = effectivePreviewKind in overlayDesigns
    ? overlayDesigns[effectivePreviewKind as OverlayDesignKey]
    : goalDesigns[effectivePreviewKind as GoalDesignKey];

  function moveStep(delta: -1 | 1) {
    const next = overlaySteps[Math.max(0, Math.min(overlaySteps.length - 1, activeStepIndex + delta))];
    if (next) setActiveStep(next.id);
  }

  function updateGoalDesign(key: GoalDesignKey, patch: Partial<EditableDesign>) {
    setGoalDesigns((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    setPreviewKind(key);
  }

  function updateOverlayDesign(key: OverlayDesignKey, patch: Partial<EditableDesign>) {
    setOverlayDesigns((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    setPreviewKind(key);
  }

  return (
    <form action={saveLedScoresGoalAlert} className={styles.experienceEditor}>
      {initial.id ? <input name="alertId" type="hidden" value={initial.id} /> : null}
      <input name="expectedRevision" type="hidden" value={initial.revision} />
      {!triggerOwn ? <HiddenDesignFields design={goalDesigns.own} prefix="own" withScorerFallback /> : null}
      {!triggerOpponent ? <HiddenDesignFields design={goalDesigns.opponent} prefix="opponent" withScorerFallback /> : null}
      {!triggerOwn && !triggerOpponent ? <HiddenDesignFields design={goalDesigns.unknown} prefix="unknown" withScorerFallback /> : null}
      {!triggers.lineup ? <>
        <HiddenDesignFields design={overlayDesigns.lineupHome} prefix="lineupHome" />
        <HiddenDesignFields design={overlayDesigns.lineupAway} prefix="lineupAway" />
        {lineupBehavior.selectedOnly ? <input name="lineupSelectedOnly" type="hidden" value="on" /> : null}
        {lineupBehavior.activeFallback ? <input name="lineupActiveFallback" type="hidden" value="on" /> : null}
        <input name="lineupPageDurationMs" type="hidden" value={lineupBehavior.pageDurationMs} />
      </> : null}
      {!triggers.start ? <HiddenDesignFields design={overlayDesigns.matchStart} prefix="matchStart" /> : null}
      {!triggers.halfTime ? <HiddenDesignFields design={overlayDesigns.halfTime} prefix="halfTime" /> : null}
      {!triggers.end ? <HiddenDesignFields design={overlayDesigns.matchEnd} prefix="matchEnd" /> : null}

      <nav aria-label="Stappen voor wedstrijdmomenten" className={styles.wizardNav}>
        <p className={styles.wizardNavTitle}>Overlay experience</p>
        <ol>
          {overlaySteps.map((step, index) => (
            <li key={step.id}>
              <button
                aria-current={activeStep === step.id ? "step" : undefined}
                onClick={() => setActiveStep(step.id)}
                type="button"
              >
                <span>{activeStepIndex > index ? <Check aria-hidden="true" /> : index + 1}</span>
                <span><strong>{step.label}</strong><small>{step.description}</small></span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <main className={styles.wizardStage}>
        <section aria-labelledby="experience-moments" hidden={activeStep !== "moments"}>
          <StepHeading
            description="LED Scores stuurt live status. Jij kiest welke veranderingen tijdelijk boven de playlist verschijnen."
            icon={<RadioTower aria-hidden="true" />}
            number={1}
            title="Bron en momenten"
          />
          <div className={styles.fieldGrid}>
            <label><span>Naam van deze experience</span><input maxLength={120} name="name" onChange={(event) => setExperienceName(event.target.value)} placeholder="Wedstrijddag hoofdveld" required value={experienceName} /></label>
            <label><span>LED Scores-verbinding</span><select name="connectionId" onChange={(event) => setConnectionId(event.target.value)} required value={connectionId}>{connections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span>Prioriteit</span><input max={1000} min={0} name="priority" onChange={(event) => setPriority(Number(event.target.value))} type="number" value={priority} /></label>
            <label><span>Standaardduur overlay</span><select defaultValue={initial.durationMs} name="durationMs"><option value="5000">5 seconden</option><option value="8000">8 seconden</option><option value="12000">12 seconden</option><option value="20000">20 seconden</option></select></label>
            <label><span>Onderliggende playlist</span><select name="underlayPolicy" onChange={(event) => setUnderlayPolicy(event.target.value)} value={underlayPolicy}><option value="continue">Laat doorgaan</option><option value="pause">Pauzeer en hervat exact</option></select></label>
            <label><span>Actief vanaf (UTC, optioneel)</span><input defaultValue={dateTimeValue(initial.config.activeFrom)} name="activeFrom" type="datetime-local" /></label>
            <label><span>Actief tot (UTC, optioneel)</span><input defaultValue={dateTimeValue(initial.config.activeUntil)} name="activeUntil" type="datetime-local" /></label>
          </div>

          <div className={styles.subsectionHeading}>
            <div><h3>Automatische momenten</h3><p>{momentCount} van 5 momentsoorten actief. Een bronknop veroorzaakt alleen een overlay wanneer die hier is ingeschakeld.</p></div>
            <Badge status={momentCount ? "success" : "warning"}>{momentCount ? `${momentCount} actief` : "Kies een moment"}</Badge>
          </div>
          <div className={styles.momentGrid}>
            <article className={styles.momentCard} data-selected={triggerOwn || triggerOpponent || undefined}>
              <div className={styles.momentIcon}><Trophy aria-hidden="true" /></div>
              <div><strong>Goal</strong><p>Direct score-impact, daarna naam, rugnummer en foto zodra de scorer bekend is.</p></div>
              <div className={styles.inlineChecks}>
                <label><input checked={triggerOwn} name="triggerOwn" onChange={(event) => setTriggerOwn(event.target.checked)} type="checkbox" />Eigen team</label>
                <label><input checked={triggerOpponent} name="triggerOpponent" onChange={(event) => setTriggerOpponent(event.target.checked)} type="checkbox" />Tegenstander</label>
              </div>
            </article>
            <MomentChoice
              checked={triggers.lineup}
              description="Toont thuis- of uitopstelling op het moment dat de LED Scores-knop wordt gebruikt."
              icon={<UsersRound aria-hidden="true" />}
              label="Opstelling"
              name="triggerLineup"
              onChange={(checked) => setTriggers((current) => ({ ...current, lineup: checked }))}
            />
            <MomentChoice
              checked={triggers.start}
              description="Een krachtige intro zodra LED Scores de wedstrijd als gestart markeert."
              icon={<Flag aria-hidden="true" />}
              label="Start wedstrijd"
              name="triggerStart"
              onChange={(checked) => setTriggers((current) => ({ ...current, start: checked }))}
            />
            <MomentChoice
              checked={triggers.halfTime}
              description="Toont de actuele score wanneer de provider rust activeert."
              icon={<Timer aria-hidden="true" />}
              label="Rust"
              name="triggerHalfTime"
              onChange={(checked) => setTriggers((current) => ({ ...current, halfTime: checked }))}
            />
            <MomentChoice
              checked={triggers.end}
              description="Sluit af met de laatst bevestigde eindstand."
              icon={<Trophy aria-hidden="true" />}
              label="Einde wedstrijd"
              name="triggerEnd"
              onChange={(checked) => setTriggers((current) => ({ ...current, end: checked }))}
            />
          </div>

          {triggers.lineup ? (
            <fieldset className={styles.optionPanel}>
              <legend>Gedrag bij opstellingen</legend>
              <label><input checked={lineupBehavior.selectedOnly} name="lineupSelectedOnly" onChange={(event) => setLineupBehavior((current) => ({ ...current, selectedOnly: event.target.checked }))} type="checkbox" />Gebruik de geselecteerde wedstrijdopstelling</label>
              <label><input checked={lineupBehavior.activeFallback} name="lineupActiveFallback" onChange={(event) => setLineupBehavior((current) => ({ ...current, activeFallback: event.target.checked }))} type="checkbox" />Gebruik alle actieve spelers als er geen selectie is</label>
              <label><input checked={lineupBehavior.includeOpponent} name="lineupIncludeOpponent" onChange={(event) => setLineupBehavior((current) => ({ ...current, includeOpponent: event.target.checked }))} type="checkbox" />Opstelling van de tegenstander opslaan en tonen</label>
              <label><span>Duur per spelerspagina</span><select name="lineupPageDurationMs" onChange={(event) => setLineupBehavior((current) => ({ ...current, pageDurationMs: Number(event.target.value) }))} value={lineupBehavior.pageDurationMs}><option value="4000">4 seconden</option><option value="6000">6 seconden</option><option value="8000">8 seconden</option><option value="10000">10 seconden</option></select></label>
              {!lineupBehavior.includeOpponent ? <p><strong>Privacyvriendelijke standaard.</strong> VeyoCast bewaart en toont alleen spelers van je eigen clubteam. Schakel de tegenstander bewust in wanneer je ook de uitopstelling wilt gebruiken.</p> : null}
              {!lineupBehavior.activeFallback ? <p><strong>Veilige standaard.</strong> Een lege geselecteerde opstelling wordt niet als volledig basiselftal gepresenteerd.</p> : null}
            </fieldset>
          ) : null}

          <fieldset className={styles.triggerFields}>
            <legend>Goalbeleid</legend>
            <label><span>Onbekende teammapping</span><select defaultValue={readString(initial.config.unknownPolicy) || "suppress"} name="unknownPolicy"><option value="suppress">Veilig onderdrukken</option><option value="generic">Generieke GOAL tonen</option></select></label>
            <p>Home en away zijn wedstrijdposities; een eigen clubteam kan dus ook uit spelen.</p>
          </fieldset>
          {ownMappings.length ? (
            <fieldset className={styles.triggerFields}>
              <legend>Eigen clubteams</legend>
              <p>Geen selectie betekent: ieder als eigen geclassificeerd team op deze verbinding.</p>
              {ownMappings.map((mapping) => <label key={mapping.teamKey}><input defaultChecked={initialOwnTeamKeys.has(normalizeProviderTeamKey(mapping.teamKey))} name="ownTeamKeys" type="checkbox" value={mapping.teamKey} />{mapping.teamName}</label>)}
            </fieldset>
          ) : (
            <p className="notice notice--warning"><strong>Nog geen eigen teammapping.</strong> Classificeer eerst minimaal één providerteam als eigen clubteam; onbekende goals volgen het gekozen fallbackbeleid.</p>
          )}
        </section>

        <section aria-labelledby="experience-design" hidden={activeStep !== "design"}>
          <StepHeading
            description="Elk moment heeft een veilige standaard. Live velden worden door VeyoCast gebonden; je hoeft geen spelersnamen in het ontwerp te zetten."
            icon={<Sparkles aria-hidden="true" />}
            number={2}
            title="Vormgeving en databinding"
          />
          <div className={styles.bindingStrip}>
            <span><CircleUserRound aria-hidden="true" />Spelerfoto</span>
            <span># Rugnummer</span>
            <span>Spelernaam</span>
            <span>Score</span>
            <span>Wedstrijdklok</span>
            <small>Automatisch uit de laatst gevalideerde LED Scores-status; ontbrekende waarden gebruiken je fallback.</small>
          </div>

          {(triggerOwn || triggerOpponent) ? (
            <DesignDisclosure
              badge="Tweefasig"
              description="Score verschijnt direct. Dezelfde overlay onthult de speler zodra LED Scores de keuze doorstuurt."
              icon={<Trophy aria-hidden="true" />}
              title="Goal"
            >
              {triggerOwn ? <DesignFields design={goalDesigns.own} label="Eigen goal" onChange={(patch) => updateGoalDesign("own", patch)} prefix="own" /> : null}
              {triggerOpponent ? <DesignFields design={goalDesigns.opponent} label="Goal tegenstander" onChange={(patch) => updateGoalDesign("opponent", patch)} prefix="opponent" /> : null}
              <DesignFields design={goalDesigns.unknown} label="Onbekend team" onChange={(patch) => updateGoalDesign("unknown", patch)} prefix="unknown" />
            </DesignDisclosure>
          ) : null}

          {triggers.lineup ? (
            <DesignDisclosure
              badge="Thuis en uit"
              description="Dezelfde rasterlogica, met een eigen stijl per wedstrijdzijde. Spelers worden automatisch gepagineerd."
              icon={<LayoutGrid aria-hidden="true" />}
              title="Opstelling"
            >
              <OverlayDesignFields design={overlayDesigns.lineupHome} designKey="lineupHome" label="Thuisopstelling" onChange={(patch) => updateOverlayDesign("lineupHome", patch)} />
              <OverlayDesignFields design={overlayDesigns.lineupAway} designKey="lineupAway" label="Uitopstelling" onChange={(patch) => updateOverlayDesign("lineupAway", patch)} />
            </DesignDisclosure>
          ) : null}
          {triggers.start ? <OverlayDisclosure design={overlayDesigns.matchStart} designKey="matchStart" description="Teamnamen, clublogo's en startstatus in één krachtige matchdayintro." icon={<Flag aria-hidden="true" />} label="Start wedstrijd" onChange={updateOverlayDesign} /> : null}
          {triggers.halfTime ? <OverlayDisclosure design={overlayDesigns.halfTime} designKey="halfTime" description="Rustige scorefocus met de laatst bevestigde stand en klokstatus." icon={<Timer aria-hidden="true" />} label="Rust" onChange={updateOverlayDesign} /> : null}
          {triggers.end ? <OverlayDisclosure design={overlayDesigns.matchEnd} designKey="matchEnd" description="Eindstand met een duidelijke afsluiting zonder oude wedstrijddata te verzinnen." icon={<Trophy aria-hidden="true" />} label="Einde wedstrijd" onChange={updateOverlayDesign} /> : null}
        </section>

        <section aria-labelledby="experience-media" hidden={activeStep !== "media"}>
          <StepHeading
            description="Live spelerfoto's komen uit de gevalideerde wedstrijdstatus. Deze bibliotheekmedia zijn de veilige merk- en fallbacklaag."
            icon={<MonitorPlay aria-hidden="true" />}
            number={3}
            title="Media en fallback"
          />
          <div className={styles.fieldGrid}>
            <AssetSelect assets={assets.filter((asset) => asset.kind === "image")} defaultValue={readString(initial.config.logoMediaAssetId)} label="Clublogo" name="logoMediaAssetId" />
            <AssetSelect assets={assets} defaultValue={readString(initial.config.ownMediaAssetId)} label="Fallback eigen goal" name="ownMediaAssetId" />
            <AssetSelect assets={assets} defaultValue={readString(initial.config.opponentMediaAssetId)} label="Fallback tegenstander" name="opponentMediaAssetId" />
            <AssetSelect assets={assets} defaultValue={readString(initial.config.unknownMediaAssetId)} label="Fallback onbekend team" name="unknownMediaAssetId" />
            <AssetSelect assets={assets.filter((asset) => asset.kind === "video")} defaultValue={readString(initial.config.ownSoundMediaAssetId)} label="Geluid eigen goal (audio uit MP4)" name="ownSoundMediaAssetId" />
            <label><span>Volume eigen goal</span><input defaultValue={readNumber(initial.config.ownSoundVolume, 70)} max={100} min={0} name="ownSoundVolume" type="number" /></label>
            <AssetSelect assets={assets.filter((asset) => asset.kind === "video")} defaultValue={readString(initial.config.opponentSoundMediaAssetId)} label="Geluid tegenstander (audio uit MP4)" name="opponentSoundMediaAssetId" />
            <label><span>Volume tegenstander</span><input defaultValue={readNumber(initial.config.opponentSoundVolume, 45)} max={100} min={0} name="opponentSoundVolume" type="number" /></label>
            <label><span>Bestaand sponsorblok</span><select defaultValue={readString(initial.config.sponsorCreativeId)} name="sponsorCreativeId"><option value="">Geen sponsorblok</option>{sponsors.map((sponsor) => <option key={sponsor.id} value={sponsor.id}>{sponsor.label}</option>)}</select></label>
          </div>
          <label className={styles.singleCheck}><input defaultChecked={readBoolean(initial.config.sponsorOnlyOwn, true)} name="sponsorOnlyOwn" type="checkbox" />Sponsorblok alleen bij een eigen goal tonen</label>
          <div className={styles.fallbackFlow} aria-label="Volgorde voor spelermedia">
            <strong>Automatische mediafallback</strong>
            <ol><li>Spelerfoto uit LED Scores</li><li>Gekozen eigen-goalmedia</li><li>Clublogo en teksttemplate</li></ol>
          </div>
          <p className="notice"><strong>Geen vervorming.</strong> De Player kiest de juiste liggende of staande compositie. Een ontbrekende foto levert altijd de ontworpen fallback op, nooit een zwart frame.</p>
        </section>

        <section aria-labelledby="experience-targets" hidden={activeStep !== "targets"}>
          <StepHeading
            description="Kies groepen; VeyoCast rekent overlap terug tot één levering per uniek scherm."
            icon={<MonitorPlay aria-hidden="true" />}
            number={4}
            title="Schermen en bereik"
          />
          <label><span>Zoek schermgroep</span><input onChange={(event) => setGroupSearch(event.target.value)} placeholder="Zoek op groepsnaam" type="search" value={groupSearch} /></label>
          <div className={styles.groupGrid}>{groups.map((group) => (
            <label className={styles.groupChoice} hidden={Boolean(normalizedGroupSearch) && !group.name.toLocaleLowerCase("nl-NL").includes(normalizedGroupSearch)} key={group.id}>
              <input checked={selectedGroups.includes(group.id)} name="targetGroupIds" onChange={(event) => setSelectedGroups((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} type="checkbox" value={group.id} />
              <span><strong>{group.name}</strong><small>{group.screenIds.length} scherm{group.screenIds.length === 1 ? "" : "en"}</small></span>
            </label>
          ))}</div>
          <p className={styles.unionSummary}><strong>{selection.screenIds.length} unieke schermen.</strong> {selection.overlapCount ? `${selection.overlapCount} schermen zitten in meerdere gekozen groepen en ontvangen ieder moment één keer.` : "Geen overlap tussen de gekozen groepen."}</p>
          <details className={styles.targetDisclosure}><summary>Definitieve doelschermen bekijken</summary><ul className={styles.screenList}>{selection.screenIds.map((screenId) => { const screen = screens.find((item) => item.id === screenId); return <li key={screenId}><span>{screen?.name ?? "Onbekend scherm"}</span><small>{screen?.status === "online" ? "Online" : screen?.status === "stale" ? "Status verouderd" : "Offline"}</small></li>; })}</ul></details>
          {conflict ? <p className="notice notice--warning" role="status"><AlertTriangle aria-hidden="true" /><strong>Overlappende actieve experience.</strong> ‘{conflict.name}’ raakt dezelfde schermen met prioriteit {conflict.priority}. Per moment en scherm wint hoogste prioriteit; bij gelijkstand de nieuwste publicatie.</p> : null}
        </section>

        <section aria-labelledby="experience-review" hidden={activeStep !== "review"}>
          <StepHeading
            description="Controleer de bron, momenten en doelgroep. Opslaan maakt eerst een concept; publiceren blijft een aparte immutable stap."
            icon={<Check aria-hidden="true" />}
            number={5}
            title="Controleren en opslaan"
          />
          <div className={styles.reviewGrid}>
            <ReviewCard label="Bron" value={connection?.name ?? "Geen verbinding"} detail="Server-side read-only" />
            <ReviewCard label="Momenten" value={`${momentCount} actief`} detail={momentSummary(triggerOwn, triggerOpponent, triggers)} />
            <ReviewCard label="Doelgroep" value={`${selection.screenIds.length} unieke schermen`} detail={`${selectedGroups.length} schermgroep${selectedGroups.length === 1 ? "" : "en"}`} />
            <ReviewCard label="Prioriteit" value={String(priority)} detail={underlayPolicy === "pause" ? "Playlist pauzeert" : "Playlist speelt door"} />
          </div>
          {!momentCount ? <p className="notice notice--critical" role="alert"><strong>Er is nog geen moment gekozen.</strong> Ga terug naar Momenten en activeer minimaal één overlay.</p> : null}
          {!selection.screenIds.length ? <p className="notice notice--critical" role="alert"><strong>Er zijn nog geen doelschermen.</strong> Kies minimaal één schermgroep voordat je dit concept opslaat.</p> : null}
          {!experienceName.trim() ? <p className="notice notice--critical" role="alert"><strong>De experience heeft nog geen naam.</strong> Ga terug naar Momenten en geef dit concept een herkenbare naam.</p> : null}
          {missingDesignHeadline ? <p className="notice notice--critical" role="alert"><strong>Een actief moment mist een hoofdtekst.</strong> Ga terug naar Vormgeving en vul voor ieder actief moment de hoofdtekst in.</p> : null}
          <div className={styles.publishExplanation}>
            <div><span>1</span><p><strong>Concept opslaan</strong>Je vormgeving en schermselectie blijven bewerkbaar.</p></div>
            <div><span>2</span><p><strong>Immutable publiceren</strong>VeyoCast bevriest templates, doelgroep en media.</p></div>
            <div><span>3</span><p><strong>Live testen</strong>Per scherm zie je ontvangen, getoond, overgeslagen of mislukt.</p></div>
          </div>
        </section>

        <div className={styles.stepActions}>
          <Button disabled={activeStepIndex === 0} onClick={() => moveStep(-1)} type="button" variant="secondary"><ChevronLeft aria-hidden="true" />Vorige</Button>
          {activeStepIndex < overlaySteps.length - 1 ? <Button onClick={() => moveStep(1)} type="button">Volgende<ChevronRight aria-hidden="true" /></Button> : null}
        </div>
      </main>

      <aside className={styles.previewPanel} aria-label="Live voorbeeld">
        <div className={styles.previewToolbar}>
          <div><Eye aria-hidden="true" /><strong>Live voorbeeld</strong></div>
          <div role="group" aria-label="Schermstand"><button aria-pressed={orientation === "landscape"} onClick={() => setOrientation("landscape")} type="button">16:9</button><button aria-pressed={orientation === "portrait"} onClick={() => setOrientation("portrait")} type="button">9:16</button></div>
        </div>
        <PreviewKindPicker choices={previewChoices} current={effectivePreviewKind} onChange={setPreviewKind} />
        <ExperiencePreview design={previewDesign} kind={effectivePreviewKind} orientation={orientation} />
        <p><strong>{orientation === "landscape" ? "Liggende compositie" : "Staande compositie"}.</strong> De Player kiest automatisch op basis van de opgeslagen schermstand.</p>
      </aside>

      <div className={styles.saveBar}>
        <div><strong>{initial.id ? "Experienceconcept wijzigen" : "Nieuwe wedstrijdexperience"}</strong><span>{momentCount} momenten · {selection.screenIds.length} schermen · publiceren gebeurt daarna apart.</span></div>
        <ExperienceSubmit disabled={!experienceName.trim() || missingDesignHeadline || !selectedGroups.length || !connections.length || !momentCount} />
      </div>
    </form>
  );
}

function ExperienceSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <Button aria-busy={pending} disabled={disabled || pending} type="submit">
    {pending ? "Concept opslaan…" : "Concept opslaan"}
  </Button>;
}

function StepHeading({ description, icon, number, title }: { description: string; icon: ReactNode; number: number; title: string }) {
  return <div className={styles.sectionHeading}><div><span>{number}</span><div><h2 id={`experience-${overlaySteps[number - 1]?.id}`}>{title}</h2><p>{description}</p></div></div>{icon}</div>;
}

function MomentChoice({ checked, description, icon, label, name, onChange }: { checked: boolean; description: string; icon: ReactNode; label: string; name: string; onChange: (checked: boolean) => void }) {
  return <label className={styles.momentCard} data-selected={checked || undefined}><span className={styles.momentIcon}>{icon}</span><span><strong>{label}</strong><small>{description}</small></span><input checked={checked} name={name} onChange={(event) => onChange(event.target.checked)} type="checkbox" /></label>;
}

function DesignDisclosure({ badge, children, description, icon, title }: { badge: string; children: ReactNode; description: string; icon: ReactNode; title: string }) {
  return <details className={styles.designDisclosure} open><summary><span className={styles.momentIcon}>{icon}</span><span><strong>{title}</strong><small>{description}</small></span><Badge status="info">{badge}</Badge></summary><div>{children}</div></details>;
}

function OverlayDisclosure({ design, designKey, description, icon, label, onChange }: { design: EditableDesign; designKey: OverlayDesignKey; description: string; icon: ReactNode; label: string; onChange: (key: OverlayDesignKey, patch: Partial<EditableDesign>) => void }) {
  return <DesignDisclosure badge="Standaardtemplate" description={description} icon={icon} title={label}><OverlayDesignFields design={design} designKey={designKey} label={label} onChange={(patch) => onChange(designKey, patch)} /></DesignDisclosure>;
}

function DesignFields({ design, label, onChange, prefix }: { design: EditableDesign; label: string; onChange: (patch: Partial<EditableDesign>) => void; prefix: GoalDesignKey }) {
  return <fieldset className={styles.designFields}><legend>{label}</legend><div className={styles.fieldGrid}>
    <label><span>Hoofdtekst</span><input maxLength={80} name={`${prefix}Headline`} onChange={(event) => onChange({ headline: event.target.value })} required value={design.headline} /></label>
    <label><span>Secundaire tekst</span><input maxLength={160} name={`${prefix}SecondaryText`} onChange={(event) => onChange({ secondaryText: event.target.value })} value={design.secondaryText} /></label>
    <label><span>Fallback doelpuntenmaker</span><input defaultValue={design.scorerFallback ?? "Doelpunt!"} maxLength={120} name={`${prefix}ScorerFallback`} /></label>
    <DesignSharedFields design={design} mode="goal" onChange={onChange} prefix={prefix} />
  </div></fieldset>;
}

function OverlayDesignFields({ design, designKey, label, onChange }: { design: EditableDesign; designKey: OverlayDesignKey; label: string; onChange: (patch: Partial<EditableDesign>) => void }) {
  return <fieldset className={styles.designFields}><legend>{label}</legend><div className={styles.fieldGrid}>
    <label><span>Standaardtemplate</span><select name={`${designKey}Template`} onChange={(event) => onChange({ template: event.target.value })} value={design.template}>{templateOptions(designKey).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label><span>Hoofdtekst</span><input maxLength={80} name={`${designKey}Headline`} onChange={(event) => onChange({ headline: event.target.value })} required value={design.headline} /></label>
    <label><span>Secundaire tekst</span><input maxLength={160} name={`${designKey}SecondaryText`} onChange={(event) => onChange({ secondaryText: event.target.value })} value={design.secondaryText} /></label>
    <DesignSharedFields
      design={design}
      mode={designKey === "lineupHome" || designKey === "lineupAway" ? "lineup" : "phase"}
      onChange={onChange}
      prefix={designKey}
    />
  </div></fieldset>;
}

function DesignSharedFields({ design, mode, onChange, prefix }: {
  design: EditableDesign;
  mode: "goal" | "lineup" | "phase";
  onChange: (patch: Partial<EditableDesign>) => void;
  prefix: string;
}) {
  return <>
    <label><span>Kleurthema</span><select name={`${prefix}Palette`} onChange={(event) => onChange({ palette: event.target.value })} value={design.palette}><option value="electric-orange">Electric Orange</option><option value="ink-black">Ink Black</option><option value="signal-red">Signal Red</option><option value="white">Wit</option></select></label>
    <label><span>Animatie</span><select name={`${prefix}Animation`} onChange={(event) => onChange({ animation: event.target.value })} value={design.animation}><option value="impact">Impact</option><option value="pulse">Pulse</option><option value="slide">Inschuiven</option><option value="none">Geen</option></select></label>
    <label><span>Typografie</span><select name={`${prefix}Typography`} onChange={(event) => onChange({ typography: event.target.value })} value={design.typography}><option value="display">Inter Tight display</option><option value="body">Inter body</option></select></label>
    <label><span>Uitlijning</span><select name={`${prefix}LogoPosition`} onChange={(event) => onChange({ logoPosition: event.target.value })} value={design.logoPosition}><option value="left">Links</option><option value="center">Midden</option></select></label>
    <label><span>Logoschaal</span><select name={`${prefix}LogoScale`} onChange={(event) => onChange({ logoScale: event.target.value })} value={design.logoScale}><option value="small">Compact</option><option value="medium">Normaal</option><option value="large">Groot</option></select></label>
    {mode === "lineup" ? <input name={`${prefix}ShowScorer`} type="hidden" value="on" /> : null}
    {mode !== "lineup" ? <div className={styles.checks}>
      <label><input checked={design.showPreviousScore} name={`${prefix}ShowPreviousScore`} onChange={(event) => onChange({ showPreviousScore: event.target.checked })} type="checkbox" />{mode === "goal" ? "Vorige stand tonen" : "Score tonen"}</label>
      {mode === "goal" ? <label><input checked={design.showScorer} name={`${prefix}ShowScorer`} onChange={(event) => onChange({ showScorer: event.target.checked })} type="checkbox" />Doelpuntenmaker tonen</label> : null}
      <label><input checked={design.showClock} name={`${prefix}ShowClock`} onChange={(event) => onChange({ showClock: event.target.checked })} type="checkbox" />Wedstrijdklok</label>
    </div> : null}
  </>;
}

function HiddenDesignFields({
  design,
  prefix,
  withScorerFallback = false
}: {
  design: EditableDesign;
  prefix: string;
  withScorerFallback?: boolean;
}) {
  return <>
    <input name={`${prefix}Animation`} type="hidden" value={design.animation} />
    <input name={`${prefix}Headline`} type="hidden" value={design.headline} />
    <input name={`${prefix}LogoPosition`} type="hidden" value={design.logoPosition} />
    <input name={`${prefix}LogoScale`} type="hidden" value={design.logoScale} />
    <input name={`${prefix}Palette`} type="hidden" value={design.palette} />
    <input name={`${prefix}SecondaryText`} type="hidden" value={design.secondaryText} />
    <input name={`${prefix}Template`} type="hidden" value={design.template} />
    <input name={`${prefix}Typography`} type="hidden" value={design.typography} />
    {design.showClock ? <input name={`${prefix}ShowClock`} type="hidden" value="on" /> : null}
    {design.showPreviousScore ? <input name={`${prefix}ShowPreviousScore`} type="hidden" value="on" /> : null}
    {design.showScorer ? <input name={`${prefix}ShowScorer`} type="hidden" value="on" /> : null}
    {withScorerFallback ? <input name={`${prefix}ScorerFallback`} type="hidden" value={design.scorerFallback ?? "Doelpunt!"} /> : null}
  </>;
}

function previewChoicesFor(
  triggerOwn: boolean,
  triggerOpponent: boolean,
  triggers: ReturnType<typeof readOverlayTriggers>
): PreviewChoice[] {
  return [
    ...(triggerOwn ? [{ id: "own" as const, label: "Goal" }] : []),
    ...(triggerOpponent ? [{ id: "opponent" as const, label: "Tegengoal" }] : []),
    ...(triggerOwn || triggerOpponent ? [{ id: "unknown" as const, label: "Onbekend" }] : []),
    ...(triggers.lineup ? [
      { id: "lineupHome" as const, label: "Opstelling thuis" },
      { id: "lineupAway" as const, label: "Opstelling uit" }
    ] : []),
    ...(triggers.start ? [{ id: "matchStart" as const, label: "Start" }] : []),
    ...(triggers.halfTime ? [{ id: "halfTime" as const, label: "Rust" }] : []),
    ...(triggers.end ? [{ id: "matchEnd" as const, label: "Einde" }] : [])
  ];
}

function PreviewKindPicker({ choices, current, onChange }: { choices: PreviewChoice[]; current: PreviewKind; onChange: (kind: PreviewKind) => void }) {
  return <div className={styles.previewKinds} role="group" aria-label="Voorbeeldmoment">{choices.map((choice) => <button aria-pressed={current === choice.id} key={choice.id} onClick={() => onChange(choice.id)} type="button">{choice.label}</button>)}</div>;
}

function ExperiencePreview({ design, kind, orientation }: { design: EditableDesign; kind: PreviewKind; orientation: "landscape" | "portrait" }) {
  const lineup = kind === "lineupHome" || kind === "lineupAway";
  const goal = kind === "own" || kind === "opponent" || kind === "unknown";
  return <div
    className={styles.experiencePreview}
    data-animation={design.animation}
    data-logo-position={design.logoPosition}
    data-logo-scale={design.logoScale}
    data-orientation={orientation}
    data-palette={design.palette}
    data-typography={design.typography}
  >
    <div className={styles.previewTopline}><span>LIVE · HOOFDVELD</span><span>{design.showClock ? "38:24" : "DUINDORP SV"}</span></div>
    <span aria-label="Voorbeeld clublogo" className={styles.previewClubMark}>D</span>
    {lineup ? <div className={styles.lineupPreview}><div><strong>{design.headline}</strong><small>{design.secondaryText}</small></div><div className={styles.playerGrid}>{[1, 2, 3, 4, 5, 6].map((number) => <span key={number}><i><CircleUserRound aria-hidden="true" /></i><b>{number}. Speler</b></span>)}</div></div> : null}
    {goal ? <div className={styles.goalPreview} data-show-scorer={design.showScorer || undefined}>
      {design.showScorer ? <span className={styles.playerPortrait}><CircleUserRound aria-hidden="true" /></span> : null}
      <div><small>DOELPUNT</small><strong>{design.headline}</strong>{design.showScorer ? <p><b>#9</b> D. Jansen</p> : null}{design.showPreviousScore ? <small className={styles.previousScore}>Vorige stand 3–2</small> : null}</div>
      <span className={styles.scorePreview}>4<small>–</small>2</span>
    </div> : null}
    {!lineup && !goal ? <div className={styles.matchMomentPreview} data-show-score={design.showPreviousScore || undefined}><small>{design.secondaryText}</small><strong>{design.headline}</strong><div><span>Duindorp SV</span>{design.showPreviousScore ? <b>{kind === "matchStart" ? "0 – 0" : "4 – 2"}</b> : null}<span>Bezoekers</span></div></div> : null}
    <span className={styles.previewSafeZone} aria-hidden="true" />
  </div>;
}

function ReviewCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function AssetSelect({ assets, defaultValue, label, name }: { assets: Asset[]; defaultValue: string; label: string; name: string }) {
  return <label><span>{label}</span><select defaultValue={defaultValue} name={name}><option value="">Geen</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.kind === "video" ? "Video" : "Afbeelding"}</option>)}</select></label>;
}

function summarizeSelection(groups: Group[], selected: string[]) {
  const counts = new Map<string, number>();
  for (const group of groups) if (selected.includes(group.id)) for (const screen of group.screenIds) counts.set(screen, (counts.get(screen) ?? 0) + 1);
  return { overlapCount: [...counts.values()].filter((count) => count > 1).length, screenIds: [...counts.keys()] };
}

function readGoalDesign(value: unknown, headline: string, secondaryText: string): EditableDesign & { scorerFallback?: string } {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    animation: readString(data.animation) || "impact",
    headline: readString(data.headline) || headline,
    logoPosition: readString(data.logoPosition) || "left",
    logoScale: readString(data.logoScale) || "medium",
    palette: readString(data.palette) || "ink-black",
    scorerFallback: readString(data.scorerFallback) || "Doelpunt!",
    secondaryText: readString(data.secondaryText) || secondaryText,
    showClock: data.showClock === true,
    showPreviousScore: data.showPreviousScore === true,
    showScorer: data.showScorer !== false,
    template: "player-reveal",
    typography: readString(data.typography) || "display"
  };
}

function templateOptions(key: OverlayDesignKey) {
  if (key === "lineupHome" || key === "lineupAway") return [{ label: "Teamraster", value: "team-grid" }];
  if (key === "matchStart") return [{ label: "Matchday impact", value: "matchday-impact" }];
  if (key === "halfTime") return [{ label: "Scorefocus", value: "score-focus" }];
  return [{ label: "Eindstand", value: "final-score" }];
}

function momentSummary(triggerOwn: boolean, triggerOpponent: boolean, triggers: ReturnType<typeof readOverlayTriggers>) {
  return [
    triggerOwn || triggerOpponent ? "Goal" : null,
    triggers.lineup ? "Opstelling" : null,
    triggers.start ? "Start" : null,
    triggers.halfTime ? "Rust" : null,
    triggers.end ? "Einde" : null
  ].filter(Boolean).join(" · ") || "Geen";
}

function readString(value: unknown) { return typeof value === "string" ? value : ""; }
function readBoolean(value: unknown, fallback: boolean) { return typeof value === "boolean" ? value : fallback; }
function readNumber(value: unknown, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function readStringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function dateTimeValue(value: unknown) { const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN; return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 16) : ""; }
