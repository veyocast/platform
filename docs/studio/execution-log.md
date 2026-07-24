# VeyoCast Studio — uitvoeringslog

## 2026-07-24 — repositoryanalyse

- Werk gestart vanaf `origin/main` op `veyocast/s40-studio`.
- Bestaande Control-, Publisher-, Player-, media-, worker-, capability- en
  RLS-grenzen geïnventariseerd.
- Vastgesteld dat geen bestaande mobiele/canvas- of Studio-runtime aanwezig is.
- Vastgesteld dat de worker FFmpeg en een service-role queuebackend bevat.
- Vastgesteld dat private media in `tenant-media` en tenant-prefixed paden staat.
- Vastgesteld dat custom rollen een databasewhitelist en effectieve
  capabilityfunctie gebruiken; beide moeten samen met `@veyocast/auth` wijzigen.
- Vastgesteld dat Player geen wijziging nodig heeft voor Studio-output.

## 2026-07-24 — implementatie en bewijs

- `@veyocast/studio` toegevoegd met versioned schema, 22 systemtemplates,
  geometrie, tekstlayout, motion, huisstijl- en rendercontracten.
- Tenantprojecten, guarded drafts, checkpoints, revisieherstel, renderqueue,
  exports, command receipts en brandkits met `FORCE ROW LEVEL SECURITY`
  toegevoegd.
- Control bevat een afzonderlijk Studio-overzicht, aanmaakflow, desktopeditor
  en mobiele quick-editflow. Publisher blijft de bestaande playlisteditor.
- De media-worker rendert immutable revisies naar sRGB-PNG of
  H.264/yuv420p/30fps-MP4 en voltooit deze als normale private media-assets.
- Schone `pnpm db:reset` en alle 625 RLS-assertions zijn groen.
- Repositorybreed lint, typecheck, tests voor 14 packages en productiebuild
  zijn groen. Studio heeft 14 contracttests; Control 83, worker 46 en Player 64.
- Vier gerichte Studio-browserchecks zijn groen. In de brede serie waren 30 van
  31 checks direct groen; de bestaande theme-persistentietest was groen bij
  geïsoleerde herhaling.
- De actuele production Docker-target is lokaal gebouwd. Echte vijfseconden
  codecsmokes waren groen voor 1920×1080 (7,473 s) en 1080×1920 (7,711 s),
  H.264, 30 fps, yuv420p, faststart en nul audio.
- Visuele screenshots zijn gecontroleerd op 1440×960 en 390×844.

## Open releasebewijs

- Eén echte stagingjob van opdracht tot zichtbaar Media-item en Publisher.
- Cancel/retry op staging met dezelfde te promoten image-digest.
- 10/15/30 seconden en complexe 25/100/200-laags productionbenchmarks.
- Fysieke playback/offlinecontrole op algemene Android-app, Google TV en
  beoogde LG-webOS/signagemodellen.
