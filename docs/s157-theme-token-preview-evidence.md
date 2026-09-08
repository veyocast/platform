# S157 — Volledige theme-tokenwerkplaats

Status: `READY_FOR_REVIEW`

Datum: 8 september 2026

Branch: `veyocast/s157-theme-token-preview`

Baseline: `5bb0e0efe9b923637069de36298e1627875ca27b`

## Root cause

De persistente theme-authority was al compleet: het contract, PostgreSQL en de
serveractie eisen exact 26 semantische tokens voor zowel light als dark. De
Control-presentatie verborg echter 21 rollen achter één generieke actie. Alleen
die verborgen velden hadden een individuele reset. De live preview zette 12
variabelen, gebruikte er effectief 10 en liet steunkleur en beide
logoplaatkleuren geheel weg.

Dit was dus geen opslag- of RLS-probleem en vereist geen migratie.

## Herstel

- De vijf hoofdrollen blijven direct zichtbaar en hebben nu elk een eigen
  herstelactie.
- De 21 aanvullende rollen staan herkenbaar in zeven disclosures. Iedere
  samenvatting toont naam, uitleg, aantal en de actuele swatches.
- Light en dark blijven afzonderlijk te bewerken; het verborgen formulier
  serialiseert steeds beide complete 26-tokenmaps.
- De preview ontvangt rechtstreeks de canonieke
  `editorialThemeCssVariables`-map en rendert canvas, oppervlakken, gewone en
  uitgelichte rijen, volledige teksthiërarchie, randen, schaduw, accent,
  statussen, foto-overlay en een echte QR-plaat.
- Basisaccent, steunkleur, clublogoplaat en thuislogoplaat hebben ieder een
  afzonderlijk zichtbaar previewdeel.
- Semantische velden markeren bij focus of hover hun toepassingsgebied in de
  preview.
- De twee logoplaatkleuren staan nu in dezelfde kleurwerkplaats en ondersteunen
  zowel de native picker als exacte hexinvoer. De presentatiekaart eronder is
  daardoor uitsluitend nog voor typografie en schaal.
- De globale herstelactie raakt alleen de 26 semantische kleurrollen en wijzigt
  geen modusbeleid, steunkleur of andere tenantinstellingen meer. Het label
  maakt expliciet dat zowel licht als donker wordt hersteld.
- Tijdelijk onvolledige hex- of tijdinvoer loopt via veilige draftvalidatie en
  kan de editor niet meer laten crashen.
- De preview behoudt ook op mobiel exact de verhouding 16:9. Iedere disclosure
  heeft een zichtbare open/dicht-indicator met hover- en focusfeedback.

## Security en releasegrens

De bestaande serveractie, capabilitycheck, strict schema, contrastcontrole,
revision-CAS en `update_tenant_theme_settings_v3` blijven ongewijzigd. Ook de
snapshotbuilder, immutable theme-rollout, actieve releasepointer en Player-LKG
zijn niet aangepast. Er zijn geen database-, migratie-, secret- of
service-workerwijzigingen.

## Verificatie

Groen op de actuele werkboom:

- gerichte theme-/tenantunit: 2 bestanden, 8 tests;
- workspace lint, typecheck en test: ieder 30/30 taken;
- workspace build: 18/18 taken;
- volledige a11y-suite: 36 groen en 1 bewuste live-skip;
- theme-route Chromium desktop + mobiel: 2/2, inclusief exact 16:9 en veilig
  typen van een onvolledige kleurwaarde;
- scoped Axe-controle met geopende aanvullende kleurgroep, plus zichtbare en
  bedienbare disclosure-indicatoren;
- visuele inspectie op 1920×1080, 1600×1000 en 390×844 zonder horizontale
  overflow;
- brede Chromium-suite: effectief 199 groen en 23 bewuste live-/visualskips.
  De gezamenlijke run leverde 197 groen, 23 skips en twee procesuitvallen door
  een automatische Control-devserver-geheugenherstart en gedeelde
  Player-renderdruk. De volledige mobiele Control-scrollmatrix en de volledige
  64-cellen FieldFlow-outputmatrix zijn daarna elk exact geïsoleerd 1/1 groen
  uitgevoerd;
- finale diff-, ownership- en changed-file credentialcontrole: groen.

## Bekende grens

S157 wijzigt uitsluitend de centrale Control-editor en zijn semantische
preview. Bestaande Player- en Static LG-templates zijn bewust niet gewijzigd;
de preview toont daarom de bedoelde toepassing van iedere opgeslagen rol en is
geen uitbreiding van welke rollen elke afzonderlijke bestaande slidefamilie
al consumeert.

Deze lokale wijziging is niet gecommit, gepusht of gedeployed.
