# S118 — LG Menu Studio portrait hotfix

## Doel

Herstel de fysieke LG Legacy-weergave van een staand Menu Studio v2-menu zodat
dezelfde portraitstructuur, zones en leesbare maatvoering gelden als in de
gedeelde browserrenderer.

## Invarianten

- Menu Studio v2 portrait gebruikt één brede kolom; landscape en v1 blijven
  hun bestaande tweekolomscontract volgen.
- Alle flowblokken worden in portrait in bronvolgorde gepagineerd, ongeacht de
  opgeslagen landscape-kolompositie.
- Header, body en footer behouden exact de 1080×1920 Menu Scene-zones.
- Korte inhoud start bovenaan en wordt niet verticaal verdeeld of gecentreerd.
- De statische runtime blijft geschikt voor de ondersteunde webOS-browser en
  voert geen snapshotcode uit.
- Releases, cache, pairing en last-known-good playback blijven ongewijzigd.

## Acceptatie

- Een echte MenuDocument.v2-fixture toont op de LG-route exact één 936 px brede
  kolom op x=72 met een 1.388 px hoge body.
- Kop, categorie, product, prijs en footer gebruiken de gedeelde portraitmaten.
- De v1-prijslijstregressie toont nog steeds twee kolommen.
- Player-unit-, webOS-build-, LG-, browser-, offline-, a11y- en E2E-gates zijn
  groen vóór deployment van exact dezelfde SHA via staging naar productie.
