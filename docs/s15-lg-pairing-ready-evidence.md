# S15 — LG-koppelklaar evidence

## Opgeleverd

- de lokale S13/S14-keten is fast-forward naar `main` gemerged;
- `/dashboard/screens` bevat geen fictieve vloot of read-only pairing meer;
- tenant-/platformbeheerders kunnen server-side een scherm aanmaken en een
  tijdelijke Player-code claimen;
- RLS en `claim_pairing_session_v2` blijven de autoritatieve tenant- en
  rolgrens;
- live schermstatus toont echte Player, playlist, actieve/gewenste release,
  heartbeat en opslag;
- Control en Player hebben secretvrije readinessroutes;
- standalone Control- en Playerimages, FFmpeg-worker en Caddy/TLS staan in
  `infra/production`;
- de normale live E2E-keten koppelt voortaan via **Schermen**, niet via de
  tijdelijke Pilotflow.

## Verificatie

- `pnpm lint`, `pnpm typecheck`, `pnpm test` en `pnpm build`: groen;
- `pnpm db:reset` en 118 RLS-tests: groen;
- volledige Chromium E2E: 34 groen, 1 bewuste live-opt-in skip;
- expliciete Playergate: 19 groen; offlinegate: 7 groen;
- a11y inclusief 390 px sequentiële Schermenflow: 9 groen;
- opt-in live Supabase-keten via de normale Schermenroute: groen;
- Compose-config en Caddy 2.10.2-config: geldig;
- Control-, Player- en workerimages: gebouwd; niet-root runtime-ownership hersteld;
- standalone Playerimage met geldige buildconfig: HTTP 200 `pairing: ready`;
- workerimage: FFmpeg 7.1.5 aanwezig en uitvoerbaar.

## Claimgrens

De software en deploymentingang zijn koppelklaar. Werkelijke compatibiliteit,
autostart, opslagpersistentie, autoplay en power recovery op het gekozen LG-model
zijn pas bewezen na de volgende fysieke sprint.
