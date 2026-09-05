# S150 — Rustige bezoekerswelkomstkaart

Status: `READY_FOR_RELEASE`

Deployment: `NOT_DEPLOYED`

Datum: 5 september 2026

Branch: `veyocast/s150-welkomstkaart-layout`

Baseline: `ca7edf9ac522289a44b576b369778be359a37f17`

## Besluit

De bezoekerswelkomstkaart heeft één vast Playercontract. Pagina's hebben twee
halve slots en tonen per bezoeker uitsluitend club/team, aanvang met veld en
kleedkamer. De kaart gebruikt hetzelfde checksumgebonden logo als 30%-beeld
over de volledige achtergrond en als groot beeld op een witte rechterplaat.

Landscape deelt horizontaal, portrait verticaal. Bij één item blijft de tweede
helft leeg. De gedeelde view sorteert de eerstvolgende wedstrijd vooraan en
normaliseert ook oudere snapshots waarin aanvang, veld en kleedkamer nog in
samengestelde teksten stonden. Modern en Static LG gebruiken hetzelfde
contract; bezoekersmotion beperkt zich tot opacity en transform.

## Data- en releasegrens

- `private.build_dynamic_snapshot_data` blijft een private, gerevoke
  `SECURITY DEFINER`-keten met expliciete lege `search_path`.
- De S150-wrapper zet titel, drie-regelcopy, twee kaarten en verborgen
  irrelevante velden vast voor uitsluitend `sport_visitor_arrivals`.
- De bronwedstrijd bepaalt lokale aanvangstijd en eerstvolgende volgorde.
- Actieve `latest`-slides worden via `queue_latest_dynamic_snapshots_v2`
  opnieuw aangeboden wanneer hun inhoudshash wijzigt.
- Historische snapshot- en releaserijen worden niet bijgewerkt of verwijderd.
- Providerlogo's blijven uitsluitend lokale checksumgebonden release-assets;
  provider-URL's bereiken de Player niet.

## Visueel bewijs

- `tests/player/welcome-arrivals-motion.spec.ts-snapshots/welkomstgrid-1-landscape-chromium-linux.png`
- `tests/player/welcome-arrivals-motion.spec.ts-snapshots/welkomstgrid-2-landscape-chromium-linux.png`
- `tests/player/welcome-arrivals-motion.spec.ts-snapshots/welkomstgrid-1-portrait-chromium-linux.png`
- `tests/player/welcome-arrivals-motion.spec.ts-snapshots/welkomstgrid-2-portrait-chromium-linux.png`

Alle vier beelden zijn lokaal visueel gecontroleerd op halve-slotgeometrie,
drie regels zonder wrapping, 30%-achtergrondlogo en witte logoplaat.

## Lokale verificatie

Groen:

- `pnpm --filter @veyocast/player test -- app/_lib/dynamic-template-view.test.ts`
  — 48 bestanden, 246 tests
- `pnpm --filter @veyocast/content-templates typecheck`
- `pnpm --filter @veyocast/player typecheck`
- `pnpm db:reset`
- gerichte `rls_s150_welcome_card_layout.sql` — 14 assertions
- `welcome-arrivals-motion.spec.ts` — 4/4 Chromium
- gerichte bezoekerscase uit `lg-legacy-player.spec.ts` — 1/1 Chrome 79
- `pnpm lint` — 30/30 taken
- `pnpm typecheck` — 30/30 taken
- `pnpm test` — 30/30 taken
- `pnpm build` — 18/18 taken, inclusief client-secretgrenzen en webOS 6-guard
- `pnpm test:rls` — 72 bestanden, 1.742 assertions
- `pnpm test:a11y` — 36 geslaagd, 1 bewuste live-skip
- `pnpm test:e2e -- --project=chromium` — 191 geslaagd en 23 bewuste
  live/evidence-skips; één brede mobiele Control-routecheck liep onder
  resourcecontingentie in een timeout en slaagde daarna geïsoleerd 1/1 in
  54,8 seconden
- `pnpm test:player` — 117 geslaagd
- `pnpm test:player:offline` — 7 geslaagd
- `pnpm exec supabase db lint --local --level warning` — geen S150-bevinding;
  negen reeds bestaande waarschuwingen in zes oudere functies
- `git diff --check` en changed-diff credentialscan

Nog open in de releasefase: PR/CI, exact-SHA staging en exact dezelfde
production-SHA.

## Bekende grenzen

- Een ontbrekend providerlogo wordt niet verzonnen; de copy gebruikt dan de
  beschikbare kaartbreedte zonder witte logoplaat.
- Een uitzonderlijk lange club/teamnaam mag gecontroleerd over meerdere regels
  lopen. De twee detailregels blijven één regel; ontbrekende waarden tonen
  `volgt` in plaats van providerdata te verzinnen.
- Fysieke LG-hardware is in deze sprint niet opnieuw getest; de bestaande
  Chrome 79-compatibiliteitsroute en webOS-buildguard zijn wel verplicht.
