"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Monitor,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserRound,
  UsersRound
} from "lucide-react";

import {
  sportlinkBirthdayConfigurationSchema,
  type PlayerDynamicTemplatePayload,
  type SportlinkBirthdayConfiguration,
  type ThemePresentationSnapshot
} from "@veyocast/contracts";
import { createDynamicTemplateView, EditorialArenaRenderer } from "@veyocast/content-templates";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  MultiSelectDropdown
} from "@veyocast/ui";

import {
  allBirthdayTeams,
  birthdayReadinessIssues,
  birthdayTeamSelectionLabel,
  hasBirthdayTeamSelection,
  resolveBirthdayTeamSelection,
  toggleBirthdaysWithoutTeam,
  toggleBirthdayTeam,
  type BirthdayReadinessIssue,
  type ResolvedBirthdayTeamSelection
} from "./birthday-wizard-state";
import { FieldFlowStyleStep } from "../../../../slides/_components/fieldflow-style-step";
import styles from "./birthdays.module.css";

type Orientation = "landscape" | "portrait";
type Birthday = {
  age: number | null;
  day: number;
  displayName: string;
  id: string;
  matchStatus: string;
  month: number;
  photoAvailable: boolean;
  role: string | null;
  sourceFetchedAt: string;
  teams: Array<{ externalId: string; name: string }>;
};
type Media = {
  bytes: number;
  checksumSha256: string;
  height: number | null;
  id: string;
  mimeType: string;
  name: string;
  url: string;
  width: number | null;
};
type Status = {
  active: boolean;
  counts: {
    ambiguous: number;
    birthdays: number;
    knownAge: number;
    matched: number;
    withPhoto: number;
  };
  featureEnabled: boolean;
  freshness: string;
  lastErrorCode: string | null;
  lastSuccessAt: string | null;
  nextSyncAt: string | null;
};
type Availability = {
  birthdaysLoaded: boolean;
  connectionLoaded: boolean;
  mediaLoaded: boolean;
  statusLoaded: boolean;
  teamsLoaded: boolean;
  templatesLoaded: boolean;
};
type Template = { orientation: Orientation; versionId: string };
type Team = { external_id: string; name: string };

const steps = ["Periode", "Selectie en informatie", "Vormgeving", "Preview en publiceren"];
const previewBirthdays: Birthday[] = [
  {
    age: 14,
    day: new Date().getDate(),
    displayName: "Sophie de Vries",
    id: "31c3078d-8b3b-4cf5-a936-0a32894dc513",
    matchStatus: "unmatched",
    month: new Date().getMonth() + 1,
    photoAvailable: false,
    role: "Speler",
    sourceFetchedAt: new Date().toISOString(),
    teams: [{ externalId: "preview-team", name: "JO15-1" }]
  },
  {
    age: null,
    day: new Date(Date.now() + 86_400_000).getDate(),
    displayName: "Milan van den Berg",
    id: "4c3a44a0-b886-4c2a-af77-f915c36e9038",
    matchStatus: "unmatched",
    month: new Date(Date.now() + 86_400_000).getMonth() + 1,
    photoAvailable: false,
    role: "Trainer",
    sourceFetchedAt: new Date().toISOString(),
    teams: [{ externalId: "preview-team-2", name: "1e elftal" }]
  }
];

export function BirthdayWizard({
  action,
  availability,
  birthdays,
  canManage,
  connection,
  media,
  refreshAction,
  status,
  teams,
  themePresentation,
  templates
}: {
  action: (formData: FormData) => Promise<void>;
  availability: Availability;
  birthdays: Birthday[];
  canManage: boolean;
  connection: { clubName: string; dataSourceId: string; id: string; timezone: string } | null;
  media: Media[];
  refreshAction: (formData: FormData) => Promise<void>;
  status: Status;
  teams: Team[];
  themePresentation: ThemePresentationSnapshot;
  templates: Template[];
}) {
  const [step, setStep] = useState(0);
  const [configuration, setConfiguration] = useState<SportlinkBirthdayConfiguration>(() =>
    sportlinkBirthdayConfigurationSchema.parse({
      themeSelection: themePresentation.selection
    })
  );
  const [orientation, setOrientation] = useState<Orientation>(() =>
    templates.some((candidate) => candidate.orientation === "landscape")
      ? "landscape"
      : templates.some((candidate) => candidate.orientation === "portrait")
        ? "portrait"
        : "landscape"
  );
  const [page, setPage] = useState({ landscape: 0, portrait: 0 });
  const [mediaQuery, setMediaQuery] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const previousStep = useRef(step);
  const realBirthdays = availability.birthdaysLoaded && birthdays.length > 0;
  const previewItems = useMemo(() => {
    if (realBirthdays) return birthdays;

    const selectedTeamId = configuration.selection.selectedTeamIds[0] ?? teams[0]?.external_id ?? "preview-team";
    const selectedTeamName = teams.find((team) => team.external_id === selectedTeamId)?.name ?? "Voorbeeldteam";

    return previewBirthdays.map((birthday, index) => index === 0
      ? { ...birthday, teams: [{ externalId: selectedTeamId, name: selectedTeamName }] }
      : { ...birthday, teams: [] });
  }, [birthdays, configuration.selection.selectedTeamIds, realBirthdays, teams]);
  const template = templates.find((candidate) => candidate.orientation === orientation);
  const previewPayloads = useMemo(() => ({
    landscape: birthdayPayload("landscape", configuration, previewItems, media, connection, status, themePresentation),
    portrait: birthdayPayload("portrait", configuration, previewItems, media, connection, status, themePresentation)
  }), [configuration, connection, media, previewItems, status, themePresentation]);
  const livePayloads = useMemo(() => ({
    landscape: birthdayPayload("landscape", configuration, birthdays, media, connection, status, themePresentation),
    portrait: birthdayPayload("portrait", configuration, birthdays, media, connection, status, themePresentation)
  }), [birthdays, configuration, connection, media, status, themePresentation]);
  const previewViews = useMemo(() => ({
    landscape: createDynamicTemplateView(previewPayloads.landscape),
    portrait: createDynamicTemplateView(previewPayloads.portrait)
  }), [previewPayloads]);
  const liveViews = useMemo(() => ({
    landscape: createDynamicTemplateView(livePayloads.landscape),
    portrait: createDynamicTemplateView(livePayloads.portrait)
  }), [livePayloads]);
  const previewPageCount = previewViews[orientation]?.pages.length ?? 0;
  const livePageCount = liveViews[orientation]?.pages.length ?? 0;
  const activePageIndex = Math.min(page[orientation], Math.max(previewPageCount - 1, 0));
  const totalDuration = livePageCount * configuration.presentation.pageDurationSeconds;
  const update = (patch: Partial<SportlinkBirthdayConfiguration>) =>
    setConfiguration((current) => ({ ...current, ...patch }));
  const updateSelection = (patch: Partial<SportlinkBirthdayConfiguration["selection"]>) =>
    update({ selection: { ...configuration.selection, ...patch } });
  const updatePresentation = (patch: Partial<SportlinkBirthdayConfiguration["presentation"]>) =>
    update({ presentation: { ...configuration.presentation, ...patch } });
  const readiness = birthdayReadinessIssues({
    active: status.active,
    connectionAvailable: Boolean(connection),
    connectionLoaded: availability.connectionLoaded,
    featureEnabled: status.featureEnabled,
    hasSuccessfulSync: Boolean(status.lastSuccessAt),
    orientationAvailable: Boolean(template),
    statusLoaded: availability.statusLoaded,
    templatesLoaded: availability.templatesLoaded
  });
  const ready = readiness.length === 0;

  useEffect(() => {
    if (previousStep.current === step) return;
    panelRef.current?.querySelector<HTMLElement>("[data-wizard-step-heading]")?.focus();
    previousStep.current = step;
  }, [step]);

  return <div className={styles.shell}>
    <nav aria-label="Stappen verjaardagsslide" className={styles.steps}>
      {steps.map((label, index) => (
        <button
          aria-current={step === index ? "step" : undefined}
          disabled={index > step + 1}
          key={label}
          onClick={() => setStep(index)}
          type="button"
        >
          <span>{index < step ? <Check aria-hidden="true" /> : index + 1}</span>{label}
        </button>
      ))}
    </nav>
    <div className={styles.workspace}>
      <section aria-label="Instellingen verjaardagsslide" className={styles.panel} ref={panelRef}>
        {step === 0 ? (
          <PeriodStep
            canManage={canManage}
            configuration={configuration}
            connection={connection}
            refreshAction={refreshAction}
            status={status}
            update={update}
          />
        ) : null}
        {step === 1 ? (
          <SelectionStep
            birthdays={birthdays}
            birthdaysLoaded={availability.birthdaysLoaded}
            configuration={configuration}
            status={status}
            teams={teams}
            teamsLoaded={availability.teamsLoaded}
            update={updateSelection}
          />
        ) : null}
        {step === 2 ? (
          <DesignStep
            configuration={configuration}
            media={media}
            mediaLoaded={availability.mediaLoaded}
            mediaQuery={mediaQuery}
            orientation={orientation}
            setMediaQuery={setMediaQuery}
            setOrientation={setOrientation}
            templates={templates}
            update={updatePresentation}
          />
        ) : null}
        {step === 3 ? (
          <ReviewStep
            configuration={configuration}
            birthdaysLoaded={availability.birthdaysLoaded}
            orientation={orientation}
            pageCount={livePageCount}
            realBirthdays={realBirthdays}
            setOrientation={setOrientation}
            status={status}
            templates={templates}
            totalDuration={totalDuration}
            views={liveViews}
          />
        ) : null}
        <footer className={styles.actions}>
          <Button
            disabled={step === 0}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            type="button"
            variant="secondary"
          >
            <ChevronLeft aria-hidden="true" />Vorige
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((value) => Math.min(3, value + 1))} type="button">
              Volgende<ChevronRight aria-hidden="true" />
            </Button>
          ) : (
            <form action={action}>
              <input name="configuration" type="hidden" value={JSON.stringify(configuration)} />
              <input name="dataSourceId" type="hidden" value={connection?.dataSourceId ?? ""} />
              <input name="name" type="hidden" value={configuration.title} />
              <input name="templateVersionId" type="hidden" value={template?.versionId ?? ""} />
              <Button disabled={!ready} type="submit">
                <ShieldCheck aria-hidden="true" />Slide aanmaken
              </Button>
            </form>
          )}
        </footer>
        {step === 3 && readiness.length ? (
          <ReadinessNotice issues={readiness} orientation={orientation} />
        ) : null}
        {step === 3 && ready && availability.birthdaysLoaded && livePageCount === 0 ? (
          <div className={`notice ${styles.readiness}`} role="status">
            <strong>De levende slide is klaar om aan te maken.</strong>
            <p>Binnen de huidige periode en selectie is nu niets zichtbaar. De Player slaat de slide veilig over en neemt nieuwe geldige verjaardagen na synchronisatie automatisch mee.</p>
          </div>
        ) : null}
      </section>
      <aside className={styles.previewRail}>
        <header>
          <span>Live gedeelde renderer</span>
          <strong>{orientation === "portrait" ? "9:16" : "16:9"} · pagina {Math.min(activePageIndex + 1, Math.max(previewPageCount, 1))}/{Math.max(previewPageCount, 1)}</strong>
        </header>
        <Preview payload={previewPayloads[orientation]} pageIndex={activePageIndex} />
        <div className={styles.previewControls}>
          <Button
            aria-label="Vorige previewpagina"
            disabled={activePageIndex <= 0}
            onClick={() => setPage((current) => ({ ...current, [orientation]: activePageIndex - 1 }))}
            size="sm"
            type="button"
            variant="ghost"
          ><ChevronLeft /></Button>
          <span>{realBirthdays ? "Actuele genormaliseerde data" : availability.birthdaysLoaded ? "Gemarkeerde previewdata" : "Previewdata · live data niet geladen"}</span>
          <Button
            aria-label="Volgende previewpagina"
            disabled={activePageIndex >= previewPageCount - 1}
            onClick={() => setPage((current) => ({ ...current, [orientation]: activePageIndex + 1 }))}
            size="sm"
            type="button"
            variant="ghost"
          ><ChevronRight /></Button>
        </div>
      </aside>
    </div>
  </div>;
}

function PeriodStep({ configuration, connection, status, canManage, refreshAction, update }: {
  configuration: SportlinkBirthdayConfiguration;
  connection: { id: string } | null;
  status: Status;
  canManage: boolean;
  refreshAction: (formData: FormData) => Promise<void>;
  update: (patch: Partial<SportlinkBirthdayConfiguration>) => void;
}) {
  const options = [
    { days: 1, label: "Alleen vandaag", mode: "today" },
    { days: 7, label: "Vandaag en komende 7 dagen", mode: "next_7_days" },
    { days: 14, label: "Komende 14 dagen", mode: "next_14_days" },
    { days: 21, label: "Komende 21 dagen", mode: "next_21_days" }
  ] as const;
  return <section>
    <Heading
      copy="Sportlink levert maximaal 21 dagen. De Player filtert verlopen dagen bij iedere weergave opnieuw, ook offline."
      icon={<CalendarDays aria-hidden="true" />}
      title="Welke verjaardagen komen in beeld?"
    />
    <div className={styles.choiceGrid}>
      {options.map((option) => (
        <label data-selected={configuration.period.mode === option.mode || undefined} key={option.mode}>
          <input
            checked={configuration.period.mode === option.mode}
            name="period"
            onChange={() => update({ period: option })}
            type="radio"
          />
          <span><strong>{option.label}</strong><small>{option.days === 1 ? "Alleen personen van vandaag" : `${option.days} dagen, inclusief vandaag`}</small></span>
        </label>
      ))}
      <label data-selected={configuration.period.mode === "custom" || undefined}>
        <input
          checked={configuration.period.mode === "custom"}
          name="period"
          onChange={() => update({ period: { days: configuration.period.days, mode: "custom" } })}
          type="radio"
        />
        <span><strong>Aangepast</strong><input aria-label="Aangepast aantal dagen" max={21} min={1} onChange={(event) => update({ period: { days: Number(event.target.value), mode: "custom" } })} type="number" value={configuration.period.days} /></span>
      </label>
    </div>
    <div className={styles.statusGrid}>
      <Metric label="Gevonden" value={status.counts.birthdays} />
      <Metric label="Laatste synchronisatie" value={formatDate(status.lastSuccessAt)} />
      <Metric label="Volgende synchronisatie" value={formatDate(status.nextSyncAt)} />
      <Metric label="Versheid" value={freshnessLabel(status.freshness)} />
    </div>
    <label className={styles.emptyBehavior}>
      <span>Wanneer er niets te tonen is</span>
      <select onChange={(event) => update({ emptyBehavior: event.target.value as SportlinkBirthdayConfiguration["emptyBehavior"] })} value={configuration.emptyBehavior}>
        <option value="skip">Slide automatisch overslaan · aanbevolen</option>
        <option value="today_only">Alleen tonen wanneer iemand vandaag jarig is</option>
        <option value="neutral">Een neutrale lege staat tonen</option>
      </select>
      <small>Overslaan gaat direct door naar het volgende playlistitem zonder zwart of technisch foutbeeld.</small>
    </label>
    {status.freshness === "stale" || status.freshness === "expired" ? (
      <p className="notice notice--warning"><strong>De Last Known Good-cache is verouderd.</strong> Bestaande geldige data blijft behouden; na 21 dagen slaat de Player de slide veilig over.</p>
    ) : null}
    {canManage && connection ? (
      <form action={refreshAction}>
        <input name="connectionId" type="hidden" value={connection.id} />
        <Button type="submit" variant="secondary"><RefreshCw aria-hidden="true" />Handmatig vernieuwen</Button>
      </form>
    ) : null}
  </section>;
}

function SelectionStep({ birthdays, birthdaysLoaded, configuration, status, teams, teamsLoaded, update }: {
  birthdays: Birthday[];
  birthdaysLoaded: boolean;
  configuration: SportlinkBirthdayConfiguration;
  status: Status;
  teams: Team[];
  teamsLoaded: boolean;
  update: (patch: Partial<SportlinkBirthdayConfiguration["selection"]>) => void;
}) {
  const rolesAvailable = status.counts.matched > 0;
  const roles = [...new Set(birthdays.flatMap((birthday) => birthday.role ? [birthday.role] : []))]
    .sort((left, right) => left.localeCompare(right, "nl-NL"));
  return <section>
    <Heading
      copy="VeyoCast verrijkt alleen bij één exacte identiteit. Dubbele namen krijgen nooit automatisch een team, rol of foto."
      icon={<ShieldCheck aria-hidden="true" />}
      title="Selectie en informatie"
    />
    <div className={styles.fieldGrid}>
      <label>
        <span>Rolselectie</span>
        <select disabled={!rolesAvailable} onChange={(event) => update({ roleFilter: event.target.value as SportlinkBirthdayConfiguration["selection"]["roleFilter"] })} value={configuration.selection.roleFilter}>
          <option value="all">Iedereen</option>
          <option value="players">Alleen spelers</option>
          <option value="staff">Alleen staf</option>
          <option value="selected">Geselecteerde rollen</option>
        </select>
        <small>{rolesAvailable ? "Gebaseerd op eenduidige Sportlink-teamkoppelingen." : "Beschikbaar na veilige team-/rolverrijking."}</small>
      </label>
      <label>
        <span>Naamweergave</span>
        <select onChange={(event) => update({ nameMode: event.target.value as SportlinkBirthdayConfiguration["selection"]["nameMode"] })} value={configuration.selection.nameMode}>
          <option value="full">Volledige naam</option>
          <option value="first_last_initial">Voornaam + eerste letter achternaam</option>
          <option value="first">Alleen voornaam</option>
        </select>
      </label>
    </div>
    <TeamPicker
      birthdays={birthdays}
      birthdaysLoaded={birthdaysLoaded}
      selection={configuration.selection}
      teams={teams}
      teamsLoaded={teamsLoaded}
      update={update}
    />
    {configuration.selection.roleFilter === "selected" ? (
      <MultiSelectDropdown
        description="Alleen personen met één van deze eenduidig gekoppelde Sportlink-rollen komen in beeld."
        emptyLabel="Er zijn nog geen gekoppelde rollen beschikbaar."
        label="Rollen"
        onValueChange={(selectedRoles) => update({ selectedRoles })}
        options={roles.map((role) => ({ label: role, value: role }))}
        placeholder="Kies één of meer rollen"
        searchLabel="Rollen zoeken"
        searchPlaceholder="Zoek op rolnaam"
        searchable
        selectionNoun={{ plural: "rollen", singular: "rol" }}
        value={configuration.selection.selectedRoles}
      />
    ) : null}
    <div className={styles.toggleGrid}>
      {[
        ["showAge", "Leeftijd tonen", status.counts.knownAge > 0, "Alleen uit betrouwbare importbron"],
        ["showRole", "Rol tonen", rolesAvailable, "Exact gekoppelde rol"],
        ["showTeam", "Team tonen", rolesAvailable, "Exact gekoppeld team"],
        ["showPhoto", "Foto tonen", status.counts.withPhoto > 0, "Alleen rechtmatig en eenduidig"],
        ["showDayOfWeek", "Dag van de week", true, "Bij de datum"],
        ["showDate", "Datum tonen", true, "Dag en maand"],
        ["emphasizeToday", "Vandaag benadrukken", true, "Visueel prioriteren"],
        ["includeUnknownRoles", "Onbekende rol meenemen", true, "Niet uitsluiten zonder bewijs"]
      ].map(([key, label, available, copy]) => (
        <label data-disabled={!available || undefined} key={String(key)}>
          <input
            checked={Boolean(configuration.selection[key as keyof typeof configuration.selection])}
            disabled={!available}
            onChange={(event) => update({ [String(key)]: event.target.checked } as Partial<SportlinkBirthdayConfiguration["selection"]>)}
            type="checkbox"
          />
          <span><strong>{label}</strong><small>{copy}</small></span>
        </label>
      ))}
    </div>
    {status.counts.ambiguous ? (
      <p className="notice notice--warning"><strong>{status.counts.ambiguous} dubbelzinnige {status.counts.ambiguous === 1 ? "naam" : "namen"}.</strong> Deze personen blijven zichtbaar zonder mogelijk verkeerde verrijking. Los ze desgewenst op bij de integratie.</p>
    ) : null}
  </section>;
}

function TeamPicker({ birthdays, birthdaysLoaded, selection, teams, teamsLoaded, update }: {
  birthdays: Birthday[];
  birthdaysLoaded: boolean;
  selection: SportlinkBirthdayConfiguration["selection"];
  teams: Team[];
  teamsLoaded: boolean;
  update: (patch: Partial<SportlinkBirthdayConfiguration["selection"]>) => void;
}) {
  const resolved = resolveBirthdayTeamSelection(selection);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ResolvedBirthdayTeamSelection>(resolved);
  const normalizedQuery = query.trim().toLocaleLowerCase("nl-NL");
  const visibleTeams = teams.filter((team) =>
    !normalizedQuery || team.name.toLocaleLowerCase("nl-NL").includes(normalizedQuery)
  );
  const withoutTeamCount = birthdays.filter((birthday) => birthday.teams.length === 0).length;
  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(resolveBirthdayTeamSelection(selection));
      setQuery("");
    }
    setOpen(nextOpen);
  };
  const apply = () => {
    if (!hasBirthdayTeamSelection(draft)) return;
    update({
      includeWithoutTeam: draft.includeWithoutTeam,
      selectedTeamIds: draft.teamIds,
      teamSelectionMode: draft.mode
    });
    setOpen(false);
  };
  return <div className={styles.teamField}>
    <span className={styles.fieldLabel}>Teams en overige</span>
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>
        <Button className={styles.teamPickerTrigger} type="button" variant="secondary">
          <span><strong>{birthdayTeamSelectionLabel(resolved, teams)}</strong><small>Meerdere keuzes mogelijk</small></span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className={styles.teamDialog} closeLabel="Teamselectie sluiten">
        <DialogHeader>
          <DialogTitle>Teams en overige selecteren</DialogTitle>
          <DialogDescription>Kies Alle voor een automatisch meegroeiende selectie, of combineer losse teams met personen zonder team.</DialogDescription>
        </DialogHeader>
        <DialogBody className={styles.teamDialogBody}>
          <label className={styles.teamSearch}>
            <span>Teams zoeken</span>
            <span><Search aria-hidden="true" /><input onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Zoek op teamnaam" type="search" value={query} /></span>
          </label>
          {!teamsLoaded ? (
            <p className="notice notice--warning"><strong>De teamlijst kon niet worden geladen.</strong> Alle blijft veilig beschikbaar. Sluit dit venster en probeer de pagina opnieuw te laden om losse teams te kiezen.</p>
          ) : null}
          <div className={styles.teamOptions}>
            <label className={styles.teamOptionFeatured}>
              <input
                checked={draft.mode === "all"}
                onChange={(event) => setDraft(event.target.checked ? allBirthdayTeams() : { includeWithoutTeam: false, mode: "selected", teamIds: [] })}
                type="checkbox"
              />
              <UsersRound aria-hidden="true" />
              <span><strong>Alle</strong><small>{birthdaysLoaded ? `Alle huidige en toekomstige teams, plus overige · ${birthdays.length}` : "Alle huidige en toekomstige teams, plus overige · aantal niet beschikbaar"}</small></span>
            </label>
            <label className={styles.teamOptionFeatured}>
              <input checked={draft.mode === "selected" && draft.includeWithoutTeam} onChange={() => setDraft(toggleBirthdaysWithoutTeam(draft))} type="checkbox" />
              <UserRound aria-hidden="true" />
              <span><strong>Overige (zonder team)</strong><small>{birthdaysLoaded ? `${withoutTeamCount} ${withoutTeamCount === 1 ? "persoon" : "personen"} in de huidige synchronisatie` : "Aantal niet beschikbaar"}</small></span>
            </label>
            {visibleTeams.map((team) => {
              const count = birthdays.filter((birthday) => birthday.teams.some((candidate) => candidate.externalId === team.external_id)).length;
              return <label key={team.external_id}>
                <input checked={draft.mode === "selected" && draft.teamIds.includes(team.external_id)} onChange={() => setDraft(toggleBirthdayTeam(draft, team.external_id))} type="checkbox" />
                <span><strong>{team.name}</strong><small>{birthdaysLoaded ? `${count} ${count === 1 ? "persoon" : "personen"} gekoppeld` : "Aantal niet beschikbaar"}</small></span>
              </label>;
            })}
          </div>
          {teamsLoaded && !visibleTeams.length ? <p className={styles.emptyCopy}>Geen teams gevonden. Pas je zoekopdracht aan.</p> : null}
        </DialogBody>
        <DialogFooter aside={birthdayTeamSelectionLabel(draft, teams)}>
          <Button onClick={() => changeOpen(false)} type="button" variant="secondary">Annuleren</Button>
          <Button disabled={!hasBirthdayTeamSelection(draft)} onClick={apply} type="button">Keuze toepassen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <small>Alle omvat ook personen zonder exact gekoppeld team. Kies Overige apart wanneer je uitsluitend die groep wilt tonen.</small>
  </div>;
}

function DesignStep({ configuration, media, mediaLoaded, mediaQuery, orientation, setMediaQuery, setOrientation, templates, update }: {
  configuration: SportlinkBirthdayConfiguration;
  media: Media[];
  mediaLoaded: boolean;
  mediaQuery: string;
  orientation: Orientation;
  setMediaQuery: (value: string) => void;
  setOrientation: (value: Orientation) => void;
  templates: Template[];
  update: (patch: Partial<SportlinkBirthdayConfiguration["presentation"]>) => void;
}) {
  const visibleMedia = media.filter((asset) =>
    asset.name.toLocaleLowerCase("nl-NL").includes(mediaQuery.toLocaleLowerCase("nl-NL"))
  );
  return <section>
    <Heading
      copy="Kies eerst de schermstand. VeyoCast gebruikt automatisch de ingebouwde verjaardagvormgeving en past de indeling aan het aantal personen aan."
      icon={<ImageIcon aria-hidden="true" />}
      title="Vormgeving"
    />
    <OrientationPicker onChange={setOrientation} orientation={orientation} templates={templates} />
    <FieldFlowStyleStep
      label="Tenantbrede slidehuisstijl"
      onActivate={() => undefined}
      value="fieldflow"
    />
    <div className={styles.fieldGrid}>
      <label><span>Presentatiemodus</span><select onChange={(event) => update({ layout: event.target.value as SportlinkBirthdayConfiguration["presentation"]["layout"] })} value={configuration.presentation.layout}><option value="auto">Automatisch</option><option value="spotlight">Spotlight</option><option value="celebration_grid">Celebration Grid</option><option value="birthday_roll">Birthday Roll</option></select></label>
      <label><span>Paginaduur</span><input max={20} min={6} onChange={(event) => update({ pageDurationSeconds: Number(event.target.value) })} type="number" value={configuration.presentation.pageDurationSeconds} /><small>6–20 seconden</small></label>
      <label><span>Maximaal liggend</span><input max={8} min={1} onChange={(event) => update({ maxPerLandscapePage: Number(event.target.value) })} type="number" value={configuration.presentation.maxPerLandscapePage} /></label>
      <label><span>Maximaal staand</span><input max={8} min={1} onChange={(event) => update({ maxPerPortraitPage: Number(event.target.value) })} type="number" value={configuration.presentation.maxPerPortraitPage} /></label>
      <label><span>Kaartstijl</span><select onChange={(event) => update({ cardStyle: event.target.value as "glass" | "solid" | "outline" })} value={configuration.presentation.cardStyle}><option value="glass">Glas</option><option value="solid">Massief</option><option value="outline">Contour</option></select></label>
      <label><span>Tekstuitlijning</span><select onChange={(event) => update({ textAlign: event.target.value as "left" | "center" })} value={configuration.presentation.textAlign}><option value="left">Links</option><option value="center">Gecentreerd</option></select></label>
    </div>
    <div className={styles.toggleGrid}>
      {[
        ["gradientOverlay", "Gradient voor contrast"],
        ["motion", "Subtiele motion"],
        ["confetti", "Subtiele celebratieparticles"]
      ].map(([key, label]) => (
        <label key={key}>
          <input checked={Boolean(configuration.presentation[key as keyof typeof configuration.presentation])} onChange={(event) => update({ [String(key)]: event.target.checked } as Partial<SportlinkBirthdayConfiguration["presentation"]>)} type="checkbox" />
          <span><strong>{label}</strong></span>
        </label>
      ))}
    </div>
    {!mediaLoaded ? <p className="notice notice--warning"><strong>Media kon niet worden geladen.</strong> De ingebouwde abstracte achtergrond blijft beschikbaar. Laad de pagina opnieuw om eigen media te kiezen.</p> : null}
    <div className={styles.resourcePicker}>
      <header><div><strong>Achtergrond uit Media</strong><small>Zoeken, thumbnails en grote preview</small></div><input aria-label="Media zoeken" onChange={(event) => setMediaQuery(event.target.value)} placeholder="Zoek in Media" type="search" value={mediaQuery} /></header>
      <div className={styles.mediaGrid}>
        <button data-selected={!configuration.presentation.backgroundMediaAssetId || undefined} onClick={() => update({ backgroundMediaAssetId: null })} type="button"><span className={styles.abstractMedia} /><strong>Premium abstract</strong></button>
        {visibleMedia.map((asset) => <button data-selected={configuration.presentation.backgroundMediaAssetId === asset.id || undefined} key={asset.id} onClick={() => update({ backgroundMediaAssetId: asset.id })} type="button"><Image alt="" height={180} src={asset.url} unoptimized width={320} /><strong>{asset.name}</strong></button>)}
      </div>
    </div>
  </section>;
}

function OrientationPicker({ onChange, orientation, templates }: {
  onChange: (value: Orientation) => void;
  orientation: Orientation;
  templates: Template[];
}) {
  return <fieldset className={styles.orientationPicker}>
    <legend>Schermstand</legend>
    <p>Je maakt één slide voor de gekozen stand. Beide standen hebben hun eigen, ingebouwde compositie.</p>
    <div>
      {(["landscape", "portrait"] as const).map((value) => {
        const available = templates.some((template) => template.orientation === value);
        const label = value === "landscape" ? "Liggend" : "Staand";
        return <label data-selected={orientation === value || undefined} key={value}>
          <input checked={orientation === value} disabled={!available} name="birthday-orientation" onChange={() => onChange(value)} type="radio" />
          {value === "landscape" ? <Monitor aria-hidden="true" /> : <Smartphone aria-hidden="true" />}
          <span><strong>{label}</strong><small>{value === "landscape" ? "16:9" : "9:16"} · {available ? "ingebouwde vormgeving beschikbaar" : "tijdelijk niet beschikbaar"}</small></span>
          {orientation === value ? <Check aria-hidden="true" /> : null}
        </label>;
      })}
    </div>
  </fieldset>;
}

function ReviewStep({ birthdaysLoaded, configuration, orientation, pageCount, realBirthdays, setOrientation, status, templates, totalDuration, views }: {
  birthdaysLoaded: boolean;
  configuration: SportlinkBirthdayConfiguration;
  orientation: Orientation;
  pageCount: number;
  realBirthdays: boolean;
  setOrientation: (value: Orientation) => void;
  status: Status;
  templates: Template[];
  totalDuration: number;
  views: { landscape: ReturnType<typeof createDynamicTemplateView>; portrait: ReturnType<typeof createDynamicTemplateView> };
}) {
  return <section>
    <Heading
      copy="Preview, thumbnail en Player gebruiken dezelfde renderer. De immutable release verwijst naar een dynamische Last Known Good-snapshot."
      icon={<Check aria-hidden="true" />}
      title="Preview en publiceren"
    />
    {!birthdaysLoaded ? <p className="notice notice--warning"><strong>De actuele preview kon niet worden geladen.</strong> De server maakt de levende snapshot rechtstreeks uit de tenantdatabase; als de overige controles groen zijn, mag de slide veilig worden aangemaakt. Laad de pagina opnieuw om de actuele preview te zien.</p> : null}
    {birthdaysLoaded && !realBirthdays ? <p className="notice"><strong>Voorbeeldweergave.</strong> De actuele synchronisatie bevat nu geen verjaardagen binnen 21 dagen. De levende slide mag wel worden aangemaakt en wordt automatisch zichtbaar zodra er geldige data is.</p> : null}
    <OrientationPicker onChange={setOrientation} orientation={orientation} templates={templates} />
    <dl className={styles.reviewMetrics}>
      <div><dt>Interne pagina’s nu</dt><dd>{birthdaysLoaded ? pageCount : "Niet beschikbaar"}</dd></div>
      <div><dt>Duur per pagina</dt><dd>{configuration.presentation.pageDurationSeconds} sec.</dd></div>
      <div><dt>Minimale zichtbaarheid nu</dt><dd>{birthdaysLoaded ? `${totalDuration} sec.` : "Niet beschikbaar"}</dd></div>
      <div><dt>Leeftijdsdekking</dt><dd>{status.counts.knownAge}/{status.counts.birthdays}</dd></div>
      <div><dt>Team/roldekking</dt><dd>{status.counts.matched}/{status.counts.birthdays}</dd></div>
      <div><dt>Fotodekking</dt><dd>{status.counts.withPhoto}/{status.counts.birthdays}</dd></div>
    </dl>
    <p className="notice"><strong>Duur automatisch aanpassen is actief.</strong> Bij toevoegen aan een playlist gebruikt Studio minimaal pagina-aantal × paginaduur, zodat iedere actuele pagina minstens eenmaal zichtbaar wordt.</p>
    <div className={styles.allPages}>{views[orientation]?.pages.map((_, index) => <div key={index}><span>Pagina {index + 1}</span></div>)}</div>
    <label className={styles.emptyBehavior}><span>Wanneer niets geldig is</span><select value={configuration.emptyBehavior} disabled><option value={configuration.emptyBehavior}>{configuration.emptyBehavior === "skip" ? "Slide automatisch overslaan" : configuration.emptyBehavior === "today_only" ? "Alleen vandaag tonen" : "Neutrale lege staat"}</option></select><small>Ingesteld in stap 1; standaard slaat de Player direct en zonder zwart frame over.</small></label>
  </section>;
}

function ReadinessNotice({ issues, orientation }: { issues: BirthdayReadinessIssue[]; orientation: Orientation }) {
  const copy: Record<BirthdayReadinessIssue, string> = {
    connection_missing: "Sportlink is nog niet gekoppeld. Zonder geldige Client ID kan de levende slide geen clubdata ophalen. Koppel Sportlink onder Databronnen.",
    connection_unavailable: "De Sportlink-koppeling kon niet veilig worden gecontroleerd. De wizard doet daarom geen aannames over activering of data. Laad de pagina opnieuw.",
    feature_unavailable: "Verjaardagen zijn voor deze vereniging niet beschikbaar. De slide kan daardoor niet worden aangemaakt. Controleer de Sportlink-functies onder Databronnen.",
    module_inactive: "De verjaardagmodule staat gepauzeerd. De Player ontvangt dan geen nieuwe verjaardagssnapshot. Activeer de module onder Databronnen.",
    orientation_unavailable: `De ingebouwde vormgeving voor ${orientation === "portrait" ? "staand" : "liggend"} is tijdelijk niet beschikbaar. Kies de andere schermstand of laat VeyoCast-beheer de vormgeving herstellen.`,
    status_unavailable: "De actuele modulestatus kon niet veilig worden gecontroleerd. De slide blijft uit voorzorg geblokkeerd. Laad de pagina opnieuw.",
    sync_missing: "Er is nog geen geslaagde verjaardagsynchronisatie. De slide heeft daardoor nog geen betrouwbare Last Known Good-basis. Synchroniseer eerst onder Databronnen.",
    templates_unavailable: "De ingebouwde vormgeving kon niet veilig worden gecontroleerd. Je keuzes blijven staan, maar de slide kan nu niet worden aangemaakt. Laad de pagina opnieuw."
  };
  return <div className={`notice notice--warning ${styles.readiness}`} role="alert">
    <strong>Slide aanmaken kan nog niet.</strong>
    <ul>{issues.map((issue) => <li key={issue}>{copy[issue]}</li>)}</ul>
  </div>;
}

function Preview({ payload, pageIndex }: { payload: PlayerDynamicTemplatePayload; pageIndex: number }) {
  return <div className={styles.previewCanvas} data-orientation={payload.orientation}>
    <EditorialArenaRenderer embedded item={{ durationSeconds: 30, dynamicTemplate: payload, id: `birthday-preview-${payload.orientation}`, title: "Verjaardagen" }} pageIndex={pageIndex} passive />
  </div>;
}

function birthdayPayload(orientation: Orientation, configuration: SportlinkBirthdayConfiguration, birthdays: Birthday[], media: Media[], connection: { clubName: string; timezone: string } | null, status: Status, themePresentation: ThemePresentationSnapshot): PlayerDynamicTemplatePayload {
  const background = configuration.presentation.backgroundMediaAssetId
    ? media.find((asset) => asset.id === configuration.presentation.backgroundMediaAssetId)
    : null;
  const assets = background ? { [background.id]: { bytes: background.bytes, checksumSha256: background.checksumSha256, mimeType: background.mimeType as "image/jpeg", url: background.url } } : undefined;
  return {
    ...(assets ? { assets } : {}),
    data: {
      brand: {
        clubName: connection?.clubName ?? "Jouw vereniging",
        primaryColor: themePresentation.snapshotVersion === 2 &&
          themePresentation.appearance.schemaVersion === 2
          ? themePresentation.appearance.palette.primary
          : themePresentation.selection.accent ?? "#2459ED"
      },
      editorial: {},
      sport: {
        birthdays: birthdays.map((birthday) => ({
          age: configuration.selection.showAge ? birthday.age : null,
          day: birthday.day,
          displayName: birthday.displayName,
          id: birthday.id,
          matchStatus: birthday.matchStatus,
          month: birthday.month,
          photoMediaAssetId: null,
          role: birthday.role,
          teamIds: birthday.teams.map((team) => team.externalId),
          teams: birthday.teams
        })),
        configuration,
        fetchedAt: status.lastSuccessAt ?? birthdays[0]?.sourceFetchedAt ?? new Date().toISOString(),
        timezone: connection?.timezone ?? "Europe/Amsterdam",
        title: configuration.title
      },
      themePresentation,
      type: "sport_birthdays"
    },
    orientation,
    schemaVersion: 1,
    slideType: "sport_birthdays",
    snapshotHash: "0".repeat(64),
    snapshotId: "ecb04a31-036a-43c7-9c48-b2a22102f258",
    templateSlug: `editorial-arena-sport-birthdays-${orientation}`,
    templateVersionId: "a3c18829-51c7-4767-9ec8-26af9ce04ad2"
  };
}

function Heading({ copy, icon, title }: { copy: string; icon: React.ReactNode; title: string }) {
  return <header className={styles.heading}><span>{icon}</span><div><h2 data-wizard-step-heading tabIndex={-1}>{title}</h2><p>{copy}</p></div></header>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Nog niet uitgevoerd";
}

function freshnessLabel(value: string) {
  return value === "fresh" ? "Actueel" : value === "stale" ? "Verouderd · LKG actief" : value === "expired" ? "Verlopen · overslaan" : "Nog geen data";
}
