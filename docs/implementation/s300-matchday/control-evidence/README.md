# S300 — Control-bewijs

De laatste lokale resultaten sluiten32/32 componentgevallen. Dit is een unie: de volledige run leverde31 PASS en één navigatiestilstand vóór inhoudsasserties (106,784s); het exacte ongewijzigde WDG-10-geval slaagde daarna met hetzelfde30s-budget (2,645s). De oorspronkelijke fout, tracehash en beide rapporthashes staan in `verification.json`. In de trace was de gecontroleerde200-respons na201ms geleverd, maar `page.goto` voltooide55,3s later. Dat bewijst de stilstand; hostbelasting blijft een hypothese. Geen productcode, assertions, harness of testtimeout is hiervoor aangepast.

De browser rendert de echte Wedstrijddag-componenten, Radix-controls en CSS. Alleen Next-/sessie-/actiontransport is gecontroleerd. De32 gevallen bewaken exacte wedstrijd-ID’s en botsende labels, hoofdwedstrijdacties op alle expliciet gekozen doelen, beperkte vrijwilligersrechten, actorwisseling, identieke nonce bij ontbrekend antwoord, CAS, afzonderlijke publicatiebevestiging, gewone planning, offlineblokkade, ontvangen/gerenderd/hersteld als verschillende toestanden, correcte publicatieversie, ontbrekend versiebewijs en schermlinks met de vereiste leesrechten. Alleen bekende publicatiegegevens leveren een versielabel; actierevisie blijft afzonderlijke afleverinformatie.

De fixture `tests/fixtures/s300-matchday-rpc.json` is exact de definitieve genormaliseerde uitvoer uit een teruggedraaide geïsoleerde SQL-fixture, SHA256 `1e88f5fc7b5fa04e12f1002a114531c11fa0ecd38f69b8885346fd071d878680`. Alle18 RPC-objecten zijn opnieuw strikt tegen de werkelijke DTO’s geparseerd. De preflight hoort aantoonbaar bij het opgeslagen concept op revisie1; de publicatiewerkplek op revisie2 is een latere waarneming. Drie browsergevallen gebruiken deze ongewijzigde uitvoer voor de opgeslagen publicatie, gecorreleerde preflight met afzonderlijke bevestigingsdialoog en daadwerkelijk beperkte gedelegeerde projectie. De uitgegeven actie, ACK, contenthash en publicatie-identiteit worden tevens onderling vergeleken. Een ontvangen ACK wordt daardoor geen verzonnen gerenderd frame.

Het databasebewijs is afzonderlijk verzameld door de SQL-writer:218 verse migraties,154 bestanden/5.306 assertions PASS (126s), lint/security0 fouten. Zie `docs/evidence/s300-matchday-database.json`. Deze browserharness opent zelf geen databaseverbinding en wijzigt geen tenantgegevens. De bewijsgrens blijft expliciet: dit is echte database-/RPC-uitvoer via gecontroleerde HTTP naar echte componenten; geen werkelijke Next-SSR/Auth/RLS-flow, hosted mutatie, providerwaarneming of fysieke Playeracceptatie.

| Gerichte controle | Resultaat |
| --- | --- |
| Laatste lokale componentunie | 32 PASS,0 falend,0 skip,0 niet uitgevoerd |
| Strikte RPC-objecten | 18/18 PASS |
| Browser-TypeScript / ESLint / diffcheck | PASS |
| Eigen Player Matchday-API | 57 units PASS; afzonderlijke actor/device/publicatie/ACK- en begrensde bodytests |

De vier PNG’s tonen Bedienen en Instellen op320 en1440px. Beide breedten behouden de overflow- en toegankelijkheidsasserties; alle vier beelden zijn visueel bekeken. Hun toestanden komen uit de expliciet gecontroleerde fixture en zijn geen bewijs van echte schermwaarnemingen. `source-files.json` bindt24 relevante bronnen aan deze proef en onderscheidt de gerenderde componenten van uitsluitend servercontext. Er zijn geen authstates, HAR-bestanden, credentials of ruwe providergegevens in deze submap opgenomen.
