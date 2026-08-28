import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import {
  guessBirthdayImportMapping,
  mapSportlinkBirthdays,
  mapSportlinkTeamMembers,
  matchSportlinkBirthdays,
  normalizeBirthdayImportRows,
  normalizeSportlinkPersonName,
  parseBirthdayImportFile,
  parseSportlinkBirthdayDate
} from "../src/sportlink-birthdays";

const now = new Date("2026-05-10T10:00:00.000Z");

describe("Sportlink birthday contract", () => {
  it("parses supported Sportlink date forms and Dutch month names", () => {
    expect(parseSportlinkBirthdayDate("15 mei", { now })?.nextOccurrence)
      .toBe("2026-05-15");
    expect(parseSportlinkBirthdayDate("15-05", { now })?.month).toBe(5);
    expect(parseSportlinkBirthdayDate("2026-05-15T00:00:00", { now })?.day).toBe(15);
    expect(parseSportlinkBirthdayDate("20260515", { now })?.day).toBe(15);
    expect(parseSportlinkBirthdayDate("31 februari", { now })).toBeNull();
  });

  it("handles December/January rollover in the tenant date", () => {
    const parsed = parseSportlinkBirthdayDate("2 januari", {
      now: new Date("2026-12-29T22:30:00.000Z"),
      timezone: "Europe/Amsterdam"
    });
    expect(parsed?.nextOccurrence).toBe("2027-01-02");
  });

  it("accepts an array or changed wrapper and ignores unknown fields", () => {
    const direct = mapSportlinkBirthdays([{
      onbekend: "veilig genegeerd", verjaardag: "15 mei", volledigenaam: "Sophie de Vries"
    }], { now });
    const wrapped = mapSportlinkBirthdays({ records: [{
      verjaardag: "15 mei", volledigenaam: "Sophie de Vries"
    }] }, { now });
    expect(direct).toHaveLength(1);
    expect(wrapped).toEqual(direct);
  });

  it("isolates missing names, invalid dates and privacy-filtered absences", () => {
    expect(mapSportlinkBirthdays([
      { verjaardag: "15 mei" },
      { verjaardag: "35 mei", volledigenaam: "Ongeldig" }
    ], { now })).toEqual([]);
    expect(mapSportlinkBirthdays([], { now })).toEqual([]);
  });

  it("bounds the provider horizon through day 21", () => {
    const rows = [1, 7, 14, 21, 22].map((offset) => ({
      verjaardag: new Date(Date.UTC(2026, 4, 10 + offset)).toISOString().slice(0, 10),
      volledigenaam: `Persoon ${offset}`
    }));
    expect(mapSportlinkBirthdays(rows, { maxDays: 21, now }).map((entry) => entry.displayName))
      .toEqual(["Persoon 1", "Persoon 7", "Persoon 14", "Persoon 21"]);
  });
});

describe("Sportlink birthday identity matching", () => {
  it("normalizes case, whitespace, apostrophes and Unicode without removing accents", () => {
    expect(normalizeSportlinkPersonName("  JOSÉ   D’Ávila "))
      .toBe("josé d'ávila");
    expect(normalizeSportlinkPersonName("Jose D'Avila"))
      .not.toBe(normalizeSportlinkPersonName("José D'Ávila"));
  });

  it("matches one exact identity and combines teams only for one member code", () => {
    const [birthday] = mapSportlinkBirthdays([{
      verjaardag: "15 mei", volledigenaam: "Sophie de Vries"
    }], { now });
    const members = [
      ...mapSportlinkTeamMembers([{
        lidcode: "L-1", teampersoonrol: "Speler", volledigenaam: "  SOPHIE de Vries "
      }], { externalId: "jo17", name: "JO17-1" }),
      ...mapSportlinkTeamMembers([{
        lidcode: "L-1", teampersoonrol: "Speler", volledigenaam: "Sophie de Vries"
      }], { externalId: "mo17", name: "MO17-1" })
    ];
    expect(matchSportlinkBirthdays([birthday!], members)[0]).toMatchObject({
      status: "matched",
      teamAssignments: [{ externalId: "jo17" }, { externalId: "mo17" }]
    });
  });

  it("marks duplicate names, missing codes across teams and different identities ambiguous", () => {
    const [birthday] = mapSportlinkBirthdays([{
      verjaardag: "15 mei", volledigenaam: "Sam Jansen"
    }], { now });
    const noCodes = [
      ...mapSportlinkTeamMembers([{ volledigenaam: "Sam Jansen" }], { externalId: "a", name: "A" }),
      ...mapSportlinkTeamMembers([{ volledigenaam: "Sam Jansen" }], { externalId: "b", name: "B" })
    ];
    const twoPeople = [
      ...mapSportlinkTeamMembers([{ lidcode: "1", volledigenaam: "Sam Jansen" }], { externalId: "a", name: "A" }),
      ...mapSportlinkTeamMembers([{ lidcode: "2", volledigenaam: "Sam Jansen" }], { externalId: "b", name: "B" })
    ];
    expect(matchSportlinkBirthdays([birthday!], noCodes)[0]?.status).toBe("ambiguous");
    expect(matchSportlinkBirthdays([birthday!], twoPeople)[0]?.status).toBe("ambiguous");
  });

  it("does not fuzzy-match similar names", () => {
    const [birthday] = mapSportlinkBirthdays([{
      verjaardag: "15 mei", volledigenaam: "Sofie de Vries"
    }], { now });
    const members = mapSportlinkTeamMembers([{
      lidcode: "1", volledigenaam: "Sophie de Vries"
    }], { externalId: "a", name: "A" });
    expect(matchSportlinkBirthdays([birthday!], members)[0]?.status).toBe("unmatched");
  });
});

describe("birthday age import", () => {
  it("reads CSV, guesses Sportlink export columns and validates age provenance", async () => {
    const parsed = await parseBirthdayImportFile("leden.csv", new TextEncoder().encode(
      "Volledige naam;Relatiecode;Geboortedatum;Team;Functie\n" +
      "Sophie de Vries;L-1;2012-05-15;JO17-1;Speler\n"
    ));
    const mapping = guessBirthdayImportMapping(parsed.headers);
    const [row] = normalizeBirthdayImportRows(parsed.rows, mapping, now);
    expect(row).toMatchObject({
      normalized: { birthDay: 15, birthMonth: 5, birthYear: 2012, externalMemberCode: "L-1" },
      status: "valid"
    });
  });

  it("rejects fictitious 1900, invalid values, formulas and duplicate identities", () => {
    const rows = normalizeBirthdayImportRows([
      { Jaar: 1900, Naam: "Onbekend" },
      { Jaar: 2010, Naam: "=HYPERLINK()" },
      { Jaar: 2010, Naam: "Sophie de Vries" },
      { Jaar: 2011, Naam: "Sophie de Vries" }
    ], { Jaar: "birth_year", Naam: "full_name" }, now);
    expect(rows.map((row) => row.status)).toEqual([
      "invalid", "invalid", "valid", "duplicate"
    ]);
  });

  it("rejects spreadsheet formulas in optional team and role fields", () => {
    const rows = normalizeBirthdayImportRows([
      { Jaar: 2010, Naam: "Veilige naam", Team: "=WEBSERVICE(A1)", Rol: "Speler" },
      { Jaar: 2010, Naam: "Andere naam", Team: "JO17-1", Rol: "-cmd" }
    ], { Jaar: "birth_year", Naam: "full_name", Rol: "role", Team: "team" }, now);
    expect(rows.map((row) => row.status)).toEqual(["invalid", "invalid"]);
  });

  it("reads a bounded XLSX export without retaining the source file", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Leden");
    sheet.addRow(["Volledige naam", "Geboortejaar", "Relatiecode"]);
    sheet.addRow(["Milan van Dijk", 2011, "L-2"]);
    const buffer = await workbook.xlsx.writeBuffer();
    const parsed = await parseBirthdayImportFile("leden.xlsx", new Uint8Array(buffer));
    const rows = normalizeBirthdayImportRows(parsed.rows, guessBirthdayImportMapping(parsed.headers), now);
    expect(rows[0]).toMatchObject({
      normalized: { birthYear: 2011, externalMemberCode: "L-2" }, status: "valid"
    });
    expect(parsed).not.toHaveProperty("rawFile");
  });
});
