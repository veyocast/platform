# S299 — Volledige sponsorrapportage

De sponsorrapportage berekent totalen over alle bewaarde, geaccepteerde events.
De laatste 50 detailregels vormen alleen de eerste pagina. Dashboard en CSV
gebruiken dezelfde campagne, schermselectie, lokale halfopen periode en
ontvangstpeildatum. Basis: `da3d1242c92beedee3e8d8d8d2c8d35404ab4ae6`.

De oude Hub haalde maximaal 5.000 events uit de laatste 30 dagen op en telde die
array in de pagina. Daardoor was een groter totaal niet te onderscheiden van de
limiet. De nieuwe geautoriseerde RPC retourneert één rapportobject met volledige
SQL-totalen en groeperingen, plus afzonderlijk gepagineerde details. Een fout
wordt geen nulrapport of gedeeltelijke telling.

## Betekenis en grenzen

- Een afspeelbeurt is een door de bestaande device-ingest geaccepteerd event.
  `played_ms` is gevalideerde, gemelde speeltijd; geen bewijs van een volledig
  bekeken uiting, publiek of bereik. UUID-deduplicatie en ingest blijven intact.
- Gebeurtenistijd bepaalt de periode: `[lokale van-datum, lokale tot-datum)` in
  de tenanttijdzone. Beide middernachten worden apart omgerekend; een dag kan
  23 of 25 uur hebben. De standaardselectie beslaat 30 lokale kalenderdagen.
- `received_at <= asOf` houdt detailpaginering en export op dezelfde ontvangstcut.
  Een later ontvangen offline event telt bij een nieuwe peildatum mee op zijn
  oorspronkelijke afspeeldatum. De maximaal 30 dagen late toelating van de
  bestaande ingest is **geen bewaartermijn**. Er is geen automatische
  eventretentie toegevoegd.
- De totalen omvatten alle beschikbare geaccepteerde events binnen de filters.
  Ontvangstvolledigheid is niet aangetoond: de UI zegt altijd “Volledigheid niet
  bevestigd”, of “Onvolledige registratie” bij een geregistreerd registratie- of
  retentiegat. Eerste/laatste bewaarde gebeurtenistijd bewijzen geen aaneengesloten
  dekking. Bekende gaten zijn private operationele metadata, geen door de client
  aangeleverde claim.
- Campagne- en schermnamen zijn de huidige namen; details tonen de historische
  immutable planversie. De ontvangstcut maakt gewijzigde namen of afspraken niet
  historisch reproduceerbaar. Verwijderde schermen behouden hun eventhistorie en
  krijgen een herkenbaar label. Historische schermgroepen zijn niet geregistreerd
  en worden niet uit huidige lidmaatschappen afgeleid.
- QR-scans zijn “Niet beschikbaar”: er bestaat geen gemeten bron in deze keten.
  Een expliciete afspraak bevat uitsluitend campagne, exacte periode/tijdzone en
  een afgesproken aantal voor **alle schermen**. Zonder invoer bestaat geen doel;
  rotatiegewicht of schermplaatsing levert geen impliciet doel op.

## Rechten en export

Lezen en export vereisen beide `tenant.sponsor.read` en `tenant.sponsor.report`.
Een afspraak wijzigen vereist `tenant.sponsor.write` en een actieve tenant.
De nieuwe RPC valideert actor, tenant, campagne, scherm, eindige periode,
ontvangstcut en gekoppelde cursor. SQL, dashboard en API hanteren dezelfde
toegangsgrens; bestaande event-RLS is ongewijzigd. De nieuwe goaltabel heeft
tenantbewuste foreign keys, FORCE RLS en geen directe menselijke schrijfrechten.

CSV bevat alle campagne/schermgroeperingen, volledige totalen, afspraken en
meetdefinitie voor dezelfde filters en peildatum. De 50 detailregels beperken
de export niet. Tekstvelden krijgen RFC4180-quoting en spreadsheetformules worden
geneutraliseerd, ook na voorloopspaties of controltekens. De download is
`private, no-store`, bevat geen raw device-identiteiten, tokens of eventcontext,
en gebruikt de ingelogde gebruikersclient.

## Gewijzigde keten

`record_sponsor_play_events_v1` (ongewijzigd) → `sponsor_play_events` →
`get_sponsor_report_v1` → strikt `SponsorReport`-contract → rapporttab en CSV.
De optionele writer is `set_sponsor_report_goal_v1`; deze auditeert de wijziging
en verandert geen campagne, rotatie, plan, publicatie of Player.

De additieve migratie is
`supabase/migrations/20261109113947_s299_sponsor_report_totals.sql`, SHA256
`580fd11200ff9429c231fe07ed5661a9b86ed9adfff4992162b7a7b7624ae487`.
Rapportfilters/formatter/CSV, RPC-loader en view staan naast de bestaande
sponsorroute; de download heeft een eigen GET-route onder
`apps/control/app/api/sponsors/report/export/`.

## Acceptatiebewijs

| Eis | Werkelijk bewijs | Grens |
| --- | --- | --- |
| SPN-01: volledige totalen boven limiet | SQL-test laat de ongewijzigde device-RPC 5.501 events accepteren: 5.501 beurten, 5.509.251 ms; campagne 2.751, scherm 1.833, intersectie 917. Alle groeperingen tellen op tot hetzelfde totaal. | Gegenereerde lokale tenantdata, geen klanttelemetrie. |
| SPN-02: tijd, historie en late events | UUID-herhaling, ongeldige duur, te oud event, vaste ontvangstcut, latere ontvangst, verwijderde schermen, halfopen middernacht en 23/25-uursdag zijn SQL-asserties. | Geen bewijs dat alle fysieke devices alle events hebben afgeleverd. |
| SPN-03: eerlijke afspraken en meetdefinities | Geen doel blijft afwezig; expliciet doel 6.000 blijft van totalen/rotatie gescheiden en expliciet voor alle schermen; QR en complete plays blijven null. UI/CSV noemen hun meetgrens. | Geen QR-bron, historische groepsregistratie of historisch snapshot van veranderlijke labels/afspraken. |
| SPN-04 / INT-10: veilige tenantgrens | Twee tenants; vreemde tenant/campagne/scherm, anon, read-only en report-only zonder read geweigerd; write en paused-tenantgrens; geen device/contextvelden. | Alleen geïsoleerde database, geen hosted mutaties. |
| INT-08: dashboard = export | De reproduceerbare probe leest echte RPC-resultaten en voert de product-CSV-serializer uit; totalen, groepen, filters en peildatum komen overeen. | CSV bevat aggregaten; detailpaginering is afzonderlijk. |
| UI / a11y / bestaande Hub | 15 Chromium-cases: echte pagina/loader/contract/view/CSS, 390/1440 px, 50 details, vervolgpagina, campagnefilter, rollen, doelactie, leeg/fout/gat, aXe en bestaande acht Hub-cases. | HTTP/session/overige Hub-reads zijn gecontroleerd; geen hosted Next-deploy of fysieke Playerclaim. |

De SQL-test is `supabase/tests/rls_s299_sponsor_report.sql` (57 asserties).
Gerichte sponsorunits: 63; contractsuite: 207. Workspace lint, typecheck en tests
zijn ieder 30/30 groen. De verse gecombineerde S296/S298/S299-databasegate
slaagt voor 152 bestanden en 5.064 asserties in 121 seconden; SQL-lint en
securityadvisors melden geen error-level bevindingen. Geteste broncommit:
`609ec6fa755e8f50520babc4f73ac9a28029a606`. Daarna is uitsluitend één lege
EOF-regel uit de SQL-test verwijderd; de 57 gerichte asserties zijn opnieuw groen. Exacte aantallen, loghashes en gecombineerde
database-eindgate staan in
[`implementation/s299-sponsor-report/local-gates.json`](implementation/s299-sponsor-report/local-gates.json).
Een Next-build en normale brede CI blijven releasegates; er is lokaal geen
extra Next-build geclaimd.

De eerste browserrun had één fout door hergebruik van dezelfde URL bij een
gecontroleerde rolwissel; navigeren via `about:blank` herlaadt de fixture. Alle
productasserties en tijdslimieten bleven behouden. Een eerste brede SQL-run had
drie pgTAP-bootstrapfouten doordat de extensie niet blijvend was aangemaakt;
die output is apart bewaard. De verse eindrun bootstrapt de extensie expliciet.

## Reproduceren en uitrol

De lokale probe in
`docs/implementation/s299-sponsor-report/probe.mts` gebruikt uitsluitend
`127.0.0.1:64432`, ingest de fixture, leest RPC-antwoorden, controleert de
product-CSV en rolt alle data terug. Uitvoeren vanuit de repository:

```sh
pnpm exec tsx docs/implementation/s299-sponsor-report/probe.mts
```

Het gegenereerde `database-proof.json` bevat periode, peildatum, exacte uitkomsten
en hashes van SQL-test, captured RPC-fixture en CSV. De browser gebruikt deze
captured RPC-antwoorden, geen nagemaakte 5.501-regelige teller.
`s299-report-390.png` en `s299-report-1440.png` zijn bekeken; de overige
Hub-metrieken in de browserfixture zijn gecontroleerde lege data en maken geen
deel uit van het rapportbewijs.

Database-resetrecept, pgTAP-commando en migratiehashes van de gecombineerde
S296/S298/S299-controle staan in `local-gates.json`. Het tijdelijke project blijft
op de geïsoleerde poort en raakt geen bestaande lokale of hosted database.

Promotie verloopt via de normale PR-, database-, build-, staging- en
productiegates op main. Hosted uitrol/readback zijn hier nog niet uitgevoerd.
De migratie is additief; bij rollback kan de vorige applicatie de nieuwe tabellen
en RPC’s ongebruikt laten staan. Verwijder geen geaccepteerde events of
afspraken als rollback. Er zijn geen providercredentials, device-tokens,
campagne-/rotatie-ingrepen of hardwarewijzigingen nodig.
