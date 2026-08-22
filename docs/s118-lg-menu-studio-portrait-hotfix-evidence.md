# S118 — LG Menu Studio portrait hotfix

## Aanleiding en oorzaak

Een fysiek LG-scherm toonde een staand Menu Studio v2-menu als twee smalle
kolommen. Daardoor stond één product klein linksboven en bleef de rechterhelft
leeg. De statische LG-adapter maakte altijd een linker- én rechterkolom en
verdeelde portraitblokken nog op hun opgeslagen x-positie. Daarnaast stond een
algemene v1-portraitregel later in de stylesheet. Die regel overschreef voor v2
de vastgelegde header-, body- en footerzones en trok de inhoud omhoog tegen de
titel.

## Herstel

- Portrait verzamelt alle Menu Studio-flowblokken in één bronvolgorde en maakt
  geen rechterkolom.
- De v2-selectors staan na en boven de algemene v1-regels, met exact de
  72/96/228-header, 72/348/936/1388-body en 72/1760/936/64-footer.
- Categorie-, product-, prijs- en footermaatvoering volgt de gedeelde Menu Scene.
- De statische adapter toont ook de `Menu`-kicker en de canonieke
  `Prijslijst`- plus paginanummerfooter.
- Landscape en bestaande v1-prijslijsten zijn functioneel ongewijzigd.

## Bewijs

De nieuwe 1080×1920-fixture gebruikt dezelfde inhoud als de fysieke melding:
`Nieuw menu`, `Hardloper, frisdrank` en `AA Drink`. De test meet één kolom van
936×1388 op x=72, bovenuitlijning, 72 px titel, 34 px categorie, 26 px product,
20 px footer en de themakleur op de headerdivider.

Visueel bewijs: [`screenshots/s118-menu-studio-lg-legacy-portrait.png`](screenshots/s118-menu-studio-lg-legacy-portrait.png).

## Gates

- Player lint/typecheck: groen.
- Player unit: 152/152 groen.
- Player productionbuild, secretguard en webOS 6-compatibiliteitsguard: groen.
- LG Legacy: 13/13 groen, inclusief nieuwe v2-portraitgeometrie en bestaande
  tweekoloms v1-regressie.
- Playerbrowser: 91/92 in parallel; de bestaande last-known-good
  overgangstiming werd geïsoleerd groen. Beide visuele matrices (40 Menu Studio
  en 48 Editorial Arena) zijn groen.
- Player offline: 7/7 groen.
- Workspace lint/typecheck/test: 30/30 groen.
- A11y: 32 groen, 1 bewuste live-skip; drie Control-runnerdrukgevallen tijdens
  een zichtbare devserver-memoryrestart daarna serieel 3/3 groen.
- E2E: 30 groen, 2 bewuste live-skips.

## Deployment

Dezelfde geteste merge-SHA wordt eerst naar staging uitgerold en na groene
health-, pairing- en LG-smokes via de expliciete productiondispatch gepromoveerd.
De uiteindelijke SHA en hosted readbacks worden na de workflows vastgelegd.
