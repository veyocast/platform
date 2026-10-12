# S200 — herstel van bevestigde Data API-schemacachefout

Incident: gebruiker meldt alle beheerpagina's niet beschikbaar. Productieprobe
38305524954 op main718/gezonde runtime18e bevestigt SQL_READY10.688s en
REST5032.733s. Onafhankelijke publieke anon/RLS-read van alleen het bekende
tenant-ID bevestigt503/PGRST002 op20:41:39.849UTC. Healthroutes bewijzen geen
Data API-beschikbaarheid. De specifieke oorzaak van het cachefalen is onbewezen.
S198-productiemigratie38304265769 faalde op indexstatement_timeout57014;
de oude applicatie/worker werden20:31:31 opnieuw gezond geactiveerd.

Root owns ONLY this prompt, TASK_LEDGER.md,
docs/deployment/s200-data-api-schema-cache-recovery.md,
scripts/recover-postgrest-schema-cache.mjs and its tests,
scripts/probe-runtime-database.mjs and its existing tests (fixed safe-code
allowlist only), .github/workflows/recover-data-api.yml,
and the explicit script lint/test lists in .github/workflows/pr-gates.yml.
No agents edit those high-conflict paths. All reviewers are read-only.

Use existing scoped main-only runtime-probe and owned SQL adapter. Recovery
requires exact public runtime health, active known tenant SQL verification and
HTTP503/PGRST002. Then send ONE fixed, tenant-guarded NOTIFY pgrst/reload schema,
with owned cancellation/deadline and strict result validation. A fresh fixed
SQL+REST probe must independently pass; notification delivery alone is not
recovery. Already-ready returns without a notification. Other errors/unknowns
fail closed. Retain sanitized before/action/after evidence in a fresh0600 artifact.
Protected production workflow uses exact current trusted main, clear stale
readbacks before setup, retain failure evidence without converting it to PASS.

No schema/role/timeout/grant/RLS/history/index/data/release/slide/version changes,
no restart, deletion, arbitrary SQL or browser/provider import. No credential
values/messages/query text in report. Existing pending migration stays immutable.
The notification is the documented narrow recovery action, not proof of the
underlying cache failure's cause. Real current API and authenticated availability
remain separate acceptance requirements. New task uses isolated worktree
/tmp/veyocast-s200-data-api-schema-cache-recovery and branch
veyocast/s200-data-api-schema-cache-recovery, stacked on exact S199 e0c6bcaa;
normal commits/push, no rebase/amend/force, retarget base after S199 merge.

Required unit/privacy/scope/cancellation regressions and workspace gates must
pass before commit/push. Full exact CI remains required; protected recovery is
authorized by the user's full repair/deploy request and active outage report.
