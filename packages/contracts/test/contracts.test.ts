import { describe, expect, it } from "vitest";

import {
  commandMetadataSchema,
  createSafeActionError,
  safeActionErrorSchema
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
