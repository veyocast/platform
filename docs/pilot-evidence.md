# S12 lokale pilotevidence

Uitgevoerd op 2026-07-18 vanuit castivo/s12-live-vertical-slice.

## Aantoonbaar werkende keten

De opt-in Chromium-test tests/e2e/live-pilot.spec.ts is volledig geslaagd:

- lokale Supabase password-login;
- server-side sessie- en tenantrollen;
- PNG magic-byte/MIME-validatie en private storage-upload;
- media-variantregistratie met SHA-256;
- conceptplaylist en immutable release;
- atomaire scherm- en desired-release-toewijzing;
- Player-owned device-token en gehashte pairingclaim;
- signed manifest en volledige assetverificatie;
- playback na complete activering;
- device-heartbeat en zichtbare Control-status.

De live test bracht drie integratiefouten aan het licht die laagtests niet
zichtbaar maakten: incomplete GoTrue-seedvelden, een verschil tussen pgTAP- en
PostgREST-JWT-claims en ontbrekende expliciete service-role tabelprivileges.
Alle drie zijn gerepareerd en in regressietests vastgelegd. Ook verschijnt
tijdens live provisioning niet langer kort een ongeldige democode.

## Geslaagde gates

- pnpm db:reset
- pnpm test:rls — 81 pgTAP-tests
- pnpm lint
- pnpm typecheck
- pnpm test — 11 workspace-taken
- pnpm build — alle apps en packages
- pnpm test:a11y — 8 tests
- pnpm test:player — 7 online/pairing/offline tests
- pnpm test:e2e -- --project=chromium — 20 geslaagd en 1 opt-in test overgeslagen
- CASTIVO_LIVE_PILOT=1 met de live-pilot Playwright-test — 1 complete live keten

## Bewuste grens

Het bewijs geldt voor afbeeldingen. De MP4-route met FFmpeg-worker, de 24-uurs
soak, productieprovisioning en operationele monitoring zijn niet bewezen. Deze
slice mag daarom niet als volledig productieklare mixed-media klantpilot worden
gepresenteerd.
