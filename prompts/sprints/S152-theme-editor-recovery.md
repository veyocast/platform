# S152 — Theme-editor en opslagherstel

## Doel

Herstel de centrale tenantbrede FieldFlow-theme-editor zodat deze professioneel,
responsive en daadwerkelijk opslaanbaar is, ook wanneer de tenant historische
Menu Studio-content bezit.

## Scope

- Geef de theme-editor de volledige beschikbare instellingenbreedte.
- Orden weergavemodus, live voorbeeld, hoofdpalet, contrast en geavanceerde
  semantische kleuren als één rustige taakflow.
- Houd legacy `primary_color` bereikbaar maar duidelijk secundair.
- Toon opslagfouten als oorzaak, effect en concrete herstelactie.
- Scheid historische rendercompatibiliteit van de FieldFlow-authoringgrens.
- Dek UI, browsergedrag en databasegrens met regressietests.

## Niet in scope

- Kleuren per slide of een nieuwe authorable theme-ID.
- Herschrijven van bestaande snapshots of immutable releases.
- Wijziging van Player-, offline-, release- of locked-brandcontracten.
- Automatische staging- of productiondeployment.

## Acceptatie

- Desktop gebruikt geen smalle rechterkolom voor de editor.
- Mobiel toont dezelfde taakvolgorde zonder horizontale overflow.
- Light en dark hebben een duidelijke paletkeuze, live preview en
  contraststatus; alle 26 tokens blijven bereikbaar.
- De tenantinstellingencommand slaagt wanneer een bestaande legacy Menu-slide
  als nieuwe `latest`-snapshot wordt gerenderd.
- Nieuwe of gewijzigde dynamische content met een legacy theme-ID blijft aan de
  PostgreSQL-grens met `23514` geweigerd.
- Historische snapshots, releases en Player last-known-good blijven ongewijzigd.
- Alle verplichte database- en Control-gates zijn groen vóór release.
