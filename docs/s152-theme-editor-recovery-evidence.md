# S152 — Theme-editor en opslagherstel

Status: `READY_FOR_RELEASE`

Deployment: `NOT_DEPLOYED`

Datum: 6 september 2026

Branch: `veyocast/s152-theme-editor-recovery`

Baseline: `138889a05da8cf3ebaabb425b09aa9d525347e3d`

## Productiereproductie

Een read-only inspectie en een expliciet teruggedraaide transactietest op de
actieve tenant reproduceerden de opslagfout exact als PostgreSQL-code `23514`:
`new menu documents must use FieldFlow 1.0.0`.

`update_tenant_control_settings_v5` schrijft de centrale theme-instellingen en
queue-t daarna atomisch nieuwe `latest`-snapshots. Die queue bouwt alle
relevante dynamische documenten opnieuw op. De S144 Menu-rendervalidator zag
een bestaand legacy Menu Studio-theme daarbij ten onrechte als nieuwe
authoring, waardoor de volledige instellingenmutatie werd teruggedraaid. Er is
tijdens de diagnose niets blijvend in staging of productie gewijzigd.

## Herstel

- `private.validate_menu_document_v2` valideert opnieuw zowel historische
  legacy als actuele FieldFlow Menu-documenten voor render- en refreshpaden.
- Een FieldFlow-document wordt voor de bestaande structurele legacy-validator
  uitsluitend tijdelijk naar de compatibele interne ID geprojecteerd.
- `private.enforce_fieldflow_dynamic_authoring_v1` blijft de echte
  insert/update-grens en controleert nu ook Menu-configuraties met een
  root-`theme.themeId`.
- Functierechten voor `PUBLIC`, `anon`, `authenticated` en `service_role` zijn
  na vervanging opnieuw expliciet ingetrokken.

Nieuwe authoring blijft daardoor FieldFlow-only, terwijl historische content
renderbaar blijft en de centrale tenantmutatie niet meer blokkeert. Geen
bestaande snapshot of immutable release wordt herschreven.

## Theme-editor

- De instellingenworkspace geeft de editor de volledige contentbreedte.
- Weergavemodus en tenantaccenten staan naast een live 16:9-voorbeeld wanneer
  ruimte beschikbaar is en onder elkaar op mobiel.
- Light/dark-paletten, kleurwaarden en contrastcontroles hebben een rustige,
  scanbare hiërarchie; alle overige semantische tokens blijven onder één
  geavanceerde actie bereikbaar.
- De oude primaire merkmetadata staat ingeklapt onder compatibiliteit met
  oudere slides en concurreert niet meer met de FieldFlow-authority.
- Bekende databasefouten krijgen veilige Nederlandse oorzaak-, effect- en
  herstelcopy zonder raw stacktrace.

## Verificatie

Groen op de actuele werkboom:

- gerichte Control-tests — 2 bestanden, 7 tests;
- Control unit — 63 bestanden, 353 tests;
- `pnpm lint` — 30/30 taken;
- `pnpm typecheck` — 30/30 taken;
- `pnpm test` — 30/30 taken;
- `pnpm build` — 18/18 taken, gevolgd door een groene finale Control-build;
- `pnpm db:reset` — alle migraties inclusief S152 vanaf nul toegepast;
- gerichte Menu Studio-pgTAP — 44/44, inclusief de volledige
  tenant-themecommand met één historische legacy Menu-slide en exact één
  gequeue-de snapshot;
- `pnpm test:rls` — 72 bestanden, 1.745 assertions;
- `pnpm exec supabase db lint --local --level warning` — geen S152-bevinding;
  negen bestaande waarschuwingen in oudere functies blijven zichtbaar;
- `pnpm test:a11y` — 36 geslaagd, 1 bewuste live-skip;
- brede Chromium — 191 geslaagd, 23 bewuste live/evidence-skips; één
  ongewijzigde `/dashboard/publications`-devservertimeout in de
  mobile-scrollmatrix, waarna die volledige matrix geïsoleerd 1/1 groen was in
  1,0 minuut;
- finale Settings desktop/mobile-browsercases — 2/2;
- handmatige desktop- en mobiele inspectie van de echte Settings-route, met
  contrastrijke voorbeeldcopy, volledig zichtbare kleurcodes en zonder
  horizontale overflow;
- `git diff --check`, dependency-metadatacontrole en changed-file
  credentialscan.

PR/CI, hosted advisors en exact-SHA staging-/productionreadbacks blijven
onderdeel van een afzonderlijke releasefase.
