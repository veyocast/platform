# S120 — Menu Studio bibliotheek- en portrait-UX

## Resultaat

- De editorpreview gebruikt expliciete bovenuitlijning en blijft op desktop
  sticky aan de bovenkant van het werkvlak.
- Categorieën en media worden vanuit zoekbare, responsieve dialogs toegevoegd;
  de lange inline bibliotheken nemen geen permanente editorruimte meer in.
- Producten staan alfabetisch op productnaam en kunnen op categorie worden
  gefilterd.
- Een nieuwe productgroep bevat alleen geselecteerde producten. Vrije invoer
  wordt pas onderdeel van het document nadat de gebruiker die zelf toevoegt.
- De previewtoolbar toont in portrait een prominente keuze voor één of twee
  kolommen. De keuze wordt als optioneel `portraitColumns`-veld opgeslagen en
  heeft voorrang op de compatibiliteitsdetectie voor bestaande documenten.
- Browser- en LG Legacy-rendering volgen dezelfde kolomkeuze. Prijzen gebruiken
  de contrastrijke thematekstkleur, zodat donkere schermthema's witte bedragen
  tonen zonder lichte thema's onleesbaar te maken.

## Compatibiliteit en grenzen

Er is geen databasemigratie nodig: het veld staat in het versioned JSON-contract
en de bestaande SQL-validatie staat aanvullende paginavelden toe. Documenten
zonder het nieuwe veld blijven één brede portraitkolom gebruiken, tenzij hun
bestaande smalle blokgeometrie aantoonbaar een tweekolomsopmaak beschrijft.
Publicatie, immutable releases, tenantautorisatie en Player-opslag zijn niet
gewijzigd. Een fysieke LG-validatie blijft onderdeel van de normale device-lab
releasepraktijk; de statische LG-browserroute en geometriegates zijn wel groen.

## Lokaal bewijs

- Workspace lint/typecheck/test: 30/30 groen; build: 18/18 groen.
- Contracts: 44 unit; content-templates: 39 unit; Control: 170 unit; Player:
  153 unit, allemaal groen.
- Verse database-reset en RLS: 52 bestanden, 1048 assertions groen.
- Menu Studio live: desktop, mobiel, dialogs, sortering/filter, productgroep,
  tweekolomskeuze, publiceren en axe groen.
- A11y: 30 groen, 1 bewuste live-skip; vijf runnerdrukgevallen daarna serieel
  5/5 groen.
- Chromium E2E: 30 groen, 2 bewuste live-skips; één Sponsor Hub-navigatierace
  daarna geïsoleerd groen.
- Playerbrowser: 94/94 groen, inclusief 40 Menu Studio-goldens en de LG-route.
- Player offline: 7/7 groen.

## Deployment

De geteste merge-SHA wordt eerst naar staging uitgerold en pas na groene health-
en rooktests met de expliciete productiondispatch naar productie gepromoveerd.
De workflowrun en hosted readbacks vormen het uiteindelijke releasebewijs.
