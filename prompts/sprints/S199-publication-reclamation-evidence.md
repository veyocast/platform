# S199 — daadwerkelijk opruimbewijs uit bestaande auditregistratie

Concrete gap na S198-index/workerfix: bestaande finalcomparer accepteert nuldelta
als NO_NET_INCREASE, releaseRowExistenceAndHashesVerified=false. User verlangt
feitelijk oudeversiesopruimen met actieve/offlineimmutablebescherming. De bestaande
transactionele publication.superseded_versions.pruned audit registreert alle
deleted IDs/hash, maar geen huidige opsprobe projecteert die.

Root owns thisprompt, TASK_LEDGER.md, docs/deployment/s199-publication-reclamation-evidence.md,
scripts/current-publication-maintenance.mjs, its new integration test,
.github/workflows/current-publication-maintenance.yml, scripts/validate-vps-deployment.sh,
PRgatelist ifrequired. Add ONLY explicit read-only reclamation mode/evidence_since
input to existing protectedmainworkflow; modes inventory/refresh/cutover retain
all gates/assertions/cooldowns. No new deletion/enqueue/schema/policy/timeouts.
No retry or success conversion. Existing fixedSQL client ownedabort/deadline and
health exact deployedSHA retain. Store only sanitized publication-reclamation.json.

Evidenceagent owns ONLY scripts/publication-reclamation-evidence.mjs and
scripts/publication-reclamation-evidence.test.mjs. Fixed parameterized/scoped
read-only SQL, strict sanitization and meaningful caps/privacy regressions.
Project bounded exact counts, all canonical protected releaseIDs/manifest/item
hashes via existing private.publication_release_is_referenced_v1, committed
existing pruneaudits and independent eliminatedID absence checks for releases,
slideversions/snapshots. Exact cap/truncation must remain UNPROVEN, not PASS;
no raw manifests/items/user/providerdata/querytext/secret or unowned SQL. Expose
no arbitrary statement/function/key. Do not claim transaction-timestamps prove
all commit ordering or no transient create/delete; report interpretationlimits.
No files outside ownership, no dependencies/lockfile/generatedtypes/migrations.
Read required canons in userorder; original fulltaskcanons already remain binding.

Worktree /tmp/veyocast-s199-publication-reclamation-evidence branch
veyocast/s199-publication-reclamation-evidence basedeff2466e S198. De S199-PR
mag tegen de S198-branch worden voorbereid zodat de onafhankelijke volledige CI
parallel draait. Na de exact groene S198-merge zet root uitsluitend de PR-base
op main en verifieert de uiteindelijke mergeboom tegen de geteste boom;
geen inhoudelijke historyrewrite, force/amend/rebase. Local
realPG proof root-owned isolated s190 stack can use owned rollbackfixtures only,
no othertenant/player/indexmutation. All rootrun gates and full exactPR/SitesCI,
staging/production + two ordinarycycles remain required; no completedtaskclaim
from metadata alone.

Root additionally owns only the fixed phase allowlist in
scripts/publication-database-query.mjs; its existing query/process/privacy budget
tests remain unchanged. The explicit reclamation_evidence phase is necessary
for the new fixed read; no arbitrary phase, SQL, timeout or metadata expansion.
