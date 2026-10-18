"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { submitLeadForm, type LeadFormState } from "../_actions/lead-actions";
import { Icon } from "./ui";
import type { SetupIntentPayload } from "../_lib/setup-intent";

const initialState: LeadFormState = { errors: {}, message: "", status: "idle" };

export function DemoForm({ appHref, onDemo, setupIntent, setupIntentToken, setupUnavailable }: { appHref: string; onDemo?: () => void; setupIntent?: SetupIntentPayload | null; setupIntentToken?: string | null; setupUnavailable?: boolean }) {
  const [state, action, pending] = useActionState(submitLeadForm, initialState);
  const [requestId, setRequestId] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({
    organizationType: setupIntent?.branch === "sportclub" ? "Sportvereniging" : setupIntent?.branch === "hospitality" ? "Horeca" : setupIntent ? "Bedrijf of organisatie" : "",
    screens: setupIntent ? setupIntent.screenCount <= 3 ? "1–3" : setupIntent.screenCount <= 10 ? "4–10" : "Meer dan 10" : "1–3"
  });
  useEffect(() => { setRequestId(crypto.randomUUID()); }, []);
  return <section className="mk-section mk-demo-section">
    <div><div className="mk-kicker"><span />Maak kennis met je nieuwe werkplek</div><h2>Eerst even zelf kijken?</h2><p>Open je werkplek. Maak een slide, bouw een playlist en bekijk hoe je content op een player verschijnt.</p><a className="mk-button" href={appHref} onClick={onDemo ? event => { event.preventDefault(); onDemo(); } : undefined}>Inloggen<Icon name="ArrowUpRight" size={18} /></a><div className="mk-demo-points">{["Je eigen content op één plek", "Wijzigingen veilig bewaard in je organisatie", "Inclusief Studio, planning en playerbeheer"].map(text => <div key={text}><Icon name="CheckCircle2" size={18} />{text}</div>)}</div><div className="mk-demo-notice"><Icon name="Info" size={20} /><div><strong>Vertel ons over je plannen.</strong><p>Een ontvangen aanvraag is nog geen ingeplande afspraak. We nemen contact met je op.</p></div></div></div>
    <div className="mk-form-card">{state.status === "received" ? <div className="mk-form-success" role="status"><span><Icon name="Check" size={32} /></span><h2>Zo begint een goed gesprek.</h2><p>{state.message}</p><strong>Je aanvraag is ontvangen.</strong></div> : <form action={action} onChange={event => { const target = event.target; if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) { setFields(current => ({ ...current, [target.name]: target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked ? "yes" : "" : target.value })); setRequestId(crypto.randomUUID()); } }}>
      <input type="hidden" name="kind" value="demo" /><input type="hidden" name="requestId" value={requestId} />
      {setupIntentToken ? <input type="hidden" name="setupIntent" value={setupIntentToken} /> : null}
      {setupIntent ? <p role="status">Je opstelling is meegenomen: {setupIntent.screenCount} schermen.</p> : null}
      {setupUnavailable ? <p role="alert">De meegenomen opstelling is verlopen of ongeldig. Bouw deze opnieuw of beschrijf je plannen hieronder.</p> : null}
      <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="mk-form-heading"><small>VERTEL ONS OVER JE PLANNEN</small><h2>Een scherm. Of een heel verhaal.</h2><p>Vertel hieronder wat je met je schermen wilt laten zien.</p></div>
      <div className="mk-form-fields">
        <label>Je naam<input name="name" value={fields.name ?? ""} onChange={() => {}} autoComplete="name" required minLength={2} maxLength={100} placeholder="Voor- en achternaam" /></label>
        <label>E-mailadres<input name="email" value={fields.email ?? ""} onChange={() => {}} type="email" autoComplete="email" required maxLength={150} placeholder="naam@organisatie.nl" /></label>
        <label>Organisatie<input name="organization" value={fields.organization ?? ""} onChange={() => {}} autoComplete="organization" required minLength={2} maxLength={140} placeholder="Naam van je organisatie" /></label>
        <div className="mk-form-row"><label>Waarvoor?<select name="organizationType" value={fields.organizationType} onChange={() => {}} required><option value="" disabled>Kies een toepassing</option><option>Sportvereniging</option><option>Horeca</option><option>Bedrijf of organisatie</option><option>Anders</option></select></label><label>Aantal schermen<select name="screens" value={fields.screens} onChange={() => {}}><option>1–3</option><option>4–10</option><option>Meer dan 10</option><option>Nog niet bekend</option></select></label></div>
        <label>Wat wil je laten zien?<textarea name="message" value={fields.message ?? ""} onChange={() => {}} maxLength={2000} rows={3} placeholder="Bijvoorbeeld clubnieuws, een prijslijst of een warm welkom…" /></label>
        <label className="mk-check"><input name="consent" type="checkbox" required value="yes" checked={fields.consent === "yes"} onChange={() => {}} /><span>VeyoCast mag mijn gegevens gebruiken om op deze aanvraag te reageren. Lees de <Link href="/privacy">privacyverklaring</Link>.</span></label>
        {state.status !== "idle" ? <p className="mk-form-error" role="alert">{state.message} {Object.values(state.errors).join(" ")}</p> : null}
        <button type="submit" className="mk-button" disabled={pending}>{pending ? "Aanvraag versturen…" : "Demo aanvragen"}<Icon name="ArrowUpRight" size={18} /></button>
      </div>
    </form>}<div className="mk-privacy-notice"><Icon name="LockKeyhole" size={15} /><p>Je gegevens worden alleen gebruikt voor je aanvraag. <Link href="/privacy">Lees meer over privacy</Link>.</p></div></div>
  </section>;
}
