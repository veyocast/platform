# S16 — Control authoring MVP evidence

## Opgeleverd

- **Media** leest uitsluitend echte tenantdata en ondersteunt private signed
  previews, zoeken/filteren, titelwijziging, veilig archiveren en een
  transactionele video-retry. Archiveren blokkeert zolang een conceptitem de
  asset gebruikt; immutable releases blijven altijd intact.
- **Playlists** ondersteunt live create, edit, media toevoegen, duration,
  contain/cover, muted video, keyboardreorder, verwijderen, archiveren, een
  bedienbare 16:9-preview, publicatiereview, multi-screen publicatie en
  releasehistorie.
- **Instellingen** bewaart verenigingsnaam, afbeeldingsduur, fit, muted video,
  schermoriëntatie en resolutie met owner/admin-autorisatie en auditregistratie.
  Nieuwe schermen en afbeeldingitems erven deze standaarden.
- **Security** gebruikt RLS default deny, een smalle settings-RPC, een
  transactionele reorder-RPC en een transactionele processing-retry. Viewer en
  cross-tenant mutaties zijn met pgTAP afgewezen.

## Mixed-media bewijs

Op 18 juli 2026 is een echte lokale keten uitgevoerd met een gegenereerde MP4
van 1280×720, 60 fps en AAC-audio:

1. authenticated tenanteditor uploadde de MP4 via de normale Media-route met
   een signed private Storage-upload;
2. de Docker-mediaworker met FFmpeg 7.1.5 claimde de echte queuejob;
3. FFmpeg maakte een `player_1080p` MP4-variant;
4. databasefinalisatie registreerde `ready`, `video/mp4`, 1280×720, 2,0 s en een
   SHA-256-checksum van 64 tekens;
5. de normale Playlistspagina voegde afbeelding en video toe, toonde beide in
   de preview en publiceerde een immutable release;
6. een nieuw gekoppelde Player downloadde en verifieerde de release, speelde de
   afbeelding en daarna de video muted af en rapporteerde een online heartbeat.

De opt-in Playwright-test in `tests/e2e/live-pilot.spec.ts` voert dezelfde keten
uit wanneer `VEYOCAST_VIDEO_FIXTURE` is gezet.

## Groene gates

- `pnpm db:reset`;
- `pnpm test:rls`: 133 tests;
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`;
- `pnpm test:a11y`: 11 tests;
- `pnpm test:e2e -- --project=chromium`: 37 groen, live test regulier
  overgeslagen;
- `pnpm test:player`: 19 tests;
- `pnpm test:player:offline`: 7 tests;
- opt-in live mixed-media Playwright-test: 1 volledige keten groen.

## Nog extern te bewijzen

- productie-Supabase, DNS, VPS, TLS, secrets, monitoring en backups;
- fysieke LG webOS Signage-model/firmwaretest;
- 24-uurs mixed-media soak en power/network recovery op het fysieke scherm.

Deze grenzen vereisen externe infrastructuur of hardware en veranderen niets
aan de lokaal bewezen authoring- en playbackketen.
