import { describe, expect, it } from "vitest";

import {
  classifyTenantFeatureRolloutError,
  deriveTenantFeatureRolloutDisplay,
  isTenantFeatureRolloutResult,
  parseTenantFeatureRolloutCommand,
  platformTenantFeatureDefinitions,
  platformTenantFeatureKeys,
  safeFeatureRolloutReference,
  tenantFeatureRolloutErrorMessages
} from "./feature-rollout";

const requestId = "12345678-1234-4234-9234-123456789abc";
const reason =
  "Pilotcohort Duindorp SV met eigenaar, verificatiepad en expliciete rollback.";

describe("platform tenant-featurevrijgave", () => {
  it("gebruikt één unieke catalogus voor presentatie en servervalidatie", () => {
    expect(platformTenantFeatureKeys).toEqual(
      platformTenantFeatureDefinitions.map((definition) => definition.key)
    );
    expect(new Set(platformTenantFeatureKeys).size).toBe(
      platformTenantFeatureKeys.length
    );
    expect(platformTenantFeatureKeys).toContain("ledscores_realtime");
  });

  it("accepteert LED Scores realtime met de canonieke sleutel en volledige reden", () => {
    expect(
      parseTenantFeatureRolloutCommand({
        enabled: "yes",
        flagKey: "ledscores_realtime",
        reason: `  ${reason}  `,
        requestId,
        revision: "0"
      })
    ).toEqual({
      data: {
        enabled: true,
        expectedRevision: 0,
        flagKey: "ledscores_realtime",
        reason,
        requestId
      },
      ok: true
    });
  });

  it.each(platformTenantFeatureKeys)(
    "houdt bestaande tenantvrijgave %s beschikbaar",
    (flagKey) => {
      expect(
        parseTenantFeatureRolloutCommand({
          enabled: "no",
          flagKey,
          reason,
          requestId,
          revision: "3"
        }).ok
      ).toBe(true);
    }
  );

  it("wijst onbekende keys gecontroleerd af", () => {
    expect(
      parseTenantFeatureRolloutCommand({
        enabled: "yes",
        flagKey: "led-scores-realtime",
        reason,
        requestId,
        revision: "0"
      })
    ).toEqual({ error: "feature-onbekend", ok: false });
  });

  it.each(["", "te kort", " ".repeat(9)])(
    "wijst een lege of te korte reden duidelijk af",
    (invalidReason) => {
      expect(
        parseTenantFeatureRolloutCommand({
          enabled: "yes",
          flagKey: "ledscores_realtime",
          reason: invalidReason,
          requestId,
          revision: "0"
        })
      ).toEqual({ error: "feature-reden", ok: false });
    }
  );

  it.each([
    { enabled: "true", requestId, revision: "0" },
    { enabled: "yes", requestId: "geen-uuid", revision: "0" },
    { enabled: "yes", requestId, revision: "-1" },
    { enabled: "yes", requestId, revision: "1.5" },
    { enabled: "yes", requestId, revision: "" },
    { enabled: "yes", requestId, revision: " " },
    { enabled: "yes", requestId, revision: "01" },
    { enabled: "yes", requestId, revision: "1e3" },
    { enabled: "yes", requestId, revision: "0x1" }
  ])("wijst verouderde of gemanipuleerde formulierdata af", (invalid) => {
    expect(
      parseTenantFeatureRolloutCommand({
        ...invalid,
        flagKey: "ledscores_realtime",
        reason
      })
    ).toEqual({ error: "feature-invoer", ok: false });
  });

  it.each([
    ["42501", "rechten"],
    ["23514", "feature-invoer"],
    ["22023", "feature-invoer"],
    ["42704", "feature-definition"],
    ["PGRST202", "feature-definition"],
    ["P0002", "feature-tenant"],
    ["40001", "feature-conflict"],
    ["23505", "feature-conflict"],
    ["PT409", "feature-conflict"],
    ["55000", "feature-kill-switch"],
    ["23503", "feature-audit"],
    ["PT500", "feature-audit"],
    ["PGRST000", "feature-uitkomst-onzeker"],
    [undefined, "feature-uitkomst-onzeker"]
  ])("vertaalt RPC-code %s naar een veilige UI-fout", (code, expected) => {
    expect(classifyTenantFeatureRolloutError(code)).toBe(expected);
  });

  it("geeft alleen een geldige UUID als supportreferentie terug", () => {
    expect(safeFeatureRolloutReference(requestId)).toBe(requestId);
    expect(safeFeatureRolloutReference("<script>alert(1)</script>")).toBeNull();
  });

  it("accepteert uitsluitend een antwoord voor exact dezelfde rolloutopdracht", () => {
    const parsed = parseTenantFeatureRolloutCommand({
      enabled: "yes",
      flagKey: "ledscores_realtime",
      reason,
      requestId,
      revision: "0"
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(
      isTenantFeatureRolloutResult(
        {
          auditEventId: "22345678-1234-4234-9234-123456789abc",
          enabled: true,
          flagKey: "ledscores_realtime",
          outcome: "applied",
          requestId,
          revision: 1,
          tenantId: "32345678-1234-4234-9234-123456789abc"
        },
        parsed.data,
        "32345678-1234-4234-9234-123456789abc"
      )
    ).toBe(true);
    expect(
      isTenantFeatureRolloutResult(
        {
          auditEventId: "22345678-1234-4234-9234-123456789abc",
          enabled: true,
          flagKey: "venue_twin",
          outcome: "applied",
          requestId,
          revision: 1,
          tenantId: "32345678-1234-4234-9234-123456789abc"
        },
        parsed.data,
        "32345678-1234-4234-9234-123456789abc"
      )
    ).toBe(false);
    expect(
      isTenantFeatureRolloutResult(
        null,
        parsed.data,
        "32345678-1234-4234-9234-123456789abc"
      )
    ).toBe(false);
  });

  it.each([
    [
      {
        definitionAvailable: false,
        effectiveEnabled: false,
        killSwitchActive: false,
        storedEnabled: false,
        tenantActive: true
      },
      "Definitie ontbreekt"
    ],
    [
      {
        definitionAvailable: true,
        effectiveEnabled: false,
        killSwitchActive: true,
        storedEnabled: true,
        tenantActive: true
      },
      "Globaal geblokkeerd"
    ],
    [
      {
        definitionAvailable: true,
        effectiveEnabled: false,
        killSwitchActive: false,
        storedEnabled: true,
        tenantActive: false
      },
      "Tenant geblokkeerd"
    ],
    [
      {
        definitionAvailable: true,
        effectiveEnabled: true,
        killSwitchActive: false,
        storedEnabled: true,
        tenantActive: true
      },
      "Vrijgegeven"
    ]
  ] as const)("toont de effectieve rolloutstatus %s", (input, label) => {
    expect(deriveTenantFeatureRolloutDisplay(input).label).toBe(label);
  });

  it("geeft oorzaak, gevolg en herstelactie zonder intern detail", () => {
    expect(tenantFeatureRolloutErrorMessages["feature-audit"]).toContain(
      "er is niets gewijzigd"
    );
    expect(tenantFeatureRolloutErrorMessages["feature-conflict"]).toContain(
      "Vernieuw de pagina"
    );
    expect(tenantFeatureRolloutErrorMessages["feature-kill-switch"]).toContain(
      "globale kill switch"
    );
    expect(
      tenantFeatureRolloutErrorMessages["feature-uitkomst-onzeker"]
    ).toContain("controleer de actuele status");
  });
});
