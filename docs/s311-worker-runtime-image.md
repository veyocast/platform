# S311 — Kleinere, geïsoleerde Worker-runtime

## Aanleiding en bewijs

De nieuwe stagingbuilds `42987483267` (5fc6) en `42995791952` (56a4) faalden
met daadwerkelijke GitHub-runnerannotaties `No space left on device`. De
bestaande releaseguard weigerde terecht de onvolledige 5fc6-images te overschrijven
bij retry `42990506267`. Staging en productie bleven gezond op 5fa981c3.
Ook 10,25 GB vooraf gemeten vrije hostruimte bleek voor de tweede build onvoldoende.
De exacte laatste Dockerinstructie is door verloren runnerlogs niet bewezen;
de daaropvolgende inventaris zag drie extra images, geen actieve builds en
nog steeds geen complete geactiveerde release.

Geautoriseerde bestaande onderhoudsruns verwijderden uitsluitend ongebruikte
BuildKit-cache ouder dan één uur, met gelijke fingerprints voor images,
containers en volumes vóór/na. Run42990111399 maakte gemeten 3.644.764.160 bytes
vrij; run42998279683 nog 4.604.047.360 bytes. Dit is geen garantie voor voldoende
bouwpiek. Er zijn geen runtime-/rollbackimages, databases of secrets verwijderd.

De broncode kopieerde voor de Worker de volledige `/app` uit de algemene
dependencies-stage, inclusief alle web-/mobiele dependencies en niet benodigde
repositoryinhoud. Die overbodige runtimekopie is concreet vastgesteld, niet
alleen afgeleid uit een statuslabel of geschatte schijfbezetting.

## Gerichte wijziging

`prepare-worker-runtime.mjs` volgt de werkelijk geïnstalleerde dependency-,
optional- en peerbindings vanaf de bestaande Worker en haar benodigde `tsx`-
loader. De versies komen uitsluitend uit de voorafgaande bestaande frozen
installatie. Er wordt niets opnieuw uit de registry opgelost; package- of
lockfilewijzigingen zijn niet nodig. Een experimentele lokale legacy-deploy
van pnpm11 bleek opnieuw te resolven en is daarom uitdrukkelijk niet gekozen.

De packager bewaart bronstructuur en relatieve links, transitieve workspace-
sources/JSON, volledige externe pakketten inclusief native libraries/TTF's,
de bestaande configuratie en alle `apps/player/public`-renderassets. `tsx`
blijft beschikbaar op het oorspronkelijke rootpad voor de onveranderde
entrypoint- en operationele probecommando's. Niet-runtime-devdependencies,
andere apps, documentatie, tests, checkoutcaches en `.env` worden niet gekopieerd.
Ontbrekende vereiste dependencies/assets of onveilige paden stoppen de build.

Een afzonderlijke Dockerstage bereidt deze runtime voor; de uiteindelijke
Worker kopieert uitsluitend `/runtime`. Dezelfde Nodebasis, Chromium/FFmpeg-
installatie, niet-rootgebruiker en `node --import tsx apps/media-worker/src/index.ts
--loop` blijven behouden. Webimages, queue/publicatiecode en deployworkflows
zijn niet gewijzigd. De manifestreceipt bevat de bron-lockfilehash en de exacte
gekopieerde pakketversies, aantallen en bytes, geen omgevingsvariabelen/secrets.

## Verificatie

- 12 gerichte packagerregressies groen: originele bytes, scoped exports,
  transitieven/cycli, peers/optionals, gedeelde store, npm-builtin-namen,
  ontbrekende loader/dependency/assets, bron-/doeloverlap, symlinks en behoud
  van Docker-Webbuilds/Worker-entrypoint.
- 63 bestaande lifecycleproeven groen; de aanvullende 93 CI-/isolatie-/toolchain-
  en concurrencyproeven groen. ESLint, Bash-syntax en ShellCheck groen.
- De werkelijk geïsoleerde lokale payload bevat 153 pakketten, 5.213 bestanden
  en 208.512.697 bytes (circa209MB); geen Next/Expo/React Native/Vitest/Playwright-
  testpakket. Alle startupimports en de echte esbuild-browserbundle werken
  zonder broncheckoutfallback. Dit is payloadgrootte, niet de volledige image.
- De echte geïsoleerde runtime-smoke controleert 354 lokale assets op lengte/
  SHA256, alle Studio-fonts en native SVG/Sharp, zes echte Chromium-RSS-captures
  op 1920×1080/1080×1920 en een menupagina met 16 producten. Allemaal groen.
  Lokaal komt Chromium uit de bestaande Playwrightcache; H.264/ffprobe draaien
  echt via de aanwezige S222-toolcontainer, niet via gefingeerde uitvoer.
- De normale Foundation-gate bouwt daarnaast de daadwerkelijke nieuwe Docker-
  Workerimage en draait dezelfde volledige smoke als niet-root, netwerkloos,
  read-only en zonder capabilities. Die hostedimage gebruikt de eigen APT-
  Chromium/FFmpeg. Een ontbrekende binary of mislukte render faalt deze gate.

Volledige hostedgates, werkelijke imagegrootte en exacte staging-/productie-SHA
worden als controleerbaar PR-/runbewijs toegevoegd. De oorspronkelijke
applicatie-, DB/RLS-, opslag/publicatie- en Player-bewijzen staan in PR339 en
de bijbehorende hotfixdocumenten; fysieke TV-/klantsessieacceptatie is niet
door een lokale of hosted containersmoke vervangen.
