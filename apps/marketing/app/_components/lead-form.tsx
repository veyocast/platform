"use client";

import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  type LeadFormState,
  submitLeadForm
} from "../_actions/lead-actions";
import type { SetupIntentPayload } from "../_lib/setup-intent";

type LeadFormProps = {
  kind: "contact" | "demo";
  setupIntent?: SetupIntentPayload | null;
  setupIntentToken?: string | null;
};

function FieldError({ error, id }: { error?: string; id: string }) {
  return error ? <span className="field-error" id={id}>{error}</span> : null;
}

function organizationTypeForSetup(setupIntent?: SetupIntentPayload | null) {
  if (setupIntent?.branch === "sportclub") return "Sportvereniging";
  if (setupIntent?.branch === "hospitality") return "Horeca of kantine";
  if (setupIntent?.branch === "organization") return "Andere organisatie";
  return "";
}

function screenBandForSetup(setupIntent?: SetupIntentPayload | null) {
  const count = setupIntent?.screenCount;
  if (!count) return "";
  if (count === 1) return "1 scherm";
  if (count <= 5) return "2–5 schermen";
  if (count <= 15) return "6–15 schermen";
  return "Meer dan 15 schermen";
}

export function LeadForm({ kind, setupIntent, setupIntentToken }: LeadFormProps) {
  const initialLeadFormState: LeadFormState = {
    errors: {},
    message: "",
    status: "idle"
  };
  const [state, action, pending] = useActionState(
    submitLeadForm,
    initialLeadFormState
  );
  const isDemo = kind === "demo";
  const [requestId, setRequestId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({
    name: "", email: "", organization: "", subject: "", message: "",
    organizationType: organizationTypeForSetup(setupIntent), screens: screenBandForSetup(setupIntent)
  });
  const field = (name: string) => ({ value: values[name] ?? "", onChange: () => {} });

  return (
    <form action={action} className="lead-form" noValidate onChange={(event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
        setValues(current => ({ ...current, [input.name]: input.value }));
        setRequestId(crypto.randomUUID());
      }
    }}>
      <input name="kind" type="hidden" value={kind} />
      <input name="requestId" type="hidden" value={requestId} />
      <input name="consent" type="hidden" value="yes" />
      {setupIntentToken ? <input name="setupIntent" type="hidden" value={setupIntentToken} /> : null}
      <div aria-hidden className="lead-form__honeypot">
        <label htmlFor={`${kind}-website`}>Website</label>
        <input autoComplete="off" id={`${kind}-website`} name="website" tabIndex={-1} />
      </div>

      {state.status !== "idle" ? (
        <div
          className={`form-message form-message--${state.status}`}
          role={state.status === "received" ? "status" : "alert"}
          tabIndex={-1}
        >
          {state.status === "received" ? <CheckCircle2 aria-hidden size={20} /> : <AlertCircle aria-hidden size={20} />}
          <div>
            <strong>
              {state.status === "received" ? "Je aanvraag is ontvangen" : state.status === "invalid"
                ? "Controleer je gegevens"
                : "Aflevering nog niet beschikbaar"}
            </strong>
            <p>{state.message}</p>
            {state.status === "unavailable" ? (
              <a
                href={`mailto:support@veyocast.nl?subject=${isDemo ? "VeyoCast%20demo" : "VeyoCast%20contact"}`}
              >
                Mail support@veyocast.nl
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="lead-form__grid">
        <label className="field" htmlFor={`${kind}-name`}>
          <span>Naam</span>
          <input
            aria-describedby={state.errors.name ? `${kind}-name-error` : undefined}
            aria-invalid={Boolean(state.errors.name)}
            autoComplete="name"
            id={`${kind}-name`}
            name="name"
            {...field("name")}
            required
          />
          <FieldError error={state.errors.name} id={`${kind}-name-error`} />
        </label>

        <label className="field" htmlFor={`${kind}-email`}>
          <span>E-mailadres</span>
          <input
            aria-describedby={state.errors.email ? `${kind}-email-error` : undefined}
            aria-invalid={Boolean(state.errors.email)}
            autoComplete="email"
            id={`${kind}-email`}
            inputMode="email"
            name="email"
            {...field("email")}
            required
            type="email"
          />
          <FieldError error={state.errors.email} id={`${kind}-email-error`} />
        </label>

        <label className="field" htmlFor={`${kind}-organization`}>
          <span>Organisatie{isDemo ? "" : " (optioneel)"}</span>
          <input
            aria-describedby={state.errors.organization ? `${kind}-organization-error` : undefined}
            aria-invalid={Boolean(state.errors.organization)}
            autoComplete="organization"
            id={`${kind}-organization`}
            name="organization"
            {...field("organization")}
            required={isDemo}
          />
          <FieldError
            error={state.errors.organization}
            id={`${kind}-organization-error`}
          />
        </label>

        {isDemo ? (
          <>
            <label className="field" htmlFor={`${kind}-organization-type`}>
              <span>Type organisatie</span>
              <select
                aria-describedby={
                  state.errors.organizationType
                    ? `${kind}-organization-type-error`
                    : undefined
                }
                aria-invalid={Boolean(state.errors.organizationType)}
                id={`${kind}-organization-type`}
                name="organizationType"
            {...field("organizationType")}
                required
              >
                <option disabled value="">Maak een keuze</option>
                <option>Sportvereniging</option>
                <option>Sportschool</option>
                <option>Horeca of kantine</option>
                <option>Bedrijf</option>
                <option>Onderwijs</option>
                <option>Retail</option>
                <option>Andere organisatie</option>
              </select>
              <FieldError
                error={state.errors.organizationType}
                id={`${kind}-organization-type-error`}
              />
            </label>
            <label className="field" htmlFor={`${kind}-screens`}>
              <span>Geschat aantal schermen</span>
              <select
                aria-describedby={state.errors.screens ? `${kind}-screens-error` : undefined}
                aria-invalid={Boolean(state.errors.screens)}
                id={`${kind}-screens`}
                name="screens"
            {...field("screens")}
                required
              >
                <option disabled value="">Maak een keuze</option>
                <option>1 scherm</option>
                <option>2–5 schermen</option>
                <option>6–15 schermen</option>
                <option>Meer dan 15 schermen</option>
                <option>Nog onbekend</option>
              </select>
              <FieldError error={state.errors.screens} id={`${kind}-screens-error`} />
            </label>
          </>
        ) : (
          <label className="field" htmlFor={`${kind}-subject`}>
            <span>Onderwerp</span>
            <input
              aria-describedby={state.errors.subject ? `${kind}-subject-error` : undefined}
              aria-invalid={Boolean(state.errors.subject)}
              id={`${kind}-subject`}
              name="subject"
            {...field("subject")}
              required
            />
            <FieldError error={state.errors.subject} id={`${kind}-subject-error`} />
          </label>
        )}
      </div>

      <label className="field" htmlFor={`${kind}-message`}>
        <span>{isDemo ? "Wat wil je laten zien?" : "Bericht"}</span>
        <textarea
          aria-describedby={`${kind}-message-help${state.errors.message ? ` ${kind}-message-error` : ""}`}
          aria-invalid={Boolean(state.errors.message)}
          id={`${kind}-message`}
          name="message"
            {...field("message")}
          required
          rows={6}
        />
        <small id={`${kind}-message-help`}>
          Deel geen wachtwoorden, pairingtokens of andere geheime gegevens.
        </small>
        <FieldError error={state.errors.message} id={`${kind}-message-error`} />
      </label>

      <div className="lead-form__footer">
        <p>
          Door dit formulier te gebruiken, ga je ermee akkoord dat we je gegevens
          gebruiken om op je vraag te reageren. Lees de{" "}
          <Link href="/privacy">privacyverklaring</Link>.
        </p>
        <button className="button button--primary" disabled={pending} type="submit">
          <span>{pending ? "Controleren…" : isDemo ? "Demo aanvragen" : "Bericht verzenden"}</span>
          <Send aria-hidden size={18} />
        </button>
      </div>
    </form>
  );
}
