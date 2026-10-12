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

Root ownership is expliciet uitgebreid na stop-and-report op de echte rode
Controlgate: alleen de shellheadingassertie voor Playlists in
tests/e2e/control-shell.spec.ts. Run38296862148/job114969918486 bewijst twee
bedoelde H1-owners (Control status en control-content); de globale query is
ambigu. Scope de eerste visibilityassertie naar Control status, behoud de
afzonderlijke contentassertie, wijzig geen applicatie-UI en verlaag geen gate.
Bewaar de oorspronkelijke fout/loghash en verifieer de correcte scope met een
echte Chromium-regressie plus de volledige nieuwe exacte CI.
De echte volledige lokale testcase passeerde daarna Playlists, maar vond dezelfde
twee owners bij Schermen (line128). Ownership omvat daarom ook uitsluitend die
shellheadingassertie in dezelfde testcase; de bestaande onafhankelijke
Schermenregion-, status-, demo- en setupcontroles blijven behouden.

Na de afzonderlijke Playerfailure in dezelfde run is root ownership ook beperkt
uitgebreid naar tests/player/watchdog-recovery.spec.ts, alleen de wachtvoorwaarde
voor het decode-recoveryrapport. Job114969918455 ontving uitsluitend eerdere
normale heartbeats bij de snapshotassertie. Poll de bestaande exacte
SKIP_ITEM/VIDEO_/invalid-video/recoveredAt-matcher binnen dezelfde5s grens;
behoud de daaropvolgende geordende heartbeat-nullclearcontrole. Geen runtime-,
offline-, dependency- of timeoutwijziging en geen retries/skip. Bewaar de fout.

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

Na stop-and-report van twee echte native browsercrashes is root ownership
uitgebreid naar uitsluitend de Playerbrowserprocesgrens in
scripts/run-browser-gates.mjs en de bestaande gatevalidatie indien nodig.
Run38299307350 faalde in attempt1/job114978030630 vóór een assertion bij
browser.newContext in connectivity; de eenmalige failed-jobrerun faalde in
attempt2/job114983883473 op dezelfde native SIGSEGV vóór een andere testcase
(welcome-arrivals-motion). Beide attempts hebben dezelfde native crashoffsets;
de specifieke C++-oorzaak is onbewezen. Bewaar beide rode attempts. De volledige
Chromium/new-headlesskandidaat faalde een bestaande lokale beeldreferentie en is
teruggenomen; playwright.config.ts blijft woordelijk gelijk. Begrens uitsluitend
het reeds bestaande Playerbatchesysteem tot één testbestand per browserproces;
alle ontdekte bestanden blijven in dezelfde volgorde precies eenmaal uitgevoerd.
Geen dependency/lock/installcommand, retry, skip, snapshot, assertie, worker- of
budgetwijziging. De eerdere lokale netwerkkandidaat PASS is geen gate-PASS.
Echte gerichte regressies en de volledige nieuwe PR-/Sourcegates moeten slagen.
