import { describe, expect, it } from "vitest";

import {
  classifyInvitationDeliveryError,
  invitationDeliveryLabel,
  invitationDeliveryRecovery
} from "./invitation-delivery";

describe("invitation delivery diagnostics", () => {
  it.each([
    [{ code: "email_address_not_authorized", status: 422 }, "invite_smtp_not_configured"],
    [{ code: "over_email_send_rate_limit", status: 429 }, "invite_rate_limited"],
    [{ code: "email_exists", status: 422 }, "invite_existing_account"],
    [{ code: "user_already_exists", status: 422 }, "invite_existing_account"],
    [{ code: "email_provider_disabled", status: 400 }, "invite_email_provider_disabled"],
    [{ code: "hook_timeout_after_retry", status: 500 }, "invite_provider_unavailable"],
    [{ code: "unexpected_failure", status: 500 }, "invite_delivery_failed"]
  ])("classifies %j without storing provider messages", (error, expected) => {
    expect(classifyInvitationDeliveryError(error)).toBe(expected);
  });

  it("treats every 429 response as a safe rate-limit signal", () => {
    expect(classifyInvitationDeliveryError({ status: 429 })).toBe(
      "invite_rate_limited"
    );
  });

  it("renders an actionable SMTP recovery without provider secrets", () => {
    expect(
      invitationDeliveryLabel("failed", "invite_smtp_not_configured")
    ).toBe("SMTP niet ingericht");
    expect(
      invitationDeliveryRecovery("invite_smtp_not_configured")
    ).toContain("Custom SMTP");
  });
});
