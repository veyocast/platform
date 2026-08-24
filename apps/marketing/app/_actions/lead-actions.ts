"use server";

import {
  verifySetupIntentToken
} from "../_lib/setup-intent";
import { setupIntentSigningSecret } from "../_lib/setup-intent.server";

export type LeadFormState = {
  errors: Record<string, string>;
  message: string;
  status: "idle" | "invalid" | "unavailable";
};

function textValue(formData: FormData, field: string, maxLength: number) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function submitLeadForm(
  _previous: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  const kind = textValue(formData, "kind", 16);
  const name = textValue(formData, "name", 100);
  const email = textValue(formData, "email", 254).toLowerCase();
  const organization = textValue(formData, "organization", 140);
  const message = textValue(formData, "message", 2_000);
  const subject = textValue(formData, "subject", 120);
  const screens = textValue(formData, "screens", 40);
  const organizationType = textValue(formData, "organizationType", 80);
  const honeypot = textValue(formData, "website", 160);
  const setupIntentToken = textValue(formData, "setupIntent", 8_000);
  const errors: Record<string, string> = {};

  if (honeypot) {
    return {
      errors: { form: "De aanvraag kon niet veilig worden gecontroleerd." },
      message: "Controleer het formulier en probeer opnieuw.",
      status: "invalid"
    };
  }

  if (kind !== "contact" && kind !== "demo") {
    errors.form = "Het formulierdoel is niet geldig.";
  }
  if (setupIntentToken) {
    const secret = setupIntentSigningSecret();
    if (!secret || !await verifySetupIntentToken(setupIntentToken, secret)) {
      errors.form = "De meegenomen opstelling is verlopen of ongeldig. Bouw de opstelling opnieuw.";
    }
  }
  if (name.length < 2) errors.name = "Vul je naam in.";
  if (!validEmail(email)) errors.email = "Vul een geldig e-mailadres in.";
  if (kind === "demo" && organization.length < 2) {
    errors.organization = "Vul de naam van je organisatie of vereniging in.";
  }
  if (kind === "demo" && !organizationType) {
    errors.organizationType = "Kies het type organisatie.";
  }
  if (kind === "demo" && !screens) {
    errors.screens = "Kies een inschatting van het aantal schermen.";
  }
  if (kind === "contact" && subject.length < 3) {
    errors.subject = "Vul een onderwerp in.";
  }
  if (message.length < 10) {
    errors.message = "Beschrijf je vraag in minimaal 10 tekens.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      message: "Controleer de gemarkeerde velden.",
      status: "invalid"
    };
  }

  // Er is bewust nog geen deliveryprovider geconfigureerd. Geldige invoer wordt
  // niet gelogd of tijdelijk opgeslagen en er wordt geen vals succes gemeld.
  return {
    errors: {},
    message:
      "Het formulier kan nog niet veilig worden afgeleverd. Mail je aanvraag rechtstreeks naar support@veyocast.nl; je invoer is niet opgeslagen.",
    status: "unavailable"
  };
}
