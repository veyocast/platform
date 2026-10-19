# S258 — Deterministische LED-reconnectfixture

De bestaande Playercase `verbindt opnieuw wanneer LED Scores bij Player-start nog niet is vrijgegeven` bevat twee echte doelpunten, een eerste204-response en een eerste rendered-ACK die503 geeft en opnieuw moet worden bezorgd. Het eerste doelpunt was gepland op `now+1500ms`, het tweede op `now+250ms`. De behouden FIFO-queue speelt het eerste doelpunt2000ms af voordat het tweede aan de beurt komt.

De originele CI op `1e3706667dfc82692439d42442bd0770a8415bc2`, run39239213825/job118015662378, faalt in case114 op de bestaande5000ms-tekstassert bij `tests/player/ledscores-goal-alert.spec.ts:179`. Beide berichten komen uit dezelfde test; er is geen bewijs van een crosscase-cachelek of productdefect. De ongewijzigde bron en oorspronkelijke CI zijn het rode bewijs.

De oorspronkelijke trace laat dit zien (monotone milliseconden):

| Gebeurtenis | Tijd |
|---|---:|
|5000ms-assert start|3465.757|
|Eerste realtime204|3872.492|
|Tweede realtime200|4885.316|
|Beide doelpunten ontvangen|4891.954 /4892.410|
|Eerste rendered-ACK,503|6410.373|
|Dezelfde ACK opnieuw,200|7417.059|
|Laatste foutieve locatorpoll, nog eerste doelpunt|8371.806|
|Tweede rendered-ACK,200|8396.783|
|Assert eindigt met fout|8472.863|
|DOM-snapshot bevat tweede verwachte tekst|8474.696|

Het tweede doelpunt rapporteert `render_latency_ms:3252`. De trace toont normale FIFO-afhandeling met een zeer smal observatievenster in deze fixture. `docs/integrations/goal-overlay-2.md` legt FIFO/max20 en niet-preëmptie vast. De serverbootstrap/catchup sorteert `executeAt` oplopend (`orderLedScoresPendingDeliveries`); de aparte drie-Player-skewcase blijft bestaan.

S258 wijzigt uitsluitend de twee offsetwaarden naar oplopend250/500ms, met één korte contextcomment. De case toetst daarmee dezelfde reconnect, twee echte queued events en duurzame ACK-retry in normale servervolgorde. Duur2000ms, expiry4000ms, alle IDs/payloads,204/401/503-responses, requesttellingen, ACK-asserties, alle deadlines en alle drie bestaande cases blijven behouden. Productcode, queuebeleid, klok, dependencies, lockfile en configuratie wijzigen niet.

Ruwe bewijzen blijven buiten Git bewaard:

- `/dev/shm/veyocast-s244-integration/ci-player-failure-1e370666-26d0f97f-e12a-4603-b104-2a084f84b485/failed-job.log`, SHA256 `40d7500869161d17461cb0548c686157fcaf526e9f5196b63de871799df42090`.
- `/dev/shm/veyocast-player-ci-case114-20261019T114134Z-cc2afdfc/trace.zip`, SHA256 `b44bea0c36f9c518cf63fecbd813b1ed09ea8021ebc7f27905d044e1f6831606`. Alleen deze case en errorcontext zijn via begrensde ZIP-ranges opgehaald; geen hele artifactdownload, viewer of rerun.
- `analysis.json` in dezelfde map, SHA256 `bcc4b6a538ff59f2a274e58b612aad9f3f2ece6d8518b0b7436cf4d058b2a495`.

De bestaande gerichte case is lokaal gesloten: **1/1 PASS in8,0s**, testcase7,0s, één worker,0skip/0retry. ScopedESLint eindigt0. Alle oorspronkelijke assertions van deze case zijn uitgevoerd, inclusief de twee echte doelpunten, renderedACK voor beide en minimaal twee afleverpogingen voor de eerste503-ACK. De andere twee oorspronkelijke cases zijn lokaal niet uitgevoerd en worden niet alsPASS geclaimd.

De uitvoering gebruikte normale Next15.5.20 `dev` met de bestaande Playwrightconfig/Chromium1228 op een RAM-workspacemirror van de onveranderde echte Playerbron, geen gekopieerde UI. Alle363Playerfilehashes/modes/sizes en42 gepinde dependency-/configinputs zijn voor/na gelijk; canonicalroot bleef exact1e37clean. Er is geen Supabase-/DB-/providercredential geïnjecteerd en alle bestaande deviceendpointmocks blijven behouden. Er is geen install of Playerproductionbuild uitgevoerd; canonical`apps/player/.next` bleef afwezig.

De eerste lokale poging eindigde vóór testdiscovery met0casesNOT_RUN: de extra readinesscontrole wees de normale lege demovideo-URL met lokale poster af. Het volledige foutbewijs blijft behouden; uitsluitend die RAM-readinesscontrole is gecorrigeerd. De testcase, asserts en deadlines wijzigden daarbij niet. V3-runner64217 eindigde daadwerkelijk0; NextPlayer en alle andere childprocessen eindigden0, zonder forcedkill/onbevestigde groep. Eigen link verwijderd, verseChrome[] en beide poorten zonderlistener (connect111; de tijdelijkeTCP_TIME_WAIT op3412 blijft als socketmetadata benoemd).

Finale lokale bewijzen:

- `/dev/shm/veyocast-s258-preparation-20261019T115010Z-78a00dbc/actual-one-case-final-proof.json`, SHA256`f7afc8fd27a3f29cffa1cb9d6b892d69c20ab2f58ebd736519edb8af83f75a17`.
- V3 rawclosure `/dev/shm/veyocast-s258-runtime-preparation-20261019T120320Z-c2d7f0da-v3/run-5192fb1d-a0e9-4cc1-890c-757619403b0f/closed.json`, SHA256`a4449be0e56cab5e64d899c9b0a654b79042585f62466d2a167c12cd9ce045f0`; dezelfde map bevat de ruwe caselogSHA256`3b75e06896b626096b6fe4641a4c21da0b2f20134b6dda3e3d45fad8dfb252ad`.
- De0case-readinessfailure is afzonderlijk behouden alsV2closedSHA256`135cbc7030abfe85ad5c6a51873e4b5a3d74cb8861066efb8a11fd11524613ba`.

StrictspecTSC/volledige foundation zijn niet op deze minimale sparseworkspace uitgevoerd en worden niet alsPASS geclaimd. De volledige gecombineerde rootgates, nieuwe exacte-headCI, daadwerkelijke captureacceptatie, vijf onafhankelijke reviewronden en staging/productie blijven rootowned open. Deze testcorrectie sluit de negen historische Controlhydrationfouten niet. Root heeft de exacte testdiff, documentatie en daadwerkelijke lokale closure gereviewd en gewone commit/push/eigen draftPR naar de S244-integratiebranch goedgekeurd. Integratie en exacte-headCI blijven afzonderlijke rootstappen.
