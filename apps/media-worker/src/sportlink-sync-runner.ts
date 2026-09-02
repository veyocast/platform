import type {
  SportActivity,
  SportClub,
  SportMatch,
  SportStanding,
  SportTeam
} from "@veyocast/contracts";
import {
  SportlinkClient,
  SportlinkClientError,
  decryptSportlinkClientId,
  extractSportlinkRecords,
  fetchSafeRssImage,
  mapSportlinkBirthdays,
  mapSportlinkActivities,
  mapSportlinkClub,
  mapSportlinkMatches,
  mapSportlinkStandings,
  mapSportlinkTeams,
  mapSportlinkTeamMembers,
  matchSportlinkBirthdays,
  stableSportlinkExternalId
} from "@veyocast/integrations/server";
import { createClient } from "@supabase/supabase-js";

import {
  prepareSportlinkClubLogo,
  prepareSportlinkPersonPhoto,
  prepareSportlinkTeamLogo,
  type SportlinkMediaArtifact,
  type SportlinkPersonPhotoArtifact,
  type SportlinkTeamLogoArtifact
} from "./sportlink-media";

export type ClaimedSportlinkSync = {
  connectionId: string;
  dataSourceId: string;
  datasetGroup: string;
  encryptedClientId: string;
  encryptionIv: string;
  encryptionTag: string;
  runId: string;
  tenantId: string;
  timezone: string;
};

export type SportlinkSyncRunResult =
  | { status: "idle" }
  | {
      datasetGroup: string;
      errorCode?: string;
      readCount?: number;
      runId: string;
      status: "completed" | "failed";
    };

type RpcClient = {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>
  ): Promise<{ data: unknown; error: { code?: string } | null }>;
  storage?: {
    from(bucket: string): {
      upload(
        path: string,
        bytes: Uint8Array,
        options: Record<string, unknown>
      ): Promise<{ error: { message?: string } | null }>;
    };
  };
};

type NormalizedSportlinkBatch = {
  activities: SportActivity[];
  birthdayFetchedAt: string | null;
  birthdays: Array<Record<string, unknown>>;
  club: SportClub | null;
  clubLogo: SportlinkMediaArtifact | null;
  matches: SportMatch[];
  personPhotos: SportlinkPersonPhotoArtifact[];
  standings: SportStanding[];
  teamMembers: Array<Record<string, unknown>>;
  teamLogos: SportlinkTeamLogoArtifact[];
  teams: SportTeam[];
};

type SportlinkSyncBackend = {
  claim(
    workerId: string,
    lockTimeoutSeconds: number
  ): Promise<ClaimedSportlinkSync | null>;
  complete(
    job: ClaimedSportlinkSync,
    workerId: string,
    batch: NormalizedSportlinkBatch
  ): Promise<number>;
  fail(
    job: ClaimedSportlinkSync,
    workerId: string,
    code: string,
    message: string
  ): Promise<void>;
  renew(job: ClaimedSportlinkSync, workerId: string): Promise<boolean>;
};

const emptyBatch = (): NormalizedSportlinkBatch => ({
  activities: [],
  birthdayFetchedAt: null,
  birthdays: [],
  club: null,
  clubLogo: null,
  matches: [],
  personPhotos: [],
  standings: [],
  teamMembers: [],
  teamLogos: [],
  teams: []
});

export class SupabaseSportlinkSyncBackend {
  private readonly client: RpcClient;

  constructor(
    supabaseUrl: string,
    serviceRoleKey: string,
    client?: RpcClient
  ) {
    this.client = client ?? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    }) as unknown as RpcClient;
  }

  async claim(workerId: string, lockTimeoutSeconds: number) {
    const result = await this.client.rpc("claim_due_sportlink_sync_v2", {
      p_lock_timeout_seconds: lockTimeoutSeconds,
      p_worker_id: workerId
    });
    if (result.error) throw new Error("sportlink_sync_claim_failed");
    if (!Array.isArray(result.data) || !result.data.length) return null;
    return parseClaim(result.data[0]);
  }

  async complete(
    job: ClaimedSportlinkSync,
    workerId: string,
    batch: NormalizedSportlinkBatch
  ) {
    const media = [batch.clubLogo, ...batch.teamLogos, ...batch.personPhotos]
      .filter(
        (artifact): artifact is SportlinkMediaArtifact => Boolean(artifact)
      );
    if (media.length) {
      if (!this.client.storage) {
        throw new Error("sportlink_media_storage_unavailable");
      }
      for (const artifact of media) {
        const upload = await this.client.storage
          .from("provider-assets")
          .upload(artifact.storagePath, artifact.bytes, {
            cacheControl: "31536000",
            contentType: artifact.mimeType,
            upsert: true
          });
        if (upload.error) throw new Error("sportlink_media_upload_failed");
      }
    }
    const result = job.datasetGroup === "public_people"
      ? await this.client.rpc("complete_sportlink_birthdays_v1", {
        p_birthdays: batch.birthdays,
        p_fetched_at: batch.birthdayFetchedAt,
        p_person_photos: batch.personPhotos.map(toMediaPayload),
        p_run_id: job.runId,
        p_team_members: batch.teamMembers,
        p_worker_id: workerId
      })
      : await this.client.rpc("complete_sportlink_sync_v4", {
      p_activities: batch.activities,
      p_club: batch.club ?? {},
      p_club_logo: batch.clubLogo ? toMediaPayload(batch.clubLogo) : {},
      p_matches: batch.matches,
      p_run_id: job.runId,
      p_standings: batch.standings,
      p_team_logos: batch.teamLogos.map(toMediaPayload),
      p_teams: batch.teams,
      p_worker_id: workerId
    });
    if (result.error || !isRecord(result.data)) {
      throw new Error("sportlink_sync_complete_failed");
    }
    const readCount = Number(result.data.readCount ?? 0);
    if (!Number.isSafeInteger(readCount) || readCount < 0) {
      throw new Error("sportlink_sync_complete_invalid");
    }
    // Re-evaluate clock-based arrival windows after every successful provider
    // observation. The database content hash prevents duplicate snapshots.
    await this.client.rpc("refresh_sportlink_time_sensitive_slides_v1", {
      p_connection_id: job.connectionId
    });
    return readCount;
  }

  async fail(
    job: ClaimedSportlinkSync,
    workerId: string,
    code: string,
    message: string
  ) {
    const result = await this.client.rpc("fail_sportlink_sync_v1", {
      p_error_code: code.slice(0, 80),
      p_error_detail: message.replace(/[\r\n]+/g, " ").slice(0, 500),
      p_run_id: job.runId,
      p_worker_id: workerId
    });
    if (result.error) throw new Error("sportlink_sync_failure_report_failed");
  }

  async renew(job: ClaimedSportlinkSync, workerId: string) {
    const result = await this.client.rpc("renew_sportlink_sync_lease_v1", {
      p_run_id: job.runId,
      p_worker_id: workerId
    });
    if (result.error) throw new Error("sportlink_sync_lease_renew_failed");
    return result.data === true;
  }
}

export async function runSportlinkSyncOnce({
  backend,
  encryptionKey,
  executeDataset = executeSportlinkDataset,
  lockTimeoutSeconds,
  workerId
}: {
  backend: SportlinkSyncBackend;
  encryptionKey: string | null;
  executeDataset?: (
    job: ClaimedSportlinkSync,
    encryptionKey: string
  ) => Promise<NormalizedSportlinkBatch>;
  lockTimeoutSeconds: number;
  workerId: string;
}): Promise<SportlinkSyncRunResult> {
  const job = await backend.claim(workerId, lockTimeoutSeconds);
  if (!job) return { status: "idle" };

  let lease: ReturnType<typeof startLeaseHeartbeat> | null = null;
  try {
    if (!encryptionKey) {
      throw new SportlinkWorkerError(
        "SPORTLINK_CONFIGURATION_UNAVAILABLE",
        "De serverconfiguratie voor Sportlink-synchronisatie ontbreekt."
      );
    }
    lease = startLeaseHeartbeat({
      backend,
      intervalMs: leaseRenewIntervalMs(lockTimeoutSeconds),
      job,
      lockTimeoutSeconds,
      workerId
    });
    const batch = await executeDataset(job, encryptionKey);
    lease.assertOwned();
    const readCount = await backend.complete(job, workerId, batch);
    return {
      datasetGroup: job.datasetGroup,
      readCount,
      runId: job.runId,
      status: "completed"
    };
  } catch (error) {
    const failure = classifySportlinkSyncFailure(error);
    try {
      await backend.fail(job, workerId, failure.code, failure.message);
    } catch {
      // A run may already have been reclaimed after an actual worker outage.
      // Reporting that stale failure must not terminate the dispatcher loop.
    }
    return {
      datasetGroup: job.datasetGroup,
      errorCode: failure.code,
      runId: job.runId,
      status: "failed"
    };
  } finally {
    await lease?.stop();
  }
}

export async function runSportlinkSyncLoop({
  backend,
  encryptionKey,
  intervalMs,
  lockTimeoutSeconds,
  onResult = () => undefined,
  signal,
  workerId
}: {
  backend: SportlinkSyncBackend;
  encryptionKey: string | null;
  intervalMs: number;
  lockTimeoutSeconds: number;
  onResult?: (result: SportlinkSyncRunResult) => void;
  signal: AbortSignal;
  workerId: string;
}) {
  while (!signal.aborted) {
    const result = await runSportlinkSyncOnce({
      backend,
      encryptionKey,
      lockTimeoutSeconds,
      workerId
    });
    onResult(result);
    if (result.status === "idle") await abortableDelay(intervalMs, signal);
  }
}

async function executeSportlinkDataset(
  job: ClaimedSportlinkSync,
  encryptionKey: string
) {
  const clientId = decryptSportlinkClientId({
    ciphertext: job.encryptedClientId,
    iv: job.encryptionIv,
    tag: job.encryptionTag
  }, encryptionKey);
  return fetchSportlinkDataset(
    job.datasetGroup,
    new SportlinkClient(clientId),
    job
  );
}

export async function fetchSportlinkDataset(
  datasetGroup: string,
  client: SportlinkClient,
  job: ClaimedSportlinkSync
): Promise<NormalizedSportlinkBatch> {
  const batch = emptyBatch();

  if (datasetGroup === "club_profile") {
    const [clubResponse, logo] = await Promise.all([
      client.fetchArticle("clubgegevens"),
      client.fetchClubLogo()
    ]);
    batch.club = mapSportlinkClub(clubResponse.payload);
    if (!batch.club) {
      throw new SportlinkWorkerError(
        "SPORTLINK_CLUB_INVALID",
        "Sportlink gaf geen bruikbare clubidentiteit terug."
      );
    }
    batch.clubLogo = await prepareSportlinkClubLogo(
      job,
      batch.club.externalId,
      batch.club.name,
      logo.bytes
    );
    return batch;
  }

  if (datasetGroup === "teams") {
    const teams = await client.fetchArticle("teams");
    batch.teams = mapSportlinkTeams(teams.payload);
    return batch;
  }

  if (datasetGroup === "matches") {
    const [program, results, cancellations, teams, pools] = await Promise.all([
      client.fetchArticle("programma", { aantaldagen: 42, aantalregels: 100 }),
      client.fetchArticle("uitslagen", { aantaldagen: 14, aantalregels: 100 }),
      client.fetchArticle("afgelastingen", { aantaldagen: 42, aantalregels: 100 }),
      client.fetchArticle("teams"),
      client.fetchArticle("poulelijst")
    ]);
    const poolMatches: SportMatch[] = [];
    for (const context of collectSportlinkPoolContexts(teams.payload, pools.payload)) {
      for (const request of [
        { article: "poule-programma" as const, mode: "program" as const, args: { poulecode: context.poolExternalId, aantaldagen: 7, eigenwedstrijden: "NEE" as const } },
        { article: "pouleuitslagen" as const, mode: "results" as const, args: { poulecode: context.poolExternalId, aantaldagen: 7, eigenwedstrijden: "NEE" as const } }
      ]) {
        try {
          const response = await client.fetchArticle(request.article, request.args);
          poolMatches.push(...enrichSportlinkPoolMatches(
            mapSportlinkMatches(response.payload, request.mode), context
          ));
        } catch (error) {
          if (error instanceof SportlinkClientError && [
            "SPORTLINK_CONDITION_ERROR", "SPORTLINK_SCOPE_INSUFFICIENT"
          ].includes(error.code)) continue;
          throw error;
        }
      }
    }
    const ownProgram = enrichSportlinkOwnMatchesWithPoolContexts(
      mapSportlinkMatches(program.payload, "program"),
      teams.payload,
      pools.payload
    );
    const ownResults = enrichSportlinkOwnMatchesWithPoolContexts(
      mapSportlinkMatches(results.payload, "results"),
      teams.payload,
      pools.payload
    );
    batch.matches = dedupeSportlinkMatches([
      ...poolMatches,
      ...ownProgram,
      ...ownResults,
      ...mapSportlinkMatches(cancellations.payload, "cancellations")
    ]);
    batch.teamLogos = await fetchMatchTeamLogos(job, batch.matches);
    return batch;
  }

  if (datasetGroup === "match_details") {
    const program = await client.fetchArticle("programma", {
      aantaldagen: 42,
      aantalregels: 100
    });
    const baseMatches = mapSportlinkMatches(program.payload, "program");
    const details = new Map<string, SportMatch>();
    const matchCodes = extractSportlinkRecords(program.payload)
      .map((match) => scalar(match.wedstrijdcode))
      .filter((value): value is string => Boolean(value && /^\d+$/.test(value)))
      .slice(0, 12);
    for (const wedstrijdcode of matchCodes) {
      try {
        const response = await client.fetchArticle("wedstrijd-informatie", {
          wedstrijdcode
        });
        for (const match of mapSportlinkMatches(response.payload, "program")) {
          details.set(match.externalId, match);
        }
      } catch (error) {
        if (
          error instanceof SportlinkClientError &&
          ["SPORTLINK_CONDITION_ERROR", "SPORTLINK_SCOPE_INSUFFICIENT"].includes(error.code)
        ) {
          continue;
        }
        throw error;
      }
    }
    batch.matches = baseMatches.map((match) => {
      const detail = details.get(match.externalId);
      return detail
        ? { ...detail, isHomeMatch: match.isHomeMatch }
        : match;
    });
    batch.teamLogos = await fetchMatchTeamLogos(job, batch.matches);
    return batch;
  }

  if (datasetGroup === "activities") {
    const activities = await client.fetchArticle("verenigingsactiviteiten", {
      aantaldagen: 90
    });
    batch.activities = mapSportlinkActivities(activities.payload);
    return batch;
  }

  if (datasetGroup === "public_people") {
    return fetchSportlinkBirthdays(client, job, batch);
  }

  if (datasetGroup === "competitions") {
    const result = await fetchStandings(client, job);
    batch.standings = result.standings;
    batch.teamLogos = result.teamLogos;
    return batch;
  }

  throw new SportlinkWorkerError(
    "SPORTLINK_DATASET_DISABLED",
    "Deze Sportlink-dataset is niet geactiveerd."
  );
}

async function fetchSportlinkBirthdays(
  client: SportlinkClient,
  job: ClaimedSportlinkSync,
  batch: NormalizedSportlinkBatch
) {
  const fetchedAt = new Date();
  const [birthdayResponse, teamResponse] = await Promise.all([
    client.fetchArticle("verjaardagen", { aantaldagen: 21 }),
    client.fetchArticle("teams")
  ]);
  const birthdays = mapSportlinkBirthdays(birthdayResponse.payload, {
    maxDays: 21,
    now: fetchedAt,
    timezone: job.timezone
  });
  if (birthdayResponse.recordCount > 0 && birthdays.length === 0) {
    throw new SportlinkWorkerError(
      "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY",
      "Sportlink leverde verjaardagen, maar geen record kon veilig worden verwerkt. " +
      "De bestaande verjaardagen blijven behouden; controleer het providercontract en synchroniseer opnieuw."
    );
  }
  const teams = mapSportlinkTeams(teamResponse.payload).slice(0, 50);
  const memberAssignments = [];
  for (const team of teams) {
    if (!team.localExternalId) continue;
    try {
      const response = await client.fetchArticle("team-indeling", {
        lokaleteamcode: team.localExternalId,
        teamcode: team.externalId,
        toonlidfoto: "JA"
      });
      memberAssignments.push(...mapSportlinkTeamMembers(response.payload, {
        externalId: team.externalId,
        name: team.name
      }));
    } catch (error) {
      if (error instanceof SportlinkClientError && [
        "SPORTLINK_CONDITION_ERROR",
        "SPORTLINK_SCOPE_INSUFFICIENT"
      ].includes(error.code)) continue;
      throw error;
    }
  }

  const members = new Map<string, {
    displayName: string;
    externalMemberCode: string | null;
    identityKey: string;
    normalizedName: string;
    photoProviderAssetVersionId: string | null;
    photoUrl: string | null;
    role: string | null;
    teamAssignments: Array<{ externalId: string; name: string }>;
  }>();
  const memberIdentity = new Map<typeof memberAssignments[number], string>();
  for (const assignment of memberAssignments) {
    const identityKey = stableSportlinkExternalId(
      assignment.externalMemberCode
        ? "birthday-member-code"
        : "birthday-member-unlinked",
      assignment.externalMemberCode ?? assignment.normalizedName,
      assignment.externalMemberCode ? "" : assignment.teamExternalId
    ).slice(0, 40);
    memberIdentity.set(assignment, identityKey);
    const existing = members.get(identityKey);
    if (existing) {
      if (!existing.teamAssignments.some(
        (team) => team.externalId === assignment.teamExternalId
      )) {
        existing.teamAssignments.push({
          externalId: assignment.teamExternalId,
          name: assignment.teamName
        });
      }
      existing.photoUrl ??= assignment.photoUrl;
      existing.role ??= assignment.role;
      continue;
    }
    members.set(identityKey, {
      displayName: assignment.displayName,
      externalMemberCode: assignment.externalMemberCode,
      identityKey,
      normalizedName: assignment.normalizedName,
      photoProviderAssetVersionId: null,
      photoUrl: assignment.photoUrl,
      role: assignment.role,
      teamAssignments: [{
        externalId: assignment.teamExternalId,
        name: assignment.teamName
      }]
    });
  }

  for (const member of [...members.values()].filter(
    (candidate) => candidate.photoUrl
  ).slice(0, 40)) {
    try {
      const image = await fetchSafeRssImage(member.photoUrl!);
      const artifact = await prepareSportlinkPersonPhoto(
        job,
        member.identityKey,
        member.photoUrl!,
        image.body
      );
      batch.personPhotos.push(artifact);
      member.photoProviderAssetVersionId = artifact.assetId;
    } catch {
      // A remote photo is optional. Identity data remains usable without it.
    }
  }

  const matched = matchSportlinkBirthdays(birthdays, memberAssignments);
  batch.birthdayFetchedAt = fetchedAt.toISOString();
  batch.teamMembers = [...members.values()].map((member) => ({
    displayName: member.displayName,
    externalMemberCode: member.externalMemberCode,
    identityKey: member.identityKey,
    normalizedName: member.normalizedName,
    photoProviderAssetVersionId: member.photoProviderAssetVersionId,
    role: member.role,
    teamAssignments: member.teamAssignments
  }));
  batch.birthdays = matched.map((match) => {
    const memberKey = match.member ? memberIdentity.get(match.member) ?? null : null;
    const matchedMember = memberKey ? members.get(memberKey) : null;
    return {
      day: match.birthday.day,
      displayName: match.birthday.displayName,
      externalId: match.birthday.externalId,
      matchStatus: match.status,
      memberIdentityKey: memberKey,
      month: match.birthday.month,
      nextOccurrence: match.birthday.nextOccurrence,
      normalizedName: match.birthday.normalizedName,
      role: matchedMember?.role ?? null,
      teamAssignments: match.teamAssignments
    };
  });
  return batch;
}

function toMediaPayload(artifact: SportlinkMediaArtifact) {
  return {
    assetId: artifact.assetId,
    checksumSha256: artifact.checksumSha256,
    externalId: artifact.externalId,
    fileSizeBytes: artifact.fileSizeBytes,
    height: artifact.height,
    mimeType: artifact.mimeType,
    role: artifact.role,
    sourceUrl: "sourceUrl" in artifact ? artifact.sourceUrl : undefined,
    storagePath: artifact.storagePath,
    title: artifact.title,
    width: artifact.width
  };
}

function leaseRenewIntervalMs(lockTimeoutSeconds: number) {
  return Math.max(
    5_000,
    Math.min(30_000, Math.floor(lockTimeoutSeconds * 1_000 / 3))
  );
}

function startLeaseHeartbeat({
  backend,
  intervalMs,
  job,
  lockTimeoutSeconds,
  workerId
}: {
  backend: SportlinkSyncBackend;
  intervalMs: number;
  job: ClaimedSportlinkSync;
  lockTimeoutSeconds: number;
  workerId: string;
}) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Promise<void> | null = null;
  let lost = false;
  let lastRenewedAt = Date.now();
  const renewalBudgetMs = Math.max(1_000, lockTimeoutSeconds * 1_000 * 0.8);

  const schedule = () => {
    if (stopped || lost) return;
    timer = setTimeout(() => {
      pending = renew().finally(() => {
        pending = null;
        schedule();
      });
    }, intervalMs);
  };

  const renew = async () => {
    try {
      if (await backend.renew(job, workerId)) {
        lastRenewedAt = Date.now();
        return;
      }
      lost = true;
    } catch {
      if (Date.now() - lastRenewedAt >= renewalBudgetMs) {
        lost = true;
      }
    }
  };

  schedule();

  return {
    assertOwned() {
      if (lost) {
        throw new SportlinkWorkerError(
          "SPORTLINK_WORKER_LEASE_LOST",
          "De synchronisatielease is door een andere worker overgenomen."
        );
      }
    },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await pending;
    }
  };
}

async function fetchStandings(
  client: SportlinkClient,
  job: ClaimedSportlinkSync
) {
  const teams = await client.fetchArticle("teams");
  const pools = await client.fetchArticle("poulelijst");
  const contexts = collectSportlinkPoolContexts(
    teams.payload,
    pools.payload
  );

  const standings: SportStanding[] = [];
  for (const context of contexts) {
    try {
      const response = await client.fetchArticle("poulestand", {
        poulecode: context.poolExternalId
      });
      standings.push(mapSportlinkStandings(
        response.payload,
        context.poolExternalId,
        context.poolName,
        null,
        context.competition
      ));
    } catch (error) {
      if (
        error instanceof SportlinkClientError &&
        error.code === "SPORTLINK_CONDITION_ERROR"
      ) {
        continue;
      }
      throw error;
    }
  }
  return {
    standings,
    teamLogos: await fetchStandingTeamLogos(job, standings)
  };
}

async function fetchStandingTeamLogos(
  job: ClaimedSportlinkSync,
  standings: SportStanding[]
) {
  const unique = new Map<string, { externalId: string; teamName: string }>();
  for (const standing of standings) {
    for (const row of standing.rows) {
      if (row.logoUrl && !unique.has(row.logoUrl)) {
        unique.set(row.logoUrl, {
          externalId: row.externalId,
          teamName: row.teamName
        });
      }
      if (unique.size >= 100) break;
    }
    if (unique.size >= 100) break;
  }
  return fetchTeamLogos(job, unique);
}

async function fetchMatchTeamLogos(
  job: ClaimedSportlinkSync,
  matches: SportMatch[]
) {
  return fetchTeamLogos(job, collectSportlinkMatchLogoCandidates(matches));
}

export function collectSportlinkMatchLogoCandidates(matches: SportMatch[]) {
  const unique = new Map<string, { externalId: string; teamName: string }>();
  for (const match of matches) {
    for (const team of [match.homeTeam, match.awayTeam]) {
      if (team.logoUrl && team.externalId && !unique.has(team.logoUrl)) {
        unique.set(team.logoUrl, {
          externalId: team.externalId,
          teamName: team.name
        });
      }
      if (unique.size >= 100) break;
    }
    if (unique.size >= 100) break;
  }
  return unique;
}

async function fetchTeamLogos(
  job: ClaimedSportlinkSync,
  unique: Map<string, { externalId: string; teamName: string }>
) {
  const entries = [...unique];
  const artifacts: SportlinkTeamLogoArtifact[] = [];
  for (let offset = 0; offset < entries.length; offset += 6) {
    const chunk = entries.slice(offset, offset + 6);
    const imported = await Promise.all(
      chunk.map(async ([sourceUrl, team]) => {
        try {
          const image = await fetchSafeRssImage(sourceUrl);
          return await prepareSportlinkTeamLogo(
            job,
            team.externalId,
            team.teamName,
            sourceUrl,
            image.body
          );
        } catch {
          // A temporarily unavailable provider image must not invalidate the
          // dataset. The initials fallback remains deterministic.
          return null;
        }
      })
    );
    artifacts.push(...imported.filter(
      (artifact): artifact is SportlinkTeamLogoArtifact => artifact !== null
    ));
  }
  return artifacts;
}

export function collectSportlinkPoolIds(
  teamsPayload: unknown,
  poolsPayload: unknown,
  maximum = 24
) {
  return collectSportlinkPoolContexts(
    teamsPayload,
    poolsPayload,
    maximum
  ).map((context) => context.poolExternalId);
}

export function collectSportlinkPoolContexts(
  teamsPayload: unknown,
  poolsPayload: unknown,
  maximum = 24
) {
  const boundedMaximum = Number.isFinite(maximum)
    ? Math.min(24, Math.max(1, Math.trunc(maximum)))
    : 24;
  const teamRecords = extractSportlinkRecords(teamsPayload);
  const poolRecords = extractSportlinkRecords(poolsPayload);
  const teamCodes = new Set(
    teamRecords
      .map((team) => scalar(team.teamcode))
      .filter((value): value is string =>
        Boolean(value && /^\d+$/.test(value))
      )
  );
  const contexts = new Map<string, {
    competition: SportStanding["competition"];
    poolExternalId: string;
    poolName: string;
  }>();
  const addPool = (value: Record<string, unknown>) => {
    const poolId = scalar(value.poulecode);
    if (
      poolId &&
      /^\d+$/.test(poolId) &&
      contexts.size < boundedMaximum &&
      !contexts.has(poolId)
    ) {
      const competitionName = scalar(
        value.competitienaam ?? value.competitie
      );
      const competitionType = scalar(
        value.competitiesoort ?? value.competitietype
      );
      const period = scalar(
        value.competitieperiode ?? value.fase ?? value.klasse
      );
      const poolName = scalar(value.poule ?? value.klassepoule)
        ?? "Competitiestand";
      const competitionLabel =
        competitionName ?? competitionType ?? period ?? poolName;
      contexts.set(poolId, {
        competition: {
          externalId: stableSportlinkExternalId(
            "competition-context",
            [
              competitionType ?? "",
              competitionName ?? "",
              period ?? "",
              poolName
            ].join("|")
          ),
          name: competitionLabel,
          period,
          season: scalar(value.seizoen),
          type: competitionType
        },
        poolExternalId: poolId,
        poolName
      });
    }
  };

  for (const team of teamRecords) {
    addPool(team);
  }
  for (const pool of poolRecords) {
    const teamCode = scalar(pool.teamcode);
    if (teamCode && teamCodes.has(teamCode)) {
      addPool(pool);
    }
  }

  return [...contexts.values()];
}

export function enrichSportlinkOwnMatchesWithPoolContexts(
  matches: SportMatch[],
  teamsPayload: unknown,
  poolsPayload: unknown
) {
  const contexts = new Map(
    collectSportlinkPoolContexts(teamsPayload, poolsPayload)
      .map((context) => [context.poolExternalId, context])
  );
  const teamPools = new Map<string, string>();
  const mapTeamPool = (record: Record<string, unknown>) => {
    const poolId = scalar(record.poulecode);
    if (!poolId || !contexts.has(poolId)) return;
    for (const value of [record.teamcode, record.lokaleteamcode]) {
      const teamId = scalar(value);
      if (teamId) teamPools.set(teamId, poolId);
    }
  };
  for (const team of extractSportlinkRecords(teamsPayload)) mapTeamPool(team);
  for (const pool of extractSportlinkRecords(poolsPayload)) mapTeamPool(pool);

  return matches.map((match) => {
    if (match.pool?.externalId) return match;
    const poolId = [match.homeTeam.externalId, match.awayTeam.externalId]
      .flatMap((teamId) => teamId ? [teamPools.get(teamId)] : [])
      .find((value): value is string => Boolean(value));
    const context = poolId ? contexts.get(poolId) : null;
    return context ? enrichSportlinkPoolMatches([match], context)[0]! : match;
  });
}

function dedupeSportlinkMatches(matches: SportMatch[]) {
  const unique = new Map<string, SportMatch>();
  for (const match of matches) unique.set(match.externalId, match);
  return [...unique.values()];
}

export function enrichSportlinkPoolMatches(
  matches: SportMatch[],
  context: ReturnType<typeof collectSportlinkPoolContexts>[number]
) {
  return matches.map((match): SportMatch => ({
    ...match,
    competition: match.competition ?? context.competition,
    pool: {
      competitionExternalId:
        match.pool?.competitionExternalId ?? context.competition?.externalId ?? null,
      externalId: context.poolExternalId,
      name: match.pool?.name ?? context.poolName
    }
  }));
}

function parseClaim(value: unknown): ClaimedSportlinkSync {
  if (
    !isRecord(value) ||
    typeof value.run_id !== "string" ||
    typeof value.tenant_id !== "string" ||
    typeof value.connection_id !== "string" ||
    typeof value.data_source_id !== "string" ||
    typeof value.dataset_group !== "string" ||
    typeof value.encrypted_client_id !== "string" ||
    typeof value.encryption_iv !== "string" ||
    typeof value.encryption_tag !== "string" ||
    typeof value.timezone !== "string"
  ) {
    throw new Error("sportlink_sync_claim_invalid");
  }
  return {
    connectionId: value.connection_id,
    dataSourceId: value.data_source_id,
    datasetGroup: value.dataset_group,
    encryptedClientId: value.encrypted_client_id,
    encryptionIv: value.encryption_iv,
    encryptionTag: value.encryption_tag,
    runId: value.run_id,
    tenantId: value.tenant_id,
    timezone: value.timezone
  };
}

function classifySportlinkSyncFailure(error: unknown) {
  if (error instanceof SportlinkClientError || error instanceof SportlinkWorkerError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "SPORTLINK_SYNC_INTERNAL_ERROR",
    message: "De periodieke Sportlink-sync is door een interne fout onderbroken."
  };
}

class SportlinkWorkerError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "SportlinkWorkerError";
  }
}

function scalar(value: unknown) {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function abortableDelay(milliseconds: number, signal: AbortSignal) {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}
