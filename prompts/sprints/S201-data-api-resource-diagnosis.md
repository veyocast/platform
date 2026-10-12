# S201 — vaste read-only context bij Data API-storing

Gebruiker vraagt exact waarom beheer traag/onbeschikbaar is en wil de volledige
oorspronkelijke reparatie/deployment. Productie heeft bevestigde historische
REST503/PGRST002; laatste quiesced runtimeprobe38309514100 meet
SQL_CONNECT_FAILED/UNKNOWN16.154s en REST_TIMEOUT10.002s zonder HTTP-respons.
Workerpauze/herstel is bewezen, herstel of een specifieke oorzaak niet.
S200-recovery is apart geteste protected code; de daadwerkelijke uitvoering
wacht op alle Source-gates. S201 verandert die recovery niet.

Nieuwe geïsoleerde branch/worktree veyocast/s201-data-api-resource-diagnosis,
/tmp/veyocast-s201-data-api-resource-diagnosis, begint op exact S200c99fe1b8.
Agent final_server_review owns ONLY scripts/probe-data-api-resources.mjs and
scripts/probe-data-api-resources.test.mjs. Root owns ONLY this prompt,
TASK_LEDGER.md, docs/deployment/s201-data-api-resource-diagnosis.md,
.github/workflows/probe-data-api-resources.yml and explicit lint/test lists in
.github/workflows/pr-gates.yml. Other agents are read-only. No schema/dependency,
lockfile, migration, app, provider, release or version changes.

Use existing exact-main scoped runtime health/known active production tenant
probe and owned SQL adapter. Only when direct SQL verifies that tenant may
one small fixed read-only query obtain current database aggregate context.
Production only; known tenant7526; no user SQL, role, table or query arguments.
Keep existing budgets; additional owned query deadline<=20s, wholeCLI<=180s.
No polling, sleep, restarts, termination, NOTIFY or data/migrationhistory writes.

Project a tightly capped/sanitized current metadata snapshot: fixed-role
activity/wait aggregates without querytext/PIDs/userdata; relation-lock and
table progress aggregates for public.player_heartbeats; fixed catalog-table
and heartbeat dead/live tuple ESTIMATES; exact known heartbeatindex presence,
valid/ready/method/columns/predicate booleans; exact migration-history version
20261012190000 present boolean. No arbitrary schema/index/role names, rows,
querytext or free errors leave SQL. Snapshot times/estimates/configuration are
context, not measured CPU/memory, per-tenant counts, historical build cause,
unique correlation of table progress to our CREATE, or recovery proof.
Permission-masked/missing/incomplete fields remain explicit UNKNOWN/UNPROVEN.

Fixed artifact fresh0600 with sanitized probe+metadata+limitations; cleanup
first and upload guarded by cleanupsuccess. Protected exact-main production
workflow uses already authorized diagnostic scope. Unit regressions must
prove scope rejection before secret/SQL access, privacy, malformed/truncated
output, independent tenant scope, exact index/history checks and owned abort.
Validate SQL against the owned local S190 PostgreSQL stack; fixtures are
synthetic/rolled back, never other local stacks or production. Do not reset
that stack or persist tenant fixtures without coordinating with root.

Plain S198 CREATE INDEX has NO IF NOT EXISTS and is already applied on staging.
Concurrent prebuilding would not transparently reconcile it. Do not rewrite
its immutable bytes/history or loosen its<=30s/<=1s budgets. This new diagnostic
exists to provide concrete next-step evidence if scoped recovery is insufficient;
it is not a speculative index build or a substitute for finishing S200/live work.
