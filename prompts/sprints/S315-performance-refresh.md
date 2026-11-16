# S315 — Gemeten performance en verversing

## Opdracht en uitvoering

De gebruiker vraagt een grondige analyse van dynamische verversing,
synchronisatie, websitegebruik en databasebelasting, gevolgd door implementatie.
Basis is main `67d8470198acec4272c47c4c7979b6071a915c4b`; één rootwriter werkt in
`veyocast/s315-performance-refresh` met een eigen worktree. S314 was uitsluitend
een begrensde operationele cacheherstelactie, geen applicatierelease.

Root bezit gerichte wijzigingen aan Control-overzicht/refreshhelpers, Worker
providerasset-/queuecode, één nieuwe forwardmigration met performance-regressies,
bijbehorende tests, analysebewijs, dit sprintprompt, plan en ledger.
Ownership wordt vóór aanvullende implementatie in dit bestand uitgebreid.
Geen dependency-/lockfilewijziging, geen wijziging van secrets, deploymentstraat,
locked assets of service worker. Geen subagents zonder nieuwe expliciete opdracht.

Na een aanvullende mobiele browsermeting is vóór extra implementatie gemeld
dat de blogintro zijn CSS-achtergrond te laat ontdekt: LCP circa 3,5 s bij
150 ms latency/1,6 Mbps/4x CPU. De website valt onder de gebruikersopdracht;
root breidt ownership gericht uit met uitsluitend de preload in
`apps/marketing/app/blog/_blog/blog-public.tsx`, de naastliggende regressietest
en `tests/e2e/marketing-s315-blog-preload.spec.ts`. Geen ontwerp-/asset- of
blogpublicatie-/cachewijziging; geen algemene footer-/prefetchherbouw.

De eerste volledige CI meldt één bestaande watchdogproef met een diagnose-
tekstverschil; Playerbron en test zijn op main hetzelfde als vóór S315.
De gebruiker autoriseert gericht herstel van
`tests/player/watchdog-recovery.spec.ts`, met behoud van retry-, zichtbare
fallback-, herstelheartbeat- en foutopruimingscontroles. Geen Playerlogica of
versoepelde gate. Native trace en herhaalde proef moeten de oorzaak onderbouwen.
Nadere tracecontrole toont daadwerkelijke extra decodefouten en een herstelde
RESTART_LOOP-heartbeat, niet slechts andere tekst. Na tien groene ongewijzigde
proeven op de bestaande mainimage autoriseert de gebruiker expliciet een
deterministische tweefoutenfixture plus afzonderlijke foutenreeksproef.
Beide gebruiken echte native decodefouten van corrupte bytes en laten precies
twee/drie itemgebonden errorcallbacks door, één per video-instance. Een tweede
defect item maakt de derde fout deterministisch zonder race met een goed frame.
Exacte actie, zichtbare fallback, herstelreceipt, volgende foutvrije heartbeat
en de zichtbare retrytekst tussen de eerste twee fouten blijven verplicht.

De productiecache toont opnieuw reserveringen voor een historische menuversie.
De private enqueuevoorwaarde behandelt een ontbrekend protocol als SQL NULL en
laat daardoor niet-ondersteunde uitvoer toe. Dezelfde forwardmigration krijgt
een fail-closed eligibilityfix met afzonderlijke lokale RED/GREEN-regressies;
geen bestaande reserveringen of private Storagebestanden worden automatisch gewist.

## Meet- en veiligheidsgrenzen

- Productiemetingen zijn read-only, begrensd en voorzien van meetvenster.
- Cumulatieve SQL-statistiek is geen actuele uurmeting; geen verzonnen versnelling.
- Geen database reset of persistente migratie op een gedeelde lokale stack.
- Index-/SQL-regressies gebruiken rollbackfixtures en een geïsoleerde testdatabase.
- Na het gemelde predecessor-harnessincident autoriseert de gebruiker uitsluitend
  lokale data-behoudende reconciliatie met huidige main. Volledige backup,
  bronhashes, schema-/historieguards en één transactie zijn vereist; geen
  kandidaatregistratie. Geen concatenatie van transactionele migraties in
  rollbackharnessen; volledige migratiereplay blijft bij de disposable CI-stack.
- Tenant/RLS/AAL2, leases, monotone revisies, immutable releases, volledige
  assetverificatie, natuurlijke wisselgrenzen en offline LKG blijven verplicht.
- Geen sneller pollen als algemene oplossing en geen globale credentialcache.
- Nieuwe caches zijn begrensd, variant-/identiteitsgebonden, foutveilig en eindig.
- Geen bulkpublicatie of wijziging van bronkoppelingen of klantplaylists.

## Acceptatie

Lever een geprioriteerde analyse met bron-/meetbewijs, bewezen verbeteringen,
request-/index-/race-/tenantregressies, relevante lint/typecheck/test/buildgates,
werkelijke uitrolstatus en expliciete resterende hardware-/productiemetingen.
