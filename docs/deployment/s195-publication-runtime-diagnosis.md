# S195: productiequery en completiondiagnose

S194 is op staging en productie uitgerold als 3dfa75ca. De eerste live workerprobe
bevestigt gezonde LED-verbinding en succesvolle Sportlink-data/projecties. De volgende
gewone matches-run faalde met een algemene completioncode; de aparte inventarisatie
faalde ná tenant- en schemaquery. De exacte oorzaak is nog niet vastgesteld.

S195 bewaart procesfase en uitsluitend allowlisted foutcategorieën en introduceert
begrensde, vaste read-only plan/statistiekdiagnose. Het wijzigen van foutclassificatie
bewijst geen herstel van de onderliggende oorzaak. De eerdere failures blijven bij
PR219 geregistreerd. Actuele uitrol- en nacontrolebewijzen volgen aan de nieuwe PR.

De bestaande get_live_integration_diagnostics_v1 sanitiseert nieuwe completioncodes
voorlopig als UNKNOWN_ERROR. Dit is een beperking van de oude formatter, geen
gewijzigde runstatus. De nieuwe scoped operationele probe leest de opgeslagen
laatste completioncode rechtstreeks en sanitiseert die met dezelfde JS-allowlist.
Productiediagnose gebruikt daarom die probe naast de algemene readback.

Lokale gates: workspace lint/typecheck/test elk30/30, respectievelijk29/29/28
cachedtaken. Worker256PASS met250 bestaande opt-inskips; gerichte completiontests61PASS.
Opsregressies:84 bestaande tests plus13 proces- en23 probe-tests; runnerpolicy8PASS.
De gepinde Actionlint/ShellCheck valideert beide gewijzigde workflows; gerichte
scriptlint, syntax en diffcheck zijn groen. De finale securityreview vond aanvullend
dat SIGINT/SIGTERM de detached diagnosegroep nog konden achterlaten; dit is
vóór commit gecorrigeerd. Echte CLI-tests annuleren tijdens metadata en EXPLAIN,
stoppen de wrapper en descendant en behouden exit130/143. Alle23 probe-tests slagen. Geen diagnoseclaim
vervangt de vereiste gewone cycli en productie-opruimingscontrole.
