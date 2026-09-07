# S156 — Wedstrijdregels, welkomsthiërarchie en clubvarianten

## Doel

Maak programma-, uitslagen-, bezoekers- en splitnieuwsslides op afstand beter
leesbaar en voorspelbaar, met gelijke moderne en Static LG-output. Laat een
beheerder daarnaast in één veilige Sportlink-aanmaakflow de clubbrede
programma- en uitslagenslides voor vandaag als thuis-, uit- en beide-variant
maken.

## Scope

- Render clubprogramma en clubuitslagen in twee regels: datum, tijd en
  sportpark/veld boven; optioneel logo plus thuisclub/team versus uitclub/team
  eronder; de uitslag staat uitsluitend bij uitslagenslides helemaal rechts.
- Gebruik vaste rijhoogtes die gelijk zijn aan een volle pagina: 115 px
  liggend, 221 px voor staand programma en 314 px voor staande uitslagen.
  Daardoor wordt een korte lijst nooit over de beschikbare hoogte uitgerekt,
  terwijl een volle pagina de contentzone benut.
- Sta twee kolommen uitsluitend liggend toe; staand normaliseert naar één kolom
  in wizard, editor, moderne Player en Static LG.
- Verrijk clubitems tenantveilig met de volledige gekoppelde teamnaam en de
  gestructureerde accommodatie-/veldinformatie.
- Toon op bezoekerskaarten de volledige thuisteamnaam, verdubbel datum en
  aanvang exact van 23/26 px naar 46/52 px en lijn kleedkamers, veld en
  scheidsrechter onderaan als label-/waarderijen uit.
- Geef de staande `hero_split`-nieuwsslide 32 px ruimte tussen de panelen en
  20 px extra zijruimte.
- Laat de Sportlink-wizard meerdere wedstrijdrichtingen kiezen. Iedere gekozen
  richting wordt een afzonderlijke, herkenbaar benoemde clubslide; programma
  vandaag plus uitslagen vandaag kunnen zo atomisch alle zes combinaties
  opleveren.
- Houd de bestaande publieke v4-RPC-signature compatibel. Exact gelijke
  blueprint/richting-combinaties blijven ongeldig; verschillende richtingen
  gebruiken deterministische transactionele sub-batches en één idempotent
  hoofdresultaat.
- Queue voor bestaande relevante `latest`-slides alleen nieuwe immutable
  snapshots van de exacte gepubliceerde versie via de bestaande S146-keten.

## Canonieke QR-grens

De gevraagde verdere verplaatsing van de liggende fullscreen-gradient-QR naar
de buitenhoek wordt niet uitgevoerd. De bestaande rechterafstand resulteert op
1920 × 1080 in exact 144 px viewportafstand (7,5%) en is daarmee al de uiterste
toegestane action-/QR-safe positie uit de designcanon. De QR blijft minimaal
220 px met quiet zone; het headerlogo staat in een andere, niet-interactieve
canvaszone en bepaalt deze veiligheidsgrens niet.

## Niet in scope

- Historische snapshots, versies, releases of Player last-known-good muteren.
- Poulecontent versmallen of de bestaande team-/competitiecontext veranderen.
- De enkelvoudige richting van een bestaande slide-editor meervoudig maken;
  één bestaande slide behoudt exact één filter.
- Logo's reconstrueren, vrije providerdata verzinnen of brandkleuren buiten de
  bestaande tokens hardcoderen.
- Offline-startup, cacheverificatie, release-activatie of service workers
  wijzigen.

## Acceptatie

- Programma en uitslagen tonen op beide oriëntaties exact de gevraagde
  tweeregelige informatiehiërarchie; de uitslag is rechts uitgelijnd.
- Logo en thuis-/uitlabels volgen de bestaande instellingen, terwijl teamnamen
  leesbaar links blijven en metadata ellipsiseert zonder canvasoverflow.
- Eén resultaat gebruikt dezelfde rijhoogte als vijf of meer resultaten.
- Liggend kan één of twee kolommen tonen; staand toont altijd één kolom.
- Bezoekerskaarten tonen de volledige thuisteamnaam en een uitgelijnde onderste
  rij voor scheidsrechter met eerlijke `volgt`-fallback.
- `hero_split` heeft staand aantoonbaar 32 px gap en 20 px zijpadding.
- Eén v4-command kan de zes today-combinaties maken, is bij retry bytegelijk
  idempotent, weigert een exact duplicaat atomisch en blijft tenantgebonden.
- Moderne en Static LG-geometrie, paginering en inhoud blijven gelijkwaardig.
- De fullscreen-gradient-QR blijft aantoonbaar binnen de canonieke 7,5%-zone.

## Releasegates

- `pnpm lint`, `pnpm typecheck`, `pnpm test` en `pnpm build`.
- Verse `pnpm db:reset`, gerichte S154/S155/S156-pgTAP en volledige
  `pnpm test:rls`; error-level database-lint zonder bevindingen.
- `pnpm test:a11y`, brede Chromium-E2E en bijgewerkte visuele goldens.
- `pnpm test:player` en `pnpm test:player:offline`, inclusief Static LG.
- Diffcheck, ownership- en secretscontrole, PR/CI, merge en exact-SHA staging-
  en productiedeployment met healthreadback.
