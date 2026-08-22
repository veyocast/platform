"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import {
  sportlinkArrivalConfigSchema,
  sportlinkSlideBlueprints,
  type SportlinkArrivalConfig,
  type SportlinkSlideBlueprintKey,
  type SportlinkSlideDraft
} from "@veyocast/contracts";
import { buildSportlinkSlideDrafts } from "@veyocast/domain";
import { Button, Field } from "@veyocast/ui";

type Team = {
  contexts: Array<{ competitionId: string; label: string; phaseId: string | null; poolId: string | null; seasonId: string | null }>;
  dataSourceId: string;
  externalId: string;
  name: string;
};
type Template = { orientation: string; slideType: string; versionId: string };

const steps = ["Bron", "Teams", "Slidetypen", "Context", "Weergave", "Controle", "Maken"];
const keys = Object.keys(sportlinkSlideBlueprints) as SportlinkSlideBlueprintKey[];

export function SportlinkBulkWizard({ action, sources, teams, templates }: {
  action: (formData: FormData) => Promise<void>;
  sources: Array<{ id: string; name: string }>;
  teams: Team[];
  templates: Template[];
}) {
  const [step, setStep] = useState(0);
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [blueprints, setBlueprints] = useState<SportlinkSlideBlueprintKey[]>([]);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [arrivalConfig, setArrivalConfig] = useState<SportlinkArrivalConfig>(() => sportlinkArrivalConfigSchema.parse({}));
  const [draftOverrides, setDraftOverrides] = useState<Record<string, Partial<SportlinkSlideDraft>>>({});
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const sourceTeams = teams.filter((team) => team.dataSourceId === sourceId);
  const selectedTeams = sourceTeams.filter((team) => teamIds.includes(team.externalId));
  const templateMap = useMemo(() => Object.fromEntries(
    templates.filter((template) => template.orientation === orientation)
      .map((template) => [template.slideType, template.versionId])
  ), [orientation, templates]);
  const drafts = useMemo(() => {
    try {
      return buildSportlinkSlideDrafts({
        blueprintKeys: blueprints,
        orientation,
        teams: selectedTeams.map((team) => {
          const first = team.contexts[0];
          return { context: {
            competitionId: first?.competitionId ?? null,
            competitionSelectionMode: first ? "pinned" : "auto_current",
            phaseId: first?.phaseId ?? null,
            poolId: first?.poolId ?? null,
            providerTeamId: team.externalId,
            seasonId: first?.seasonId ?? null
          }, name: team.name };
        }),
        templateVersionIdBySlideType: templateMap
      }).map((draft) => {
        const key = draftKey(draft);
        const override = draftOverrides[key];
        return override ? { ...draft, ...override, context: { ...draft.context, ...override.context } } : draft;
      });
    } catch { return []; }
  }, [blueprints, draftOverrides, orientation, selectedTeams, templateMap]);
  const requiredSlideTypes = [...new Set(blueprints.map((key) => sportlinkSlideBlueprints[key].slideType))];
  const missingTemplates = requiredSlideTypes.filter((type) => !templateMap[type]);
  const canNext = step === 0 ? Boolean(sourceId)
    : step === 1 ? teamIds.length > 0
      : step === 2 ? blueprints.length > 0 && missingTemplates.length === 0
        : drafts.length > 0;
  const payload = {
    dataSourceId: sourceId,
    drafts: drafts.map((draft) => ({
      ...draft,
      ...(draft.blueprintKey.endsWith("arrivals") ? { arrival: arrivalConfig } : {})
    })),
    idempotencyKey
  };

  return (
    <form action={action} className="slw">
      <input name="payload" type="hidden" value={JSON.stringify(payload)} />
      <ol aria-label="Voortgang" className="slw-steps">
        {steps.map((label, index) => <li data-active={index === step || undefined} data-done={index < step || undefined} key={label}><span>{index + 1}</span>{label}</li>)}
      </ol>
      <section className="slw-panel">
        {step === 0 ? <SourceStep onChange={(value) => { setSourceId(value); setTeamIds([]); }} sources={sources} value={sourceId} /> : null}
        {step === 1 ? <MultiChoice description="Je kunt meerdere teams tegelijk kiezen." items={sourceTeams.map((team) => ({ id: team.externalId, label: team.name }))} onChange={setTeamIds} selected={teamIds} title="Teams kiezen" /> : null}
        {step === 2 ? <MultiChoice description="Elke combinatie van team en slidetype wordt een zelfstandig concept." items={keys.map((key) => ({ id: key, label: sportlinkSlideBlueprints[key].label }))} onChange={(values) => setBlueprints(values as SportlinkSlideBlueprintKey[])} selected={blueprints} title="Slidetypen kiezen" /> : null}
        {step === 3 ? <ContextStep drafts={drafts} setOverrides={setDraftOverrides} teams={selectedTeams} /> : null}
        {step === 4 ? <DisplayStep arrivalConfig={arrivalConfig} hasArrivals={blueprints.some((key) => key.endsWith("arrivals"))} orientation={orientation} setArrivalConfig={setArrivalConfig} setOrientation={setOrientation} /> : null}
        {step >= 5 ? <ReviewStep drafts={drafts} /> : null}
        {missingTemplates.length ? <p className="notice notice--critical" role="alert">Voor {orientation === "portrait" ? "staand" : "liggend"} ontbreken gepubliceerde templates: {missingTemplates.join(", ")}.</p> : null}
      </section>
      <footer className="slw-actions">
        <Button disabled={step === 0} onClick={() => setStep((value) => value - 1)} type="button" variant="secondary">Vorige</Button>
        {step < 5 ? <Button disabled={!canNext} onClick={() => setStep((value) => value + 1)} type="button">Volgende</Button> : <Button disabled={!drafts.length || Boolean(missingTemplates.length)} type="submit">{drafts.length} {drafts.length === 1 ? "slide" : "slides"} maken</Button>}
      </footer>
      <style>{`.slw{display:grid;gap:1rem}.slw-steps{display:flex;gap:.5rem;overflow:auto;padding:0;list-style:none}.slw-steps li{display:flex;align-items:center;gap:.4rem;white-space:nowrap;color:var(--muted-foreground);font-weight:700}.slw-steps span{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--border);border-radius:50%}.slw-steps li[data-active] span,.slw-steps li[data-done] span{background:var(--accent);color:var(--accent-foreground);border-color:var(--accent)}.slw-panel{min-height:350px;padding:1.5rem;border:1px solid var(--border);border-radius:18px;background:var(--surface)}.slw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.75rem}.slw-choice{display:flex;gap:.7rem;padding:1rem;border:1px solid var(--border);border-radius:12px}.slw-choice[data-selected]{border-color:var(--accent);background:var(--accent-soft)}.slw-context{display:grid;gap:.7rem;padding:1rem 0;border-bottom:1px solid var(--border)}.slw-actions{display:flex;justify-content:space-between}.slw-review{width:100%;border-collapse:collapse}.slw-review th,.slw-review td{text-align:left;padding:.65rem;border-bottom:1px solid var(--border)}.slw h2{margin-top:0}`}</style>
    </form>
  );
}

function SourceStep({ onChange, sources, value }: { onChange: (value: string) => void; sources: Array<{ id: string; name: string }>; value: string }) {
  return <><h2>Sportlink-bron</h2><p>Kies de gekoppelde vereniging waarvan je slides wilt maken.</p><Field label="Databron"><select onChange={(event) => onChange(event.target.value)} value={value}>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></Field>{!sources.length ? <p className="notice notice--warning">Koppel en synchroniseer eerst Sportlink via Databronnen.</p> : null}</>;
}

function MultiChoice({ description, items, onChange, selected, title }: { description: string; items: Array<{ id: string; label: string }>; onChange: (ids: string[]) => void; selected: readonly string[]; title: string }) {
  return <><h2>{title}</h2><p>{description}</p><div className="slw-grid">{items.map((item) => <label className="slw-choice" data-selected={selected.includes(item.id) || undefined} key={item.id}><input checked={selected.includes(item.id)} onChange={() => onChange(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])} type="checkbox" /><strong>{item.label}</strong></label>)}</div>{!items.length ? <p className="notice notice--warning">Er zijn nog geen gesynchroniseerde opties beschikbaar.</p> : null}</>;
}

function ContextStep({ drafts, setOverrides, teams }: { drafts: SportlinkSlideDraft[]; setOverrides: Dispatch<SetStateAction<Record<string, Partial<SportlinkSlideDraft>>>>; teams: Team[] }) {
  return <><h2>Competitiecontext per slide</h2><p>Elke slide bewaart zijn eigen seizoen, competitie, fase en poule. “Overnemen” is alleen een startpunt.</p>{drafts.map((draft) => {
    const team = teams.find((item) => item.externalId === draft.context.providerTeamId);
    const key = draftKey(draft);
    return <div className="slw-context" key={key}><strong>{draft.name}</strong><Field label="Selectie"><select value={draft.context.competitionSelectionMode} onChange={(event) => setOverrides((current) => ({ ...current, [key]: { ...current[key], context: { ...draft.context, competitionSelectionMode: event.target.value as "auto_current" | "pinned" } } }))}><option value="auto_current">Automatisch huidige competitie</option><option value="pinned">Vastgezette competitie</option></select></Field>{draft.context.competitionSelectionMode === "pinned" ? <Field label="Competitie · fase · poule"><select value={draft.context.competitionId ?? ""} onChange={(event) => { const context = team?.contexts.find((item) => item.competitionId === event.target.value); setOverrides((current) => ({ ...current, [key]: { ...current[key], context: { ...draft.context, competitionId: context?.competitionId ?? null, phaseId: context?.phaseId ?? null, poolId: context?.poolId ?? null, seasonId: context?.seasonId ?? null } } })); }}>{team?.contexts.map((context) => <option key={`${context.competitionId}:${context.poolId}`} value={context.competitionId}>{context.label || context.competitionId}</option>)}</select></Field> : null}</div>;
  })}</>;
}

function DisplayStep({ arrivalConfig, hasArrivals, orientation, setArrivalConfig, setOrientation }: {
  arrivalConfig: SportlinkArrivalConfig;
  hasArrivals: boolean;
  orientation: "landscape" | "portrait";
  setArrivalConfig: Dispatch<SetStateAction<SportlinkArrivalConfig>>;
  setOrientation: (value: "landscape" | "portrait") => void;
}) {
  const updateNumber = (
    key: "cardCount" | "highlightRecentMinutes" | "minutesAfter" | "minutesBefore" | "pageDurationSeconds",
    value: string
  ) => setArrivalConfig((current) => ({ ...current, [key]: Number(value) }));
  const flags = [
    ["showArrivalTime", "Aankomsttijd"], ["showKickoffTime", "Aanvangstijd"],
    ["showDressingRoom", "Kleedkamer"], ["showField", "Veld"],
    ["showCompetition", "Competitie"], ["showWelcome", "Welkomsttekst"],
    ["showClubLogo", "Clublogo"], ["showSponsor", "Sponsor"]
  ] as const;
  return <><h2>Weergave</h2><p>Kies het schermformaat en stel aankomstpagina's desgewenst verder af.</p><div className="slw-grid">{(["landscape", "portrait"] as const).map((value) => <label className="slw-choice" data-selected={orientation === value || undefined} key={value}><input checked={orientation === value} onChange={() => setOrientation(value)} type="radio" /><strong>{value === "portrait" ? "Staand · 1080 × 1920" : "Liggend · 1920 × 1080"}</strong></label>)}</div>{hasArrivals ? <><h3>Aankomstvenster en kaarten</h3><div className="slw-grid"><Field label="Minuten vóór aanvang"><input max="720" min="0" onChange={(event) => updateNumber("minutesBefore", event.target.value)} type="number" value={arrivalConfig.minutesBefore} /></Field><Field label="Minuten na aanvang"><input max="360" min="0" onChange={(event) => updateNumber("minutesAfter", event.target.value)} type="number" value={arrivalConfig.minutesAfter} /></Field><Field label="Kaarten per pagina"><select onChange={(event) => updateNumber("cardCount", event.target.value)} value={arrivalConfig.cardCount}>{[1, 2, 3, 4].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Paginaduur in seconden"><input max="120" min="5" onChange={(event) => updateNumber("pageDurationSeconds", event.target.value)} type="number" value={arrivalConfig.pageDurationSeconds} /></Field><Field label="Recent markeren (minuten)"><input max="180" min="0" onChange={(event) => updateNumber("highlightRecentMinutes", event.target.value)} type="number" value={arrivalConfig.highlightRecentMinutes} /></Field><Field label="Ontvangstbalie (optioneel)"><input maxLength={120} onChange={(event) => setArrivalConfig((current) => ({ ...current, dutyDeskText: event.target.value.trim() || null }))} placeholder="Meld je bij de ontvangstbalie" value={arrivalConfig.dutyDeskText ?? ""} /></Field><Field label="Gedrag zonder inhoud"><select onChange={(event) => setArrivalConfig((current) => ({ ...current, emptyBehavior: event.target.value as "skip" | "placeholder" }))} value={arrivalConfig.emptyBehavior}><option value="skip">Slide overslaan</option><option value="placeholder">Lege melding tonen</option></select></Field><Field label="Tekst zonder inhoud"><input maxLength={160} onChange={(event) => setArrivalConfig((current) => ({ ...current, placeholderText: event.target.value }))} value={arrivalConfig.placeholderText} /></Field><Field label="Welkomsttekst"><input maxLength={80} onChange={(event) => setArrivalConfig((current) => ({ ...current, welcomeText: event.target.value }))} value={arrivalConfig.welcomeText} /></Field></div><div className="slw-grid">{flags.map(([key, label]) => <label className="slw-choice" data-selected={arrivalConfig[key] || undefined} key={key}><input checked={arrivalConfig[key]} onChange={(event) => setArrivalConfig((current) => ({ ...current, [key]: event.target.checked }))} type="checkbox" /><strong>{label}</strong></label>)}</div></> : null}</>;
}

function ReviewStep({ drafts }: { drafts: SportlinkSlideDraft[] }) {
  return <><h2>Eindcontrole</h2><p>Er worden nu nog geen records gemaakt. Na bevestigen ontstaat één transactionele batch.</p><table className="slw-review"><thead><tr><th>Naam</th><th>Type</th><th>Context</th><th>Formaat</th></tr></thead><tbody>{drafts.map((draft) => <tr key={draftKey(draft)}><td>{draft.name}</td><td>{sportlinkSlideBlueprints[draft.blueprintKey].label}</td><td>{draft.context.competitionSelectionMode === "auto_current" ? "Automatisch" : [draft.context.seasonId, draft.context.competitionId, draft.context.phaseId, draft.context.poolId].filter(Boolean).join(" · ")}</td><td>{draft.orientation === "portrait" ? "Staand" : "Liggend"}</td></tr>)}</tbody></table></>;
}

function draftKey(draft: SportlinkSlideDraft) { return `${draft.context.providerTeamId}:${draft.blueprintKey}`; }
