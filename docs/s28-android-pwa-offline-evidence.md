# S28-G Android PWA en offline statusevidence

## Resultaat

De hosted Player biedt op Android een installeerbare PWA-ervaring zonder een
native-appclaim. Wanneer Chromium de installability-event aanbiedt, opent
`Player installeren` de echte browserprompt. De browser en gebruiker houden de
eindbeslissing; automatische installatie zonder bevestiging is technisch en
productmatig niet toegestaan. Andere Android-browsers krijgen een concrete
menu-instructie. In standalone-modus, na installatie, na sluiten en tijdens
netwerkverlies blijft de installatiekaart weg.

Android bouwt de launch-splash uit het PWA-manifest: Ink Black
`background_color`/`theme_color`, VeyoCast Player als appnaam en de goedgekeurde
maskable 512-pixelafgeleide. Er is geen nieuw of aangepast logo gemaakt.

## Offline gedrag

Service-worker shellcache `veyocast-player-shell-v3` bevat vóór activatie:

- `/` en `/manifest.webmanifest`;
- de locked setup- en maskable merkassets;
- alle `/_next/static/` scripts, styles en fonts die de eerste HTML-render
  nodig heeft.

Media blijft checksum-gebaseerd in de afzonderlijke assetcache en releases
blijven atomisch in IndexedDB. Een offline reload gebruikt daardoor de lokale
app-shell en de last-known-good release. Het netwerk-event verandert bestaande
playback direct naar `OFFLINE_PLAYING`; een herstelde verbinding start meteen
een manifestcontrole. Ook een onbereikbare Player-origin achter nog actieve
wifi wordt als verbindingsverlies gesignaleerd.

Tijdens online playback is geen publiek diagnosepaneel meer zichtbaar. Alleen
bij aantoonbaar verbindingsverlies verschijnt rechtsonder de tekstchip `Geen
internetverbinding`. De chip onderbreekt playback niet en verdwijnt na herstel.
De volledige technische status blijft uitsluitend als verborgen test- en
toegankelijkheidscontract beschikbaar en wordt via heartbeat aan Control
gerapporteerd.

## Geautomatiseerde bewijslast

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` — Player 42 unit/contracttests, alle workspaces groen
- `pnpm build` — 12 workspacebuilds groen
- `pnpm test:a11y` — 19 geslaagd
- `pnpm test:e2e -- --project=chromium` — 58 checks, 2 bewuste live-skips
- `pnpm test:player` — 27 geslaagd
- `pnpm test:player:offline` — 7 geslaagd

De browserchecks bewijzen Android-only promptgedrag, native promptaanroep,
desktopuitsluiting, shellprecache, offline reload, Cache Range 200/206/416,
last-known-good playback, onbereikbare-origin-detectie en automatische
chipverwijdering na herstel.

## Bewuste bewijsgrens

Android/Chromium is geautomatiseerd gesimuleerd. De uiteindelijke OS-installatie,
launcherplaatsing, door Android gegenereerde splash, storage persistence na
power cycle en vendorbrowsers moeten nog op de gekozen fysieke Android-player
worden afgetekend. Voor LG blijven het aparte fysieke protocol en de hosted
versus packaged beslisregels ongewijzigd.
