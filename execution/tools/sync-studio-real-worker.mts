import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  createSyncStudioStarter,
  updateSyncStudioDocument,
} from "../../packages/studio/src/sync";
import { SupabaseStudioRenderBackend } from "../../apps/media-worker/src/studio-render-backend";
import { ResvgSharpStudioRenderer } from "../../apps/media-worker/src/studio-render-resvg";
import { runStudioRenderOnce } from "../../apps/media-worker/src/studio-render-runner";

assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE, "1");
assert.equal(process.cwd(), "/home/codex/repos/castivo-s226");
const configFile = "/tmp/veyocast-s226-local-status.json",
  stateFile = "/tmp/veyocast-s226-qa-auth-state.json";
for (const path of [configFile, stateFile])
  assert.equal(statSync(path).mode & 0o777, 0o600);
const config = JSON.parse(readFileSync(configFile, "utf8")),
  state = JSON.parse(readFileSync(stateFile, "utf8"));
assert.equal(config.API_URL, "http://127.0.0.1:57621");
assert.equal(new URL(config.DB_URL).port, "57622");
const container = "supabase_db_veyocast-s226";
assert.equal(
  execFileSync(
    "docker",
    [
      "inspect",
      "--format",
      '{{.Name}} {{ index .Config.Labels "com.supabase.cli.project" }}',
      container,
    ],
    { encoding: "utf8" },
  ).trim(),
  "/supabase_db_veyocast-s226 veyocast-s226",
);
const sql = (query: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atc",
      query,
    ],
    { encoding: "utf8" },
  ).trim();
const checkpointFile = "/tmp/veyocast-s226-sync-worker-state.json";
type Command = {
  createKey: string;
  renderKey: string;
  retryKey?: string;
  previousFailedJobs?: string[];
  projectId?: string;
  jobId?: string;
};
if (existsSync(checkpointFile))
  assert.equal(statSync(checkpointFile).mode & 0o777, 0o600);
const checkpoint: { runId: string; commands: Record<"png" | "mp4", Command> } =
  existsSync(checkpointFile)
    ? JSON.parse(readFileSync(checkpointFile, "utf8"))
    : {
        runId: randomUUID(),
        commands: {
          png: { createKey: randomUUID(), renderKey: randomUUID() },
          mp4: { createKey: randomUUID(), renderKey: randomUUID() },
        },
      };
const saveCheckpoint = () =>
  writeFileSync(checkpointFile, JSON.stringify(checkpoint), { mode: 0o600 });
saveCheckpoint();
const pending = JSON.parse(
  sql(
    "select coalesce(json_agg(id),'[]'::json) from public.studio_render_jobs where status not in('completed','failed','cancelled')",
  ),
) as string[];
assert.ok(
  pending.every((id) =>
    Object.values(checkpoint.commands).some((command) => command.jobId === id),
  ),
  "An unrelated pending job must not be claimed",
);
const require = createRequire(`${process.cwd()}/apps/control/package.json`);
const { createServerClient } = require("@supabase/ssr"),
  cookies = new Map(
    state.cookies.map((cookie: { name: string }) => [cookie.name, cookie]),
  );
const client = createServerClient(config.API_URL, config.ANON_KEY, {
  cookies: {
    getAll: () => [...cookies.values()],
    setAll: (values: Array<{ name: string }>) =>
      values.forEach((cookie) => cookies.set(cookie.name, cookie)),
  },
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      assert.equal(url.origin, config.API_URL);
      return fetch(input, { ...init, signal: AbortSignal.timeout(15000) });
    },
  },
});
assert.equal(
  (await client.auth.getUser()).data.user?.id,
  "19170000-0000-4000-8000-000000000001",
);
assert.equal(
  (await client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,
  "aal2",
);
const playwrightRequire = createRequire(`${process.cwd()}/package.json`);
process.env.CHROMIUM_EXECUTABLE_PATH =
  playwrightRequire("@playwright/test").chromium.executablePath();
const tenant = "19170000-0000-4000-8000-000000000010",
  runId = checkpoint.runId,
  results: unknown[] = [];
for (const outputKind of ["png", "mp4"] as const) {
  let document = createSyncStudioStarter({
    family: outputKind === "png" ? "club-story" : "fixtures",
    tenantName: "S226 lokale club",
    orientation: outputKind === "png" ? "portrait" : "landscape",
    theme: outputKind === "png" ? "onzetrots-tv" : "fieldflow",
  });
  document = updateSyncStudioDocument(
    document,
    {
      ...document.syncPresentation!,
      // Keep this earlier static PNG/multipage fixture separate from the
      // selected-animation proof in sync-motion-real-worker.mts.
      style:{...document.syncPresentation!.style,motion:"geen"},
      title: "Een echte Sync-uitzending",
      body: "Eigen tekst via de geautoriseerde opslag- en renderketen.",
      ...(outputKind === "mp4"
        ? {
            rows: Array.from(
              { length: 5 },
              (_, index): [string, string, string, string] => [
                `Thuis ${index + 1}`,
                `Uit ${index + 1}`,
                "11:00",
                String(index + 1),
              ],
            ),
          }
        : {}),
    },
    outputKind === "mp4" ? 3 : 12,
  );
  const command = checkpoint.commands[outputKind];
  if (!command.projectId) {
    const created = await client
      .rpc("create_studio_project_v1", {
        p_tenant_id: tenant,
        p_name: `S226 Sync ${outputKind} ${runId}`,
        p_orientation: document.artboard.orientation,
        p_document: document,
        p_referenced_asset_ids: [],
        p_project_kind: "design",
        p_idempotency_key: command.createKey,
      })
      .retry(false);
    assert.equal(created.error, null);
    assert.equal(created.data.outcome, "created");
    command.projectId = created.data.projectId;
    saveCheckpoint();
  }
  const projectId = command.projectId;
  const draft = await client
    .from("studio_project_drafts")
    .select("draft_revision,document_json")
    .eq("tenant_id", tenant)
    .eq("project_id", projectId)
    .single();
  assert.equal(draft.error, null);
  assert.deepEqual(
    draft.data.document_json,
    JSON.parse(JSON.stringify(document)),
  );
  let queued = await client
    .rpc("request_studio_render_v1", {
      p_project_id: projectId,
      p_expected_draft_revision: draft.data.draft_revision,
      p_output_kind: outputKind,
      p_idempotency_key: command.renderKey,
    })
    .retry(false);
  assert.equal(queued.error, null);
  assert.equal(queued.data.outcome, "queued");
  command.jobId = queued.data.renderJobId;
  saveCheckpoint();
  let previous = await client
    .from("studio_render_jobs")
    .select("status,media_asset_id")
    .eq("tenant_id", tenant)
    .eq("id", command.jobId)
    .single();
  assert.equal(previous.error, null);
  if (previous.data.status === "failed") {
    assert.equal(
      command.jobId,
      "4ac25dc2-9afd-4e0b-adda-9c93478813e9",
      "Only the recorded missing-encoder fixture is eligible for this recovery",
    );
    // This known failed job exhausted its original three claims. Keep its real
    // history and issue one new render request for the same unchanged draft.
    command.previousFailedJobs = [
      ...(command.previousFailedJobs ?? []),
      command.jobId!,
    ];
    command.renderKey = randomUUID();
    saveCheckpoint();
    queued = await client
      .rpc("request_studio_render_v1", {
        p_project_id: projectId,
        p_expected_draft_revision: draft.data.draft_revision,
        p_output_kind: outputKind,
        p_idempotency_key: command.renderKey,
      })
      .retry(false);
    assert.equal(queued.error, null);
    assert.equal(queued.data.outcome, "queued");
    assert.notEqual(queued.data.renderJobId, command.jobId);
    command.jobId = queued.data.renderJobId;
    saveCheckpoint();
    previous = await client
      .from("studio_render_jobs")
      .select("status,media_asset_id")
      .eq("tenant_id", tenant)
      .eq("id", command.jobId)
      .single();
    assert.equal(previous.error, null);
  }
  const rendered =
    previous.data.status === "completed"
      ? {
          status: "completed" as const,
          jobId: command.jobId!,
          mediaAssetId: previous.data.media_asset_id,
        }
      : await runStudioRenderOnce({
          backend: new SupabaseStudioRenderBackend(
            config.API_URL,
            config.SERVICE_ROLE_KEY,
          ),
          renderer: new ResvgSharpStudioRenderer(),
          config: {
            workerId: `s226-sync-${outputKind}-proof`,
            lockTimeoutSeconds: 900,
            maxAttempts: 3,
          },
        });
  assert.equal(rendered.status, "completed");
  if (rendered.status !== "completed") throw Error("Render did not complete");
  assert.equal(rendered.jobId, queued.data.renderJobId);
  const job = await client
    .from("studio_render_jobs")
    .select("id,status,progress,media_asset_id,project_id")
    .eq("tenant_id", tenant)
    .eq("id", rendered.jobId)
    .single();
  assert.equal(job.error, null);
  assert.equal(job.data.status, "completed");
  assert.equal(job.data.project_id, projectId);
  const media = await client
    .from("media_assets")
    .select("id,kind,status,width,height,checksum_sha256,duration_seconds")
    .eq("tenant_id", tenant)
    .eq("id", rendered.mediaAssetId)
    .single();
  assert.equal(media.error, null);
  assert.equal(media.data.status, "ready");
  assert.equal(media.data.kind, outputKind === "png" ? "image" : "video");
  assert.equal(media.data.width, document.artboard.width);
  assert.equal(media.data.height, document.artboard.height);
  const variants = await client
    .from("media_variants")
    .select(
      "variant_type,storage_path,checksum_sha256,mime_type,file_size_bytes",
    )
    .eq("tenant_id", tenant)
    .eq("asset_id", rendered.mediaAssetId);
  assert.equal(variants.error, null);
  const original = variants.data.find(
    (variant: { variant_type: string }) =>
      variant.variant_type ===
      (outputKind === "png" ? "original" : "player_1080p"),
  );
  assert.ok(original);
  const admin = createServerClient(config.API_URL, config.SERVICE_ROLE_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
  const downloaded = await admin.storage
    .from("tenant-media")
    .download(original.storage_path);
  assert.equal(downloaded.error, null);
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    original.checksum_sha256,
  );
  assert.equal(bytes.length, original.file_size_bytes);
  assert.equal(
    sql(
      `select count(*) from public.playlist_releases where tenant_id='${tenant}'`,
    ),
    "0",
  );
  results.push({
    outputKind,
    projectId,
    job: job.data,
    media: media.data,
    previousFailedJobs: command.previousFailedJobs ?? [],
    documentDurationMs: document.motion.durationMs,
    documentPages: outputKind === "mp4" ? 2 : 1,
    outputSha256: original.checksum_sha256,
    bytes: bytes.length,
  });
  process.stdout.write(
    JSON.stringify({
      outputKind,
      status: "PASS",
      projectId,
      jobId: rendered.jobId,
      bytes: bytes.length,
    }) + "\n",
  );
}
writeFileSync(
  "execution/evidence/sync-studio-real-worker.json",
  JSON.stringify(
    {
      status: "PASS",
      capturedAt: new Date().toISOString(),
      transport:
        "actual AAL2 PostgREST, unchanged project/render commands, real Chromium/FFmpeg worker and private Storage bytes",
      environment: "disposable S226 local Supabase",
      results,
      unintendedReleases: 0,
      limits:
        "No new Source editor UI, live provider projection, Player publication or hosted deployment claim.",
    },
    null,
    2,
  ) + "\n",
);
