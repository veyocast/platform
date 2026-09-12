# S177 — Datagedreven slides beheren en actuele competitie

## Analyse vóór implementatie

- `slides/slide-resource-data.ts` stuurt alle `sport_*`-slides naar de versie-editor.
  `slides/[slideId]/edit/page.tsx` retourneert echter 404 zonder actieve draft.
  Gepubliceerde Sportlink-slides hebben normaal geen draft. De bestaande
  `createOrResumeDynamicSlideVersion`-actie wordt door de lijst overgeslagen.
- De S136-standenselector sorteert bij `auto_current` alleen op synchronisatietijd:
  geen verplicht teamlidmaatschap en geen actuele pouleresolutie. Read-only
  productieanalyse toont reguliere 12-teamstanden waar de beker 4 teams heeft.
- Sportlink-wedstrijden hebben een uit wedstrijdmetadata berekende competitie-ID;
  hun `pool.competitionExternalId` bevat de ID uit dezelfde poulecatalogus als
  `sports_teams.metadata.competitionOptions`. S158/S176 vergelijken alleen de eerste.
  Hierdoor verdwijnen ook jeugdwedstrijden ondanks correcte team- en poule-ID's.
- De worker begrenst de catalogus stil op 24 poules; productie bevat 32 poules
  voor Duindorp, acht jeugdteams missen daardoor opgeslagen poules. Verhoog de
  begrenzing naar 128 met expliciete fout boven die grens en behoud van LKG.
  De team→poulekoppeling mag bij meerdere competities niet langer 'last wins' zijn.
- Bibliotheekstatus 'Actief' betekent gepubliceerd, niet beschikbare inhoud.
  De lijst toont geen duidelijke competitiecontext of reden voor ontbrekende data.
- Bulk-aanmaken is alleen idempotent per verzoek. Nieuwe wizardbezoeken kunnen
  dezelfde selectie opnieuw aanmaken. Bestaande duplicaten worden niet verwijderd.
- Naam in de lijst komt uit de gepubliceerde versie; een beheernaam moet los van
  immutable ontwerpversies en schermtitels kunnen veranderen.

## Implementatie

1. Hergebruik poolcatalogus en exacte team/bron/tenantidentiteit. Gebruik de
   gekoppelde competitie-ID bij wedstrijdselectie; hergebruik dezelfde resolver
   voor standen. Ambiguïteit blijft leeg met uitleg; geen kalender- of bekerhack.
2. Eén lijst met naam, type, publicatie en actuele beschikbaarheid; acties rechts,
   uitklapbare details, zoeken/filteren en bestaande veilige archiveerflow.
3. Bereid concepten via de bestaande POST-actie voor. Oude bewerk-URL's krijgen
   een herstelactie wanneer geen draft bestaat, en uitsluitend echte missers 404.
4. Voeg een tenantgescopeerde beheernaam toe, met capability- en revisionguard.
   Geef namen ook vóór aanmaken op. Identieke configuraties worden herkend zodat
   opnieuw aanmaken geen overbodige duplicaten oplevert.
5. Ververs alleen de exacte gepubliceerde latest-versie via nieuwe snapshots.
   Player, releasehistorie, drafts, assetverificatie en LKG blijven intact.

## Ownership

Control `dashboard/slides/**`, `dashboard/studio/**`, relevante shellnavigatie;
`dashboard/playlists/data.ts` uitsluitend voor dezelfde beheernaam in de picker;
Sportlink-contract/domain/workerhelpers indien nodig; nieuwe S177-migratie,
databasecontracten en tests; browser-, unit- en RLS-tests; dit promptbestand,
`TASK_LEDGER.md` en integratiedocumentatie. Geen dependencywijzigingen.

### Aanvullende gebruikersmelding

De gebruiker vraagt tijdens S177 ook de kleurvelden van Goal Overlay en de
ontbrekende intro bij een testdoelpunt op echte players te herstellen en mee te
deployen. Ownership omvat daarom ook de centrale Goal Overlay-editor, bestaande
LED Scores-playertransport- en cachehelpers, React/LG-goalruntime en hun tests.
Productiecontrole: beide gepubliceerde MP4-varianten bestaan en introEnabled is
true; drie actuele players ontvangen het testevent. Een ontvangstbevestiging
`configuration_prefetched` bewijst momenteel nog niet dat media gecachet zijn.
De kleurswatch is een niet-interactieve span; gebruik de bestaande combinatie
van native kleurkiezer en hexveld, met automatische clubkleuren en validatie.
De lege-cache-browserreproductie bevestigt dat React native `fetch` met de
GoalMediaCache-instance als receiver aanroept en daardoor niets downloadt.
Een wrapper herstelt dit; configuratie-ack volgt na prefetch. Beide runtimes
krijgen dezelfde toets met een echte decoder en natuurlijk `ended`.

## Verificatie

Senioren beker versus competitie; jeugdfase; afwijkende bron-ID's met gekoppelde
poule-ID; verkeerde tenant/team/bron/poule/fase; ambigue en ontbrekende data;
gepubliceerde slide zonder draft bewerken; herhaalde draft-actie; beheernaam
zonder historische mutatie; identieke selectie hergebruiken; archiveren met
playlistverwijzingen; desktop/mobiel/toetsenbord. Daarna lint, typecheck, unit,
build, verse DB-reset/RLS, a11y/Chromium en Player/offline-regressies.
