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
  mapSportlinkActivities,
  mapSportlinkClub,
  mapSportlinkMatches,
  mapSportlinkStandings,
  mapSportlinkTeams
} from "@veyocast/integrations/server";
import { createClient } from "@supabase/supabase-js";

export type ClaimedSportlinkSync = {
  connectionId: string;
  dataSourceId: string;
  datasetGroup: string;
  encryptedClientId: string;
  encryptionIv: string;
  encryptionTag: string;
  runId: string;
  tenantId: string;
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
};

type NormalizedSportlinkBatch = {
  activities: SportActivity[];
  club: SportClub | null;
  matches: SportMatch[];
  standings: SportStanding[];
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
  club: null,
  matches: [],
  standings: [],
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
    const result = await this.client.rpc("claim_due_sportlink_sync_v1", {
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
    const result = await this.client.rpc("complete_sportlink_sync_v1", {
      p_activities: batch.activities,
      p_club: batch.club ?? {},
      p_matches: batch.matches,
      p_run_id: job.runId,
      p_standings: batch.standings,
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
    new SportlinkClient(clientId)
  );
}

async function fetchSportlinkDataset(
  datasetGroup: string,
  client: SportlinkClient
): Promise<NormalizedSportlinkBatch> {
  const batch = emptyBatch();

  if (datasetGroup === "club_profile") {
    const [club] = await Promise.all([
      client.fetchArticle("clubgegevens"),
      client.fetchClubLogo()
    ]);
    batch.club = mapSportlinkClub(club.payload);
    if (!batch.club) {
      throw new SportlinkWorkerError(
        "SPORTLINK_CLUB_INVALID",
        "Sportlink gaf geen bruikbare clubidentiteit terug."
      );
    }
    return batch;
  }

  if (datasetGroup === "teams") {
    const teams = await client.fetchArticle("teams");
    batch.teams = mapSportlinkTeams(teams.payload);
    return batch;
  }

  if (datasetGroup === "matches") {
    const [program, results, cancellations] = await Promise.all([
      client.fetchArticle("programma", { aantaldagen: 42, aantalregels: 100 }),
      client.fetchArticle("uitslagen", { aantaldagen: 14, aantalregels: 100 }),
      client.fetchArticle("afgelastingen", { aantaldagen: 42, aantalregels: 100 })
    ]);
    batch.matches = [
      ...mapSportlinkMatches(program.payload, "program"),
      ...mapSportlinkMatches(results.payload, "results"),
      ...mapSportlinkMatches(cancellations.payload, "cancellations")
    ];
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
    batch.matches = baseMatches.map((match) =>
      details.get(match.externalId) ?? match
    );
    return batch;
  }

  if (datasetGroup === "activities") {
    const activities = await client.fetchArticle("verenigingsactiviteiten", {
      aantaldagen: 90
    });
    batch.activities = mapSportlinkActivities(activities.payload);
    return batch;
  }

  if (datasetGroup === "competitions") {
    batch.standings = await fetchStandings(client);
    return batch;
  }

  throw new SportlinkWorkerError(
    "SPORTLINK_DATASET_DISABLED",
    "Deze Sportlink-dataset is niet geactiveerd."
  );
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

async function fetchStandings(client: SportlinkClient) {
  const teams = await client.fetchArticle("teams");
  const pools = await client.fetchArticle("poulelijst");
  const poolIds = collectSportlinkPoolIds(teams.payload, pools.payload);

  const standings: SportStanding[] = [];
  for (const poolId of poolIds) {
    try {
      const response = await client.fetchArticle("poulestand", {
        poulecode: poolId
      });
      standings.push(mapSportlinkStandings(response.payload, poolId));
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
  return standings;
}

export function collectSportlinkPoolIds(
  teamsPayload: unknown,
  poolsPayload: unknown,
  maximum = 24
) {
  const boundedMaximum = Number.isFinite(maximum)
    ? Math.min(24, Math.max(1, Math.trunc(maximum)))
    : 24;
  const teamRecords = extractSportlinkRecords(teamsPayload);
  const teamCodes = new Set(
    teamRecords
      .map((team) => scalar(team.teamcode))
      .filter((value): value is string =>
        Boolean(value && /^\d+$/.test(value))
      )
  );
  const poolIds = new Set<string>();
  const addPool = (value: unknown) => {
    const poolId = scalar(value);
    if (poolId && /^\d+$/.test(poolId) && poolIds.size < boundedMaximum) {
      poolIds.add(poolId);
    }
  };

  for (const team of teamRecords) {
    addPool(team.poulecode);
  }
  for (const pool of extractSportlinkRecords(poolsPayload)) {
    const teamCode = scalar(pool.teamcode);
    if (teamCode && teamCodes.has(teamCode)) {
      addPool(pool.poulecode);
    }
  }

  return [...poolIds];
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
    typeof value.encryption_tag !== "string"
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
    tenantId: value.tenant_id
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
