# Platformbehoud, routebereik en gecontroleerde deployment

Onderzochte snapshots: Sites `b1cae899af19fc39908217253094c5240d7359fc`; GitHub `6fcc26f02c8050b7244e3660a93b85f02491e121`. Dit is brononderzoek op 11 oktober 2026, geen verklaring over de momenteel op VPS, Supabase of fysieke schermen actieve versie. Er zijn in deze audit geen repositories gewijzigd, builds uitgevoerd of deployments gestart.

## 1. Besluit: visuele bron en productruntime gescheiden houden

Neem de daadwerkelijke Sites-componenten, CSS, fonts, foto's, grunge-assets, templates, geometrie, flows en mobiele bediening over. Integreer ze in het bestaande VeyoCast-monorepo. Het gehele Sites-project als vervanger van Control uploaden zou echte auth, tenants, servermutaties, immutable publicatie, workerprocessing en Playerbetrouwbaarheid verwijderen.

De bindende ontwerpwijziging is de huidige opdracht van de eigenaar: Sites wordt de visuele en interactiereferentie voor alle daadwerkelijk aanwezige Sites-schermen. Leg deze delta expliciet vast in de bestaande designcanons. Veiligheid, locked officiële VeyoCast-assets, toegankelijkheid, immutable historie, rechten en offlinegaranties blijven gelden. Een niet in Sites uitgewerkte productieroute blijft bestaan en wordt consistent vormgegeven met dezelfde componenten; ze krijgt niet de onjuiste status ‘exact overgenomen’.

| Onderdeel | Sites-bron | VeyoCast-bron en overdrachtsbesluit |
|---|---|---|
| Routing | Eén `app/page.tsx`, browserhash en `app/prototype/app.tsx` | Echte Next App Router-routes in `apps/control/app`, `apps/marketing/app`, `apps/player/app` behouden; links, back, refresh, resource-ID's en rechten naar bestaande routes adapteren. |
| Runtime | Vinext 1.0.0-beta.5/Vite 8, React 19.2.6, Next-compatdependency 16.3.4, Cloudflare Worker; `package.json`, `vite.config.ts`, `build/sites-worker.ts` | Next 15.4.1-range/React 19.1-range, pnpm 11.5.2/Node 24, Turbo workspace. Neem het Sites-lockfile of de Worker-bootstrap niet over. Geen frameworkupgrade is nodig om de visuele code te integreren; dependencyverschillen afzonderlijk beoordelen. |
| Hosting/auth | Sites-hosting en ChatGPT-toegang; `.openai/hosting.json` heeft D1/R2 null | Bestaande Supabase Auth, AAL2, tenantcontext, RLS en VPS-hosting blijven authority. `app/chatgpt-auth.ts` en Sites Worker geen productieauth. |
| Mutaties | `veyocast-demo-*` localStorage, afbeeldingen in IndexedDB | Bestaande serveracties/services/RPC's en private assetpipeline. Lokale opslag uitsluitend toegestane persoonlijke voorkeuren en aantoonbaar tenantgescheiden conceptherstel; geen lokale ‘succes’ vóór serverbevestiging. |
| Publicatie | Lokale demo snapshots/schermtoewijzingen | Actuele publicatie wijst naar immutable configuratie; autorisatie, revision guards, targets, live data en Player acknowledgement blijven uit het platform komen. |
| Marketing | Eén `#/website`, interactief voorbeeld met democlaims/-prijzen | Alleen homebeeld/bediening overnemen naar `apps/marketing/app/page.tsx`; alle SEO-, juridische, contact-, demo-, setup-intent- en inlogroutes behouden. Prijzen en claims uit actuele productauthority, niet blind uit de mock. |
| Mobile beheer | Responsive DOM/CSS in Sites | Zowel responsive Control/PWA als de afzonderlijke native Expo-app bestaan al. DOM/CSS werkt niet rechtstreeks in React Native. PWA exact uitwerken; native dezelfde componenttaal en taakvolgorde afzonderlijk vertalen en als eigen gate rapporteren. |
| Schermweergave | Browserpreview van templates | Preview, thumbnail, workerposter, moderne Player en Static LG moeten dezelfde bevroren presentatie tonen. Geen Studio-runtime of onbegrensde browsercode naar de Player kopiëren. |

## 2. Routebereik

`ROUTE-MAPPING.csv` koppelt alle fysieke `page.tsx`-routes in Control en Player, de echte Marketing-routefamilies plus de gedeclareerde SEO-paden, native beheerschermen en de Sites-only hashfamilies aan hun migratiebesluit. CSV is een route- en contractinventaris, geen bewering dat iedere functie getest is. De guardkolom toont in de pagebron gevonden guards; verdere controle in parent layouts, acties, RPC's en RLS blijft verplicht.

Belangrijkste zichtbare mappings:

- `#/dashboard` → `/dashboard`; gebruik de Sites-overzichtscompositie met echte actie-inbox/telemetrie.
- `#/dashboard/playlists` → `/dashboard/playlists`; modale Sites-editor → `/dashboard/playlists/[playlistId]` met eigen mobiele stappen en browser-teruggedrag. Voeg niet opnieuw een mini-desktopeditor toe.
- `#/dashboard/studio` en `/edit` → `/dashboard/studio`, `/new`, `/[designId]`; vaste/dynamische slides blijven gekoppeld aan `/dashboard/slides/**`.
- `#/dashboard/studio/menu` → `/dashboard/slides/menu-studio/new` en `/[slideId]`.
- `#/dashboard/studio/sportlink` → `/dashboard/studio/sportlink/new` en `/birthdays/new`.
- `#/dashboard/studio/led-scores` → dezelfde route plus de reeds bestaande centrale `/goal-overlay`-route.
- `#/dashboard/sources/**` → bestaande sources-aliases/data-sources/integrations-routes; aliases en bestaande diepe links blijven geldig.
- `#/dashboard/screens` bevat lijst/groepen/zones/modale details; productie heeft afzonderlijke `/screens/new`, `/screens/[screenId]`, `/screens/groups`, `/screens/locations`, `/screens/health`. Alle blijven bruikbaar en krijgen dezelfde bediening.
- `#/platform` is slechts een eenvoudige demonstratie met drie tabs. Productie-tenants, lifecycle, rechten, billing, support, templates, Sportlink en systeembeheer mogen hierdoor niet verdwijnen.

Productieoppervlakken zonder volledige Sites-equivalent: inloggen/registratie/wachtwoordherstel/invitatie/MFA/onboarding/contextkeuze, billing/checkoutreturn, playlisttemplates, schema-/templatebeheer, centrale tenantthema-editor, uitgebreide Goal Overlay, daadwerkelijke productimportreview, schermdiagnostiek/locaties, pilotacceptatie, supportdetail en platformbeheer. Gebruik bestaande datavelden en transacties; maak consistente pagina's in het nieuwe design en voer gerichte review uit.

## 3. Auth, rechten en tenantveiligheid: bestaande grenzen verplicht behouden

Evidence: `apps/control/lib/control-session.ts`, `packages/auth/src/capabilities.ts`, `apps/control/app/(shell)/layout.tsx`, `(shell)/dashboard/layout.tsx`, `(shell)/platform/layout.tsx`, `docs/security-rls-canon.md`.

- Shell vraagt `requireControlSession`; dashboard vraagt `requireTenantControlSession`; platform vraagt `platform.system.read`. De actieve tenant wordt server-side opnieuw getoetst. Een gekozen dropdownwaarde is geen bevoegdheid.
- Alle read/write/publish/manage capabilities blijven afzonderlijk. Een editor heeft standaard wel content-/Studio-authoringrechten, maar geen playlistpublicatie of teambeheer. Een viewer krijgt geen upload/publiceerknop die toch een serveractie uitvoert; server en database blokkeren eveneens.
- Platformrollen blijven gescheiden van tenantrollen en custom werkrollen. Neem de vereenvoudigde vier Sites-rollen niet over als autorisatiemodel.
- Platformmutaties met AAL2, laatste-ownerbescherming, eigen toegang, eenmalige e-mail-/tenantgebonden uitnodigingen en paused/archived tenantguards blijven intact.
- Tenant A mag geen gegevens/Storage van tenant B lezen of muteren. Bewaar tenant-aware relaties, private Storage en server-only provider-/service-role secrets.
- Houd account- en tenantwisseling inclusief leegmaken van tenantgebonden lokale data; bestaand `clearTenantScopedLocalData` in Control-shell is relevant.

## 4. Bestaande featuregates en productfuncties

Evidence: `(shell)/_lib/vector-features.ts`, `lib/vector-features.ts`, `lib/ledscores-feature-state.ts`, betreffende serveracties/RPC's en `docs/integrations/ledscores-realtime-goal-alert.md`.

- Bestaande vectorflags: `vector_v2_design_system`, `vector_v2_control_shell`, `unified_resource_picker`, `unified_filter_dock`, `venue_twin`, `screen_health_view`, `engage`, `youtube_integration`. Beide shellflags bepalen de Vector-shell; deze niet stil activeren of met een tweede onbeheerd flagsysteem vervangen.
- LED `ledscores_realtime` heeft tenantvrijgave, featuredefinitie, globale noodstop en effectieve status. Behoud unavailable/definition_missing/globally_blocked/not_released/tenant_blocked én echte beschikbare toestand. Een fraaie Siteskaart betekent niet dat een tenant vrijgegeven is.
- Engage en YouTube tonen expliciet gecontroleerde rollout. Flag verleent nooit rechten; aantoonbaar ingeschakelde feature én capability/preflight blijven nodig.
- Menu/Twelve gebruikt de gecontroleerde productimport. ‘Twelve’ niet tot bewezen live API veranderen; production noemt expliciet Excel-import waar officiële API niet gekoppeld is.
- Sponsors bevatten meer dan de lokale Sitescampagne: behoud vier-ogen-beoordeling, sponsorplannen, targeting en Proof of Play.
- Nieuw OnzeTrots TV-thema vraagt een gecontroleerde contractwijziging. Huidige technical/security canons staan authoring uitsluitend als `fieldflow` toe; S161 gebruikt `royal-current-v8` als appearance/designrevision, geen tweede public theme-ID. Implementeer de gevraagde extra keuze end-to-end als versioned presentatie/thema met passende schema-/DB-/rendererondersteuning. Alleen de clientpicker aanpassen faalt. Historische thema's, Royal Current/Navy Glass en reeds gepubliceerde snapshots blijven decodeerbaar en ongewijzigd.

## 5. Mobiele topologie en platformbehoud

1. **Responsive Control + beheer-PWA:** `apps/control/app/manifest.ts`, `app/_components/control-pwa-runtime.tsx`, `public/sw.js`. Manifest start `/dashboard`. Serviceworker cachet alleen publieke shell/static/brand, geen geauthenticeerde HTML, API-antwoorden of signed media. Offline navigatie toont de veilige offlinepagina. Noem dit niet een bewezen offline editor alleen omdat Sites lokaal bewaart.
2. **Native beheerapp:** `apps/control-mobile` is Expo Router/React Native, met Vandaag, Content/playlists, Maken, Schermen, Meer; account, organisatiekeuze, beveiliging, meldingen en Engage. Communiceert via `/api/mobile/v1/**`, SecureStore/SQLite en bestaande sessiegrenzen. Afzonderlijke workflows voor CI, Play internal en production. Pixelgelijkheid vereist native vertaling, geen kopie van CSS.
3. **Player:** `apps/player` is een aparte Next-app; moderne en Static LG-renderers plus cached playback. Player is een device, geen Auth-user.
4. **Android signagehost:** `apps/android-tv` blijft bestaande Kotlin WebView-shell voor Android-telefoon/tablet/TV/Google TV. Dit is niet de native beheerapp. Geen nieuwe release-/cache-implementatie bouwen.
5. **LG signagehost:** `apps/lg-webos-signage` en distribution-IPK blijven aparte packaging/runtimecompatibiliteit. Fysieke model-/firmwareacceptatie en duurtest blijven aparte bewijsregels.

De Sites-app heeft deze hosts, stores, API's en deviceflows niet vervangen of bewezen.

## 6. Geen infrastructuurmigratie voor deze UI-overdracht

Evidence: `.github/workflows/deploy.yml`, `scripts/deploy-vps.sh`, `infra/vps/compose.yaml`, `infra/vps/worker.compose.yaml`, `docs/deployment/vps-deployment.md`, `docs/ci.md`.

| Omgeving | Service | Bestaande route/binding |
|---|---|---|
| Staging | Control | `staging-control.veyocast.nl` → `127.0.0.1:13000` |
| Staging | Player | `staging-player.veyocast.nl` → `127.0.0.1:13001` |
| Production | Control | `control.veyocast.nl` → `127.0.0.1:23000` |
| Production | Player | `player.veyocast.nl` → `127.0.0.1:23001` |
| Production | Marketing | `veyocast.nl` → `127.0.0.1:23002` |
| Beide | Mediaworker | Afzonderlijk `veyocast-<environment>-worker` Compose-project; geen publieke healthpoort |

Deze waarden staan in de bron. Live DNS/host/runnerconfiguratie is voor dit pakket niet geverifieerd. Caddy staat volgens het runbook op de host, Docker is rootless, staging/production hebben gescheiden Supabase-projecten. De deployworkflow bouwt Control, Player, Marketing én media-worker als SHA-images en promoveert dezelfde digests. Oudere prozaregels die alleen drie images noemen zijn onvolledig ten opzichte van het huidige script/workercompose.

Op `main`-push start staging. Production vereist `workflow_dispatch` met `deploy_target=production`, stagingbewijs, exacte actuele main-SHA en beschermde Environment. Geen Sites-deploy naar dit domein en geen los `git pull && next build` in de productieruntime. Marketing wordt gebouwd en tijdelijk gecontroleerd, maar heeft volgens dit runbook geen aparte stagingservice; visuele marketing-QA daarom vooraf in de reviewomgeving uitvoeren.

## 7. Uitvoerings- en stagingacceptatieplan

### Fase A — nulmeting en backwardscompatibility

- Lees huidige AGENTS/canons en werk vanaf een nieuwe geïsoleerde worktree/branch. Vergelijk actuele GitHub main met de vastgelegde SHA; behoud inmiddels toegevoegde functies en migrations.
- Leg actuele deployment-SHA's, database migration history, image-digests, featurecohort, player/runtimeversies en screenshotbaselines vast via bestaande toegestane operatorroutes. Rapporteer onbekende waarden als onbekend.
- Maak één route-/componentcontract met Sitesreferentie, productiequery/actie, capability, loading/empty/error/permission/offline state, visuele acceptatie en testbewijs.
- Houd source-updates en publicatie apart conform S185; geen bronrefresh die onbedoeld tientallen playlistreleases genereert. Behoud egress/cachecorrecties uit S186 en standen-/portraitcorrecties S187/S188.

### Fase B — opbouw in toetsbare stappen

1. Tokens/typografie/assets/shell en gedeelde componenten; geen demo-account, vaste tenant of vaste aantallen in productie.
2. Media + mobiele playlistlijst/editor/picker met serverpaginatie, TUS/upload/processing en revision guards.
3. Studios, alle templates/thema's, providerselecties, achtergrondbeheer en gedeelde projectie/worker/Player/LG-fallback.
4. Schermen/groepen/planning/publicatie/telemetrie met serverbeslissingen.
5. Alle overige tenant/platform/auth/marketingroutes; mobiele/PWA en eventuele native vertaling apart nalopen.
6. Volledige gates en releasebewijs; pas daarna stagingactivering via bestaande releaseketen.

### Fase C — testgates (uit te voeren door implementerende Codex)

Vanuit het echte monorepo, met de gepinde tools en frozen lockfile:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:reset
pnpm test:rls
pnpm test:a11y
pnpm test:e2e -- --project=chromium
pnpm test:player
pnpm test:player:offline
bash scripts/validate-github-actions.sh
bash scripts/validate-vps-deployment.sh
```

`db:reset` uitsluitend in de geïsoleerde lokale testdatabase, nooit staging/production. De repository-Playwrightconfig heeft een guard voor muterende tests en lokale Supabase; houd die actief. Foundation CI (`pr-gates.yml`) doet al lint/typecheck/unit/build plus twee gerichte media-egress/serviceworkerrangetests. Dit vervangt de volledige UI-/a11y-/Playermatrix niet. DB/RLS en native/wrapper-CI zijn path-scoped; bewijsgates bewust triggeren wanneer een gedeeld contract ze raakt.

Concrete acceptatiejourneys:

- Android Chrome 360/390/412 px, iPhone Safari 390 px, tablet 768/1024 en desktop 1440 px: geen horizontale overflow, modal binnen visual viewport, keyboard open, safe area, browser terug, focus en 44px-touchdoelen. Playlistbewerking met één hand.
- Op dezelfde fixtures naast Sites beoordelen: media zoeken/filteren, meerdere selecteren, upload van echt beeld én video, categorieën, favorieten/archief, playlist duration/reorder/undo, preview en opgeslagen reload. Test lege en 100+ items, lange titels, verdwenen assets en uploadfout.
- Twee gebruikers op hetzelfde concept: stale revision wordt uitgelegd, geen overschreven wijzigingen. Opslagfout geeft herstel, geen vals succes. Tenantwisseling lekt geen concept/media.
- Publiceer naar groep plus individueel scherm; controleer echte desired/download/verify/active/first-frame-status. Rollback/restauratie maakt een nieuwe configuratie; historie blijft identiek.
- Alle thema/templatefamilies in landscape én portrait, korte/lange lijsten, ontbrekend logo/score, lange teamnamen, bronstoring, live update zonder timer-reset, doelpunt eigen/tegenstander, introvideo en vervolgslide. Templates op moderne Player, Static LG, thumbnail en poster vergelijken.
- Scherm offline → appherstart → geldige last-known-good; nieuwe release met corrupt asset wordt niet actief; nieuwere opdracht wint van oudere download. Warm afspelen gebruikt lokale bytes, geen herhaalde mediabijdrage.
- Rollen tenant owner/admin/editor/viewer en platform owner/support/viewer; echte serverweigering bij onbevoegde write, AAL1/AAL2, paused/archived, cross-tenant resource-ID en Storagepad, flag uit/noodstop.
- Login/MFA/invite/reset, account- en organisatiekeuze, PWA-installeren/update/offlinepagina, native APIcompatibiliteit, support/billing/importreview blijven bruikbaar.
- Geen Pixelmatch-claim met alleen code/buildtest: bewaar ref/new/diff-captures, review iedere belangrijke state en leg bewuste functionele verschillen vast.

### Fase D — release en bewijs

- Merge via PR met groene relevante gates. De bestaande main-workflow bouwt eenmaal en activeert staging na migrationguard en healthchecks.
- Controleer op staging `/api/health` van Control en `/healthz` van Player op exact environment/revision, plus workerqueue/readiness uit de bestaande interne probe/releasegebonden heartbeat.
- Voer echte stagingkernjourney uit met gecontroleerde tenant en testdevices. Geen tests tegen live clubs uitvoeren zonder specifiek operationeel plan.
- Lever overzicht met SHA, migrations, routes, screenshots, fixtures, tests en skips, legacy/themacompatibiliteit, stagingreadbacks, devicehardwarebewijs en open punten.
- Production blijft expliciete releasehandeling nadat het concrete stagingresultaat is gereviewd. Hergebruik exact geteste digests en de bestaande auth-/Caddy-/secretsconfig.

## 8. Rollback en beperking

Bestaande `docs/deployment/rollback.md` blijft leidend: een eerdere immutable appimage alleen als ze het vooruit gemigreerde schema en nieuwe theme/payloadversies kan lezen. Geen DB-down-migration, geen verwijdering van historische releases en geen Playercache wissen. Nieuw thema eerst achter bestaande cohorteerbare rolloutgrens; uitbreiding stoppen bij pariteits-/authoringfout. Een oud image zonder nieuwe decoder is geen veilige rollback zolang nieuwe output actief is: eerst de publicatiecompatibiliteit regelen of een compatibele forward fix inzetten.

GitHub `TASK_LEDGER.md` heeft S185 nog `in_progress` en S186–S188 `review`, met afzonderlijke lokaal groen- en hosted/deploypendingvermeldingen. Dat is repositorydocumentatie en geen actuele hostingmeting. Het overdrachtspakket claimt daarom geen live deployment, geen reeds geslaagde migratie, geen pixelmatch en geen fysieke apparaatacceptatie.
