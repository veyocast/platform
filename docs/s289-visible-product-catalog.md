# S289 — Zichtbare producten en beheertabellen

De productwerkruimte meldde 204 producten en 50 geladen rijen op pagina twee,
maar de tabel ontbrak op de aangeleverde Chrome-screenshot. Read-only controle
van de actieve productiedatabase bevestigt dat alle 204 productrecords bestaan.
Er zijn geen productiegegevens aangepast.

De bestaande tabelklasse `ad-table` komt exact voor in de openbare
[EasyList-regels](https://github.com/easylist/easylist/blob/master/easylist/easylist_general_hide.txt).
Een gecontroleerde browserproef met die ene bestaande verbergregel reproduceert
het verdwijnen op 390 en 1440 px. Dit bewijst de CSS-botsing; welke extensie of
filterinstelling de gebruiker daadwerkelijk heeft, is niet vastgesteld.

## Herstel

Alle runtimeverwijzingen naar deze gedeelde beheerklasse gebruiken nu
`sync-data-table`: de productcatalogus, prijsverschillendialoog, team- en
sponsoroverzichten. De bestaande CSS-declaraties en mobiele behandeling blijven
identiek. De gebruiker hoeft geen browserfilter uit te schakelen. Dataqueries,
serverrechten, productbeschikbaarheid en bevestigde menuprijzen wijzigen niet.

## Bewijs

- Vóór herstel: beide nieuwe browsergevallen falen op een verborgen tabel.
- Na herstel: alle negen productworkflows groen; beide filtergevallen bewijzen
  exact gelijke tabelgeometrie voor/na activeren van de filterregel, 50 rijen,
  tweede pagina, prijzen, zoeken en toetsenbordbediende beschikbaarheid.
- De negatieve filtercontrole is daadwerkelijk verborgen tijdens elke proef.
- Geen horizontale paginascroll op 390/1440 px; WCAG 2 A/AA, 2.1 AA en 2.2 AA
  zonder axe-overtredingen. De fixture kreeg een documenttitel; de echte
  applicatie had die al.
- De dertien aanvullende prijs-, team- en sponsorbrowsergevallen zijn groen.
- Workspace lint/typecheck/unit zijn groen: 68 succesvolle Turbotaken; ook
  browser-ESLint en `git diff --check` zijn groen. Normale GitHub-CI moet groen
  zijn vóór merge; staging en productie volgen via de bestaande immutable
  releasestraat.

Bewijsbestanden staan lokaal onder
`/home/codex/.local/state/veyocast-s289/`: `browser-before.log`,
`browser-final.log`, `browser-final/`, `browser-lint.log`, `foundation.log`.
Er zijn geen dependencies, migraties, merkassets of Playerbestanden veranderd.

## Volledige CI-controle

De eerste volledige Control-CI-run haalde 600 browsergevallen, maar stopte
bij de vaste checksum van `sync-source.css` in de mobiele platformfixture.
Die controle had de bedoelde klassenaamwijziging nog niet verwerkt. De
controle behoudt nu juist de historische checksum en normaliseert alleen
`.sync-data-table` terug naar `.ad-table` voordat zij vergelijkt. Alle overige
CSS-bytes en alle andere beschermde hashes blijven exact verplicht. De
werkelijke browser laadt de nieuwe CSS zonder deze normalisatie. Een aparte
bytevergelijking bevestigt dat uitsluitend de klassenaam is veranderd.
