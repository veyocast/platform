import { describe, expect, it } from "vitest";

import {
  commandMetadataSchema,
  createSafeActionError,
  safeActionErrorSchema,
  tenantProvisioningCommandSchema
} from "../src";

describe("safe action error contracts", () => {
  it("accepts an allowlisted public error without implementation details", () => {
    expect(
      createSafeActionError({
        code: "CONFLICT",
        message: "De gegevens zijn ondertussen gewijzigd.",
        recovery: "Laad de nieuwste versie en probeer opnieuw.",
        requestId: "request-12345678"
      })
    ).toEqual({
      code: "CONFLICT",
      message: "De gegevens zijn ondertussen gewijzigd.",
      recovery: "Laad de nieuwste versie en probeer opnieuw.",
      requestId: "request-12345678"
    });
  });

  it("rejects unknown fields that could leak internal state", () => {
    expect(() =>
      safeActionErrorSchema.parse({
        code: "INTERNAL",
        message: "De actie is niet voltooid.",
        recovery: "Probeer later opnieuw.",
        stack: "sensitive stack"
      })
    ).toThrow();
  });
});

describe("identity command contracts", () => {
  it("normalizes a complete tenant provisioning command", () => {
    expect(
      tenantProvisioningCommandSchema.parse({
        actorBecomesOwner: false,
        locale: "nl-NL",
        metadata: {
          idempotencyKey: "tenant:018f7aaa-1234",
          requestId: "request-12345678"
        },
        name: "Voorbeeldvereniging",
        ownerEmail: "Owner@Example.test",
        screenLimit: 4,
        slug: "voorbeeldvereniging",
        timezone: "Europe/Amsterdam"
      })
    ).toMatchObject({ ownerEmail: "owner@example.test" });
  });

  it("rejects unsupported locales and invalid provisioning limits", () => {
    expect(() =>
      tenantProvisioningCommandSchema.parse({
        actorBecomesOwner: false,
        locale: "nl-BE",
        metadata: {
          idempotencyKey: "tenant:018f7aaa-1234",
          requestId: "request-12345678"
        },
        name: "Voorbeeldvereniging",
        ownerEmail: "owner@example.test",
        screenLimit: 0,
        slug: "voorbeeldvereniging",
        timezone: "Europe/Amsterdam"
      })
    ).toThrow();
  });
});

describe("command metadata contracts", () => {
  it("accepts bounded idempotency and revision metadata", () => {
    expect(
      commandMetadataSchema.parse({
        expectedRevision: 4,
        idempotencyKey: "tenant-create:018f7aaa",
        requestId: "request-12345678"
      })
    ).toEqual({
      expectedRevision: 4,
      idempotencyKey: "tenant-create:018f7aaa",
      requestId: "request-12345678"
    });
  });

  it("rejects short or whitespace-bearing idempotency keys", () => {
    expect(() =>
      commandMetadataSchema.parse({
        idempotencyKey: "short",
        requestId: "request-12345678"
      })
    ).toThrow();

    expect(() =>
      commandMetadataSchema.parse({
        idempotencyKey: "tenant create:018f7aaa",
        requestId: "request-12345678"
      })
    ).toThrow();
  });
});
