# S310 — Snellere Player-CI met volledige oorspronkelijke dekking

De gebruiker heeft op 11 november 2026 de Player-jobgrens van 105 naar 135
minuten toegestaan, maar vraagt nadrukkelijk de oorzaak te onderzoeken en de
werkelijke wachttijd drastisch te verminderen. De lopende S309-uitrol wordt
niet onderbroken. Werk in een afzonderlijke branch/worktree/PR vanaf main
`5fc6c6e8774f529bc2514df4c8b4d09d683bf528`.

Ownership: root bezit uitsluitend `.github/workflows/pr-gates.yml`, de bestaande
browsergaterunner en regressies, een nieuwe Player-closureverifier, dit prompt,
eigen documentatie, `docs/ci.md`, plan en ledger. Geen applicatiecode,
deployworkflows, dependencies, lockfile, secrets, omgevingen of databasewijzigingen.

Verdeel de volledige dynamisch ontdekte oorspronkelijke Player-inventory over
vier onafhankelijke CI-jobs. Behoud per oorspronkelijke case een eigen verse
Playwright-CLI, Next-server en browser, dezelfde gepinde CLI/binary, workers,
assertions, hooks, screenshots, opt-inregels, bestaande skips en deadlines.
Geen crashretry, batching van cases of vermindering van dekking.

Behoud de vereiste checknaam `Browser gates (player)` als fail-closed eindgate.
Bewijs dezelfde bron-SHA, workflowrun/poging, CLI en volledige inventory in alle
vier closures, en iedere oorspronkelijke case precies eenmaal op haar eigen
shard. Ontbrekende, dubbele, gedeeltelijke, mislukte of gemengde bewijzen falen.
Overige browsergroepen en bestaande deployment-/releaseguards blijven gelijk.

Test de echte CLI-isolatie met oorspronkelijke browsercases, alle closure- en
foutpaden met gerichte regressies, plus bestaande inventory/toolchain/concurrency-
en workflowvalidators. Normale volledige hosted gates blijven vereist vóór
merge. Vergelijk de daadwerkelijk gemeten hostedlooptijd met de groene S309-
nulmeting; een theoretische versnelling is geen meetresultaat.
