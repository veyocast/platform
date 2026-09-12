import { describe, expect, it } from "vitest";
import { parseLedScoresClubCatalog } from "../src/ledscores-catalog";

const club = { id: 213, slug: "duindorp-sv", name: "Duindorp SV", email: "excluded@test.invalid", permissions: ["excluded"], teams: [
  { id: 29643, name: "Duindorp SV ZA1", sportlink_team_name: "Duindorp sv 1", type: "home", logo: "/media/213/teams/home/one.png", players: [{ name: "excluded" }] },
  { id: 29644, name: "Duindorp SV ZA2", type: "home", category: "Senioren" },
  { id: 29646, name: "Duindorp SV O19-1", type: "home", category: "Jeugd", active: false },
  { id: 30000, name: "VUC 2", type: "away" }
] };
describe("LED Scores club catalog", () => {
  it("discovers multiple own teams through explicit source type and club ID", () => {
    const parsed = parseLedScoresClubCatalog(JSON.stringify(club), "duindorp-sv");
    expect(parsed.clubId).toBe("213");
    expect(parsed.teams.filter((t) => t.side === "own")).toHaveLength(3);
    expect(parsed.teams[0]).toMatchObject({ teamKey: "29643", teamName: "Duindorp sv 1", active: true, logoSourceUrl: "https://api.ledscores.score.tel/media/213/teams/home/one.png" });
    expect(parsed.teams[2]).toMatchObject({ active: false, category: "Jeugd" });
    expect(parsed.teams[3]?.side).toBe("opponent");
    expect(JSON.stringify(parsed)).not.toContain("excluded");
  });
  it("automatically includes a newly available team without a hardcoded list", () => {
    const expanded = { ...club, teams: [...club.teams, { id: 55555, name: "Nieuw team", type: "home" }] };
    expect(parseLedScoresClubCatalog(JSON.stringify(expanded), "duindorp-sv").teams.at(-1)?.teamKey).toBe("55555");
  });
  it("checks club identity and rejects duplicate team identities", () => {
    expect(() => parseLedScoresClubCatalog(JSON.stringify(club), "andere-club")).toThrow("club_mismatch");
    expect(() => parseLedScoresClubCatalog(JSON.stringify({ ...club, teams: [club.teams[0], club.teams[0]] }), "duindorp-sv")).toThrow("duplicate_team");
  });
  it("ignores an unsupported logo host without losing the team", () => {
    const parsed = parseLedScoresClubCatalog(JSON.stringify({ ...club, teams: [{ ...club.teams[0], logo: "https://untrusted.invalid/logo.png" }] }), "duindorp-sv");
    expect(parsed.teams[0]?.logoSourceUrl).toBeNull();
  });
});
