import { describe, expect, it } from "vitest";

import {
  sportlinkSlideTeamContextsMax,
  type SportlinkSlideDraft
} from "@veyocast/contracts";
import { platformDefaultThemeSelection } from "@veyocast/content-templates/theme-catalog";

import {
  autoCompetitionContext,
  competitionContextFromOption,
  normalizeLegacyClubAggregateDraft,
  normalizeLegacyArrivalDraft,
  prepareSportlinkVersionEditorDraft,
  replaceArrivalTeamContext,
  replaceArrivalTeamSelection,
  replaceClubMatchLocation,
  replaceClubTeamContext,
  replaceClubTeamSelection,
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
      showLogo: true,
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
    expect(selected.teamContexts?.at(-1)?.providerTeamId).toBe("team-499");
  });

  it("normaliseert een legacy clubslide naar één toekomstbestendige alle-teamsfilter", () => {
    const legacy = regularDraft();
    const normalized = normalizeLegacyClubAggregateDraft(legacy);

    expect(normalized.teamSelection).toEqual({
      matchLocation: "both",
      mode: "all",
      teamContexts: []
    });
    expect(normalizeLegacyClubAggregateDraft(normalized)).toBe(normalized);
    expect(
      prepareSportlinkVersionEditorDraft(legacy, teams, "1.0.0").requiresSave
    ).toBe(true);
  });

  it("bewaart een expliciete clubselectie als filter op dezelfde slide en behoudt overrides", () => {
    const normalized = normalizeLegacyClubAggregateDraft(regularDraft());
    const selected = replaceClubTeamSelection(
      normalized,
      "selected",
      ["team-a", "team-b", "team-a"],
      teams
    );
    const pinned = competitionContextFromOption(
      "team-a",
      teams[0]!.contexts[0]!
    );
    const overridden = replaceClubTeamContext(selected, pinned);
    const reordered = replaceClubTeamSelection(
      overridden,
      "selected",
      ["team-b", "team-a"],
      teams
    );

    expect(reordered.teamSelection?.mode).toBe("selected");
    expect(reordered.teamSelection?.teamContexts.map((context) =>
      context.providerTeamId
    )).toEqual(["team-b", "team-a"]);
    expect(reordered.teamSelection?.teamContexts[1]).toEqual(pinned);
    expect(reordered.context.providerTeamId).toBe("team-b");
  });

  it("houdt bij alle teams alleen competitieafwijkingen vast en kan die terugzetten", () => {
    const normalized = normalizeLegacyClubAggregateDraft(regularDraft());
    const pinned = competitionContextFromOption(
      "team-a",
      teams[0]!.contexts[0]!
    );
    const withOverride = replaceClubTeamContext(normalized, pinned);
    const allTeams = replaceClubTeamSelection(
      withOverride,
      "all",
      ["team-a", "team-b"],
      teams
    );
    const reset = replaceClubTeamContext(
      allTeams,
      autoCompetitionContext("team-a")
    );

    expect(allTeams.teamSelection).toEqual({
      matchLocation: "both",
      mode: "all",
      teamContexts: [pinned]
    });
    expect(reset.teamSelection).toEqual({
      matchLocation: "both",
      mode: "all",
      teamContexts: []
    });
  });

  it("ondersteunt meer dan 25 geselecteerde teams binnen één clubslide", () => {
    const manyTeams = Array.from(
      { length: 40 },
      (_, index): SportlinkVersionEditorTeam => ({
        contexts: [],
        externalId: `club-team-${index}`,
        name: `Clubteam ${index}`
      })
    );
    const selected = replaceClubTeamSelection(
      normalizeLegacyClubAggregateDraft(regularDraft()),
      "selected",
      manyTeams.map((team) => team.externalId),
      manyTeams
    );

    expect(selected.teamSelection?.teamContexts).toHaveLength(40);
    expect(selected.teamSelection?.teamContexts.at(-1)?.providerTeamId)
      .toBe("club-team-39");
  });

  it("normaliseert een ontbrekende wedstrijdlocatie zonder de selectie te verbreden", () => {
    const selected = {
      ...regularDraft(),
      context: autoCompetitionContext("team-b"),
      teamSelection: {
        mode: "selected" as const,
        teamContexts: [autoCompetitionContext("team-b")]
      }
    };

    const normalized = normalizeLegacyClubAggregateDraft(selected);

    expect(normalized.teamSelection).toEqual({
      matchLocation: "both",
      mode: "selected",
      teamContexts: [autoCompetitionContext("team-b")]
    });
    expect(normalized.context).toEqual(autoCompetitionContext("team-b"));
    expect(
      prepareSportlinkVersionEditorDraft(selected, teams, "1.0.0")
        .requiresSave
    ).toBe(true);
  });

  it("behoudt de wedstrijdlocatie bij team-, context- en clubblueprintwijzigingen", () => {
    const normalized = normalizeLegacyClubAggregateDraft(regularDraft());
    const away = replaceClubMatchLocation(normalized, "away");
    const selected = replaceClubTeamSelection(
      away,
      "selected",
      ["team-a", "team-b"],
      teams
    );
    const pinned = replaceClubTeamContext(
      selected,
      competitionContextFromOption("team-a", teams[0]!.contexts[0]!)
    );
    const nextBlueprint = switchSportlinkBlueprint(
      pinned,
      "sportlink.club_results_previous_7_days",
      templateId
    );

    expect(selected.teamSelection?.matchLocation).toBe("away");
    expect(pinned.teamSelection?.matchLocation).toBe("away");
    expect(nextBlueprint.teamSelection?.matchLocation).toBe("away");
  });
});
