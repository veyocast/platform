import { describe, expect, it } from "vitest";

import {
  sportlinkSlideTeamContextsMax,
  type SportlinkSlideDraft
} from "@veyocast/contracts";
import { platformDefaultThemeSelection } from "@veyocast/content-templates/theme-catalog";

import {
  autoCompetitionContext,
  competitionContextFromOption,
  normalizeLegacyArrivalDraft,
  prepareSportlinkVersionEditorDraft,
  replaceArrivalTeamContext,
  replaceArrivalTeamSelection,
  switchSportlinkBlueprint,
  type SportlinkVersionEditorTeam
} from "./sportlink-version-editor-state";

const templateId = "00000000-0000-4000-8000-000000000001";
const teams: SportlinkVersionEditorTeam[] = [
  {
    contexts: [{
      competitionId: "competition-a",
      label: "Competitie A · Poule 1",
      phaseId: "fase-a",
      poolId: "poule-a",
      seasonId: "2026"
    }],
    externalId: "team-a",
    name: "Team A"
  },
  { contexts: [], externalId: "team-b", name: "Team B" }
];

function regularDraft(): SportlinkSlideDraft {
  return {
    blueprintKey: "sportlink.club_schedule_today",
    context: autoCompetitionContext("team-a"),
    display: {
      columns: "two",
      showDressingRoom: false,
      showField: true,
      showHomeAway: true,
      showReferee: false
    },
    name: "Team A · Programma vandaag",
    orientation: "landscape",
    templateVersionId: templateId,
    themeSelection: platformDefaultThemeSelection,
    title: "Clubprogramma vandaag"
  };
}

describe("Sportlink-versie-editorcontext", () => {
  it("maakt alleen het historisch opgeslagen team expliciet bij legacy-normalisatie", () => {
    const legacy = {
      ...regularDraft(),
      blueprintKey: "sportlink.visitor_arrivals" as const
    };

    const normalized = normalizeLegacyArrivalDraft(legacy);

    expect(normalized.teamContexts).toEqual([
      autoCompetitionContext("team-a")
    ]);
    expect(normalizeLegacyArrivalDraft(normalized)).toBe(normalized);
  });

  it("verplicht opslaan wanneer legacy selectie of thema in de editor wordt genormaliseerd", () => {
    const legacy = {
      ...regularDraft(),
      blueprintKey: "sportlink.visitor_arrivals" as const
    };
    const prepared = prepareSportlinkVersionEditorDraft(legacy, teams, "2.0.0");

    expect(prepared.requiresSave).toBe(true);
    expect(prepared.draft.teamContexts).toEqual([
      autoCompetitionContext("team-a")
    ]);
    expect(prepared.draft.themeSelection.ref).toEqual({
      catalog: "v2",
      id: "fieldflow",
      version: "2.0.0"
    });
    expect(
      prepareSportlinkVersionEditorDraft(prepared.draft, teams, "2.0.0")
        .requiresSave
    ).toBe(false);
  });

  it("maakt van een gewone teamslide één aggregate welkomstcomponent voor dat team", () => {
    const arrival = switchSportlinkBlueprint(
      regularDraft(),
      "sportlink.visitor_arrivals",
      templateId
    );

    expect(arrival.teamContexts).toEqual([
      autoCompetitionContext("team-a")
    ]);
    expect(arrival.context).toEqual(autoCompetitionContext("team-a"));
    expect(arrival.arrival).toBeDefined();
  });

  it("behoudt aggregate selectie tussen beide welkomsttypen", () => {
    const arrival = switchSportlinkBlueprint(
      regularDraft(),
      "sportlink.visitor_arrivals",
      templateId
    );
    const selected = replaceArrivalTeamSelection(arrival, ["team-b"], teams);
    const referees = switchSportlinkBlueprint(
      selected,
      "sportlink.referee_arrivals",
      templateId
    );

    expect(referees.teamContexts).toEqual([autoCompetitionContext("team-b")]);
  });

  it("maakt bij wisselen naar gewone content expliciet één teamcontext", () => {
    const arrival = switchSportlinkBlueprint(
      regularDraft(),
      "sportlink.visitor_arrivals",
      templateId
    );
    const regular = switchSportlinkBlueprint(
      arrival,
      "sportlink.pool_standings",
      templateId
    );

    expect(regular.context).toEqual(autoCompetitionContext("team-a"));
    expect(regular.teamContexts).toBeUndefined();
    expect(regular.arrival).toBeUndefined();
  });

  it("behoudt overrides en voorkomt een lege aggregate selectie", () => {
    const arrival = switchSportlinkBlueprint(
      regularDraft(),
      "sportlink.visitor_arrivals",
      templateId
    );
    const pinned = competitionContextFromOption("team-a", teams[0]!.contexts[0]!);
    const overridden = replaceArrivalTeamContext(arrival, pinned);
    const reordered = replaceArrivalTeamSelection(
      overridden,
      ["team-b", "team-a"],
      teams
    );

    expect(reordered.context.providerTeamId).toBe("team-b");
    expect(reordered.teamContexts?.[1]).toEqual(pinned);
    expect(replaceArrivalTeamSelection(reordered, [], teams)).toBe(reordered);
  });

  it("begrenst een aggregate selectie voordat een ongeldig concept ontstaat", () => {
    const manyTeams = Array.from(
      { length: sportlinkSlideTeamContextsMax + 1 },
      (_, index): SportlinkVersionEditorTeam => ({
        contexts: [],
        externalId: `team-${index}`,
        name: `Team ${index}`
      })
    );
    const arrival = switchSportlinkBlueprint(
      regularDraft(),
      "sportlink.visitor_arrivals",
      templateId
    );
    const selected = replaceArrivalTeamSelection(
      arrival,
      manyTeams.map((team) => team.externalId),
      manyTeams
    );

    expect(selected.teamContexts).toHaveLength(sportlinkSlideTeamContextsMax);
    expect(selected.teamContexts?.at(-1)?.providerTeamId).toBe("team-99");
  });
});
