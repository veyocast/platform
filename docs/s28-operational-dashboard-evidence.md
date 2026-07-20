# S28 — Operationeel dashboard, resourcezoekfunctie en pairing-UI evidence

## Geleverde productflow

- `/dashboard` toont maximaal vier live KPI's: actie nodig, schermen online,
  media in verwerking en bevestigde playback.
- De actie-inbox wordt server-side afgeleid uit tenantgebonden schermen,
  devices, heartbeats, media, playlists, uitnodigingen en limieten.
- Elk signaal heeft ernst, leeftijd, stabiele deduplicatiesleutel, resource,
  deep link en contextuele uitleg met oorzaak, effect en herstelactie.
- Offline en langdurige synchronisatie wijzigen de Playerveiligheid niet: de
  geldige last-known-good release blijft leidend.
- De onboardingchecklist is uitsluitend afgeleid uit organisatiecontext,
  teamleden, gereed materiaal, playlistitems, immutable releases, schermen,
  gekoppelde devices en recente playbacktelemetrie.
- De lokale dashboardroute toont bewust een eerlijke lege staat en geen fake
  klant, KPI, notificatie, schermstatus of publicatie.
- `Ctrl/Cmd+K` zoekt naast capability-gestuurde navigatie ook echte resources.
  Iedere query gebruikt de actieve sessie, expliciete `tenant_id`-filters en
  Supabase RLS. In platformcontext worden uitsluitend toegankelijke tenants
  gezocht.

## Player pairing

- Pairing, boot, sync en herstel gebruiken het locked inverse VeyoCast-logo.
- Het landschapsscherm volgt een split-layout; portret schakelt naar een
  gestapelde flow zonder horizontale overflow.
- De zesdelige code gebruikt een groot monospaced, hoog-contrast codevlak.
- Apparaat, internetstatus, Player-versie, verloopstatus en het device-
  sessiemodel staan als secundaire diagnostiek bij de pairingstap.
- De rustige signaalanimatie duidt wachten op Control aan en wordt uitgeschakeld
  via `prefers-reduced-motion`.
- Normale playback is niet aangepast en bevat geen permanente branding.

Een QR-deeplink is niet toegevoegd: er bestaat nog geen canoniek, environment-
veilig Control-URL/deeplinkcontract dat een pairingcode kan claimen. Een
decoratieve of niet-werkende QR-code zou misleidend zijn. De bestaande veilige
codeclaim blijft de enige pairinghandeling.

## Security- en datagrens

- Geen nieuwe database- of storage-mutatie en geen serviceroletoken in
  browsercode.
- Geen acknowledge-status die een onderliggende failure kan maskeren.
- Searchresultaten bevatten alleen resourcevelden die nodig zijn voor label,
  type, status en deep link.
- De Player blijft een revocable device en geen Supabase Auth-user.

## Verificatie

De volledige lokale releasegate is groen:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:a11y
pnpm test:e2e -- --project=chromium
pnpm test:player
pnpm test:player:offline
```

- workspace gates: lint 18/18, typecheck 18/18, test 18/18 en build 12/12;
- unit: Control 43 tests, inclusief 2 nieuwe operationele afleidingstests;
- a11y: 18/18;
- Chromium E2E: 47 geslaagd, 2 live-pilottests correct overgeslagen zonder
  externe pilotcredentials;
- Player: 19/19;
- Player offline: 7/7;
- aanvullende gerichte Control browsercheck: 19/19;
- aanvullende gerichte pairing/a11y/offline check: 3/3;
- `git diff --check`: groen;
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, migraties en
  service-workerbestanden: ongewijzigd.

Visueel gecontroleerde viewports: Player pairing op 1920×1080 en 1080×1920;
Control-responsiviteit blijft afgedekt op 320, 390, 768 en 1280 px.
