# S153 — Slide-thema, wedstrijdpresentatie en backoffice-resources

## Doel

Maak dynamische wedstrijdslides en hun beheer coherent: een clubbrede slide blijft
één slide met een bewerkbare teamfilter, programma- en uitslagpagina's gebruiken
één veilig presentatiepatroon, en themawijzigingen worden als nieuwe immutable
presentaties veilig naar actieve schermen uitgerold.

## Scope

- Verplaats de FieldFlow-slidehuisstijl van algemene instellingen naar een
  afzonderlijke, theme-scoped beheerroute.
- Voeg gecureerde typografie, algemene en sportschaal, clublogoplaat en
  thuislogoplaat toe aan het themecontract.
- Maak bij een themewijziging nieuwe snapshots en releases; wijzig nooit een
  gepubliceerd snapshot of release in-place en behoud Player last-known-good.
- Geef programma- en uitslagslides gelijke veilige ruimte aan alle vier zijden,
  een kop met `MATCHCENTRE`, pagina-aanduiding en tenanttijd, en afzonderlijke
  uitgelijnde wedstrijdkaarten met gefaseerde motion.
- Pas dit presentatiepatroon toe op club-, poule- en teamcontexten in de moderne
  renderer en de statische LG-runtime.
- Laat de clubbrede Sportlink-wizard precies één dynamische slide aanmaken met
  een zoekbare multi-select voor teams en een optie `Alle teams`.
- Bewaar teamactivatie als filter op die ene slide, zonder limiet van 25 teams,
  met compacte per-team competitieafwijkingen en latere bewerkbaarheid.
- Gebruik standaard één kolom en voeg `Logo tonen` als expliciete instelling toe.
- Laat stap 5 wachten op expliciete bevestiging en toon het werkelijke
  aanmaakresultaat.
- Vervang de slidekaartmuur door een gepagineerde resource-lijst met zoeken,
  filters, multi-select, normale en override-verwijdering en rijacties voor
  bekijken, bewerken, verwijderen en toevoegen aan een afspeellijst.
- Breng Media naar hetzelfde rij- en actiepatroon en maak filters compact.
- Herstel previewroutes met tenantveilige asset-resolutie en bruikbare foutstatus.
- Orden de betrokken instellingen- en detailpagina's volgens het Publishercanon.

## Niet in scope

- Vrije fontuploads, willekeurige CSS of reconstructie van merklogo's.
- Mutatie van historische snapshots of releases.
- Versimpeling van player offline-, verificatie- of activatiegedrag.
- Een generieke vervanging van alle bestaande backoffice-routes die geen
  resourceverzameling beheren.

## Acceptatie

- Clubprogramma vandaag, clubprogramma komende 7 dagen en clubuitslagen vandaag
  maken elk maximaal één clubbrede slide per wizardkeuze.
- `Alle teams` volgt ook later gesynchroniseerde teams; een expliciete selectie
  kan meer dan 25 teams bevatten en filtert de wedstrijden binnen dezelfde slide.
- Competitiekeuze kan per geselecteerd team worden aangepast zonder een lange
  reeks permanent geopende panelen.
- Controleren navigeert of publiceert niet vanzelf; alleen een expliciete actie
  maakt de slide aan.
- Themawijzigingen leveren nieuwe immutable snapshots en opvolgreleases op voor
  actieve schermtakken, met voortgang en een herstelbare foutstatus.
- Programma- en uitslagpagina's hebben aan alle zijden dezelfde veilige marge,
  geen verticale MATCHCENTRE-balk en geen dubbele paneeltitel.
- Moderne en LG-weergave tonen dezelfde inhoudsvolgorde; reduced motion slaat de
  tussenanimaties over.
- Slides en Media hebben serverpaginatie, toegankelijke rijacties, multi-select
  en een werkende voorbeeldweergave.
- Alle verplichte database-, Control-, toegankelijkheids-, browser- en
  Player-gates zijn groen vóór release.

## Uitvoering

- FieldFlow heeft een eigen route onder `Thema's`; algemene instellingen
  bevatten geen globale slidehuisstijl meer.
- De themaopslag gebruikt een tenant- en theme-scoped profiel met revision-CAS.
  Een wijziging plant nieuwe snapshots, rendert die eerst volledig en kloont
  daarna alleen de actieve releasebranches. Historische snapshots, releases en
  last-known-good blijven ongewijzigd.
- Het gedeelde presentatiecontract bevat gecureerde fontkeuze, basis- en
  sportschaal, clublogoplaat en thuislogoplaat. Moderne en Static LG-renderers
  lezen dezelfde bevroren waarden.
- De drie clubbrede wedstrijdblueprints leveren elk één dynamische slide. De
  teamfilter ondersteunt meer dan 25 expliciete teams of alle huidige en
  toekomstige teams; competitieafwijkingen staan per team in compacte
  keuzepanelen en blijven op de bewerkpagina wijzigbaar.
- Stap 4 start met één kolom en een expliciete logotoggle. Stap 5 is een echte
  review en maakt pas content na de bevestigingsactie.
- Slides en Media gebruiken serverbegrensde resourcepagina's met zoeken,
  filters, status/datumkolommen, rijacties, selectiebulkacties en previews met
  tenantveilige asset-URL's. Algemene instellingen tonen steeds één categorie.

## Lokale releasegates

- `pnpm lint`: 30/30 taken groen.
- `pnpm typecheck`: 30/30 taken groen.
- `pnpm test`: 30/30 taken groen.
- `pnpm build`: 18/18 taken groen.
- Verse `pnpm db:reset`; S153-pgTAP 62/62 en volledige RLS-suite 73 bestanden,
  1.807 tests groen.
- Supabase database-lint heeft geen S153-bevindingen; de resterende meldingen
  zijn bestaande waarschuwingen buiten deze scope.
- Toegankelijkheid: 36 groen en 1 bewuste live-skip.
- Brede Chromium-suite: 192 groen en 23 bewuste skips. Eén late Chromium-page
  crashte onder hostdruk; de exact betrokken welkomstmotionsuite draaide daarna
  in een vers proces 4/4 groen.
- Player: 118/118; offline: 7/7; FieldFlow-visualmatrix: 64/64; aanvullende
  LG/Menu/verjaardag/welkomstregressies: 38/38.
