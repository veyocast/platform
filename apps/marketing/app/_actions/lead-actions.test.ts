import { describe, expect, it } from "vitest";

import type { LeadFormState } from "./lead-actions";
import { submitLeadForm } from "./lead-actions";

const initialState: LeadFormState = {
  errors: {},
  message: "",
  status: "idle"
};

function validDemoForm() {
  const form = new FormData();
  form.set("kind", "demo");
  form.set("name", "Danny Goldenbelt");
  form.set("email", "danny@example.nl");
  form.set("organization", "VeyoCast pilotvereniging");
  form.set("organizationType", "Sportvereniging");
  form.set("screens", "2–5 schermen");
  form.set("message", "Toon de workflow van media tot een gepubliceerde release.");
  return form;
}

describe("marketing lead form action", () => {
  it("returns field errors for incomplete input", async () => {
    const form = new FormData();
    form.set("kind", "demo");

    const result = await submitLeadForm(initialState, form);

    expect(result.status).toBe("invalid");
    expect(result.errors).toMatchObject({
      email: expect.any(String),
      message: expect.any(String),
      name: expect.any(String),
      organization: expect.any(String),
      organizationType: expect.any(String),
      screens: expect.any(String)
    });
  });

  it("does not claim delivery while no provider is configured", async () => {
    const result = await submitLeadForm(initialState, validDemoForm());

    expect(result.status).toBe("unavailable");
    expect(result.message).toContain("niet opgeslagen");
    expect(result.message).toContain("support@veyocast.nl");
  });

  it("rejects honeypot submissions", async () => {
    const form = validDemoForm();
    form.set("website", "https://spam.invalid");

    const result = await submitLeadForm(initialState, form);

    expect(result.status).toBe("invalid");
    expect(result.errors.form).toBeDefined();
  });

  it("rejects a tampered carried setup before processing the lead", async () => {
    const previousSecret = process.env.VEYOCAST_SETUP_INTENT_SIGNING_SECRET;
    process.env.VEYOCAST_SETUP_INTENT_SIGNING_SECRET =
      "test-only-lead-setup-secret-with-more-than-32-bytes";
    const form = validDemoForm();
    form.set("setupIntent", "tampered.intent");

    try {
      const result = await submitLeadForm(initialState, form);
      expect(result.status).toBe("invalid");
      expect(result.errors.form).toContain("verlopen of ongeldig");
    } finally {
      if (previousSecret === undefined) {
        delete process.env.VEYOCAST_SETUP_INTENT_SIGNING_SECRET;
      } else {
        process.env.VEYOCAST_SETUP_INTENT_SIGNING_SECRET = previousSecret;
      }
    }
  });
});
