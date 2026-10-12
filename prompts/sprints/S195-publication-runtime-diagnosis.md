# S195 — publicatiequery en Sportlink-completion gericht onderzoeken

Scope: begrensde operationele diagnose voor de productie-inventarisatie die op
3dfa75ca na succesvolle tenant/schemaquery faalde, en de gewone matches-run
14:54:21–14:55:17 met SPORTLINK_SYNC_COMPLETE_INVALID_RESULT. LED blijft verbonden;
competitions slaagt. Dit stelt de onderliggende database-/netwerkoorzaak niet vast.

De proces-agent bezit uitsluitend scripts/current-publication-maintenance.mjs en
scripts/publication-database-query.*. De diagnose-agent bezit uitsluitend
scripts/probe-publication-runtime.mjs en scripts/probe-publication-runtime.test.mjs.
Root bezit .github/workflows/probe-publication-runtime.yml, .github/workflows/pr-gates.yml,
scripts/validate-vps-deployment.sh,
workflow-securityvalidator/tests indien nodig, documentatie en TASK_LEDGER.md.
Sportlink-agent bezit uitsluitend apps/media-worker/src/sportlink-sync-runner.ts
en de bijbehorende bestaande tests. Geen dependencywijzigingen, geen migraties
zonder concrete diagnose en afzonderlijke root-ownership. Andere agents reviewen read-only.

Diagnose moet trusted main, beschermde omgeving, exacte gezonde Control/Player-SHA,
project/tenantbinding, ongewijzigde TLS en pinning afdwingen. Alleen vaste read-only
queries, EXPLAIN zonder ANALYZE, technische allowlisted planstatistiek, geen SQLtekst,
filters, credentials, providerpayloads of persoonsdata in output. Owned child process
groups en begrensde output/tijd voorkomen loslopende diagnostiek. Geen ruimer timeout
om een dure query te verbergen. Statusclassificatie onderscheidt bekende proces/CLI-
en PostgREST-transportfouten van werkelijk ontbrekende responsevorm.

Gates: workspace lint/typecheck/test plus gerichte regressies/opsvalidators. Bij
gewijzigde worker relevante worker- en bestaande providercompletiontests; app/browsers,
RLS indien database daadwerkelijk wijzigt. Geen gates afzwakken; eerste failures bewaren.
Na merge exacte staging/productionpromotie, veilige readbacks en twee gewone cycli.
Immutable actieve/desired/default/offline-LKG-releases blijven beschermd. Hardware en
ontbrekende browser-IDB-blobs blijven externe beperkingen; geen fake sluiting.
