# S154 — Eigen clubwedstrijden en thuis-/uitfilter

## Doel

Zorg dat clubprogramma- en clubuitslagslides uitsluitend wedstrijden tonen
waarin minimaal één geselecteerd eigen Sportlink-team speelt. Laat de beheerder
per clubslide kiezen tussen thuis en uit, alleen thuis of alleen uit.

## Scope

- Voeg `teamSelection.matchLocation` met `both`, `home` en `away` toe aan het
  gedeelde contract, de Sportlink-wizard en de slide-editor.
- Bewaar de keuze per clubbreed programma- of uitslagonderdeel; poulecontent
  behoudt bewust de volledige poulecontext.
- Bepaal de richting met de exacte eigen `providerTeamId` aan de thuis- of
  uitzijde van de wedstrijd, niet met de onbetrouwbare providerflag
  `is_home_match`.
- Laat oude configuraties zonder `matchLocation` compatibel als `both` werken.
- Laat oude clubslides zonder volledige `teamSelection` fail-closed alleen
  wedstrijden met een actief tenant-eigen Sportlink-team tonen.
- Queue na migratie nieuwe immutable snapshots voor de exacte gepubliceerde
  versie van bestaande relevante latest-slides, ook wanneer daarnaast een
  afwijkend authoringconcept openstaat; muteer geen historische snapshots,
  versies of releases.

## Niet in scope

- Het verwijderen of samenvoegen van historische, afzonderlijk aangemaakte
  slides.
- Het versmallen van pouleprogramma's of pouleuitslagen; wedstrijden tussen
  andere teams in dezelfde poule blijven daar geldig.
- Wijzigingen aan Player-offline-, verificatie- of last-known-goodgedrag.
- Een nieuwe publieke RPC-versie: de aanvullende selectie-eigenschap is
  backward-compatible binnen de bestaande v4-commandgrens.

## Acceptatie

- `both` toont eigen teams als thuis- én uitteam en nooit vreemd tegen vreemd.
- `home` toont alleen wedstrijden waarin een geselecteerd eigen team exact het
  thuisteam is; `away` doet hetzelfde voor de uitzijde.
- `Alle teams` gebruikt uitsluitend actieve eigen teams uit dezelfde tenant en
  Sportlink-databron; een expliciete selectie gebruikt uitsluitend de gekozen
  team-ID's.
- De wizard toont de drie keuzes per geselecteerde clubslide en stap 5 herhaalt
  de keuze vóór expliciet aanmaken.
- De bewerkpagina kan de instelling later wijzigen en bewaart haar bij
  teamselectie, competitieaanpassing en wisselen tussen clubblueprints.
- Legacy clubslides worden opnieuw gerenderd via een nieuw snapshot; bestaande
  immutable historie en de huidige Player-LKG blijven intact tot veilige
  promotie.
- Vastgezette versies blijven bewust onaangeraakt; de herstelqueue volgt alleen
  het bestaande latest/default-releasepad en herschrijft geen expliciet gekozen
  immutable releasebranch.
- Contract-, domain-, Control-, pgTAP-, RLS-, toegankelijkheids-, browser-,
  Player- en offlinegates zijn groen voor deployment.

## Uitvoering

- `sportlinkSlideTeamSelectionSchema` draagt de optionele legacy-compatibele
  matchrichting; nieuwe wizardcommands schrijven haar altijd expliciet.
- Eén gedeelde toegankelijke radio-cardcontrol wordt door wizard en editor
  gebruikt en valt mobiel terug naar één kolom.
- De private teamselectievalidator accepteert alleen de bekende sleutel en drie
  waarden. De matchhelper combineert zijde, teamlidmaatschap en eventuele
  vastgezette competitiecontext tenantveilig.
- Een dunne wrapper rond de S153-snapshotbuilder normaliseert legacyinput en
  hergebruikt de bestaande 100-item-, logo- en displayprojectie.
- Een gespecialiseerde herstelqueue materialiseert de exacte gepubliceerde
  versie, zodat een open concept byte-identiek blijft en de scopefix toch kan
  renderen; pinned versies zijn uitgesloten.
- De bestaande S146-render- en releasequeue zorgt dat alleen complete nieuwe
  artifacts worden gepromoveerd.

## Releasegates

- `pnpm lint`, `pnpm typecheck` en `pnpm test`: elk 30/30 workspacetaken
  groen.
- `pnpm build`: 18/18 workspacetaken groen, inclusief Control-authgrens,
  client-secretcontrole en Player-webOS-guard.
- Verse `pnpm db:reset`; S154-pgTAP 53/53, S153-regressie 62/62 en volledige
  RLS-suite 74 bestanden/1.860 assertions groen.
- Database-lint zonder S154-bevinding; alleen reeds bestaande waarschuwingen
  buiten deze sprintscope.
- Toegankelijkheid 36 groen plus 1 bewuste live-skip; Chromium-E2E 39 groen
  plus 13 bewuste live-integratieskips.
- Player en offline samen 118/118 groen.
- Hosted CI, merge en exact-SHA staging-/productiedeployment worden na push in
  het PR-bewijs vastgelegd.
