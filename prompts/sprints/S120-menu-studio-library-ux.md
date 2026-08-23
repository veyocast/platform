# S120 — Menu Studio bibliotheek- en portrait-UX

## Doel

Maak het samenstellen van een Menu Studio-slide overzichtelijker: houd de
preview bovenaan in beeld, verplaats grote categorie- en mediabibliotheken naar
zoekbare dialogs, maak producten snel vindbaar en bied een duidelijke keuze
voor één of twee kolommen in staande modus.

## Invarianten

- De gedeelde Menu Scene-renderer blijft de bron voor Control en Player.
- Bovenuitlijning is routespecifiek voor de editor; normale playback behoudt
  zijn bestaande viewportgedrag.
- Producten worden alfabetisch op productnaam getoond en blijven filterbaar op
  categorie.
- Een productgroep bewaart alleen expliciet ingevoerde vrije regels; er wordt
  geen automatische tekst zoals `Naar keuze` opgeslagen.
- De gekozen portraitkolommen worden in `MenuDocument.v2` bewaard en door zowel
  de browserrenderer als de statische LG Legacy-renderer gevolgd.
- Bestaande documenten zonder expliciete keuze blijven compatibel: brede
  portraitblokken renderen als één kolom en bestaande smalle tweekolomsindeling
  wordt herkend.
- Prijzen volgen de contrastrijke thematekstkleur; locked assets, immutable
  releases, tenantgrenzen en last-known-good playback blijven ongewijzigd.

## Acceptatie

- De preview staat bovenaan en blijft op desktop sticky terwijl de bibliotheek
  scrolt; op mobiel blijft de flow sequentieel.
- Categorieën en media zijn via een zichtbare knop in een zoekbare popup te
  selecteren en toe te voegen.
- De productbibliotheek staat alfabetisch en heeft een categoriefilter.
- Nieuwe productgroepen bevatten geen vrije invoer totdat de gebruiker die
  expliciet toevoegt.
- In portrait is de keuze `1 kolom` / `2 kolommen` direct naast de preview
  zichtbaar en blijft die keuze na opslaan/publiceren in de output gelden.
- Prijzen zijn in donkere thema's wit en blijven in lichte thema's leesbaar.
- Lint, typecheck, unit, build, RLS, a11y, E2E, Player en offlinegates zijn groen
  vóór deployment van exact dezelfde merge-SHA via staging naar productie.
