# S121 — Dynamische slides schermvullend

## Resultaat

- De gedeelde Editorial Arena-renderer berekent één expliciete viewportfit.
  Een scherm met dezelfde oriëntatie als de slide gebruikt proportionele
  `cover`, zodat de volledige viewport zonder zwarte reststroken wordt benut.
- Bij een echte portrait/landscape-mismatch blijft `contain` actief. Daarmee
  blijft een verkeerd georiënteerde publicatie volledig zichtbaar en wordt die
  niet tot een smalle, zwaar gecropte uitsnede gereduceerd.
- De zelfstandige LG Legacy-runtime volgt exact dezelfde beslissing en past
  die opnieuw toe na een viewportresize.
- De Menu Studio-previewstage gebruikt exact 16:9 of 9:16. De gedeelde
  Menu Scene vult daardoor het previewvlak zonder kunstmatige ruimte boven en
  onder het canvas.

## Compatibiliteit en grenzen

Losse afbeeldingen en video's behouden hun opgeslagen `contain`- of
`cover`keuze. Er is geen schema- of databasemigratie nodig. Publicatie,
immutable releases, tenantautorisatie, assetverificatie en last-known-good
playback zijn niet gewijzigd. Fysieke LG-validatie blijft onderdeel van de
normale device-labpraktijk; browser- en statische LG-geometriegates dekken de
implementatie in CI.

## Lokaal bewijs

- Content templates, Control en Player lint/typecheck/unit: groen.
- Gerichte browserregressie voor afwijkende landscape- en portraitviewports:
  groen.
- Volledige workspace-, build-, a11y-, Chromium-, Player- en offlinegates:
  lopend.

## Deployment

Na groene gates wordt de merge-SHA eerst automatisch naar staging uitgerold.
Na staging-health en rooktests wordt exact dezelfde SHA expliciet naar
productie gepromoveerd en op beide omgevingen teruggelezen.
