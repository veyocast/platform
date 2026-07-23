import { describe, expect, it } from "vitest";

import {
  commandMetadataSchema,
  createSafeActionError,
  playerPlaybackItemSchema,
  playlistConflictSchema,
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

describe("playlist contracts", () => {
  it("accepts the exact playback fields shared by editor preview and Player", () => {
    expect(
      playerPlaybackItemSchema.parse({
        accessibilityName: "Openingsvideo zonder gesproken tekst",
        backgroundColor: "#0A0A0A",
        cropFocus: { x: 0.25, y: 0.75 },
        displayTitle: "Wedstrijdintro thuis",
        durationSeconds: 10,
        enabled: true,
        fitMode: "cover",
        id: "30000000-0000-4000-8000-000000000001",
        kind: "video",
        muted: false,
        section: {
          name: "Sponsors",
          positionKey: 2,
          sourceSectionId: "32000000-0000-4000-8000-000000000001"
        },
        title: "Wedstrijdintro",
        transition: "crossfade",
        trim: { endSeconds: 18, startSeconds: 8 },
        visibility: {
          from: "2026-07-23T16:00:00.000Z",
          until: "2026-07-23T18:00:00.000Z"
        },
        volumePercent: 60
      })
    ).toMatchObject({
      kind: "video",
      muted: false,
      transition: "crossfade",
      volumePercent: 60
    });
  });

  it("keeps legacy schemaVersion 1 playback items valid without publisher fields", () => {
    expect(
      playerPlaybackItemSchema.parse({
        durationSeconds: 10,
        fitMode: "cover",
        id: "30000000-0000-4000-8000-000000000001",
        kind: "video",
        muted: true,
        title: "Wedstrijdintro"
      })
    ).toEqual({
      durationSeconds: 10,
      fitMode: "cover",
      id: "30000000-0000-4000-8000-000000000001",
      kind: "video",
      muted: true,
      title: "Wedstrijdintro"
    });
  });

  it("rejects invalid trim and visibility windows", () => {
    const baseline = {
      durationSeconds: 10,
      fitMode: "cover",
      id: "30000000-0000-4000-8000-000000000001",
      kind: "video",
      muted: true,
      title: "Wedstrijdintro"
    };

    expect(() =>
      playerPlaybackItemSchema.parse({
        ...baseline,
        trim: { endSeconds: 5, startSeconds: 5 }
      })
    ).toThrow();
    expect(() =>
      playerPlaybackItemSchema.parse({
        ...baseline,
        visibility: {
          from: "2026-07-23T18:00:00.000Z",
          until: "2026-07-23T16:00:00.000Z"
        }
      })
    ).toThrow();
  });

  it("keeps revision conflicts typed and free of database details", () => {
    expect(
      playlistConflictSchema.parse({
        actualRevision: 8,
        code: "PLAYLIST_REVISION_CONFLICT",
        expectedRevision: 7,
        playlistId: "40000000-0000-4000-8000-000000000001",
        recovery: "compare"
      })
    ).toEqual({
      actualRevision: 8,
      code: "PLAYLIST_REVISION_CONFLICT",
      expectedRevision: 7,
      playlistId: "40000000-0000-4000-8000-000000000001",
      recovery: "compare"
    });
  });
});
