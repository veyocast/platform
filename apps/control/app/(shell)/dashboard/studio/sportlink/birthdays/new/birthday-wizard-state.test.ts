import { describe, expect, it } from "vitest";

import {
  allBirthdayTeams,
  birthdayReadinessIssues,
  birthdayTeamSelectionLabel,
  resolveBirthdayTeamSelection,
  toggleBirthdaysWithoutTeam,
  toggleBirthdayTeam
} from "./birthday-wizard-state";

describe("birthday team selection", () => {
  const teams = [
    { external_id: "team-1", name: "JO15-1" },
    { external_id: "team-2", name: "JO17-1" }
  ];

  it("treats the legacy empty selection as all teams and unassigned people", () => {
    const selection = resolveBirthdayTeamSelection({
      includeWithoutTeam: undefined,
      selectedTeamIds: [],
      teamSelectionMode: undefined
    });
    expect(selection).toEqual(allBirthdayTeams());
    expect(birthdayTeamSelectionLabel(selection, teams)).toBe("Alle teams en overige");
  });

  it("keeps a legacy non-empty selection restricted to those teams", () => {
    expect(resolveBirthdayTeamSelection({
      includeWithoutTeam: undefined,
      selectedTeamIds: ["team-1"],
      teamSelectionMode: undefined
    })).toEqual({ includeWithoutTeam: false, mode: "selected", teamIds: ["team-1"] });
  });

  it("supports only unassigned people and combines them with selected teams", () => {
    const withoutTeam = toggleBirthdaysWithoutTeam(allBirthdayTeams());
    expect(withoutTeam).toEqual({ includeWithoutTeam: true, mode: "selected", teamIds: [] });
    const combined = toggleBirthdayTeam(withoutTeam, "team-2");
    expect(combined).toEqual({ includeWithoutTeam: true, mode: "selected", teamIds: ["team-2"] });
    expect(birthdayTeamSelectionLabel(combined, teams)).toBe("2 selecties");
  });
});

describe("birthday wizard readiness", () => {
  const ready = {
    active: true,
    connectionAvailable: true,
    connectionLoaded: true,
    featureEnabled: true,
    hasSuccessfulSync: true,
    orientationAvailable: true,
    statusLoaded: true,
    templatesLoaded: true
  };

  it("does not block a valid living slide merely because it currently has zero pages", () => {
    expect(birthdayReadinessIssues(ready)).toEqual([]);
  });

  it("reports module and orientation problems separately", () => {
    expect(birthdayReadinessIssues({
      ...ready,
      active: false,
      orientationAvailable: false
    })).toEqual(["module_inactive", "orientation_unavailable"]);
  });

  it("fails closed when status or template availability could not be loaded", () => {
    expect(birthdayReadinessIssues({ ...ready, statusLoaded: false })).toEqual([
      "status_unavailable"
    ]);
    expect(birthdayReadinessIssues({ ...ready, templatesLoaded: false })).toEqual([
      "templates_unavailable"
    ]);
  });

  it("blokkeert niet op een losse previewfout", () => {
    expect(birthdayReadinessIssues(ready)).toEqual([]);
  });

  it("onderscheidt een laadfout van een ontbrekende koppeling", () => {
    expect(birthdayReadinessIssues({
      ...ready,
      connectionAvailable: false,
      connectionLoaded: false
    })).toEqual(["connection_unavailable"]);
  });
});
