# S214 — Studio-templatekiezer en v17-opslagherstel

## Doel

Herstel het aanmaken van de in S213 ingevoerde OnzeTrots v17-templates en maak
de templatekeuze bruikbaar op kleine en grote schermen. Verwijder de dubbele
Studio-kop uit het contentgebied; de shell blijft de enige paginakop.

## Scope

- verwijder `Jouw Studio` en de dubbele introductieregel uit het contentgebied;
- vervang de lange wand van volledige templatepreviews door een compacte,
  filterbare keuzelijst en één geselecteerde live-preview;
- laat de preview contain-schalen in liggende en staande viewports;
- accepteer uitsluitend de exacte gekoppelde Sites v11- en v17-identiteiten in
  alle databasegrenzen voor Studio, dynamische configuraties en publicaties;
- behoud RLS, immutable releases, providerdata uit de database en bestaande
  v11-compatibiliteit;
- leg regressies vast voor serveractie, echte Studio-RPC, RLS en mobiele en
  desktopinteractie.

## Niet wijzigen

Geen providerfetch vanuit slides, mutable publicatie, service-role in de
browser, nieuwe ontwerpversie bij een bronrefresh, reconstructie van merkassets
of wijzigingen aan Player/offlinegedrag.

## Gates

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:reset`,
`pnpm test:rls`, `pnpm test:a11y`, `pnpm test:e2e -- --project=chromium` en een
gerichte Studio-interactiematrix op 390×844 en 1440×900.
