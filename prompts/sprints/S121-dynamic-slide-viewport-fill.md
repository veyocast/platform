# S121 — Dynamische slides schermvullend

## Doel

Laat de Menu Studio-preview en alle gedeelde dynamische slides de beschikbare
viewport volledig benutten wanneer scherm en slide dezelfde oriëntatie hebben,
zonder de veilige weergave bij een echte portrait/landscape-mismatch te breken.

## Invarianten

- De vaste logische canvassen blijven 1920×1080 en 1080×1920.
- Browser en LG Legacy volgen dezelfde fitbeslissing.
- Een gelijk georiënteerde viewport gebruikt proportionele `cover`; een echte
  oriëntatiemismatch gebruikt `contain` om een portraitslide niet destructief
  op een landscapescherm te croppen, en omgekeerd.
- De Menu Studio-previewstage volgt exact 16:9 of 9:16 en blijft bovenaan in de
  bestaande editorflow.
- De ingestelde fitmodus van losse afbeeldingen en video's blijft leidend.
- Tenantautorisatie, opslag, immutable releases, offlinecache en
  last-known-good-activatie blijven ongewijzigd.

## Acceptatie

- Landscape- en portraitslides bedekken een licht afwijkende maar gelijk
  georiënteerde viewport zonder zwarte balken boven, onder of opzij.
- Een portraitslide op een landscapescherm blijft volledig zichtbaar met
  letterboxing in plaats van zware crop.
- De browserrenderer en statische LG Legacy-renderer exposen de gekozen
  fitmodus toetsbaar.
- De Control-previewstage heeft in beide oriëntaties dezelfde verhouding als
  het gerenderde slidecanvas.
- Lint, typecheck, unit, build, a11y, E2E, Player en offlinegates zijn groen
  vóór deployment van exact dezelfde merge-SHA via staging naar productie.
