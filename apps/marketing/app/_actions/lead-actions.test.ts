import { beforeEach, describe, expect, it, vi } from "vitest";
import { receiveInquiry } from "../_lib/inquiries.server";
vi.mock("../_lib/inquiries.server", () => ({ receiveInquiry: vi.fn() }));

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
  form.set("consent", "yes");
  form.set("requestId", "20000000-0000-4000-8000-000000226001");
  return form;
}

describe("marketing lead form action", () => {
  beforeEach(() => { vi.mocked(receiveInquiry).mockReset().mockResolvedValue({ received: false }); });
  it("returns field errors for incomplete input", async () => {
    const form = new FormData();
    form.set("kind", "demo");

    const result = await submitLeadForm(initialState, form);

    expect(result.status).toBe("invalid");
    expect(result.errors).toMatchObject({
      email: expect.any(String),
      name: expect.any(String),
      organization: expect.any(String),
      organizationType: expect.any(String),
      screens: expect.any(String)
    });
  });

  it("does not claim delivery while no provider is configured", async () => {
    const result = await submitLeadForm(initialState, validDemoForm());

    expect(result.status).toBe("unavailable");
    expect(result.message).toContain("niet worden bevestigd");
    expect(result.message).toContain("support@veyocast.nl");
  });

  it("reports receipt only after the storage service confirms it", async () => {
    vi.mocked(receiveInquiry).mockResolvedValue({ received: true });
    const result = await submitLeadForm(initialState, validDemoForm());
    expect(result.status).toBe("received");
    expect(receiveInquiry).toHaveBeenCalledWith("20000000-0000-4000-8000-000000226001", expect.objectContaining({ email: "danny@example.nl", consent: "yes" }));
    expect(result.message).toContain("nog geen afspraak");
  });

  it("does not contact storage for a missing consent", async () => {
    const form = validDemoForm();
    form.delete("consent");
    expect((await submitLeadForm(initialState, form)).status).toBe("invalid");
    expect(receiveInquiry).not.toHaveBeenCalled();
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
