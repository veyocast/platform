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
  enrichSportlinkStandingForm,
  extractSportlinkRecords,
  fetchSafeRssImage,
  normalizeSportlinkBirthdays,
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
import { createStructuredLogger } from "@veyocast/observability";

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
      datasetGroup?: undefined;
      errorCode: "SPORTLINK_SYNC_CLAIM_FAILED";
      runId?: undefined;
      status: "failed";
    }
  | {
      datasetGroup: string;
      errorCode?: string;
      readCount?: number;
      runId: string;
      status: "completed" | "failed";
    };

type ProviderCacheQuery = PromiseLike<{ data: unknown; error: unknown }> & {
  eq(column: string, value: string): ProviderCacheQuery;
  in(column: string, values: string[]): ProviderCacheQuery;
  limit(count: number): ProviderCacheQuery;
  abortSignal(signal: AbortSignal): ProviderCacheQuery;
  retry(enabled: boolean): ProviderCacheQuery;
};

type RpcClient = {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>
  ): Promise<{ data: unknown; error: { code?: string; message?: string } | null; status?: number }>;
  from?(table: "provider_asset_cache"): { select(columns: string): ProviderCacheQuery };
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

// Only reviewed upstream codes may become a persisted diagnostic. Never carry
// an arbitrary SDK message, detail, hint or cause into the run or its logs.
const completionDatabaseCodes = new Set([
  "08001", "08006", "22023", "22P02", "23502", "23503", "23505", "23514",
  "28000", "28P01", "40001", "40P01", "42501", "42703", "42883", "42P01",
  "53300", "53400", "54000", "55000", "55P03", "57014", "57P01", "57P02",
  "57P03", "P0001", "P0002", "XX000"
]);
const completionPostgrestCodes = new Set([
  "PGRST000", "PGRST001", "PGRST002", "PGRST003", "PGRST100", "PGRST102",
  "PGRST103", "PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204",
  "PGRST205", "PGRST300", "PGRST301", "PGRST302", "PGRST303", "PGRSTX00"
]);

function completionFailureCode(result: Awaited<ReturnType<RpcClient["rpc"]>>) {
  if (!result.error) return "SPORTLINK_SYNC_COMPLETE_INVALID_RESULT";
  // The SDK uses status 0 for a fetch rejection, including aborts, without an
  // HTTP response. It does not establish the underlying network/timeout cause.
  if (result.status === 0) return "SPORTLINK_SYNC_COMPLETE_TRANSPORT_FAILED";
  const code = result.error.code;
  // These exact PostgreSQL messages distinguish two cancellation mechanisms.
  // A matching SQLSTATE alone, localized message or added detail proves neither.
  if (code === "57014") {
    if (result.error.message === "canceling statement due to statement timeout") {
      return "SPORTLINK_SYNC_COMPLETE_57014_STATEMENT_TIMEOUT";
    }
    if (result.error.message === "canceling statement due to user request") {
      return "SPORTLINK_SYNC_COMPLETE_57014_USER_REQUEST";
    }
  }
  if (code && (completionDatabaseCodes.has(code) || completionPostgrestCodes.has(code))) {
    return `SPORTLINK_SYNC_COMPLETE_${code}`;
  }
  return "SPORTLINK_SYNC_COMPLETE_RPC_FAILED";
}

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
  bindOperationSignal?(signal: AbortSignal): void;
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
  private readonly requestTimeoutMs: number;
  private operationSignal?: AbortSignal;

  bindOperationSignal(signal: AbortSignal) {
    if (!(signal instanceof AbortSignal)) throw new Error("sportlink_operation_signal_invalid");
    if (this.operationSignal && this.operationSignal !== signal) {
      throw new Error("sportlink_operation_signal_already_bound");
    }
    this.operationSignal = signal;
  }

  constructor(
    supabaseUrl: string,
    serviceRoleKey: string,
    client?: RpcClient,
    requestTimeoutMs = 30_000
  ) {
    const timeoutMs = Number.isFinite(requestTimeoutMs) ? Math.min(30_000, Math.max(1, requestTimeoutMs)) : 30_000;
    this.requestTimeoutMs = timeoutMs;
    this.client = client ?? createClient(supabaseUrl, serviceRoleKey, {
      global: {
        fetch: (input, init) => {
          assertOperationActive(this.operationSignal);
          const deadline = AbortSignal.timeout(timeoutMs);
          const requestSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
          const signals = [deadline, requestSignal, this.operationSignal]
            .filter((signal): signal is AbortSignal => Boolean(signal));
          return fetch(input, {
            ...init,
            signal: AbortSignal.any(signals)
          });
        }
      },
      auth: { autoRefreshToken: false, persistSession: false }
    }) as unknown as RpcClient;
  }

  async claim(workerId: string, lockTimeoutSeconds: number) {
    const result = await operationWait(() => this.client.rpc("claim_due_sportlink_sync_v2", {
      p_lock_timeout_seconds: lockTimeoutSeconds,
      p_worker_id: workerId
    }), this.operationSignal);
    assertOperationActive(this.operationSignal);
    if (result.error) throw new Error("sportlink_sync_claim_failed");
    if (!Array.isArray(result.data) || !result.data.length) return null;
    return parseClaim(result.data[0]);
  }

  async complete(
    job: ClaimedSportlinkSync,
    workerId: string,
    batch: NormalizedSportlinkBatch
  ) {
    assertOperationActive(this.operationSignal);
    const optionalLogos = [batch.clubLogo, ...batch.teamLogos]
      .filter(
        (artifact): artifact is SportlinkMediaArtifact => Boolean(artifact)
      );
    const persistedLogos = new Set<SportlinkMediaArtifact>();
    const unpersistedTeams = new Set<string>();
    let failedLogos = 0;
    let skippedLogos = 0;
    for (const artifact of optionalLogos) {
      assertOperationActive(this.operationSignal);
      if (failedLogos) {
        // One storage failure opens the circuit for the remaining optional
        // images: an outage must not cost 100 sequential request deadlines.
        skippedLogos++;
      } else {
        try {
          if (!this.client.storage) throw new Error("storage_unavailable");
          const upload = await operationWait(() => this.client.storage!.from("provider-assets")
            .upload(artifact.storagePath, artifact.bytes, {
              cacheControl: "31536000", contentType: artifact.mimeType, upsert: true
            }), this.operationSignal);
          assertOperationActive(this.operationSignal);
          if (upload.error) throw new Error("optional_logo_upload_failed");
          persistedLogos.add(artifact);
          continue;
        } catch {
          assertOperationActive(this.operationSignal);
          failedLogos++;
        }
      }
      if (artifact.role === "team_logo") unpersistedTeams.add(artifact.externalId);
    }
    // Person photos remain fail-closed. Their already assigned member pointers
    // must never reach the birthday RPC unless their upload succeeds.
    if (batch.personPhotos.length) {
      if (!this.client.storage) {
        throw new Error("sportlink_media_storage_unavailable");
      }
      for (const artifact of batch.personPhotos) {
        const upload = await operationWait(() => this.client.storage!
          .from("provider-assets")
          .upload(artifact.storagePath, artifact.bytes, {
            cacheControl: "31536000",
            contentType: artifact.mimeType,
            upsert: true
          }), this.operationSignal);
        assertOperationActive(this.operationSignal);
        if (upload.error) throw new SportlinkWorkerError(
          "SPORTLINK_MEDIA_UPLOAD_FAILED",
          "Een Sportlink-logo kon niet worden opgeslagen. De bestaande gegevens blijven behouden; controleer de provideropslag."
        );
      }
    }
    const previous = await this.previousTeamLogos([...unpersistedTeams]);
    assertOperationActive(this.operationSignal);
    const reusedTeamLogos = new Set<string>();
    const standings = batch.standings.map((standing) => ({
      ...standing,
      rows: standing.rows.map((row) => {
        const safeRow = { ...row } as typeof row & { logoMediaAssetId?: string };
        delete safeRow.logoMediaAssetId;
        const versionId = previous.versions.get(row.externalId);
        if (versionId) {
          safeRow.logoMediaAssetId = versionId;
          reusedTeamLogos.add(row.externalId);
        }
        return safeRow;
      })
    }));
    const result = await operationWait(() => job.datasetGroup === "public_people"
      ? this.client.rpc("complete_sportlink_birthdays_v1", {
        p_birthdays: batch.birthdays,
        p_fetched_at: batch.birthdayFetchedAt,
        p_person_photos: batch.personPhotos.map(toMediaPayload),
        p_run_id: job.runId,
        p_team_members: batch.teamMembers,
        p_worker_id: workerId
      })
      : this.client.rpc("complete_sportlink_sync_v4", {
      p_activities: batch.activities,
      p_club: batch.club ?? {},
      p_club_logo: batch.clubLogo && persistedLogos.has(batch.clubLogo) ? toMediaPayload(batch.clubLogo) : {},
      p_matches: batch.matches,
      p_run_id: job.runId,
      p_standings: standings,
      p_team_logos: batch.teamLogos.filter((artifact) => persistedLogos.has(artifact)).map(toMediaPayload),
      p_teams: batch.teams,
      p_worker_id: workerId
    }), this.operationSignal);
    if (result.error || !isRecord(result.data)) {
      assertOperationActive(this.operationSignal);
      throw new SportlinkWorkerError(
        completionFailureCode(result),
        "Sportlink-gegevens zijn opgehaald maar konden niet worden verwerkt. De bestaande gegevens blijven behouden; controleer de synchronisatiediagnose."
      );
    }
    const readCount = Number(result.data.readCount ?? 0);
    if (!Number.isSafeInteger(readCount) || readCount < 0) {
      throw new SportlinkWorkerError(
        "SPORTLINK_SYNC_COMPLETE_INVALID_RESULT",
        "Sportlink gaf een onbruikbare synchronisatie-uitkomst terug. De bestaande gegevens blijven behouden; controleer de synchronisatiediagnose."
      );
    }
    // The committed source revision queues published-data refresh, including
    // clock-based windows. No fallible rendering RPC follows successful ingest.
    if (failedLogos && !this.operationSignal?.aborted) {
      try {
        createStructuredLogger({
          correlationId: job.runId, environment: process.env.VEYOCAST_ENVIRONMENT ?? "development",
          revision: process.env.DEPLOYMENT_SHA ?? "development", service: "media-worker"
        }).warn("sportlink.sync.completed", {
          outcome: "completed_with_optional_media_warning", errorCode: "SPORTLINK_MEDIA_PARTIAL",
          failedLogos: Math.min(101, failedLogos), skippedLogos: Math.min(101, skippedLogos),
          reusedTeamLogos: reusedTeamLogos.size, cacheLookupFailed: previous.failed
        });
      } catch { /* Logging failure cannot turn an already committed ingest into a failed run. */ }
    }
    return readCount;
  }

  private async previousTeamLogos(externalIds: string[]) {
    assertOperationActive(this.operationSignal);
    const versions = new Map<string, string>();
    if (!externalIds.length) return { versions, failed: false };
    if (!this.client.from || externalIds.length > 100
      || externalIds.some((id) => !/^[a-zA-Z0-9._:-]{1,128}$/.test(id))) return { versions, failed: true };
    try {
      const result = await operationWait(async () => this.client.from!("provider_asset_cache").select(
        "id,provider,entity_type,external_entity_id,asset_role,current_version_id,version:provider_asset_versions!provider_asset_cache_current_version_fk(id,cache_id,checksum_sha256,storage_bucket,storage_path,mime_type,file_size_bytes,width,height)"
      ).eq("provider", "sportlink").eq("entity_type", "team").eq("asset_role", "team_logo")
        .in("external_entity_id", externalIds).limit(100).retry(false)
        .abortSignal(this.operationSignal ? AbortSignal.any([this.operationSignal, AbortSignal.timeout(this.requestTimeoutMs)])
          : AbortSignal.timeout(this.requestTimeoutMs)), this.operationSignal);
      assertOperationActive(this.operationSignal);
      if (result.error || !Array.isArray(result.data) || result.data.length > externalIds.length) return { versions, failed: true };
      const seen = new Set<string>();
      for (const item of result.data) {
        if (!isRecord(item) || item.provider !== "sportlink" || item.entity_type !== "team" || item.asset_role !== "team_logo"
          || typeof item.id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(item.id)
          || typeof item.external_entity_id !== "string" || !externalIds.includes(item.external_entity_id)
          || seen.has(item.external_entity_id)) return { versions: new Map<string, string>(), failed: true };
        seen.add(item.external_entity_id);
        if (item.current_version_id === null && item.version === null) continue;
        const version = item.version;
        if (!isRecord(version) || typeof version.id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(version.id)
          || version.cache_id !== item.id || item.current_version_id !== version.id
          || typeof version.checksum_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(version.checksum_sha256)
          || version.storage_bucket !== "provider-assets" || version.storage_path !== `providers/sportlink/team_logo/${version.checksum_sha256}.webp`
          || version.mime_type !== "image/webp" || !Number.isSafeInteger(version.file_size_bytes) || Number(version.file_size_bytes) < 1 || Number(version.file_size_bytes) > 2_000_000
          || !Number.isInteger(version.width) || Number(version.width) < 1 || Number(version.width) > 512
          || !Number.isInteger(version.height) || Number(version.height) < 1 || Number(version.height) > 512) return { versions: new Map<string, string>(), failed: true };
        versions.set(item.external_entity_id, version.id);
      }
      return { versions, failed: false };
    } catch {
      assertOperationActive(this.operationSignal);
      return { versions: new Map<string, string>(), failed: true };
    }
  }

  async fail(
    job: ClaimedSportlinkSync,
    workerId: string,
    code: string,
    message: string
  ) {
    const result = await operationWait(() => this.client.rpc("fail_sportlink_sync_v1", {
      p_error_code: code.slice(0, 80),
      p_error_detail: message.replace(/[\r\n]+/g, " ").slice(0, 500),
      p_run_id: job.runId,
      p_worker_id: workerId
    }), this.operationSignal);
    assertOperationActive(this.operationSignal);
    if (result.error) throw new Error("sportlink_sync_failure_report_failed");
  }

  async renew(job: ClaimedSportlinkSync, workerId: string) {
    const result = await operationWait(() => this.client.rpc("renew_sportlink_sync_lease_v1", {
      p_run_id: job.runId,
      p_worker_id: workerId
    }), this.operationSignal);
    assertOperationActive(this.operationSignal);
    if (result.error) throw new Error("sportlink_sync_lease_renew_failed");
    return result.data === true;
  }
}

export async function runSportlinkSyncOnce({
  backend,
  encryptionKey,
  executeDataset = executeSportlinkDataset,
  lockTimeoutSeconds,
  signal,
  workerId
}: {
  backend: SportlinkSyncBackend;
  encryptionKey: string | null;
  executeDataset?: (
    job: ClaimedSportlinkSync,
    encryptionKey: string,
    signal?: AbortSignal
  ) => Promise<NormalizedSportlinkBatch>;
  lockTimeoutSeconds: number;
  signal?: AbortSignal;
  workerId: string;
}): Promise<SportlinkSyncRunResult> {
  if (signal) backend.bindOperationSignal?.(signal);
  if (signal?.aborted) return { status: "idle" };
  let job: ClaimedSportlinkSync | null;
  try {
    job = await operationWait(() => backend.claim(workerId, lockTimeoutSeconds), signal);
  } catch {
    if (signal?.aborted) return { status: "idle" };
    // A queue/database outage has no owned job to fail. Keep the dispatcher
    // alive without exposing raw RPC errors or inventing a run identity.
    return { errorCode: "SPORTLINK_SYNC_CLAIM_FAILED", status: "failed" };
  }
  if (!job || signal?.aborted) return { status: "idle" };

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
      signal,
      workerId
    });
    const batch = await operationWait(() => executeDataset(job, encryptionKey, signal), signal);
    assertOperationActive(signal);
    lease.assertOwned();
    const readCount = await operationWait(() => backend.complete(job, workerId, batch), signal);
    return {
      datasetGroup: job.datasetGroup,
      readCount,
      runId: job.runId,
      status: "completed"
    };
  } catch (error) {
    if (signal?.aborted) return { status: "idle" };
    const failure = classifySportlinkSyncFailure(error);
    try {
      await operationWait(() => backend.fail(job, workerId, failure.code, failure.message), signal);
    } catch {
      // A run may already have been reclaimed after an actual worker outage.
      // Reporting that stale failure must not terminate the dispatcher loop.
    }
    if (signal?.aborted) return { status: "idle" };
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
  backend.bindOperationSignal?.(signal);
  const baseDelay = Number.isFinite(intervalMs) ? Math.min(60_000, Math.max(1_000, intervalMs)) : 15_000;
  let failures = 0;
  while (!signal.aborted) {
    const result = await runSportlinkSyncOnce({
      backend,
      encryptionKey,
      lockTimeoutSeconds,
      signal,
      workerId
    });
    if (signal.aborted) break;
    onResult(result);
    failures = result.status === "failed" ? Math.min(7, failures + 1) : 0;
    if (result.status === "failed" || result.status === "idle") {
      await abortableDelay(Math.min(60_000, baseDelay * 2 ** Math.max(0, failures - 1)), signal);
    }
  }
}

async function executeSportlinkDataset(
  job: ClaimedSportlinkSync,
  encryptionKey: string,
  signal?: AbortSignal
) {
  assertOperationActive(signal);
  const clientId = decryptSportlinkClientId({
    ciphertext: job.encryptedClientId,
    iv: job.encryptionIv,
    tag: job.encryptionTag
  }, encryptionKey);
  return fetchSportlinkDataset(
    job.datasetGroup,
    new SportlinkClient(clientId, { operationSignal: signal }),
    job,
    signal
  );
}

export async function fetchSportlinkDataset(
  datasetGroup: string,
  client: SportlinkClient,
  job: ClaimedSportlinkSync,
  signal?: AbortSignal
): Promise<NormalizedSportlinkBatch> {
  assertOperationActive(signal);
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
        { article: "poule-programma" as const, mode: "program" as const, args: { poulecode: context.poolExternalId, aantaldagen: 14, eigenwedstrijden: "NEE" as const } },
        { article: "poule-programma" as const, mode: "program" as const, args: { poulecode: context.poolExternalId, aantaldagen: 14, eigenwedstrijden: "JA" as const } },
        { article: "pouleuitslagen" as const, mode: "results" as const, args: { poulecode: context.poolExternalId, aantaldagen: 14, eigenwedstrijden: "NEE" as const } },
        { article: "pouleuitslagen" as const, mode: "results" as const, args: { poulecode: context.poolExternalId, aantaldagen: 14, eigenwedstrijden: "JA" as const } }
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
    batch.teamLogos = await fetchMatchTeamLogos(job, batch.matches, signal);
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
    batch.teamLogos = await fetchMatchTeamLogos(job, batch.matches, signal);
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
    return fetchSportlinkBirthdays(client, job, batch, signal);
  }

  if (datasetGroup === "competitions") {
    const result = await fetchStandings(client, job, signal);
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
  batch: NormalizedSportlinkBatch,
  signal?: AbortSignal
) {
  const fetchedAt = new Date();
  const [birthdayResponse, teamResponse] = await Promise.all([
    client.fetchArticle("verjaardagen", { aantaldagen: 21 }),
    client.fetchArticle("teams")
  ]);
  const normalization = normalizeSportlinkBirthdays(birthdayResponse.payload, {
    maxDays: 21,
    now: fetchedAt,
    timezone: job.timezone
  });
  if (normalization.recordCount > 0 && normalization.validCount === 0) {
    throw new SportlinkWorkerError(
      "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY",
      "Sportlink leverde verjaardagen, maar geen record kon veilig worden verwerkt. " +
      "De bestaande verjaardagen blijven behouden; controleer het providercontract en synchroniseer opnieuw."
    );
  }
  const birthdays = normalization.birthdays;
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
      assertOperationActive(signal);
      const image = await fetchSafeRssImage(member.photoUrl!, 0, { signal });
      assertOperationActive(signal);
      const artifact = await prepareSportlinkPersonPhoto(
        job,
        member.identityKey,
        member.photoUrl!,
        image.body
      );
      batch.personPhotos.push(artifact);
      member.photoProviderAssetVersionId = artifact.assetId;
    } catch {
      assertOperationActive(signal);
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
  signal,
  workerId
}: {
  backend: SportlinkSyncBackend;
  intervalMs: number;
  job: ClaimedSportlinkSync;
  lockTimeoutSeconds: number;
  signal?: AbortSignal;
  workerId: string;
}) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Promise<void> | null = null;
  let lost = false;
  let lastRenewedAt = Date.now();
  const renewalBudgetMs = Math.max(1_000, lockTimeoutSeconds * 1_000 * 0.8);

  const schedule = () => {
    if (stopped || lost || signal?.aborted) return;
    timer = setTimeout(() => {
      pending = renew().finally(() => {
        pending = null;
        schedule();
      });
    }, intervalMs);
  };

  const renew = async () => {
    try {
      if (await operationWait(() => backend.renew(job, workerId), signal)) {
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

  const disarm = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
  signal?.addEventListener("abort", disarm, { once: true });
  schedule();

  return {
    assertOwned() {
      assertOperationActive(signal);
      if (lost) {
        throw new SportlinkWorkerError(
          "SPORTLINK_WORKER_LEASE_LOST",
          "De synchronisatielease is door een andere worker overgenomen."
        );
      }
    },
    async stop() {
      disarm();
      signal?.removeEventListener("abort", disarm);
      await pending;
    }
  };
}

async function fetchStandings(
  client: SportlinkClient,
  job: ClaimedSportlinkSync,
  signal?: AbortSignal
) {
  const teams = await client.fetchArticle("teams");
  const pools = await client.fetchArticle("poulelijst");
  const contexts = collectSportlinkPoolContexts(
    teams.payload,
    pools.payload
  );

  const ownTeams = mapSportlinkTeams(teams.payload);
  const standings: SportStanding[] = [];
  for (const context of contexts) {
    try {
      const response = await client.fetchArticle("poulestand", {
        poulecode: context.poolExternalId
      });
      const standing = mapSportlinkStandings(
        response.payload,
        context.poolExternalId,
        context.poolName,
        null,
        context.competition,
        ownTeams
      );
      const results: SportMatch[] = [];
      if (standing.rows.some((row) => row.form.length === 0)) {
        for (const eigenwedstrijden of ["NEE", "JA"] as const) {
          try {
            const response = await client.fetchArticle("pouleuitslagen", {
              aantaldagen: 90,
              eigenwedstrijden,
              poulecode: context.poolExternalId
            });
            // The requested pool is authoritative when the feed omits it.
            // Discard an explicit conflicting pool before filling context.
            const poolResults = extractSportlinkRecords(response.payload).filter((row) =>
              !scalar(row.poulecode) || scalar(row.poulecode) === context.poolExternalId
            );
            results.push(...enrichSportlinkPoolMatches(
              mapSportlinkMatches(poolResults, "results"), context
            ));
          } catch (error) {
            if (error instanceof SportlinkClientError && [
              "SPORTLINK_CONDITION_ERROR", "SPORTLINK_SCOPE_INSUFFICIENT"
            ].includes(error.code)) continue;
            throw error;
          }
        }
      }
      standings.push(enrichSportlinkStandingForm(standing, results));
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
    teamLogos: await fetchStandingTeamLogos(job, standings, signal)
  };
}

async function fetchStandingTeamLogos(
  job: ClaimedSportlinkSync,
  standings: SportStanding[],
  signal?: AbortSignal
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
  return fetchTeamLogos(job, unique, signal);
}

async function fetchMatchTeamLogos(
  job: ClaimedSportlinkSync,
  matches: SportMatch[],
  signal?: AbortSignal
) {
  return fetchTeamLogos(job, collectSportlinkMatchLogoCandidates(matches), signal);
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
  unique: Map<string, { externalId: string; teamName: string }>,
  signal?: AbortSignal
) {
  const entries = [...unique];
  const artifacts: SportlinkTeamLogoArtifact[] = [];
  for (let offset = 0; offset < entries.length; offset += 6) {
    assertOperationActive(signal);
    const chunk = entries.slice(offset, offset + 6);
    const imported = await Promise.all(
      chunk.map(async ([sourceUrl, team]) => {
        try {
          assertOperationActive(signal);
          const image = await fetchSafeRssImage(sourceUrl, 0, { signal });
          assertOperationActive(signal);
          return await prepareSportlinkTeamLogo(
            job,
            team.externalId,
            team.teamName,
            sourceUrl,
            image.body
          );
        } catch {
          assertOperationActive(signal);
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

// Bound provider work, but never report a silently truncated club catalogue as complete.
const maximumSportlinkClubPools = 128;

export function collectSportlinkPoolIds(
  teamsPayload: unknown,
  poolsPayload: unknown,
  maximum = maximumSportlinkClubPools
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
  maximum = maximumSportlinkClubPools
) {
  const boundedMaximum = Number.isFinite(maximum)
    ? Math.min(maximumSportlinkClubPools, Math.max(1, Math.trunc(maximum)))
    : maximumSportlinkClubPools;
  const teamRecords = extractSportlinkRecords(teamsPayload);
  const poolRecords = extractSportlinkRecords(poolsPayload);
  const teamCodes = new Set(
    teamRecords
      .flatMap((team) => [team.teamcode, team.lokaleteamcode])
      .map(positiveSportlinkCode)
      .filter((value): value is string => Boolean(value))
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
      !contexts.has(poolId)
    ) {
      if (contexts.size >= boundedMaximum) {
        throw new SportlinkWorkerError(
          "SPORTLINK_POOL_LIMIT_EXCEEDED",
          "De vereniging heeft meer poules dan deze synchronisatie kan verwerken. De bestaande gegevens blijven behouden; controleer de synchronisatielimiet."
        );
      }
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
    const belongsToTenantTeam = [pool.teamcode, pool.lokaleteamcode]
      .map(positiveSportlinkCode)
      .some((teamCode) => teamCode !== null && teamCodes.has(teamCode));
    if (belongsToTenantTeam) {
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
  const teamRecords = extractSportlinkRecords(teamsPayload);
  const ownTeamIds = new Set(teamRecords.flatMap((team) =>
    [team.teamcode, team.lokaleteamcode].map(positiveSportlinkCode)
      .filter((id): id is string => id !== null)
  ));
  const teamPools = new Map<string, Set<string>>();
  const mapTeamPool = (record: Record<string, unknown>) => {
    const poolId = scalar(record.poulecode);
    if (!poolId || !contexts.has(poolId)) return;
    for (const value of [record.teamcode, record.lokaleteamcode]) {
      const teamId = positiveSportlinkCode(value);
      if (teamId && ownTeamIds.has(teamId)) {
        const poolIds = teamPools.get(teamId) ?? new Set<string>();
        poolIds.add(poolId);
        teamPools.set(teamId, poolIds);
      }
    }
  };
  for (const team of teamRecords) mapTeamPool(team);
  for (const pool of extractSportlinkRecords(poolsPayload)) mapTeamPool(pool);

  return matches.map((match) => {
    if (match.pool?.externalId) {
      const explicitContext = contexts.get(match.pool.externalId);
      if (explicitContext) return enrichSportlinkPoolMatches([match], explicitContext)[0]!;
      if (/^\d+$/.test(match.pool.externalId)) return match;
    }
    const poolIds = new Set([match.homeTeam.externalId, match.awayTeam.externalId]
      .flatMap((teamId) => teamId ? [...(teamPools.get(teamId) ?? [])] : []));
    const candidates = [...poolIds].map((poolId) => contexts.get(poolId)!)
      .filter((context) => (["period", "season", "type"] as const).every((key) => {
        const fixtureValue = match.competition?.[key];
        return !fixtureValue || context.competition?.[key] === fixtureValue;
      }));
    // A team can play in the cup and league simultaneously. Pool endpoint rows
    // supply authoritative context during deduplication when this remains ambiguous.
    const context = candidates.length === 1 ? candidates[0] : null;
    return context ? enrichSportlinkPoolMatches([match], context)[0]! : { ...match, pool: null };
  });
}

export function dedupeSportlinkMatches(matches: SportMatch[]) {
  const unique = new Map<string, SportMatch>();
  for (const match of matches) {
    const existing = unique.get(match.externalId);
    unique.set(
      match.externalId,
      existing ? mergeSportlinkMatch(existing, match) : match
    );
  }
  return [...unique.values()];
}

function mergeSportlinkMatch(existing: SportMatch, incoming: SportMatch): SportMatch {
  return {
    ...existing,
    ...incoming,
    awayTeam: {
      ...existing.awayTeam,
      ...incoming.awayTeam,
      externalId: incoming.awayTeam.externalId ?? existing.awayTeam.externalId,
      logoUrl: incoming.awayTeam.logoUrl ?? existing.awayTeam.logoUrl,
      score: incoming.awayTeam.score ?? existing.awayTeam.score
    },
    competition: mergeOptionalRecord(existing.competition, incoming.competition),
    dressingRooms: mergeOptionalFields(
      existing.dressingRooms,
      incoming.dressingRooms
    ),
    homeTeam: {
      ...existing.homeTeam,
      ...incoming.homeTeam,
      externalId: incoming.homeTeam.externalId ?? existing.homeTeam.externalId,
      logoUrl: incoming.homeTeam.logoUrl ?? existing.homeTeam.logoUrl,
      score: incoming.homeTeam.score ?? existing.homeTeam.score
    },
    isHomeMatch: existing.isHomeMatch || incoming.isHomeMatch,
    officials: incoming.officials.length ? incoming.officials : existing.officials,
    pool: mergeOptionalRecord(existing.pool, incoming.pool),
    venue: mergeOptionalFields(existing.venue, incoming.venue)
  };
}

function mergeOptionalRecord<T extends Record<string, unknown>>(
  existing: T | null,
  incoming: T | null
): T | null {
  if (!existing) return incoming;
  if (!incoming) return existing;
  return mergeOptionalFields(existing, incoming);
}

function mergeOptionalFields<T extends Record<string, unknown>>(
  existing: T,
  incoming: T
): T {
  return Object.fromEntries(
    Object.keys({ ...existing, ...incoming }).map((key) => [
      key,
      incoming[key] ?? existing[key]
    ])
  ) as T;
}

export function enrichSportlinkPoolMatches(
  matches: SportMatch[],
  context: ReturnType<typeof collectSportlinkPoolContexts>[number]
) {
  return matches.map((match): SportMatch => ({
    ...match,
    competition: match.competition && context.competition
      ? mergeOptionalRecord(context.competition, match.competition)
      : match.competition ?? context.competition,
    pool: {
      competitionExternalId:
        context.competition?.externalId ?? match.pool?.competitionExternalId ?? null,
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

function assertOperationActive(signal?: AbortSignal) {
  if (signal?.aborted) throw new SportlinkWorkerError(
    "SPORTLINK_WORKER_CANCELLED", "De worker wordt gestopt."
  );
}

/** Stops owned waiting even for an injected backend. The real SDK fetch also
 * receives the same signal; this does not promise hosted transaction rollback.
 */
async function operationWait<T>(operation: () => PromiseLike<T>, signal?: AbortSignal): Promise<T> {
  assertOperationActive(signal);
  if (!signal) return await operation();
  let abort: (() => void) | undefined;
  try {
    const cancelled = new Promise<never>((_resolve, reject) => {
      abort = () => reject(new SportlinkWorkerError("SPORTLINK_WORKER_CANCELLED", "De worker wordt gestopt."));
      signal.addEventListener("abort", abort, { once: true });
    });
    return await Promise.race([cancelled, Promise.resolve().then(() => {
      assertOperationActive(signal);
      return operation();
    })]);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
  }
}

function scalar(value: unknown) {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function positiveSportlinkCode(value: unknown) {
  const code = scalar(value);
  return code && /^\d+$/.test(code) && Number(code) > 0 ? code : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function abortableDelay(milliseconds: number, signal: AbortSignal) {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
    function finish() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    }
  });
}
