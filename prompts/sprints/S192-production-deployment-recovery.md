# S192 — Herstel van de beschermde productiondeploy

Rond de geautoriseerde S191 staging/production-uitrol af. S191 is gemerged en
staging is gezond, maar productiondeploy 38200372232 faalde vóór migraties op
de eerste normale databaseverbinding. Een verse read-only inventarisatie
38201079451 faalt eveneens met PUBLICATION_DATABASE_CONNECT_FAILED.

Root bezit uitsluitend `scripts/deploy-vps.sh`, `scripts/migrate-supabase.sh`,
`scripts/validate-vps-deployment.sh`, dit sprintpromptbestand,
`docs/deployment/s192-production-deployment-recovery.md` en `TASK_LEDGER.md`.
De transportagent bezit `scripts/probe-database-transport.mjs` en zijn
`.test.mjs`; de lifecycleagent bezit `scripts/test-deployment-lifecycle.test.mjs`.
Geen dependency-, lockfile-, database-, source-, UI- of Playerwijzigingen.

Valideer eerst de vorige worker tegen omgeving, release-SHA, Compose-labels en
immutable image-ID. Stop uitsluitend die draaiende worker tijdelijk vóór de
normale migratiecontrole. Arm herstel vóór stop; herstel bij ERR, EXIT, INT en
TERM. Herstel vóór runtime-mutation exact dezelfde container; gebruik daarna
de bestaande applicatierollback. Bewaar de vorige configuratie wanneer herstel
faalt. Bewaar en herstel alle vier runtimebestanden ook bij gedeeltelijke
statuscommit; verdere INT/TERM mogen lopend herstel niet afbreken. Healthchecks
moeten fouten expliciet doorgeven, ook wanneer Bash-errexit
door een conditionele functieaanroep uitgeschakeld is.

Begrensde transportdiagnostiek mag DNS/TCP/PostgreSQL-SSLRequest/TLS controleren,
maar nooit authenticeren of credentials, hostnamen, IP-adressen, certificaten,
DSN's of rauwe errors tonen. De normale CLI/TLS/migration-history-grenzen blijven
ongewijzigd; geen downgrade of alternatieve migratieclient.

Gates: gedragsmatige fout-/signaal-/healthmatrix-/secret-redactiontests,
shellsyntax en bestaande VPS/workflowvalidators; workspace lint/typecheck/test,
groene PR-gates. Daarna dezelfde nieuwe main-SHA eerst staging en beschermd
production. Verifieer vervolgens de echte LED/Sportlink-databaseverversing en
behoud van configuratie-/playlist-/release-identiteit volgens S191. SIGKILL,
hostuitval en fysieke schermacceptatie blijven expliciete grenzen, geen claims.
