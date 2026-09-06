# S151 — Gedeelde dropdown-multiselect

## Doel

Vervang lange, verspreide checkboxlijsten voor gewone entiteitskeuzes door één
compacte en toegankelijke dropdown-multiselect, met de Sportlink-teamstap als
primaire aanleiding. Behoud alle server-side autorisatie, domeinvalidatie en
formuliercontracten.

## Scope

- Voeg één canonieke `MultiSelectDropdown` toe aan `@veyocast/ui`.
- Ondersteun zoeken, selectiechips, afzonderlijk verwijderen, alles selecteren,
  wissen, lege resultaten, disabled opties, minimum- en maximumaantallen.
- Verstuur gekozen waarden als herhaalde verborgen formuliervelden wanneer een
  `name` is opgegeven.
- Gebruik native checkboxes in de geopende lijst en minimaal 44 px
  aanraakdoelen.
- Respecteer light/dark tokens en `prefers-reduced-motion` zonder een tweede
  UI-kit of nieuwe dependency.
- Vervang in de Sportlink-bulkwizard de team × typematrix door één
  dropdown-multiselect per gekozen onderdeel.
- Hergebruik hetzelfde patroon voor:
  - teams van een bestaande gekoppelde welkomstslide;
  - schermen binnen een schermgroep;
  - schermgroepen op een schermdetail;
  - eigen teams en doelschermgroepen binnen LED Scores;
  - geselecteerde verjaardagsrollen;
  - supportwerkrollen voor afdelingsroutering.

## Bewuste uitzonderingen

- Publicatie- en rollbacktargets blijven zichtbaar omdat preflightstatus,
  ontbrekende bytes en risicobevestiging per scherm operationeel relevant zijn.
- Schermfleet- en mediaselectie blijven tabel-/bulkselecties.
- Permissions blijven expliciet zichtbaar vanwege hun security-impact.
- Weekdagen blijven een vaste, ruimtelijke zevendagenkeuze.
- Product- en menuselecties met volgorde, kolomplaatsing of een aparte
  apply/cancel-transactie behouden hun gespecialiseerde editor of dialog.

## Acceptatie

- De Sportlink-teamstap bevat geen desktopmatrix of mobiele matrixcards meer.
- Ieder gekozen Sportlink-onderdeel heeft een zoekbare dropdown met eigen
  teamselectie; gewone onderdelen blijven team × type en welkom blijft één
  gekoppeld meerteamscomponent.
- De bestaande limiet van 100 welkomstteamcontexten en minimaal één team bij
  versiebewerking blijven gelden.
- De gedeelde control toont labels, hulptekst, aantallen, lege staten en
  toetsenbordbedienbare native checkboxes.
- Bestaande server actions ontvangen dezelfde veldnamen en waarden als vóór
  deze wijziging.
- Er is geen database-, Player-, release-, LKG-, provider- of
  autorisatiecontract gewijzigd.
- UI-unit-, Control-contract-, lint-, typecheck-, build-, a11y- en Chromiumgates
  zijn groen vóór overdracht.
