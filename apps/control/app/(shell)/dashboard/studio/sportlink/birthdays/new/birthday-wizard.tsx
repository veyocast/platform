"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, ImageIcon, RefreshCw, ShieldCheck } from "lucide-react";

import {
  sportlinkBirthdayConfigurationSchema,
  type PlayerDynamicTemplatePayload,
  type SportlinkBirthdayConfiguration
} from "@veyocast/contracts";
import { createDynamicTemplateView, EditorialArenaRenderer } from "@veyocast/content-templates";
import { Button } from "@veyocast/ui";

import styles from "./birthdays.module.css";

type Birthday = {
  age: number | null; day: number; displayName: string; id: string; matchStatus: string;
  month: number; photoAvailable: boolean; role: string | null;
  sourceFetchedAt: string; teams: Array<{ externalId: string; name: string }>;
};
type Media = {
  bytes: number; checksumSha256: string; height: number | null; id: string;
  mimeType: string; name: string; url: string; width: number | null;
};
type Status = {
  active: boolean; counts: { ambiguous: number; birthdays: number; knownAge: number; matched: number; withPhoto: number };
  freshness: string; lastSuccessAt: string | null; nextSyncAt: string | null;
};
type Template = { orientation: "landscape" | "portrait"; versionId: string };

const steps = ["Periode", "Selectie en informatie", "Vormgeving", "Preview en publiceren"];
const previewBirthdays: Birthday[] = [
  { age: 14, day: new Date().getDate(), displayName: "Sophie de Vries", id: "31c3078d-8b3b-4cf5-a936-0a32894dc513", matchStatus: "unmatched", month: new Date().getMonth() + 1, photoAvailable: false, role: "Speler", sourceFetchedAt: new Date().toISOString(), teams: [{ externalId: "preview-team", name: "JO15-1" }] },
  { age: null, day: new Date(Date.now() + 86_400_000).getDate(), displayName: "Milan van den Berg", id: "4c3a44a0-b886-4c2a-af77-f915c36e9038", matchStatus: "unmatched", month: new Date(Date.now() + 86_400_000).getMonth() + 1, photoAvailable: false, role: "Trainer", sourceFetchedAt: new Date().toISOString(), teams: [{ externalId: "preview-team-2", name: "1e elftal" }] }
];

export function BirthdayWizard({
  action, birthdays, canManage, connection, media, refreshAction, status, teams, templates
}: {
  action: (formData: FormData) => Promise<void>;
  birthdays: Birthday[]; canManage: boolean;
  connection: { clubName: string; dataSourceId: string; id: string; timezone: string } | null;
  media: Media[]; refreshAction: (formData: FormData) => Promise<void>;
  status: Status; teams: Array<{ external_id: string; name: string }>; templates: Template[];
}) {
  const [step, setStep] = useState(0);
  const [configuration, setConfiguration] = useState<SportlinkBirthdayConfiguration>(() => sportlinkBirthdayConfigurationSchema.parse({}));
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [page, setPage] = useState({ landscape: 0, portrait: 0 });
  const [mediaQuery, setMediaQuery] = useState("");
  const realBirthdays = birthdays.length > 0;
  const previewItems = realBirthdays ? birthdays : previewBirthdays;
  const template = templates.find((candidate) => candidate.orientation === orientation);
  const payloads = useMemo(() => ({
    landscape: birthdayPayload("landscape", configuration, previewItems, media, connection, status),
    portrait: birthdayPayload("portrait", configuration, previewItems, media, connection, status)
  }), [configuration, connection, media, previewItems, status]);
  const views = useMemo(() => ({
    landscape: createDynamicTemplateView(payloads.landscape),
    portrait: createDynamicTemplateView(payloads.portrait)
  }), [payloads]);
  const activeView = views[orientation];
  const pageCount = activeView?.pages.length ?? 0;
  const totalDuration = pageCount * configuration.presentation.pageDurationSeconds;
  const update = (patch: Partial<SportlinkBirthdayConfiguration>) => setConfiguration((current) => ({ ...current, ...patch }));
  const updateSelection = (patch: Partial<SportlinkBirthdayConfiguration["selection"]>) => update({ selection: { ...configuration.selection, ...patch } });
  const updatePresentation = (patch: Partial<SportlinkBirthdayConfiguration["presentation"]>) => update({ presentation: { ...configuration.presentation, ...patch } });
  const ready = Boolean(connection && status.active && template && pageCount > 0);

  return <div className={styles.shell}>
    <nav aria-label="Stappen verjaardagsslide" className={styles.steps}>
      {steps.map((label, index) => <button aria-current={step === index ? "step" : undefined} disabled={index > step + 1} key={label} onClick={() => setStep(index)} type="button"><span>{index < step ? <Check aria-hidden="true" /> : index + 1}</span>{label}</button>)}
    </nav>
    <div className={styles.workspace}>
      <section aria-label="Instellingen verjaardagsslide" className={styles.panel}>
        {step === 0 ? <PeriodStep configuration={configuration} connection={connection} status={status} canManage={canManage} refreshAction={refreshAction} update={update} /> : null}
        {step === 1 ? <SelectionStep birthdays={previewItems} configuration={configuration} status={status} teams={teams} update={updateSelection} /> : null}
        {step === 2 ? <DesignStep configuration={configuration} media={media} mediaQuery={mediaQuery} setMediaQuery={setMediaQuery} update={updatePresentation} /> : null}
        {step === 3 ? <ReviewStep configuration={configuration} orientation={orientation} pageCount={pageCount} realBirthdays={realBirthdays} setOrientation={setOrientation} status={status} totalDuration={totalDuration} views={views} /> : null}
        <footer className={styles.actions}>
          <Button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} type="button" variant="secondary"><ChevronLeft aria-hidden="true" />Vorige</Button>
          {step < 3 ? <Button onClick={() => setStep((value) => Math.min(3, value + 1))} type="button">Volgende<ChevronRight aria-hidden="true" /></Button> : (
            <form action={action}>
              <input name="configuration" type="hidden" value={JSON.stringify(configuration)} />
              <input name="dataSourceId" type="hidden" value={connection?.dataSourceId ?? ""} />
              <input name="name" type="hidden" value={configuration.title} />
              <input name="templateVersionId" type="hidden" value={template?.versionId ?? ""} />
              <Button disabled={!ready} type="submit"><ShieldCheck aria-hidden="true" />Slide aanmaken</Button>
            </form>
          )}
        </footer>
        {!ready && step === 3 ? <p className="notice notice--warning"><strong>Publiceren kan nog niet.</strong> Activeer en synchroniseer verjaardagen en controleer of voor {orientation === "portrait" ? "staand" : "liggend"} een gepubliceerd template beschikbaar is.</p> : null}
      </section>
      <aside className={styles.previewRail}>
        <header><span>Live gedeelde renderer</span><strong>{orientation === "portrait" ? "9:16" : "16:9"} · pagina {Math.min(page[orientation] + 1, Math.max(pageCount, 1))}/{Math.max(pageCount, 1)}</strong></header>
        <Preview payload={payloads[orientation]} pageIndex={page[orientation]} />
        <div className={styles.previewControls}><Button aria-label="Vorige previewpagina" disabled={page[orientation] <= 0} onClick={() => setPage((current) => ({ ...current, [orientation]: current[orientation] - 1 }))} size="sm" type="button" variant="ghost"><ChevronLeft /></Button><span>{realBirthdays ? "Actuele genormaliseerde data" : "Gemarkeerde previewdata"}</span><Button aria-label="Volgende previewpagina" disabled={page[orientation] >= pageCount - 1} onClick={() => setPage((current) => ({ ...current, [orientation]: current[orientation] + 1 }))} size="sm" type="button" variant="ghost"><ChevronRight /></Button></div>
      </aside>
    </div>
  </div>;
}

function PeriodStep({ configuration, connection, status, canManage, refreshAction, update }: {
  configuration: SportlinkBirthdayConfiguration; connection: { id: string } | null; status: Status; canManage: boolean;
  refreshAction: (formData: FormData) => Promise<void>; update: (patch: Partial<SportlinkBirthdayConfiguration>) => void;
}) {
  const options = [{ days: 1, label: "Alleen vandaag", mode: "today" }, { days: 7, label: "Vandaag en komende 7 dagen", mode: "next_7_days" }, { days: 14, label: "Komende 14 dagen", mode: "next_14_days" }, { days: 21, label: "Komende 21 dagen", mode: "next_21_days" }] as const;
  return <section><Heading icon={<CalendarDays />} title="Welke verjaardagen komen in beeld?" copy="Sportlink levert maximaal 21 dagen. De Player filtert verlopen dagen bij iedere weergave opnieuw, ook offline." />
    <div className={styles.choiceGrid}>{options.map((option) => <label data-selected={configuration.period.mode === option.mode || undefined} key={option.mode}><input checked={configuration.period.mode === option.mode} name="period" onChange={() => update({ period: option })} type="radio" /><span><strong>{option.label}</strong><small>{option.days === 1 ? "Alleen personen van vandaag" : `${option.days} dagen, inclusief vandaag`}</small></span></label>)}<label data-selected={configuration.period.mode === "custom" || undefined}><input checked={configuration.period.mode === "custom"} name="period" onChange={() => update({ period: { days: configuration.period.days, mode: "custom" } })} type="radio" /><span><strong>Aangepast</strong><input aria-label="Aangepast aantal dagen" max={21} min={1} onChange={(event) => update({ period: { days: Number(event.target.value), mode: "custom" } })} type="number" value={configuration.period.days} /></span></label></div>
    <div className={styles.statusGrid}><Metric label="Gevonden" value={status.counts.birthdays} /><Metric label="Laatste synchronisatie" value={formatDate(status.lastSuccessAt)} /><Metric label="Volgende synchronisatie" value={formatDate(status.nextSyncAt)} /><Metric label="Versheid" value={freshnessLabel(status.freshness)} /></div>
    <label className={styles.emptyBehavior}><span>Wanneer er niets te tonen is</span><select onChange={(event) => update({ emptyBehavior: event.target.value as SportlinkBirthdayConfiguration["emptyBehavior"] })} value={configuration.emptyBehavior}><option value="skip">Slide automatisch overslaan · aanbevolen</option><option value="today_only">Alleen tonen wanneer iemand vandaag jarig is</option><option value="neutral">Een neutrale lege staat tonen</option></select><small>Overslaan gaat direct door naar het volgende playlistitem zonder zwart of technisch foutbeeld.</small></label>
    {status.freshness === "stale" || status.freshness === "expired" ? <p className="notice notice--warning"><strong>De Last Known Good-cache is verouderd.</strong> Bestaande geldige data blijft behouden; na 21 dagen slaat de Player de slide veilig over.</p> : null}
    {canManage && connection ? <form action={refreshAction}><input name="connectionId" type="hidden" value={connection.id} /><Button type="submit" variant="secondary"><RefreshCw aria-hidden="true" />Handmatig vernieuwen</Button></form> : null}
  </section>;
}

function SelectionStep({ birthdays, configuration, status, teams, update }: { birthdays: Birthday[]; configuration: SportlinkBirthdayConfiguration; status: Status; teams: Array<{ external_id: string; name: string }>; update: (patch: Partial<SportlinkBirthdayConfiguration["selection"]>) => void }) {
  const rolesAvailable = status.counts.matched > 0;
  const roles = [...new Set(birthdays.flatMap((birthday) => birthday.role ? [birthday.role] : []))].sort((left, right) => left.localeCompare(right, "nl-NL"));
  return <section><Heading icon={<ShieldCheck />} title="Selectie en informatie" copy="VeyoCast verrijkt alleen bij één exacte identiteit. Dubbele namen krijgen nooit automatisch een team, rol of foto." />
    <div className={styles.fieldGrid}>
      <label><span>Rolselectie</span><select disabled={!rolesAvailable} onChange={(event) => update({ roleFilter: event.target.value as SportlinkBirthdayConfiguration["selection"]["roleFilter"] })} value={configuration.selection.roleFilter}><option value="all">Iedereen</option><option value="players">Alleen spelers</option><option value="staff">Alleen staf</option><option value="selected">Geselecteerde rollen</option></select><small>{rolesAvailable ? "Gebaseerd op eenduidige Sportlink-teamkoppelingen." : "Beschikbaar na veilige team-/rolverrijking."}</small></label>
      <label><span>Naamweergave</span><select onChange={(event) => update({ nameMode: event.target.value as SportlinkBirthdayConfiguration["selection"]["nameMode"] })} value={configuration.selection.nameMode}><option value="full">Volledige naam</option><option value="first_last_initial">Voornaam + eerste letter achternaam</option><option value="first">Alleen voornaam</option></select></label>
    </div>
    <fieldset className={styles.teamPicker}><legend>Teams</legend><p>Geen selectie betekent alle teams en personen zonder team.</p>{teams.map((team) => <label key={team.external_id}><input checked={configuration.selection.selectedTeamIds.includes(team.external_id)} onChange={(event) => update({ selectedTeamIds: event.target.checked ? [...configuration.selection.selectedTeamIds, team.external_id] : configuration.selection.selectedTeamIds.filter((id) => id !== team.external_id) })} type="checkbox" />{team.name}</label>)}</fieldset>
    {configuration.selection.roleFilter === "selected" ? <fieldset className={styles.teamPicker}><legend>Rollen</legend>{roles.map((role) => <label key={role}><input checked={configuration.selection.selectedRoles.includes(role)} onChange={(event) => update({ selectedRoles: event.target.checked ? [...configuration.selection.selectedRoles, role] : configuration.selection.selectedRoles.filter((value) => value !== role) })} type="checkbox" />{role}</label>)}</fieldset> : null}
    <div className={styles.toggleGrid}>{[
      ["showAge", "Leeftijd tonen", status.counts.knownAge > 0, "Alleen uit betrouwbare importbron"], ["showRole", "Rol tonen", rolesAvailable, "Exact gekoppelde rol"], ["showTeam", "Team tonen", rolesAvailable, "Exact gekoppeld team"], ["showPhoto", "Foto tonen", status.counts.withPhoto > 0, "Alleen rechtmatig en eenduidig"], ["showDayOfWeek", "Dag van de week", true, "Bij de datum"], ["showDate", "Datum tonen", true, "Dag en maand"], ["emphasizeToday", "Vandaag benadrukken", true, "Visueel prioriteren"], ["includeUnknownRoles", "Onbekende rol meenemen", true, "Niet uitsluiten zonder bewijs"]
    ].map(([key, label, available, copy]) => <label data-disabled={!available || undefined} key={String(key)}><input checked={Boolean(configuration.selection[key as keyof typeof configuration.selection])} disabled={!available} onChange={(event) => update({ [String(key)]: event.target.checked } as Partial<SportlinkBirthdayConfiguration["selection"]>)} type="checkbox" /><span><strong>{label}</strong><small>{copy}</small></span></label>)}</div>
    {status.counts.ambiguous ? <p className="notice notice--warning"><strong>{status.counts.ambiguous} dubbelzinnige {status.counts.ambiguous === 1 ? "naam" : "namen"}.</strong> Deze personen blijven zichtbaar zonder mogelijk verkeerde verrijking. Los ze desgewenst op bij de integratie.</p> : null}
  </section>;
}

function DesignStep({ configuration, media, mediaQuery, setMediaQuery, update }: { configuration: SportlinkBirthdayConfiguration; media: Media[]; mediaQuery: string; setMediaQuery: (value: string) => void; update: (patch: Partial<SportlinkBirthdayConfiguration["presentation"]>) => void }) {
  const visibleMedia = media.filter((asset) => asset.name.toLocaleLowerCase("nl-NL").includes(mediaQuery.toLocaleLowerCase("nl-NL")));
  return <section><Heading icon={<ImageIcon />} title="Vormgeving" copy="Automatisch kiest Spotlight, Celebration Grid of Birthday Roll op basis van aantal en oriëntatie." />
    <div className={styles.fieldGrid}>
      <label><span>Presentatiemodus</span><select onChange={(event) => update({ layout: event.target.value as SportlinkBirthdayConfiguration["presentation"]["layout"] })} value={configuration.presentation.layout}><option value="auto">Automatisch</option><option value="spotlight">Spotlight</option><option value="celebration_grid">Celebration Grid</option><option value="birthday_roll">Birthday Roll</option></select></label>
      <label><span>Paginaduur</span><input max={20} min={6} onChange={(event) => update({ pageDurationSeconds: Number(event.target.value) })} type="number" value={configuration.presentation.pageDurationSeconds} /><small>6–20 seconden</small></label>
      <label><span>Maximaal liggend</span><input max={8} min={1} onChange={(event) => update({ maxPerLandscapePage: Number(event.target.value) })} type="number" value={configuration.presentation.maxPerLandscapePage} /></label>
      <label><span>Maximaal staand</span><input max={8} min={1} onChange={(event) => update({ maxPerPortraitPage: Number(event.target.value) })} type="number" value={configuration.presentation.maxPerPortraitPage} /></label>
      <label><span>Kaartstijl</span><select onChange={(event) => update({ cardStyle: event.target.value as "glass" | "solid" | "outline" })} value={configuration.presentation.cardStyle}><option value="glass">Glas</option><option value="solid">Massief</option><option value="outline">Contour</option></select></label>
      <label><span>Variant</span><select onChange={(event) => update({ themeMode: event.target.value as "dark" | "light" })} value={configuration.presentation.themeMode}><option value="dark">Donker</option><option value="light">Licht</option></select></label>
      <label><span>Achtergrondkleur</span><input onChange={(event) => update({ backgroundColor: event.target.value })} type="color" value={configuration.presentation.backgroundColor} /></label>
      <label><span>Tekstuitlijning</span><select onChange={(event) => update({ textAlign: event.target.value as "left" | "center" })} value={configuration.presentation.textAlign}><option value="left">Links</option><option value="center">Gecentreerd</option></select></label>
    </div>
    <div className={styles.toggleGrid}>{[["gradientOverlay", "Gradient voor contrast"], ["motion", "Subtiele motion"], ["confetti", "Subtiele celebratieparticles"], ["useTenantTheme", "Globaal tenantthema gebruiken"]].map(([key, label]) => <label key={key}><input checked={Boolean(configuration.presentation[key as keyof typeof configuration.presentation])} onChange={(event) => update({ [String(key)]: event.target.checked } as Partial<SportlinkBirthdayConfiguration["presentation"]>)} type="checkbox" /><span><strong>{label}</strong></span></label>)}</div>
    <div className={styles.resourcePicker}><header><div><strong>Achtergrond uit Media</strong><small>Zoeken, thumbnails en grote preview</small></div><input aria-label="Media zoeken" onChange={(event) => setMediaQuery(event.target.value)} placeholder="Zoek in Media" type="search" value={mediaQuery} /></header><div className={styles.mediaGrid}><button data-selected={!configuration.presentation.backgroundMediaAssetId || undefined} onClick={() => update({ backgroundMediaAssetId: null })} type="button"><span className={styles.abstractMedia} /><strong>Premium abstract</strong></button>{visibleMedia.map((asset) => <button data-selected={configuration.presentation.backgroundMediaAssetId === asset.id || undefined} key={asset.id} onClick={() => update({ backgroundMediaAssetId: asset.id })} type="button"><Image alt="" height={180} src={asset.url} unoptimized width={320} /><strong>{asset.name}</strong></button>)}</div></div>
  </section>;
}

function ReviewStep({ configuration, orientation, pageCount, realBirthdays, setOrientation, status, totalDuration, views }: { configuration: SportlinkBirthdayConfiguration; orientation: "landscape" | "portrait"; pageCount: number; realBirthdays: boolean; setOrientation: (value: "landscape" | "portrait") => void; status: Status; totalDuration: number; views: { landscape: ReturnType<typeof createDynamicTemplateView>; portrait: ReturnType<typeof createDynamicTemplateView> } }) {
  return <section><Heading icon={<Check />} title="Preview en publiceren" copy="Preview, thumbnail en Player gebruiken dezelfde renderer. De immutable release verwijst naar een dynamische Last Known Good-snapshot." />
    {!realBirthdays ? <p className="notice notice--warning"><strong>Previewdata.</strong> Er is nog geen echte genormaliseerde verjaardag beschikbaar. Publiceren blijft geblokkeerd totdat Sportlink geldig is gesynchroniseerd.</p> : null}
    <div className={styles.orientationTabs}>{(["landscape", "portrait"] as const).map((value) => <button aria-pressed={orientation === value} key={value} onClick={() => setOrientation(value)} type="button">{value === "landscape" ? "Liggend · 16:9" : "Staand · 9:16"}</button>)}</div>
    <dl className={styles.reviewMetrics}><div><dt>Interne pagina’s</dt><dd>{pageCount}</dd></div><div><dt>Duur per pagina</dt><dd>{configuration.presentation.pageDurationSeconds} sec.</dd></div><div><dt>Minimale zichtbaarheid</dt><dd>{totalDuration} sec.</dd></div><div><dt>Leeftijdsdekking</dt><dd>{status.counts.knownAge}/{status.counts.birthdays}</dd></div><div><dt>Team/roldekking</dt><dd>{status.counts.matched}/{status.counts.birthdays}</dd></div><div><dt>Fotodekking</dt><dd>{status.counts.withPhoto}/{status.counts.birthdays}</dd></div></dl>
    <p className="notice"><strong>Duur automatisch aanpassen is actief.</strong> Bij toevoegen aan een playlist gebruikt Studio minimaal pagina-aantal × paginaduur, zodat iedere pagina minstens eenmaal zichtbaar wordt.</p>
    <div className={styles.allPages}>{views[orientation]?.pages.map((_, index) => <div key={index}><span>Pagina {index + 1}</span></div>)}</div>
    <label className={styles.emptyBehavior}><span>Wanneer niets geldig is</span><select value={configuration.emptyBehavior} disabled><option value={configuration.emptyBehavior}>{configuration.emptyBehavior === "skip" ? "Slide automatisch overslaan" : configuration.emptyBehavior === "today_only" ? "Alleen vandaag tonen" : "Neutrale lege staat"}</option></select><small>Ingesteld in stap 1; standaard slaat de Player direct en zonder zwart frame over.</small></label>
  </section>;
}

function Preview({ payload, pageIndex }: { payload: PlayerDynamicTemplatePayload; pageIndex: number }) {
  const orientation = payload.orientation;
  return <div className={styles.previewCanvas} data-orientation={orientation}><EditorialArenaRenderer embedded item={{ durationSeconds: 30, dynamicTemplate: payload, id: `birthday-preview-${orientation}`, title: "Verjaardagen" }} pageIndex={pageIndex} passive /></div>;
}

function birthdayPayload(orientation: "landscape" | "portrait", configuration: SportlinkBirthdayConfiguration, birthdays: Birthday[], media: Media[], connection: { clubName: string; timezone: string } | null, status: Status): PlayerDynamicTemplatePayload {
  const background = configuration.presentation.backgroundMediaAssetId
    ? media.find((asset) => asset.id === configuration.presentation.backgroundMediaAssetId) : null;
  const assets = background ? { [background.id]: { bytes: background.bytes, checksumSha256: background.checksumSha256, mimeType: background.mimeType as "image/jpeg", url: background.url } } : undefined;
  return {
    ...(assets ? { assets } : {}), data: {
      brand: { clubName: connection?.clubName ?? "Jouw vereniging", primaryColor: "#ff6b00" },
      editorial: {}, sport: {
        birthdays: birthdays.map((birthday) => ({
          age: configuration.selection.showAge ? birthday.age : null,
          day: birthday.day, displayName: birthday.displayName, id: birthday.id,
          matchStatus: birthday.matchStatus, month: birthday.month,
          photoMediaAssetId: null, role: birthday.role, teams: birthday.teams
        })),
        configuration, fetchedAt: status.lastSuccessAt ?? birthdays[0]?.sourceFetchedAt ?? new Date().toISOString(),
        timezone: connection?.timezone ?? "Europe/Amsterdam", title: configuration.title
      }, type: "sport_birthdays"
    }, orientation, schemaVersion: 1, slideType: "sport_birthdays",
    snapshotHash: "0".repeat(64), snapshotId: "ecb04a31-036a-43c7-9c48-b2a22102f258",
    templateSlug: `editorial-arena-sport-birthdays-${orientation}`,
    templateVersionId: "a3c18829-51c7-4767-9ec8-26af9ce04ad2"
  };
}

function Heading({ copy, icon, title }: { copy: string; icon: React.ReactNode; title: string }) { return <header className={styles.heading}><span>{icon}</span><div><h2>{title}</h2><p>{copy}</p></div></header>; }
function Metric({ label, value }: { label: string; value: number | string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Nog niet uitgevoerd"; }
function freshnessLabel(value: string) { return value === "fresh" ? "Actueel" : value === "stale" ? "Verouderd · LKG actief" : value === "expired" ? "Verlopen · overslaan" : "Nog geen data"; }
