# S136 — Sportlink eigen wedstrijden en leesbare pouleslides

## Doel

Herstel de teamgebonden pouleprogramma- en pouleuitslagfeeds zodat wedstrijden
van de eigen vereniging onderdeel zijn van de providerbrede poulesnapshot.
Vergroot de primaire typografie van poulestanden en uitslagen exact 50% in de
gedeelde browser/previewrenderer en LG Legacy, met eerdere paginering waar dat
nodig is om afkapping te voorkomen.

## Ownership

- Sportlink match-syncrequest en gerichte workerregressie;
- gedeelde Editorial Arena-layout, renderer en typografietest;
- LG Legacy-renderer en routecontracttest;
- compatibel aankomstvenster met minuten-/uren-/dageninvoer, duidelijke
  validatiefouten en een 42-dagen databasegrens;
- S136-architectuur- en releasebewijs.

## Productgrenzen

- geen providerpayload, Client ID of service-role-secret naar browser/Player;
- geen mutatie van bestaande immutable releases;
- nieuwe snapshots ontstaan alleen via de bestaande sync- en publicatieketen;
- grotere tekst pagineert eerder en wordt niet terug verkleind;
- last-known-good en offline playback blijven ongewijzigd;
- LED Scores-activatie blijft een afzonderlijke AAL2- en auditgebonden
  tenantmutatie na succesvolle productiepromotie.

## Gates

Gerichte integrations/media-worker/content-templates/Playertests, workspace
lint/typecheck/test/build, verse database-reset en volledige RLS, Control
a11y/E2E, Player/offline en immutable VPS-build met staging- en
production-readback.
