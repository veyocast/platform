# S26 Release Center, impact en preflight — evidence

Status: implementation review

## Geleverd operationeel domein

- `/dashboard/releases` toont echte tenant-scoped immutable releases met
  playlist, versie, actor, datum, releasenotitie, itemcount, duur, omvang,
  SHA-256-status en huidige/historische doelschermen.
- `/dashboard/releases/[releaseId]` toont release-items, deploymenthistorie,
  asset→playlist→release→screen-impact, versieverschil en uitrol per scherm.
- `/dashboard/playlists/[playlistId]/publish` is de begeleide publicatieroute
  boven de bestaande draft-ID en revisie. De route doorloopt readiness,
  Playerpreview, targets, preflight, releasegegevens en expliciete bevestiging.
  Gekozen scherm-ID's staan hervatbaar in de URL; er bestaat geen verborgen
  tijdelijke producttabel.
- Playlist Studio publiceert niet langer rechtstreeks vanuit het editorpaneel,
  maar leidt naar deze begeleide flow. Conceptwijzigingen vermelden hoeveel
  schermen pas na een volgende immutable publicatie veranderen.

## Golden releasediff en impact

`compareReleaseItems` in `@veyocast/domain` vergelijkt stabiele
`source_item_id`-waarden en SHA-256-checksums. Het resultaat houdt toegevoegd,
verwijderd, verplaatst en inhoudelijk gewijzigd afzonderlijk bij en berekent
netto duur- en byteverschil. De golden unit test fixeert deze classificatie en
de mensvriendelijke UI gebruikt assettitels in plaats van technische IDs.

De impactweergave gebruikt alleen databasefeiten:

1. immutable release-items verwijzen naar media-assets;
2. ieder item hoort bij één playlist en release;
3. append-only `release_screen_assignments` bewaart publicatie- en
   herallocatietargets;
4. `screens.assigned_release_id` toont de huidige toewijzing.

Archiveren of een oudere versie opnieuw toewijzen herschrijft daarom geen
release of release-item.

## Deterministische schermpreflight

`evaluateReleasePreflight` is frameworkvrij en classificeert `ready`,
`warning`, `blocked` of `unknown`. De vaste reason codes dekken:

- uitgeschakeld scherm en onderhoudsmodus;
- ontbrekende Player, heartbeat of verse heartbeat;
- expliciet incompatibele of onbekende manifestondersteuning;
- onbekende, aantoonbaar onvoldoende of krappe opslag.

Ontbrekende bytes worden alleen berekend uit de targetchecksums minus de
checksums van bekende active/previous releases. Opslaggebruik en quota worden
uitsluitend uit de nieuwste heartbeat gelezen en alleen gebruikt wanneer die
heartbeat maximaal twee minuten oud is. Een verse heartbeat zonder eigen
opslagmeting blijft eveneens onbekend. Een stale of ontbrekende heartbeat levert `missingBytes: null`,
`availableBytes: null` en `unknown`; hij wordt nooit stilzwijgend als voldoende
opslag of aanwezige cache geïnterpreteerd.

`blocked` kan niet publiceren of opnieuw toewijzen. Een geselecteerd
`warning`- of `unknown`-scherm vereist een expliciete riskbevestiging. De server
laadt revision, readiness, targets en preflight direct vóór de databasecommand
opnieuw, zodat gemanipuleerde hidden fields geen controle overslaan.

## Immutable reassignment en deploymenthistorie

De additieve migratie introduceert `release_screen_assignments` met `tenant_id
NOT NULL`, tenantindexen, default-deny RLS en reject-update/delete-triggers.
Alleen gecontroleerde security-definer commands schrijven nieuwe historie.

`reassign_playlist_release`:

- controleert tenantrol en actieve/non-disabled targets;
- wijzigt alleen de operationele `assigned_release_id` en
  `desired_release_id`;
- schrijft append-only targethistorie en een audit-event;
- muteert nooit `playlist_releases` of `playlist_release_items`.

De revision-aware publishcommand registreert voortaan eveneens ieder target in
de append-only historie. Bestaande huidige assignments worden bij migratie
veilig als historische publicatietargets vastgelegd.

## Playerprogressie en compatibility

De Player gebruikt `record_player_heartbeat_v2` en declareert
`manifestSchemaVersions: [1]`, SHA-256-ondersteuning en een begrensd platform.
Downloaden, verifiëren en switch-pending worden aan `desiredReleaseId`
gekoppeld; de actieve fase aan `activeReleaseId`. Release Center kan daardoor
per scherm `Gewenst`, `Downloaden`, `Verifiëren`, `Switch gereed` en `Actief`
tonen zonder een phase of percentage te verzinnen.

Players die sinds de migratie nog geen verse v2-heartbeat hebben verstuurd
blijven eerlijk `unknown` totdat zij opnieuw rapporteren.

## Security, forward en rollback

- Release- en deploymentreads blijven RLS-tenantgebonden.
- `anon` kan geen release heralloceren en `authenticated` kan geen
  deploymenthistory inserten, wijzigen of verwijderen.
- Viewer- en cross-tenant-herallocaties falen; disabled en cross-tenant targets
  falen atomair.
- De Player blijft een tokenbezittend device zonder Supabase Auth-user. Alleen
  zijn eigen token kan capabilities en voortgang van zijn assignment melden.
- De service-role key is niet aan browsercode toegevoegd.

Forward is additief: één tabel, drie commandupdates/toevoegingen en Playerroute-
gebruik. Voor rollback moet eerst de applicatie terug naar de oude
heartbeat/publicatiecode. Daarna kunnen v2-heartbeat, reassignment en de
append-only assignmenttabel worden verwijderd. Releases, items en huidige
screen/device assignments hoeven niet te worden herschreven. De historische
assignmentevents gaan bij het droppen van de tabel wel verloren en moeten vóór
een bewuste rollback worden geëxporteerd.

## Verificatie

| Gate | Resultaat |
| --- | --- |
| `pnpm db:reset` | geslaagd; volledige forwardmigratie vanaf nul |
| `pnpm test:rls` | geslaagd; 15 bestanden, 246 tests |
| Supabase DB lint | geslaagd; geen schemafouten |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` | geslaagd; 18 Turbo-taken per gate |
| `pnpm build` | geslaagd; Release Center en guided publish zijn dynamische serverroutes |
| `pnpm test:a11y` | geslaagd; 18 tests inclusief 390 px Release Center |
| volledige Chromium-suite | geslaagd; 47 tests en 2 expliciete live skips |
| live S26 E2E | geslaagd; upload, concurrencyguard, tweede echt scherm, unknown-confirmatie, immutable multi-screen publish, Release Center en mobiele reflow |
| golden domain tests | geslaagd; releasediff, active/previous bytes, stale heartbeat, incompatibiliteit en quota |
| `git diff --check` | wordt vóór review opnieuw uitgevoerd |

## Expliciete grenzen

- Preflight inventariseert niet live ieder Cache Storage-object. Dat zou de
  playercache onterecht tot centrale waarheid maken. Bekende active/previous
  releasechecksums plus verse Storage Estimate-telemetry vormen de
  conservatieve bewijsgrens.
- Download/verify is faseprogressie, geen verzonnen percentage; de huidige
  Player rapporteert nog geen bytecounter per pending download.
- Een browser- en lokale Supabase-test vervangt geen fysieke LG webOS-test of
  24-uurs mixed-media soak. Die blijven harde S30-releasegates.
