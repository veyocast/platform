# S102 — LG standing single-canvas evidence

## Probleem en meting

De Android-app renderde `sport_standing` via de gedeelde Editorial Arena-opbouw:
één masthead, één tabelpaneel en één footer. De statische LG Legacy-runtime koos
daarentegen een historische `standing-club-edition` die binnen de actuele
Editorial Arena-root opnieuw een volledige kop, stand en footer opbouwde.
Daardoor was op de fysieke LG zichtbaar sprake van een slide in een slide.

Een tweede CSS-conflict vergrootte alle dynamische logo's. De regel
`#media-root img` had een hogere specificiteit dan de templateklassen en gaf ook
geneste club- en teamlogo's `width: 100%; height: 100%`. De historische
standrenderer gebruikte bovendien CSS `min()` voor logoafmetingen, terwijl de
doel-LG Chrome 79 gebruikt.

## Correctie

- `sport_standing` bouwt in LG Legacy uitsluitend het tabelpaneel binnen de
  bestaande Editorial Arena-masthead en -footer.
- De oude geneste standkop, contextkop, footer en `standing-club-edition`-route
  zijn uit de statische runtime verwijderd.
- Fullscreen mediaregels gelden alleen voor directe kinderen van `#media-root`;
  geneste templateassets volgen weer hun lokale componentafmetingen.
- Portrait clublogo, teamlogo's, kolommen, rijen, highlight en vorm gebruiken
  expliciete Chrome-79-veilige maten zonder CSS `min()`.
- De immutable release-, checksum-, lokale Blob- en last-known-good-keten is niet
  gewijzigd.

## Regressiebewijs

De nieuwe fysieke-runtimefixture gebruikt de LG webOS Chrome 79 User-Agent op
een logisch 1080×1920-viewport en bewijst:

- exact één zichtbare kop `Stand`;
- exact één standpaneel en geen geneste historische standkop;
- vier verwachte rijen op één gedeeld kolomgrid;
- één begrensd clublogo en vier begrensde teamlogo's;
- competitie-, poule- en seizoencontext exact eenmaal;
- uitsluitend lokale, checksum-gevalideerde dynamische assets.

Visueel bewijs:
`docs/screenshots/s102-lg-standing-single-canvas.png`.

Lokale gates vóór publicatie:

- workspace lint/typecheck/test: 30/30 taken groen;
- workspace build: 19/19 packages groen;
- Player unit: 145/145 en productiebuild inclusief webOS-guard groen;
- volledige Player-browsermatrix: 81/81 groen;
- offline Player: 7/7 groen;
- a11y: 35/35 groen;
- volledige LG Legacy-browsermatrix: 11/11 groen.
