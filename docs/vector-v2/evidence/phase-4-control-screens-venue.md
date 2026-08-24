# Fase 4 — Control, Screen Health en Venue Twin

Datum: 24 augustus 2026  
Status: `DONE`.

## Geleverde productgrens

- Canonieke tenant feature flags staan default-off en verlenen geen rechten.
- Alleen een AAL2-platformoperator kan Venue Twin en Screen Health per tenant
  vrijgeven of via de kill switch intrekken; iedere mutatie schrijft audit.
- Venue Twin bewaart venues, optionele media-backed floorplans, zones en
  genormaliseerde schermposities met tenant-aware foreign keys en default-deny
  RLS.
- Alle browsermutaties lopen via capability-beveiligde, revision-aware RPC's.
- De schermvloot onderscheidt `online`, `syncing`, `stale`, `offline`,
  `unknown`, `unpaired`, `maintenance` en `disabled` op echte telemetry.
- Venue en positie verschijnen naast list/grid in een kaartweergave, in een
  gelijkwaardige tekstlijst en in Screen 360. Immutable releases en Player/LKG
  zijn niet gewijzigd.
- System Pulse toont naast schermen, publicatie, sync en opslag ook de echte
  integratiestatus `fresh/stale/error/disabled`.

## Security- en databasereadback

- Verse `pnpm db:reset`: groen, inclusief
  `20260824170000_s123_venue_twin_foundation.sql`.
- Gerichte pgTAP: `supabase/tests/rls_s123_venue_twin.sql`, 25/25 groen.
- Cross-tenant reads/writes, ongeldige mediarelaties, ongeldige coördinaten,
  ongeautoriseerde flags en ontbrekende AAL2 falen gesloten.
- De live browserflow gebruikt uitsluitend de seeded pilottenant; er staan geen
  service-role- of signingcredentials in screenshots of logs.

## Browser- en accessibilitybewijs

`VEYOCAST_LIVE_VENUE_E2E=1 PLAYWRIGHT_EXTERNAL_SERVERS=1 CONTROL_PORT=3101 pnpm exec playwright test tests/e2e/vector-control-venue-live.spec.ts --project=chromium`

Resultaat: 1/1 groen in 12,5 s tegen de production build en een verse lokale
Supabase-stack. De flow
bewees login, MFA, twee geaudite rolloutbesluiten, tenantcontext, System Pulse,
venue, floorplan, zone, schermpositie, Health en de mobiele lijstfallback.
Axe gaf nul violations op System Pulse, Venue Twin en Screen Health. Tijdens de
gate zijn een SSR-sessierace en twee bestaande contrasttokens bij de bron
hersteld.
De screenshots zijn op de exacte doelviewport vastgelegd; de mobiele filterdock
houdt zoekresultaat en bedieningsacties leesbaar zonder horizontale overflow.

Screenshots:

- `docs/screenshots/vector-v2/control/platform-rollout-1440x900.png`
- `docs/screenshots/vector-v2/control/system-pulse-1440x900.png`
- `docs/screenshots/vector-v2/control/venue-twin-1440x900.png`
- `docs/screenshots/vector-v2/control/screen-health-1440x900.png`
- `docs/screenshots/vector-v2/control/venue-twin-390x844.png`

## Bewuste grens

De floorplan-FK accepteert nu al alleen een veilige tenant-eigen, gereedstaande
afbeelding. De UI gebruikt totdat fase 5 de gedeelde Resource Picker integreert
een code-native kaart zonder fictieve gebouwdata; dit DoD-item blijft daarom
`IN_PROGRESS`. Venue Twin blijft achter `venue_twin` en Screen Health achter
`screen_health_view` totdat latere staging-/productiegates zijn afgerond.

## Brede regressiegates

- `pnpm lint`: 30/30 tasks groen.
- `pnpm typecheck`: 30/30 tasks groen.
- `pnpm test`: 30/30 tasks groen; Control 40 bestanden/181 tests.
- `pnpm build`: 18/18 tasks groen; Control authboundary en client-secretcheck
  inbegrepen.
- `pnpm test:rls`: 56 bestanden/1.128 assertions groen.
- Production-only readback legde frameworkcache op geauthenticeerde
  Supabase-requests bloot; de gedeelde SSR-client gebruikt nu expliciet
  `cache: no-store`. De production E2E bewees daarna iedere mutatie via reload.
