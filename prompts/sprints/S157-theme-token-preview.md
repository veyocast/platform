# S157 — Volledige theme-tokenwerkplaats

## Doel

Maak de centrale FieldFlow-theme-editor compleet en overzichtelijk: iedere
opgeslagen kleurrol moet per licht/donkerpalet exact aanpasbaar zijn en de live
preview moet het effect van alle kleurinstellingen eerlijk tonen.

## Scope

- Houd de vijf hoofdrollen direct zichtbaar en geef ze dezelfde individuele
  herstelactie als de overige tokens.
- Orden de overige 21 semantische rollen in benoemde, ingeklapte groepen met
  actuele swatches en exacte CSS-kleurinvoer.
- Voed de preview via de gedeelde `editorialThemeCssVariables`-projectie en
  toon alle 26 rollen tegelijk in een rustige 16:9-compositie.
- Toon in dezelfde preview ook basisaccent, steunkleur, clublogoplaat en
  thuislogoplaat.
- Maak beide logoplaatkleuren naast de native picker ook als exacte hexwaarde
  invoerbaar.
- Laat focus en hover op een semantisch kleurveld de bijbehorende previewzone
  markeren.
- Dek tokeninventaris, volledige light/dark-payload, previewdekking,
  toegankelijkheid en responsive overflow af met regressietests.

## Niet in scope

- Nieuwe tokens, tabellen, migraties of gedeeltelijke kleurmaps.
- Wijziging van server-side capabilitychecks, RLS of theme-rolloutcommands.
- Mutatie van snapshots, gepubliceerde releases of Player last-known-good.
- Wijziging van Player-, Static LG-, offline- of service-workergedrag.
- Vrije CSS, fontuploads of reconstructie van merklogo's.

## Acceptatie

- De editor biedt exact de bestaande 26 semantische tokens eenmaal aan voor de
  geselecteerde lichte of donkere modus.
- Ieder semantisch token heeft picker, exacte tekstwaarde en individuele
  herstelactie; beide volledige maps blijven in de formulierpayload staan.
- De preview gebruikt de canonieke 26 CSS-variabelen en bevat voor iedere rol
  een zichtbaar, gemarkeerd onderdeel.
- Basisaccent, steunkleur en beide logoplaatkleuren veranderen hun eigen
  previewonderdeel direct.
- De vijf kernkleuren blijven taakgericht vooraan; aanvullende rollen blijven
  vindbaar in zeven rustige disclosures.
- Desktop en mobiel hebben geen horizontale overflow en de geopende editor
  doorstaat de relevante toegankelijkheidscontrole.

## Gates

- Gerichte Control unit-, lint- en typecheck.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` en `pnpm build`.
- `pnpm test:a11y` en Chromium-E2E, met gerichte theme-routecontrole op desktop
  en mobiel.
- Diffcheck, ownershipcontrole en changed-file credentialscan.
