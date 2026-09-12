# S175 — LED Scores Goal Overlay 2.0

## Analyse vóór implementatie

Baseline: `28761ae`, schone werkboom; taakbranch
`veyocast/s175-goal-overlay-2`. Scope: LED Scores-contracten, connector en
catalogus, bestaande Control-databron/Studio, gedeelde goal-renderer, beide
Player-runtimes, additive Supabase-migratie/RLS en gerichte tests/documentatie.
Geen nieuwe dependencies, logos, groups, uploadpipeline of playlistmodel.

| Onderdeel | Bestaande implementatie en bevinding |
| --- | --- |
| Koppeling | `packages/integrations/src/ledscores.ts`, `apps/media-worker/src/ledscores-connector-runner.ts`: read-only scores-websocket op vaste host, workerleases, reconnect/baseline en beperkte persistfrequentie. |
| Teamkeuze | Control Studio `led-scores/page.tsx` laadt alleen `ledscores_team_mappings`; `alert-editor.tsx` filtert `side=own`. Geen teamcatalogussync. De databronpagina biedt handmatige mappingvelden. Eén mapping verklaart één keuze; er staat geen hardcoded Duindorp-productielijst. |
| Werkelijke catalogus | Read-only gecontroleerd op 12 september 2026: de bestaande provider gebruikt naast `/clubs/{slug}/scores/` ook de publieke `/clubs/{slug}/`-websocket. Die geeft een clubsnapshot met `id`, `slug`, `name`, `teams` en `matches`. Duindorp: club-ID 213, 57 teams, waarvan 13 eigen teams in de gecontroleerde catalogus. `teams[].type=home` onderscheidt eigen teams; beschikbaar zijn ID, naam, scoreboardnaam, logo, Sportlink-teamnaam/-code. De REST-clubroute gaf 403. Geen credentials nodig voor deze publieke catalogus. |
| Clubidentiteit | Club-ID en team-ID moeten samen aan de tenantverbinding worden gekoppeld. Een bestaande VeyoCast/Sportlink-club mag expliciet worden gekozen; nooit afleiden uit een gelijkende naam. Alleen allowlisted catalogusvelden worden opgeslagen; geen e-mail, rechten, volledig roster of rauwe clubsnapshot. |
| Home/away | Scoreboardpositie is onafhankelijk van own/opponent. Detector bepaalt delta en `scored.side`, mappings classificeren het team. `scoreboard.scored.id` is een scoreknop, geen speler-ID. |
| Goals | Exact +1, verse scoredatum/update, geen baseline/reconnectreplay, correcties en sprongen onderdrukt. SHA-256 canonical key plus database-uniqueness tenant/connection/key en event/screen. Late scorer wordt aan dezelfde goal verrijkt. |
| Transport | PostgreSQL screen-scoped deliveries → Supabase Realtime → server-side `/api/player/realtime` SSE → revocable devicecredential. ACK-outbox blijft duurzaam; een heartbeat bewijst geen render. |
| Groups | `screen_groups` + `screen_group_memberships` zijn many-to-many. Draft/version-groups targeten de union; overlappende groepen leveren één event per scherm. Hergebruik hiervan. |
| Publicatie | `ledscores_goal_alerts`, draft assets/groups, immutable versions/version assets/groups. Bestaande routines valideren capabilities, tenantstatus, featureflag, revision en media. JSONB bevat het bestaande versioned renderdocument; relationele resourceverwijzingen blijven relationeel. |
| Rendererfout | `ledscores-goal-overlay.module.css` combineert opgeslagen `signal-red`/wit-tekst met Royal Current `.content` op `--surface`. Een lichte tenantsurface erft zo witte tekst. Ook zijn eigen/tegenstander/canvas/preview afzonderlijke stijl-authorities. Werkelijke opgeslagen productieconfig is niet uitgelezen; dit is de aantoonbare CSS-conflictketen. |
| Theme | `tenant_settings` plus `tenant_theme_profiles` zijn autoriteit; `loadTenantStyleData`, `resolveTenantThemeAuthority` en frozen presentation ondersteunen fixed/scheduled/system mode. Player gebruikt immutable presentatie. Goal krijgt eigen expliciete light/dark kleuren, met tenantdefault en gevalideerde overrides. |
| Media | Bestaande resumable upload accepteert MP4 en WebM; worker normaliseert naar H.264 MP4 `player_1080p`, hash en metadata. Gebruik die variant ook voor intro; geen tweede upload. |
| Foto's | `ledscores_player_identities` koppelt tenant/connection/providerteam/providerspeler. Bestaande importer valideert providerfoto's en slaat content-addressed WebP op in private provider-assets. Ontbrekende foto mag goal niet blokkeren. |
| Oriëntatie | Moderne Player en Static LG kennen viewport/schermstand. Canvas heeft paired composities; normale content blijft releasegebonden. Goal-layout moet containerresponsief worden, geen vaste canvas-scale. |
| Interruptie | Moderne `useLedScoresRealtime` en Static LG vervangen nu de lopende goal. Timers begrenzen de gehele overlay; achtergrondvideo loopt in een loop, niet als intro. |
| Hervatten | `player-runtime.tsx` bewaart resterende itemtijd, pauzeert dezelfde video en houdt release en DOM gemount. LG heeft `pauseGoalUnderlay`/`resumeGoalUnderlay`. Dit vormt de interruptiegrens voor de hele queue. |
| Cache | Playlistassets zijn hash/size-gecontroleerd via `player-cache.ts` en `PlayerMediaStore`; LED-preload maakt nu alleen losse Image/video-elementen met signed URL. Nog geen duurzame, geverifieerde introcache. |

## Implementatieplan

1. Breid de bestaande verbinding/mapping uit met geverifieerde providerclub-ID,
   expliciete lokale clubrelatie en automatisch gesynchroniseerde catalogus.
   Behoud last-known-good catalogus bij bronfouten. Teamselectie gebruikt stabiele
   IDs en relationele draft/version-selecties.
2. Maak één centrale Goal Overlay in de bestaande Studio-routefamilie. Hergebruik
   media-upload, tenantstijl, multiselect, groups, capabilities en publicatie.
   Bestaande overige wedstrijdmomenten blijven afzonderlijk beschikbaar.
3. Eén begrensd contract en één renderengine voor preview, modern en LG, met
   expliciete kleuren per mode, variabelen, ontbrekende-datafallback en compositie
   per oriëntatie. Config en media worden immutable gepubliceerd.
4. FIFO-queue met dedupe en expliciete intro/enter/visible/exit/resume-states.
   Start overlay na `ended`; load/play/stallfouten slaan intro over. Houd playlist
   gepauzeerd tot de volledige queue klaar is; geen release- of device-reset.
5. Verifieer/cache intro's en statische beelden vooraf op checksum, hergebruik
   bestaande media-adapter en begrens opslag. Cachefout blokkeert playback niet;
   een ongecachete intro wordt overgeslagen en op de achtergrond voorbereid.
6. Test broncatalogus, clubbinding, RLS, synthetisch targeten, kleuren/optional
   content, intro/queue/state, hervatten, beide runtimes en bestaande gates.

## Geïmplementeerde architectuur

### Club-ID en dynamische teams

De LED Scores-verbinding bewaart het geverifieerde `provider_club_id` en kan in
**Databronnen → LED Scores** expliciet aan een bestaande VeyoCast/Sportlink-club
worden gekoppeld (`sports_club_id`). Een eenmaal geverifieerde provider-ID of slug
kan niet ongemerkt worden omgebonden. Teamselecties refereren relationeel aan
`tenant_id + connection_id + provider_club_id + provider_team_key`.

De worker leest de catalogus bij verbinden en iedere vijf minuten. Alleen
gewhiteliste identiteit-, naam-, actief-, categorie- en logovelden worden
verwerkt. Nieuwe teams worden toegevoegd; verdwenen teams worden inactief.
Bronfouten behouden de laatste geldige catalogus. De oude handmatige editor kan
een geverifieerde catalogus niet meer overschrijven. De centrale selector toont
de eigen teams (`type=home` in de catalogus), met zoeken, alles selecteren,
wissen en categorieën als de bron of een exacte Sportlink-koppeling die levert.
Een geselecteerd inactief team kan worden verwijderd, maar niet opnieuw gekozen.

De naam is een label, nooit de identiteit. De lokale Sportlink-teamkoppeling
gebruikt uitsluitend een exacte bronteamcode binnen de expliciet gekoppelde
club. Ontbreekt die code, dan blijft het LED Scores-team zelfstandig bruikbaar;
er wordt geen onbetrouwbare match op teamnaam gemaakt. De 57 teams uit de
gecontroleerde Duindorp-snapshot bevatten eigen teams én tegenstanders; dit is
geen lijst van 57 gegarandeerd gelijktijdig live gevolgde thuisteams.

### Centrale Studio en rendering

Route: `/dashboard/studio/led-scores/goal-overlay`.
De pagina heeft een responsive editor met een gedeelde live preview, concept
opslaan, publiceren, activeren/pauzeren en testen op één gepubliceerde groep.
Teams, groepen, twee introvarianten, inhoud, templates, kleuren, compositie,
typografie, afstanden en animatie-/zichtduur worden centraal beheerd. De score
blijft verplicht zichtbaar. Voorbeelden zijn herkenbaar als voorbeelddata.

`goal-overlay-renderer.ts` is de enige DOM/CSS-renderengine. De React-wrapper
wordt gebruikt door Studio en de moderne player; Static LG neemt dezelfde
renderer op in zijn bestaande compatibele runtime. Home/away verandert alleen
de gegevens. Light heeft een lichte kaart met expliciete clubkleurtekst; dark
gebruikt de tenantsurface met lichte tekst. Volgorde voor de primaire kleur:
tenant → betrouwbare teamkleur → Royal Current-token. Handmatige overrides
hebben voorrang. De bestaande Roboto-fontbestanden en expliciete kop-/tekstgewichten
voorkomen dat Studio en LG via hun omringende pagina verschillende fonts erven. Er is geen goal-rood als automatische fallback.

Containerafmetingen bepalen echte landscape-/portraitcomposities en vloeiende
letter-/beeldmaten. Dichte optionele inhoud krijgt minder ruimte binnen de kaart;
er wordt geen vaste desktopcanvas met `transform: scale()` verkleind. Ontbrekende
of onlaadbare beelden verdwijnen; een ontbrekend logo houdt de teamnaam zichtbaar.

Bekende spelers gebruiken de bestaande combinatie connection/team/player-ID.
Een handmatig gekoppelde foto uit de tenantmediabibliotheek heeft voorrang op de
geïmporteerde bronfoto. De scoreknop-ID wordt nooit als speler-ID behandeld.
Competitie wordt alleen uit een exact gekoppeld Sportlink-team toegevoegd;
wedstrijdnaam volgt de werkelijke teams. Speelronde en sportpark verdwijnen zolang
de gekoppelde bronadapter daarvoor geen betrouwbare eventgegevens levert.

### Eventflow en playlist

```text
Scorefeed → bestaande +1-detector / bronvalidatie / deduplicatie
  → geselecteerde gepubliceerde team-ID
  → union van bestaande schermgroepen → unieke aflevering per scherm
  → bestaande Realtime → device-authenticated SSE → FIFO (maximaal 20)
  → lokale intro laden → video playing → daadwerkelijk ended
  → overlay entering → visible → exiting
  → volgende goal, of dezelfde playlist hervatten
```

De bestaande detectie- en ACK-infrastructuur blijft gelden. Nieuwe centrale
versies vervangen de dispatch van oude goalconfiguraties binnen die tenant;
andere wedstrijdmomenten blijven bestaan. Er is één centrale configuratie met
relationele draft- en immutable version-teamselecties. De bestaande immutable
version-assets en version-groups blijven de publicatiegrens.

Een geaccepteerde goal onderbreekt een actieve goal niet. Dubbele deliveries en
bron-events worden onderdrukt. Reconnect-bootstrap levert maximaal twintig verse
goals in volgorde, plus de bijbehorende gepubliceerde versies. Binnenkomende
centrale goals zijn maximaal 120 seconden geldig; reeds geaccepteerde queue-items
krijgen bij activering voldoende lokale afspeeltijd. De queue houdt de bestaande
playlistpauze vast tot het laatste item klaar is. Release, itempositie, video-DOM,
overgebleven itemtijd en device-identiteit worden behouden. Geen playerreload of
playlistdownload door een Goal Alert.

Normale introvoltooiing gebruikt uitsluitend `ended`. Cache-/load-/playfouten
slaan de intro over. Een decoder die acht seconden geen voortgang maakt geldt als
videofout, niet als een geschatte videoduur. De clubkleur vult het oppervlak
terwijl de eerste videoframe wordt voorbereid. De tweede oriëntatie is een
`contain`-fallback met clubkleur rondom. Autoplay is altijd gemute.

Structured logs gebruiken de gevraagde `goal_event_*`, `goal_intro_*` en
`goal_overlay_*` namen met event-/connection-ID en beperkte foutcodes; geen
rauwe bronpayloads of persoonsgegevens. Delivery-ACKs blijven via de bestaande
duurzame outbox lopen. De bestaande `rendered` ACK markeert de gestarte
celebration; `goal_overlay_started` markeert specifiek de fase na de intro.

### Media en cache

MP4/WebM-upload loopt via de bestaande resumable media-upload en worker. De
bestaande geverifieerde H.264 `player_1080p`-variant is de playerintro. Er zijn geen
nieuwe dependencies of wijzigingen aan de uploadpipeline of service worker.

Moderne player en LG gebruiken de bestaande `PlayerMediaStore`-adapter met een
aparte retentienaam `veyocast-player-goal-assets-v2`. De sleutel is de SHA-256 van
de bytes; gewijzigde signed URLs veroorzaken geen nieuwe download. Bytes worden
op checksum gecontroleerd voordat ze lokaal bruikbaar zijn. Configuratie- en
bootstrapberichten bereiden intro's en cataloguslogo's op de achtergrond voor.
Downloads worden samengevoegd en begrensd: maximaal 128 MiB per asset en 256 MiB
voor de goalcache. Benodigde introhashes worden tijdens opruimen beschermd.
De playlist/LKG-cache wordt niet verwijderd of vervangen.

Bij het doelpunt wordt voor de intro alleen lokaal gelezen. Is die nog niet
gecachet, dan verschijnt direct de overlay en wordt de intro op de achtergrond
voorbereid. Een live goal wacht dus niet op een grote internetdownload. Optionele
beelden mogen terugvallen op hun ondertekende URL en verdwijnen bij een fout.
Opslagquota, een lege browsercache of extreem veel grote gepubliceerde
introversies kunnen tot overslaan van een intro leiden, nooit tot blokkeren van
de playlist. Zonder verbinding worden geen nieuwe live goals verzonnen.

### Database en uitrol

Migratie: `supabase/migrations/20260912105908_s175_goal_overlay_2.sql`.
Deze breidt bestaande connections/mappings/alerts/player-identities uit, voegt
draft/version-teamrelaties toe en introduceert begrensde catalogus-, clublink-,
centrale save-, dispatch-, test- en fotokoppelroutines. Tenant-aware foreign keys,
RLS, actor-capabilities, featurevrijgave, revision checks en immutable-versietriggers
worden gehandhaafd. Normale Studio-operaties gebruiken de gebruikerssessie.
Alleen de bestaande worker/devicebackend gebruikt de daarvoor bedoelde servicerol.

Uitrolvolgorde: migratie → worker, Control en beide player-runtimes → geverifieerde
clubkoppeling controleren → teams/groepen/media kiezen → concept opslaan →
publiceren → test op een kleine eigen schermgroep. Oude publieke dispatch- en
publishsignaturen blijven compatibel. Bestaande playlistreleases en eerder
gepubliceerde overlayversies worden niet herschreven.

Bij terugdraaien eerst de centrale overlay pauzeren en lopende queues laten
uitspelen; behoud immutable versie-, referentie- en deliverygegevens. De
compatibiliteitsroutines zijn bewaard onder `*_before_s175_v1`. Een downgrade is
een aparte gecontroleerde migratie, geen destructieve drop van tenantgegevens.
Deployment verloopt via de bestaande GitHub-pipeline: exacte main-SHA naar
staging, daarna dezelfde geverifieerde images naar productie. De gebruiker heeft
op 12 september 2026 expliciet commit, push en deployment van S175 opgedragen.

## Gewijzigde bestanden

| Gebied | Bestanden |
| --- | --- |
| Contracten | `packages/contracts/src/goal-overlay.ts`, exports en unit tests |
| Catalogus/detector | `packages/integrations/src/ledscores-catalog.ts`, `ledscores.ts`, `server.ts`, catalogustests |
| Worker/assets | `apps/media-worker/src/ledscores-connector-runner.ts`, `ledscores-player-assets.ts` |
| Clubbeheer | `apps/control/app/(shell)/dashboard/data-sources/led-scores/{page.tsx,actions.ts}` |
| Studio | `apps/control/app/(shell)/dashboard/studio/led-scores/goal-overlay/{page.tsx,editor.tsx,actions.ts,goal-overlay.module.css}`, gedeelde `studio-data.ts`, bestaande overzichtspagina en bijbehorende laadtest |
| UI/rendering | `packages/ui/src/components/multi-select-dropdown.tsx`, `packages/content-templates/src/goal-overlay-renderer.ts`, `goal-overlay.tsx`, exports |
| React-player | `apps/player/app/_components/{goal-celebration.tsx,ledscores-goal-overlay.tsx,player-runtime.tsx}` |
| Cache/transport/LG | `apps/player/app/_lib/{goal-media-cache.ts,goal-media-cache.test.ts,player-ledscores-server.ts,lg-goal-overlay-runtime.ts,lg-legacy-page.ts}`, `/api/player/realtime/route.ts` |
| Database | genoemde S175-migratie en `supabase/tests/rls_s175_goal_overlay.sql` |
| Browsertests | `tests/player/{goal-overlay-2.spec.ts,goal-overlay-2-renderer.spec.ts,ledscores-goal-alert.spec.ts}` |
| Documentatie | dit document en `TASK_LEDGER.md` |

## Verificatie en aandachtspunten

Uitgevoerd op 12 september 2026 in
`/home/codex/repos/castivo-s175-goal-overlay-2`:

| Gate | Resultaat |
| --- | --- |
| `pnpm lint --concurrency=2` | 30/30 taken groen |
| `pnpm typecheck --concurrency=2` | 30/30 taken groen |
| `pnpm test --concurrency=1 --env-mode=loose --force` | 30/30 taken groen, zonder testcache; 219 Vitest-bestanden met 1.335 tests plus 14 Node/webOS-tests |
| `pnpm build --concurrency=1` | 18/18 groen; laatste Control-build zonder de nieuwe CSS-compatibiliteitswaarschuwing; auth- en clientbundlegrenzen gecontroleerd |
| `pnpm db:reset` | Volledige lokale migratieketen en seed geslaagd |
| `pnpm test:rls` | 80 bestanden, 2.057 tests groen; nieuwe S175-suite 37/37 |
| Toegankelijkheid, volledige `tests/a11y` | Effectief 36 groen, 1 bestaande opt-in live-skip; één test tijdens een devserverherstart is afzonderlijk groen herhaald |
| Chromium, volledige `tests/e2e` | 40 groen, 13 bestaande opt-in live-/omgevingsskips |
| Brede `pnpm test:player` | Na gerichte herhaling 139 playerchecks groen, 2 bestaande externe visual-skips, plus 7/7 offlinechecks; de oude vervangingsverwachting is aangepast aan FIFO |
| Nieuwe natuurlijke video-einden | React en Static LG beide groen, echte browserdecoder en nul introdownloads tijdens de goal |
| Gerichte browserherhaling | 18/18 groen: nieuwe flow plus bestaande goal-/mobiele controles |
| Gebouwde productieplayer via `next start` | 20/20 nieuwe goal-/renderertests groen, inclusief natuurlijke video-einden; tests gebruiken gecontroleerde device/API-fixtures |
| Gecompileerde LG-inlinecode | Parseert; geen arrow functions, optional chaining of nullish coalescing |
| Nieuwe cataloguslezer tegen publieke bron | Geslaagd: club-ID 213, 57 teams, waarvan 13 eigen teams; alleen deze tellingen gelogd |
| `git diff --check` | Groen; door bestaande tests overschreven unrelated screenshots hersteld |

De a11y-, e2e-, gerichte player- en offlinebestanden zijn ook gezamenlijk via
`pnpm test:e2e tests/e2e tests/a11y tests/player-offline ... --project=chromium`
uitgevoerd. De brede run had twee timing-/herstartuitvallen; de volledige betrokken
bestanden zijn daarna zonder gelijktijdige builds opnieuw uitgevoerd (18/18).
Een parallelle unitrun raakte resource-time-outs. De definitieve run gebruikte
één Vitest-worker per pool en één Turbo-taak tegelijk; test-time-outs en assertions
zijn niet versoepeld. Een pakketgrenscontrole plaatste de nieuwe contracttest
terecht buiten `src`; deze staat nu in de bestaande `test`-map.

De nieuwe rendererchecks dekken 1920×1080, 3840×2160, 1080×1920 en 2160×3840,
light/dark, tenant/custom/fallbackkleuren, ongeldige/ontbrekende logo's,
foto-errorverwijdering en dichte optionele inhoud binnen de kaart. De flowchecks
dekken beide runtimes, home/away, wel/geen scorer en minuut, dubbele events,
queued goals, cachegebruik, videofout, handmatig gecontroleerd `ended` én
natuurlijk `ended`, behoud van document en dezelfde playlistonderlaag. Landscape-
en portraitcomposities zijn daarnaast visueel geïnspecteerd.

De wijzigingen staan in een geïsoleerde taakworktree. De nieuwe Studio-route is
gebouwd met de bestaande authgrenzen; live Studio-publicatie naar echte schermen
en fysieke LG/webOS-acceptatie zijn geen onderdeel van het lokale testbewijs.
De release is lokaal gevalideerd voor commit, PR en deployment. Hosted CI en
de exacte staging-/productie-uitrol worden in de PR en workflow vastgelegd.

Tenantkleur en modebeleid worden bij opslaan/publiceren bevroren, conform de
bestaande publicatiearchitectuur. Na een wijziging aan het tenantthema moet deze
Goal Overlay opnieuw worden opgeslagen/gepubliceerd om die nieuwe defaults over
te nemen. Dag-/nachtschakeling binnen het gepubliceerde beleid blijft automatisch.
