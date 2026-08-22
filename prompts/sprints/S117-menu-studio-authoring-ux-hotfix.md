# S117 — Menu Studio authoring-UX hotfix

## Doel

Herstel drie concrete pilotproblemen zonder de MenuDocument-, publicatie- of
Playerinvarianten te verzwakken: een actieve productgroep moet duidelijk
afsluitbaar zijn, korte staande prijslijsten moeten bovenaan beginnen en de
menunaam moet herkenbaar bewerkbaar zijn en overal dezelfde identiteit houden.

## Invarianten

- Groepsbewerking is alleen tijdelijke UI-selectie en muteert geen save-status.
- Een andere canvasselectie of expliciete `Klaar`-actie sluit de actieve groep.
- Portraitcategorieën beginnen bovenaan, onafhankelijk van ondervulling.
- De titelwijziging gebruikt de bestaande revision-aware en idempotente command-RPC.
- De MenuDocument-titel en `dynamic_slides.name` worden atomisch gelijk gehouden.
- Tenantcapability, actieve tenant, rolloutflags en exacte RPC-ACL blijven afgedwongen.
- Bestaande snapshots/releases blijven immutable; publicatie blijft expliciet.

## Acceptatie

- Desktop en touch kunnen een productgroep maken, vullen en weer verlaten.
- Na afsluiten verdwijnen alle acties voor de actieve groep.
- Het veld `Menunaam` heeft een duidelijke begrenzing, hulptekst en toetsenbordpad.
- Een opgeslagen titel is ook de zichtbare naam in Slides.
- Een korte portraitprijslijst heeft `justify-content: flex-start` en aantoonbare
  bovenuitlijning; de volledige bestaande visuele matrix blijft groen.
- Verse database-reset, volledige RLS-suite, a11y, browser-, Player- en
  offlinegates zijn groen vóór deployment van exact dezelfde SHA.
