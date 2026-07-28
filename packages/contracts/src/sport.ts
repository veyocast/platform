import { z } from "zod";

const idSchema = z.string().trim().min(1).max(240);
const labelSchema = z.string().trim().min(1).max(200);
const optionalLabelSchema = z.string().trim().max(500).nullable();
const dateTimeSchema = z.string().datetime({ offset: true });
const safeUrlSchema = z.string().url().max(2_048).nullable();

export const sportPersonDisplaySchema = z.object({
  displayName: labelSchema,
  externalId: idSchema.nullable(),
  photoUrl: safeUrlSchema,
  role: optionalLabelSchema
});

export const sportSponsorSchema = z.object({
  externalId: idSchema,
  logoUrl: safeUrlSchema,
  name: labelSchema,
  websiteUrl: safeUrlSchema
});

export const sportClubSchema = z.object({
  city: optionalLabelSchema,
  clubCode: idSchema.nullable(),
  colors: z.object({
    primary: z.string().trim().max(32).nullable(),
    secondary: z.string().trim().max(32).nullable(),
    text: z.string().trim().max(32).nullable()
  }),
  externalId: idSchema,
  foundedOn: z.string().date().nullable(),
  information: z.string().trim().max(4_000).nullable(),
  logoUrl: safeUrlSchema,
  name: labelSchema,
  websiteUrl: safeUrlSchema
});

export const sportTeamSchema = z.object({
  category: optionalLabelSchema,
  competitionName: optionalLabelSchema,
  externalId: idSchema,
  gender: optionalLabelSchema,
  localExternalId: idSchema.nullable(),
  logoUrl: safeUrlSchema,
  name: labelSchema,
  photoUrl: safeUrlSchema,
  teamType: optionalLabelSchema
});

export const sportCompetitionSchema = z.object({
  externalId: idSchema,
  name: labelSchema,
  period: optionalLabelSchema,
  season: optionalLabelSchema,
  type: optionalLabelSchema
});

export const sportPoolSchema = z.object({
  competitionExternalId: idSchema.nullable(),
  externalId: idSchema,
  name: labelSchema
});

export const sportVenueSchema = z.object({
  city: optionalLabelSchema,
  field: optionalLabelSchema,
  name: optionalLabelSchema,
  routeUrl: safeUrlSchema
});

export const dressingRoomAssignmentSchema = z.object({
  away: optionalLabelSchema,
  home: optionalLabelSchema,
  official: optionalLabelSchema
});

export const sportOfficialSchema = z.object({
  displayName: labelSchema,
  externalId: idSchema.nullable(),
  role: optionalLabelSchema
});

export const sportMatchTeamSchema = z.object({
  externalId: idSchema.nullable(),
  logoUrl: safeUrlSchema,
  name: labelSchema,
  score: z.number().int().min(0).max(999).nullable()
});

export const sportMatchStatuses = [
  "scheduled",
  "cancelled",
  "postponed",
  "in_progress",
  "finished",
  "unknown"
] as const;

export const sportMatchSchema = z.object({
  awayTeam: sportMatchTeamSchema,
  cancellationReason: optionalLabelSchema,
  competition: sportCompetitionSchema.nullable(),
  dressingRooms: dressingRoomAssignmentSchema,
  externalId: idSchema,
  homeTeam: sportMatchTeamSchema,
  isHomeMatch: z.boolean(),
  officials: z.array(sportOfficialSchema).max(20),
  pool: sportPoolSchema.nullable(),
  startsAt: dateTimeSchema,
  status: z.enum(sportMatchStatuses),
  venue: sportVenueSchema
});

export const sportStandingRowSchema = z.object({
  drawn: z.number().int().min(0).nullable(),
  externalId: idSchema,
  goalsAgainst: z.number().int().min(0).nullable(),
  goalsFor: z.number().int().min(0).nullable(),
  lost: z.number().int().min(0).nullable(),
  played: z.number().int().min(0).nullable(),
  points: z.number().int().nullable(),
  position: z.number().int().min(1).nullable(),
  teamName: labelSchema,
  won: z.number().int().min(0).nullable()
});

export const sportStandingSchema = z.object({
  competition: sportCompetitionSchema.nullable(),
  externalId: idSchema,
  periodNumber: z.number().int().min(1).nullable(),
  pool: sportPoolSchema,
  rows: z.array(sportStandingRowSchema).max(100),
  scoresPublished: z.boolean()
});

export const sportActivitySchema = z.object({
  allDay: z.boolean(),
  calendarName: optionalLabelSchema,
  endsAt: dateTimeSchema.nullable(),
  externalId: idSchema,
  location: optionalLabelSchema,
  name: labelSchema,
  startsAt: dateTimeSchema,
  url: safeUrlSchema
});

export const sportTrainingSchema = z.object({
  dressingRoom: optionalLabelSchema,
  endsAt: dateTimeSchema.nullable(),
  externalId: idSchema,
  location: optionalLabelSchema,
  name: labelSchema,
  startsAt: dateTimeSchema,
  teamExternalId: idSchema.nullable(),
  trainers: z.array(sportPersonDisplaySchema).max(10)
});

export const sportVolunteerTaskSchema = z.object({
  assignees: z.array(sportPersonDisplaySchema).max(20),
  endsAt: dateTimeSchema.nullable(),
  externalId: idSchema,
  location: optionalLabelSchema,
  name: labelSchema,
  startsAt: dateTimeSchema
});

export const sportSnapshotSchema = z.object({
  activities: z.array(sportActivitySchema).max(100),
  club: sportClubSchema.nullable(),
  emptyStateCode: z.string().regex(/^[A-Z0-9_]{3,80}$/).nullable(),
  expiresAt: dateTimeSchema.nullable(),
  generatedAt: dateTimeSchema,
  matches: z.array(sportMatchSchema).max(100),
  people: z.array(sportPersonDisplaySchema).max(100),
  sponsors: z.array(sportSponsorSchema).max(100),
  stale: z.boolean(),
  standings: z.array(sportStandingSchema).max(20),
  teams: z.array(sportTeamSchema).max(100),
  trainings: z.array(sportTrainingSchema).max(100),
  volunteerTasks: z.array(sportVolunteerTaskSchema).max(100)
});

export type SportActivity = z.infer<typeof sportActivitySchema>;
export type SportClub = z.infer<typeof sportClubSchema>;
export type SportCompetition = z.infer<typeof sportCompetitionSchema>;
export type SportMatch = z.infer<typeof sportMatchSchema>;
export type SportPersonDisplay = z.infer<typeof sportPersonDisplaySchema>;
export type SportPool = z.infer<typeof sportPoolSchema>;
export type SportSnapshot = z.infer<typeof sportSnapshotSchema>;
export type SportSponsor = z.infer<typeof sportSponsorSchema>;
export type SportStanding = z.infer<typeof sportStandingSchema>;
export type SportStandingRow = z.infer<typeof sportStandingRowSchema>;
export type SportTeam = z.infer<typeof sportTeamSchema>;
export type SportTraining = z.infer<typeof sportTrainingSchema>;
export type SportVolunteerTask = z.infer<typeof sportVolunteerTaskSchema>;
