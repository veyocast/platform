"use client";

import type { SportlinkArrivalConfig, SportlinkArrivalMotionPreset } from "@veyocast/contracts";
import { Field } from "@veyocast/ui";

export type SportlinkMediaOption = { id: string; name: string };

const motionOptions: Array<{ label: string; value: SportlinkArrivalMotionPreset }> = [
  { label: "Automatisch afwisselen", value: "auto" },
  { label: "Aurora omhoog", value: "aurora-rise" },
  { label: "Spotlight bloom", value: "spotlight-bloom" },
  { label: "Kinetische split", value: "kinetic-split" },
  { label: "Prisma swipe", value: "prism-swipe" },
  { label: "Grand flip", value: "grand-flip" }
];

export function SportlinkArrivalFields({ media, onChange, value }: {
  media: SportlinkMediaOption[];
  onChange: (value: SportlinkArrivalConfig) => void;
  value: SportlinkArrivalConfig;
}) {
  const number = (
    key: "cardCount" | "highlightRecentMinutes" | "minutesAfter" | "minutesBefore" | "pageDurationSeconds",
    next: string
  ) => onChange({ ...value, [key]: Number(next) });
  const toggle = (
    key: "showArrivalTime" | "showClubLogo" | "showCompetition" | "showDressingRoom" | "showField" | "showKickoffTime" | "showSponsor" | "showWelcome",
    next: boolean
  ) => onChange({ ...value, [key]: next });
  return (
    <div className="vc-arrival-fields">
      <div className="vc-arrival-fields__grid">
        <Field label="Minuten vóór aanvang"><input max="720" min="0" onChange={(event) => number("minutesBefore", event.target.value)} type="number" value={value.minutesBefore} /></Field>
        <Field label="Minuten na aanvang"><input max="360" min="0" onChange={(event) => number("minutesAfter", event.target.value)} type="number" value={value.minutesAfter} /></Field>
        <Field label="Maximaal aantal blokken"><select onChange={(event) => number("cardCount", event.target.value)} value={value.cardCount}>{[1, 2, 3, 4].map((count) => <option key={count}>{count}</option>)}</select></Field>
        <Field label="Paginaduur in seconden"><input max="120" min="5" onChange={(event) => number("pageDurationSeconds", event.target.value)} type="number" value={value.pageDurationSeconds} /></Field>
        <Field label="Wijziging markeren (minuten)"><input max="180" min="0" onChange={(event) => number("highlightRecentMinutes", event.target.value)} type="number" value={value.highlightRecentMinutes} /></Field>
        <Field label="Motion animatie"><select onChange={(event) => onChange({ ...value, motionPreset: event.target.value as SportlinkArrivalMotionPreset })} value={value.motionPreset}>{motionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
        <Field label="Welkomsttekst"><input disabled={!value.showWelcome} maxLength={80} onChange={(event) => onChange({ ...value, welcomeText: event.target.value })} value={value.welcomeText} /></Field>
        <Field label="Extra informatie (optioneel)"><input maxLength={120} onChange={(event) => onChange({ ...value, dutyDeskText: event.target.value.trim() || null })} placeholder="Meld je bij het wedstrijdsecretariaat" value={value.dutyDeskText ?? ""} /></Field>
        <Field label="Wanneer er geen aankomsten zijn"><select onChange={(event) => onChange({ ...value, emptyBehavior: event.target.value === "placeholder" ? "placeholder" : "skip" })} value={value.emptyBehavior}><option value="skip">Slide overslaan</option><option value="placeholder">Melding tonen</option></select></Field>
        {value.emptyBehavior === "placeholder" ? <Field label="Melding bij lege slide"><input maxLength={160} minLength={1} onChange={(event) => onChange({ ...value, placeholderText: event.target.value })} value={value.placeholderText} /></Field> : null}
        <Field label="Sponsor (optioneel)"><select disabled={!value.showSponsor} onChange={(event) => onChange({ ...value, sponsorMediaAssetId: event.target.value || null })} value={value.sponsorMediaAssetId ?? ""}><option value="">Geen sponsorafbeelding</option>{media.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></Field>
      </div>
      <div className="vc-arrival-fields__toggles">
        <Toggle checked={value.showWelcome} label="Welkomsttekst" onChange={(checked) => toggle("showWelcome", checked)} />
        <Toggle checked={value.showClubLogo} label="Clublogo" onChange={(checked) => toggle("showClubLogo", checked)} />
        <Toggle checked={value.showArrivalTime} label="Aankomsttijd" onChange={(checked) => toggle("showArrivalTime", checked)} />
        <Toggle checked={value.showKickoffTime} label="Aanvangstijd" onChange={(checked) => toggle("showKickoffTime", checked)} />
        <Toggle checked={value.showCompetition} label="Competitie" onChange={(checked) => toggle("showCompetition", checked)} />
        <Toggle checked={value.showField} label="Veld" onChange={(checked) => toggle("showField", checked)} />
        <Toggle checked={value.showDressingRoom} label="Kleedkamer" onChange={(checked) => toggle("showDressingRoom", checked)} />
        <Toggle checked={value.showSponsor} label="Sponsor" onChange={(checked) => toggle("showSponsor", checked)} />
      </div>
      <p>Bij vijf of meer aankomsten maakt de Player automatisch extra pagina's. Providerlogo's blijven buiten deze gebruikersmediakeuze.</p>
      <style>{`.vc-arrival-fields{display:grid;gap:.75rem}.vc-arrival-fields__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.vc-arrival-fields__toggles{display:flex;flex-wrap:wrap;gap:.5rem}.vc-arrival-fields__toggles label{display:flex;align-items:center;gap:.4rem;min-height:44px;padding:.5rem .65rem;border:1px solid var(--border);border-radius:8px}.vc-arrival-fields>p{margin:0;color:var(--muted-foreground);font-size:.8rem}@media(max-width:640px){.vc-arrival-fields__grid{grid-template-columns:1fr}}`}</style>
    </div>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label><input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" /> {label}</label>;
}
