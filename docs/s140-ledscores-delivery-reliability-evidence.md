# S140 — LED Scores Playerbetrouwbaarheid en afleverbewijs

## Productieoorzaak

De laatste synthetische productieproef maakte vier unieke schermdeliveries.
De Android-telefoon bevestigde ontvangst en rendering; drie kantineschermen
bleven `pending`, ondanks recente heartbeat op twee daarvan. Database, worker,
Control, Player-health en de directe databaseverbinding waren tijdens het
onderzoek gezond.

De moderne Player beëindigde zijn realtime-effect definitief na HTTP 204. Dat
antwoord is normaal zolang `ledscores_realtime` nog niet effectief is. Een
Player die vóór tenantvrijgave al open stond, probeerde daardoor na activatie
niet opnieuw te verbinden. De telefoon was na vrijgave gestart en ontving het
event wel. De statische LG Legacy-route had daarnaast geen realtimeclient of
Goal Alert-overlay.

## Herstelcontract

- een feature-204 is een tijdelijke toestand met begrensde back-off;
- abort, unmount en ongeldig devicecredential stoppen veilig;
- modern en Legacy gebruiken dezelfde device-geauthenticeerde server-SSE en
  dezelfde acknowledgementroute;
- Legacy verwerkt de stream met Chromium 79-compatibele XHR en plain ES5;
- verlopen en dubbele events worden overgeslagen en bevestigd;
- de overlay laat de bestaande last-known-good release in de DOM staan;
- Control toont per goal/test en scherm de echte uitkomst en noemt een recente
  heartbeat niet ten onrechte een realtimeverbinding;
- de live-test maakt deliveries alleen `klaar`; Players bepalen via hun receipt
  of de alert ontvangen, getoond, overgeslagen of mislukt is.

## Nulmeting

Vóór de implementatie waren de actuele `main`-gates groen:

- Player: 45 testbestanden, 182 tests;
- Control: 49 testbestanden, 264 tests.

## Verificatie en release

De lokale pre-releaseverificatie bewijst:

- workspace lint, typecheck en unit: telkens 30/30 Turbotaken groen;
- workspace production build: 18/18 Turbotaken groen, inclusief Control-
  authgrens, client-secretgrens en Player-webOS6-guard;
- Control: 51 testbestanden en 272 tests groen;
- Player: 45 testbestanden en 191 tests groen;
- de gerichte Legacy-browserproef toont de alert boven dezelfde LKG-afbeelding,
  gebruikt bearer-auth en verstuurt een eerst met HTTP 503 geweigerde terminale
  acknowledgement daarna alsnog succesvol;
- toegankelijkheid en responsive gedrag: 36 Playwrightscenario's groen en één
  conditionele live-fixtureskip;
- brede Chromium-E2E: 182 scenario's groen en 21 bewuste conditionele live- of
  evidence-skips;
- afzonderlijke Player-browsergate: 109/109 groen;
- afzonderlijke last-known-good/offlinegate: 7/7 groen;
- een aparte review vond geen P0/P1. Het ene P2-geval — succesvolle paginering
  van een volle outbox telde ten onrechte mee als retry — is hersteld en bewijst
  nu dat 200 van 200 receipts zonder back-off worden geleegd.

De immutable release-SHA, image-identiteiten, staging-/productiehealth en
hosted readback worden door de VPS-releasemanifesten en de eindrapportage van
de daadwerkelijke promotie vastgelegd.

## Rollback

De operationele feature-rollback blijft de geauditeerde tenantactie. Een
applicatierollback gebruikt uitsluitend de vorige immutable VPS-release; er is
geen database-downmigratie nodig. In beide gevallen blijft last-known-good
playback actief en blijven deliveryreceipts als auditbewijs bestaan.
