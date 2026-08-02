import { z } from "zod";

export const sportlinkSyncGroups = [
  "club_profile", "teams", "competitions", "matches", "match_details",
  "activities", "public_people", "volunteers"
] as const;
export type SportlinkSyncGroup = typeof sportlinkSyncGroups[number];

const code = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);
const integer = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).optional();
const text = z.string().trim().min(1).max(80).optional();
const yesNo = z.enum(["JA", "NEE", "ja", "nee"]).optional();
const none = z.object({}).strict();
const team = z.object({
  teamcode: code.optional(),
  lokaleteamcode: code.optional()
}).strict().refine(
  (value) =>
    value.teamcode !== undefined || value.lokaleteamcode !== undefined
);
const teamPool = z.object({ teamcode: code, lokaleteamcode: code }).strict();
const match = z.object({ wedstrijdcode: code }).strict();
const schedule = z.object({
  wedstrijdtype: text, teamcode: code.optional(), lokaleteamcode: code.optional(),
  aantalregels: integer(1, 500), aantaldagen: integer(0, 365),
  weekoffset: integer(-52, 52), gebruiklokaleteamgegevens: yesNo,
  sorteervolgorde: text, eigenwedstrijden: yesNo, thuis: yesNo, uit: yesNo,
  spelsoort: text, leeftijdscategorie: text, competitiesoort: text, dagsoort: text
}).strict();

export type SportlinkSensitivity = "public" | "public_people_minimized";
type Definition = {
  argumentsSchema: z.ZodType<Record<string, unknown>>;
  capability: string;
  mapper: string;
  syncGroup: SportlinkSyncGroup;
  sensitivity: SportlinkSensitivity;
  enabledByDefault: boolean;
};
const def = (
  capability: string, syncGroup: SportlinkSyncGroup, mapper: string,
  argumentsSchema: z.ZodType<Record<string, unknown>> = none,
  sensitivity: SportlinkSensitivity = "public"
): Definition => ({
  argumentsSchema, capability, mapper, syncGroup, sensitivity,
  enabledByDefault: sensitivity === "public"
});
const people = (
  capability: string, group: SportlinkSyncGroup,
  schema: z.ZodType<Record<string, unknown>> = none
) => def(capability, group, "mapPublicPeople", schema, "public_people_minimized");

export const sportlinkArticleRegistry = {
  clubgegevens: def("club", "club_profile", "mapClub"),
  clublogo: def("club_logo", "club_profile", "mapClubLogo"),
  "kleuren-clubdata": def("club_colors", "club_profile", "mapClubColors"),
  "kleuren-clubtv": def("club_tv_colors", "club_profile", "mapClubColors"),
  teams: def("teams", "teams", "mapTeams", z.object({
    competitieperiode: text, teamsoort: text, geslacht: text, spelsoort: text,
    competitiesoort: text, leeftijdscategorie: text,
    gebruiklokaleteamgegevens: yesNo
  }).strict()),
  "team-gegevens": def("team_details", "teams", "mapTeams", team),
  teampoulelijst: def("team_pools", "competitions", "mapPools", teamPool),
  poulelijst: def("pools", "competitions", "mapPools"),
  "poule-indeling": def("pool_members", "competitions", "mapPoolMembers",
    z.object({ poulecode: code }).strict()),
  "poule-programma": def("pool_program", "matches", "mapMatches",
    z.object({ poulecode: code, aantaldagen: integer(0, 250),
      weekoffset: integer(-52, 52), eigenwedstrijden: yesNo,
      gebruiklokaleteamgegevens: yesNo }).strict()),
  pouleuitslagen: def("pool_results", "matches", "mapMatches",
    z.object({ poulecode: code, aantaldagen: integer(0, 250),
      weekoffset: integer(-52, 52), eigenwedstrijden: yesNo,
      sorteervolgorde: text, gebruiklokaleteamgegevens: yesNo }).strict()),
  poulestand: def("standings", "competitions", "mapStandings",
    z.object({ poulecode: code, gebruiklokaleteamgegevens: yesNo }).strict()),
  periodestand: def("period_standings", "competitions", "mapStandings",
    z.object({ poulecode: code, periodenummer: integer(-1, 99) }).strict()),
  programma: def("program", "matches", "mapMatches", schedule),
  uitslagen: def("results", "matches", "mapMatches", schedule),
  afgelastingen: def("cancellations", "matches", "mapMatches",
    z.object({ aantaldagen: integer(0, 42), aantalregels: integer(1, 500),
      weekoffset: integer(-52, 52), gebruiklokaleteamgegevens: yesNo,
      sorteervolgorde: text }).strict()),
  "wedstrijd-informatie": def("match_information", "match_details", "mapMatchDetails", match),
  "wedstrijd-accommodatie": def("match_venue", "match_details", "mapMatchVenue", match),
  "wedstrijd-kleedkamers": def("match_dressing_rooms", "match_details", "mapDressingRooms", match),
  "wedstrijd-officials": people("match_officials", "match_details", match),
  "wedstrijd-historische-resultaten": def("match_history", "match_details", "mapMatchHistory", match),
  "wedstrijd-statistieken": def("match_statistics", "match_details", "mapMatchStatistics", match),
  scheidsrechtersaanstellingen: people("official_assignments", "match_details",
    z.object({ aantalregels: integer(1, 500), aantaldagen: integer(0, 42),
      weekoffset: integer(-52, 52), sorteervolgorde: text }).strict()),
  "team-sponsors": def("team_sponsors", "teams", "mapSponsors", team),
  verenigingsactiviteiten: def("activities", "activities", "mapActivities",
    z.object({ aantaldagen: integer(1, 365), kalendersoort: text }).strict()),
  "team-indeling": people("team_members", "teams",
    z.object({ teamcode: code.optional(), lokaleteamcode: code.optional(),
      teampersoonrol: text, toonlidfoto: yesNo }).strict()),
  "wedstrijd-deelnemers": people("match_participants", "match_details", match),
  "wedstrijd-thuisteam": people("match_home_team", "match_details",
    z.object({ wedstrijdcode: code, toonlidfoto: yesNo }).strict()),
  "wedstrijd-uitteam": people("match_away_team", "match_details",
    z.object({ wedstrijdcode: code, toonlidfoto: yesNo }).strict()),
  trainingenlijst: def("training_list", "activities", "mapTrainings"),
  trainingdetails: def("training_details", "activities", "mapTrainings",
    z.object({ trainingid: code, aantaldagen: integer(1, 30) }).strict()),
  "team-trainingenlijst": def("team_training_list", "activities", "mapTrainings", team),
  bestuur: people("board", "public_people"),
  commissies: people("committees", "public_people"),
  "commissie-details": people("committee_details", "public_people",
    z.object({ commissiecode: code }).strict()),
  "commissie-leden": people("committee_members", "public_people",
    z.object({ commissiecode: code, toonlidfoto: yesNo }).strict()),
  verjaardagen: people("birthdays", "public_people",
    z.object({ aantaldagen: integer(1, 21) }).strict()),
  vrijwilligerstaken: def("volunteer_tasks", "volunteers", "mapVolunteerTasks"),
  vrijwilligers: people("volunteers", "volunteers",
    z.object({ vrijwilligerstaakcode: code, weekoffset: integer(-52, 52),
      aantaldagen: integer(1, 365) }).strict())
} as const satisfies Record<string, Definition>;

export type SportlinkArticleKey = keyof typeof sportlinkArticleRegistry;
export const excludedSportlinkArticles = [
  "adresboek", "mijn-commissies", "mijn-diplomas", "mijn-facturen",
  "mijn-factuurdetails", "mijn-factuurdetailsregels", "mijn-financielegegevens",
  "mijn-gegevens", "mijn-machtigingen", "mijn-teams"
] as const;
export function isSportlinkArticleKey(value: string): value is SportlinkArticleKey {
  return Object.hasOwn(sportlinkArticleRegistry, value);
}
export function parseSportlinkArguments(key: SportlinkArticleKey, value: unknown) {
  return sportlinkArticleRegistry[key].argumentsSchema.parse(value);
}
