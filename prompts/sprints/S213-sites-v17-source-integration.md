# S213 — Sites v17 bronintegratie en viewportfit

## Doel

Integreer Sites v17 commit
`6800bc858436ba0843eaea89b682cd5b43c3521d` in de bestaande servergebonden
VeyoCast-runtime. Gebruik dezelfde presentatie in Studio, preview, playlist en
Player. Behoud Sites v11-compatibiliteit, RLS, immutable publicaties,
last-known-good playback en de database-eerst providerdatastroom.

## Scope

- getypeerd v17-contract en 16 unified families;
- alle 17 Sportlinkfamilies plus LED, RSS en menu;
- bron-CSS, fonts en zes website-brushassets met vaste checksums;
- 32 liggende/staande Studio-starttemplates;
- gedeelde React- en Static LG-uitvoer;
- breedte- én hoogtegebonden contain-schaling voor alle schermformaten;
- echte teamlogo's met veilige initialenfallback;
- scanbare lokale QR-SVG zonder externe Playerlink;
- bron→doelmapping en concrete visuele/functionele bewijsgrenzen.

## Niet wijzigen

Geen nieuwe providerfetch vanuit slides, parallel opslagmodel, Supabasemigratie,
mutable release, service-role browsergebruik, nagebouwd logo of wijziging van
deploymentjobs. Providerrefreshes maken geen ontwerp- of playlistversie.

## Gates

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:a11y`,
`pnpm test:e2e -- --project=chromium`, `pnpm test:player` en
`pnpm test:player:offline`. Controleer daarnaast broncommit, CSS- en
assetchecksums, beide native oriëntaties en de bestaande immutable
publicatie-/offlinecontracten.
