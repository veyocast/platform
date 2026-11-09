# S301 — Sportlink-seizoenswissel

Basis: `da3d1242c92beedee3e8d8d8d2c8d35404ab4ae6`. Opdracht: fase D / hoofdstuk05 uit de overdracht van9 november2026, SEI-01–12 en INT-09/10. AGENTS en toepasselijke technische/design/Publisher/security/offline/dynamische-data-canons blijven leidend. Root beheert PLANS/TASK_LEDGER, gedeelde barrel exports en release-integratie. Databaseagent beheert alle SQL/migrations/generated types in een seriële namespace; ontwerpvoorstellen eerst in `/tmp`, nooit zonder schrijfslot in gedeelde migrations.

Maak Bronnen→Sportlink→Seizoenswissel als één tenant- en taakgebonden werkplek. Inventariseer pagineerbaar oorspronkelijke gekoppelde ontwerpen, reeksen/zones en bekende huidige/toekomstige/terugkerende publicatie-/schermimpact; bundel hetzelfde object. Inventarisatie en preview schrijven niets en starten geen provider-/renderjobs. Toon onbekende afhankelijkheden als onbekend. Bewuste brede alle-team/context-selecties blijven breed en worden niet automatisch geselecteerd of gewijzigd. Handmatige ontwerpen, RSS/menu/campagnes horen niet bij de mutatieselectie.

Doelseizoenen en kandidaten komen uitsluitend uit toegankelijke genormaliseerde Sportlink-contexten en de bestaande resolver: tenant, verbinding/club, team, competitie, poule, seizoen en fase. Geen naam-, leeftijds-, kalenderjaar- of aftrapdatumfallback. Twee overlappende seizoenen en beker/competitiecontexten blijven onderscheiden; een verplaatste oude wedstrijd behoudt zijn oorspronkelijke canonieke identiteit. Onduidelijke kwalificaties vragen expliciete keuze.

Preview bindt oude→nieuwe identiteit, oorspronkelijke versie/revisie, oude bindinghash en actuele genormaliseerde broncontext/hash. Standaard niets geselecteerd. Bevestigde begrensde per-resourceopdrachten gebruiken bestaande permissies, actieve tenant, ontvangstbewijs vóór mutabele CAS, inhoudsverschil onder dezelfde nonce=conflict, en server-side reconstructie van uitsluitend bindingsvelden. Names/layout/huisstijl/duur/thuis-uit/overige instellingen blijven behouden. Gepubliceerde versies/releases en actieve/historische runbooks blijven immutable. Nieuwe concepten publiceren niet automatisch.

S300-runbookadapter: UUID+draftrevisie en exacte selectiecontext; nooit mainMatchId op naam/datum remappen. Als de nieuwe context bestaande geselecteerde matches uitsluit, vereist de preview expliciete clearSelectedMatches-bevestiging voordat matches=[]/mainMatchId=null wordt opgeslagen. Daarna moet een nieuwe exacte wedstrijd worden gekozen via S300. Finaliseer DTO/RPC/capabilitynamen samen met Playeragent vóór implementatie.

Toon opslag-/render-/preflight-/publicatie-/playerbewijs afzonderlijk. Link naar bestaande preflight/publicatie en geverifieerde herstelroute. Tests: previewgeenwrites, twee tenants/rollen, meerdere playlists/zones, echte source-health, doel ontbreekt, ambigue contexten/gelijknamige codes, oude verplaatste match, brede selectie, CAS+exacte retry+mismatch, partiële per-resourceuitkomsten, instellingenbehoud, publicatieimmutabiliteit en expliciete runbookclear. Mobiel/desktop/toetsenbord/a11y en normale lint/type/test/build/DB-RLS/Playwrightgates. Hosted staging en fysieke Player alleen claimen met werkelijk verzameld kandidaatbewijs.

Geen package/lock/workflow/serviceworker/brand/tokenwijzigingen. Geen productiefixtures/planningen of providercredentials. Gebruiker autoriseert normale staging-/productiepromotie; root voert onafhankelijke review en releaseworkflow uit.

## Uitgevoerde ownership en contracten

De dedicated DTO staat in `packages/contracts/src/sportlink-season-switch.ts`; root schreef alleen de additieve barrel-export. De drie publieke RPCs zijn `get_sportlink_season_switch_inventory_v1`, `preview_sportlink_season_switch_v1` en `apply_sportlink_season_switch_draft_v1`; alleen de bestaande actor-/tenantclient roept ze aan. De SQL namespace en beide SQL-bestanden zijn uitsluitend door databaseagent geschreven, onafhankelijk door root gereviewd en na de verse153/5154-gate bevroren. De migratie vereist de voorgaande S296-framehelper; geen siblingmigraties zijn gedupliceerd. Root integreert die dependency voordat er een geldige PR/CIketen wordt gestart.

De uiteindelijke code-/testpaden zijn:

- `apps/control/app/(shell)/dashboard/data-sources/sportlink/season-switch/page.tsx`
- `apps/control/app/(shell)/dashboard/data-sources/sportlink/source-workspace.server.tsx`
- `apps/control/app/(shell)/dashboard/slides/[slideId]/page.tsx`
- `apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/page.test.tsx`
- `apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/page.tsx`
- `apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/season-switch-actions.test.ts`
- `apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/season-switch-actions.ts`
- `apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/season-switch-data.server.test.ts`
- `apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/season-switch-data.server.ts`
- `apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/season-switch-filters.tsx`
- `apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/season-switch-state.test.ts`
- `apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/season-switch-state.ts`
- `apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/season-switch-workspace.tsx`
- `apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/season-switch.module.css`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/sportlink-season-switch.ts`
- `packages/contracts/test/sportlink-season-switch.test.ts`
- `supabase/migrations/20261109122540_s301_sportlink_season_draft_switch.sql`
- `supabase/tests/s301_sportlink_season_switch.sql`
- `tests/control/s301-season-switch.spec.ts`
- `tests/fixtures/s301-season-rpc.json`
- `tests/helpers/s301-season-fixtures.ts`

Eigen documentatie en twee screenshots staan onder `docs/implementation/s301-sportlink-seizoenswissel/`. De gecontroleerde browsercase gebruikt één exact bewaard rollback-only RPC-capture; ze claimt geen directe hostedDB- of fysieke Playerverbinding. De productiebuild was groen vóór de laatste uitsluitend Nederlandse impactstatelabels; de definitieve bron heeft opnieuw lint/typecheck en de volledige beperkte2-workerControltests. Normale CI herbouwt die exacte definitieve bron. Eerste parallellehosttimingfails blijven in bewijs benoemd; geen gate of timeout is versoepeld.

Root autoriseert na de concrete normale Player-CI-fout de beperkte bestaande
`player-runtime.tsx`-verbindingsadapter en `tests/player/connectivity.spec.ts`.
Gebruik uitsluitend de bestaande echte origintracker, behoud complete
assetverificatie, alle deadlines en lokale playback. Bewijs304→heartbeatfout
RED→GREEN; een positieve browserhint of los event mag geen actuele manifestcheck
claimen. Onderscheid de gerichte afzonderlijke S300-build van eigen volledige
S301-CI. Integreer S296/S298/S297 via gewone merges en houd alle deelbewijzen.
