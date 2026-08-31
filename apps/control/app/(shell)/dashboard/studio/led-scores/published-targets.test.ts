import { describe, expect, it } from "vitest";

import {
  activePublishedGroupIds,
  publishedGroupIds
} from "./published-targets";

const versionGroups = [
  { alert_version_id: "version-live", screen_group_id: "kantine" },
  { alert_version_id: "version-live", screen_group_id: "entree" },
  { alert_version_id: "version-old", screen_group_id: "bestuur" }
];

describe("LED Scores live-doelgroepen", () => {
  it("gebruikt uitsluitend groepen van de actuele immutable versie", () => {
    expect(publishedGroupIds("version-live", versionGroups)).toEqual([
      "kantine",
      "entree"
    ]);
  });

  it("telt alleen daadwerkelijk actieve gepubliceerde alerts", () => {
    expect(activePublishedGroupIds([
      { currentPublishedVersionId: "version-live", status: "published" },
      { currentPublishedVersionId: "version-old", status: "paused" },
      { currentPublishedVersionId: null, status: "draft" }
    ], versionGroups)).toEqual(["kantine", "entree"]);
  });
});
