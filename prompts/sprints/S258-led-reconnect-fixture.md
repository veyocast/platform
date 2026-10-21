# S258 — LED-reconnectfixture in normale FIFO-volgorde

Root autoriseert een aparte branch `veyocast/s258-led-reconnect-fixture` en sparseworktree `/home/codex/repos/castivo-s258` vanaf exact `1e3706667dfc82692439d42442bd0770a8415bc2`. Lees de verplichte bestaande canons en het S175 FIFO-/S141executeAt-contract. Bestaande proofbytes, andere branches en worktrees behouden.

## Ownership

Uitsluitend `tests/player/ledscores-goal-alert.spec.ts`, bestaande case op oorspronkelijke104: twee executeAt-offsets1500/250ms naar oplopend250/500ms. Eén korte comment over FIFO en scenariofocus toegestaan. Daarnaast eigen `docs/s258-led-reconnect-fixture.md`, deze prompt en uitsluitend eigen S258-ledgerregel. Alle andere specbytes en alle duur/expiry/IDs/requests/payloads/ACKs/asserts/deadlines/toleranties/caseaantallen blijven gelijk. Geen product-, dependency-, lock-, config- of workflowwijziging.

## Bewijs en uitvoering

Bewaar CI1e37 run39239213825/job118015662378, oorspronkelijke faalcase114, volledige logSHA40d75008 en specifieke traceb44bea0c buitenGit. Beide doelpunten komen uit dezelfde case. Geen crosscase-cache- of productdefectclaim. De bestaande FIFO/max20/niet-preëmptie blijft; servercatchup sorteertexecuteAt. De bestaande5000ms-assert blijft.

Maak vóór sparsecheckout een resourcebewijs: beperkte tekstset, meld kosten>5MiB vooraf, hostreserve≥100MiB. Geen nieuwe install. Tijdelijke rootcanonicaldependency-/typealiases uitsluitend guarded eigen lokale testinfrastructuur met provenance en exacte cleanup. Geen browser/runtime/build zolang Gallery exclusievequeue bezit. Bereid de bestaande ongewijzigde reconnect/ACKretrycase voor tegen een normale bestaande gebundelde/devPlayer; uitvoering pas na root-GO,1worker/0retry. Scoped lint/typecheck en reverse-invarianten moeten de test-onlygrens bewijzen. Geen volledige sparseworkspacefoundation alsPASSclaim. Volledige gecombineerde foundation/exact-head CI blijven vereist.

Commit/push/eigen draftPR pas na rootreview en gerichte groene checks. Geen mainmerge/deploy. Alle oude fouten en nogopen finale Controlcapture-/releasegrenzen blijven expliciet.

Root gaf na bewezen Galleryclosure exclusieve uitvoering-GO. Dezelfde ene bestaande case en scopedESLint zijn daadwerkelijk groen gesloten (runner64217exit0,1PASS8,0s/0skip-retry;Player0/Chrome[]/ownlinkweg). Eerste0case-readinessfailure blijft apart, alleen RAMguard gecorrigeerd. Alle testcasebytes buiten de twee offsets/comment en alle productbytes blijven gelijk. Root heeft documentatie, de exacte testdiff en daadwerkelijke closure gereviewd en gewone commit/push/eigen draftPR naar de S244-integratiebranch goedgekeurd. Volledige gecombineerde gates/exacte-headCI en releaseacceptatie blijven open.
