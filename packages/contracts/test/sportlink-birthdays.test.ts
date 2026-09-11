import { describe, expect, it } from "vitest";

import { sportlinkBirthdayConfigurationSchema } from "../src";

describe("Sportlink birthday selection contract", () => {
  it("starts with every team and people without a team", () => {
    const parsed = sportlinkBirthdayConfigurationSchema.parse({});
    expect(parsed.selection).toMatchObject({
      includeWithoutTeam: true,
      selectedTeamIds: [],
      teamSelectionMode: "all"
    });
    expect(parsed.presentation).toMatchObject({
      maxPerLandscapePage: 6,
      maxPerPortraitPage: 6
    });
    expect(parsed.selection.showTeamRole).toBe(true);
  });

  it("normalizes legacy card counts to the premium 1/2/4/6 contract", () => {
    const parsed = sportlinkBirthdayConfigurationSchema.parse({
      presentation: { maxPerLandscapePage: 3, maxPerPortraitPage: 8 }
    });
    expect(parsed.presentation).toMatchObject({
      maxPerLandscapePage: 4,
      maxPerPortraitPage: 6
    });
  });

  it("keeps legacy team selections distinguishable after parsing", () => {
    const parsed = sportlinkBirthdayConfigurationSchema.parse({
      selection: {
        emphasizeToday: true,
        includeUnknownRoles: true,
        nameMode: "full",
        roleFilter: "all",
        selectedRoles: [],
        selectedTeamIds: ["legacy-team"],
        showAge: true,
        showDate: true,
        showDayOfWeek: true,
        showPhoto: true,
        showRole: true,
        showTeam: true
      }
    });

    expect(parsed.selection.teamSelectionMode).toBeUndefined();
    expect(parsed.selection.includeWithoutTeam).toBeUndefined();
    expect(parsed.selection.selectedTeamIds).toEqual(["legacy-team"]);
  });

  it("accepts a selection that only includes people without a team", () => {
    const parsed = sportlinkBirthdayConfigurationSchema.parse({
      selection: {
        includeWithoutTeam: true,
        selectedTeamIds: [],
        teamSelectionMode: "selected"
      }
    });

    expect(parsed.selection).toMatchObject({
      includeWithoutTeam: true,
      selectedTeamIds: [],
      teamSelectionMode: "selected"
    });
  });
});
