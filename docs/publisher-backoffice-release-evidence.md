# Publisher-backoffice release-evidence

**Branch:** `veyocast/s31-publisher-backoffice-canon`  
**Basis:** `85739a0`  
**Canon:** `VEYOCAST_PUBLISHER_BACKOFFICE_CANON_v1.0`  
**Datum:** 23 juli 2026

## 1. Geleverde productoppervlakken

| Oppervlak | Geleverde uitkomst |
|---|---|
| Shell | Vaste 224px sidebar, onafhankelijke navigatie-/contentscroll, exclusieve tenant/platformcontext, mobile bottomnav, command palette |
| Thema | Light/dark/system, compacte/comfortabele dichtheid en persoonlijke tabelkolommen |
| Overzicht | Actieprioriteit, rustige hiërarchie, quick actions, echte status en actorized activiteit |
| Media | Bibliotheek als hoofdtaak, raster/tabel, inspector-sheet, URLfilters, mappen, tags, favorieten, persoonlijke views, globale uploadtray, herstelbare archivering |
| Playlists | Visuele covers, status/gebruik, zoeken/filteren, create/duplicate/template-dialoog en revision-0-kopie zonder historie |
| Studio | Drie panelen vanaf 1200px, mobiele sheets, DnD, keyboard move, secties, iteminspector, schermpreview, autosave, recovery en immutable publishflow |
| Schermen | Actiegesorteerde vloot, cards/tabel, onboarding, bulk, groepen, assignmentbron, lifecycle en detailtabs |
| Planning | Agenda/week/maand, eenmalig/recidiverend, tijdvensters, weekdagen, timezone/DST, occurrence-conflicten en workeractivatie |
| Templates | Tenantgescheiden playlisttemplates en gecontroleerde conceptinstantiatie |
| Activiteit | Filterbare, begrijpelijke, actorized serveraudit zonder raw payloaddump |
| PWA | Manifest, iconen, installability, shellcache, offline-indicator en begrensd lokaal conceptherstel |

## 2. Veiligheids- en datacontract

- Mutaties voor playlistdetails, presentatie, itemproductiviteit, secties,
  publicatie, restore, groepen, planning, schermbulk en medialifecycle zijn
  tenantgescheiden guarded commands.
- Command-ID's zijn idempotent en leveren server-authoritatieve auditregels.
- `tenant_editor` kan niet publiceren; publicatie blijft voor managerrollen.
- Releases en release-items blijven immutable.
- Een releaseherstel maakt een nieuw concept en muteert geen historie.
- Video-itemduur wordt zowel in de editor als met een databasetrigger begrensd
  tot de gevalideerde bron- of trimduur.
- Scheduleconflicten worden op werkelijke occurrences bepaald, inclusief
  weekdagen, tijdvensters en DST.
- De Player houdt last-known-good, volledige verificatie en activatie op een
  item-/loopgrens.

## 3. Responsive en interactie-evidence

De routematrix controleert 320, 390, 768, 1024, 1100, 1280 en 1920px. De
belangrijkste gedragsgrenzen zijn:

- geen documentbrede horizontale overflow;
- cards worden mobiele taakflows en geen verkleinde desktop;
- filters blijven tot en met compact desktop in één disclosure;
- dialogs, sheets, bulkbars en mobiele Studio-acties respecteren safe areas;
- de Studio-inspector is vanaf 1200px het derde vaste paneel;
- touchtargets zijn minimaal 44px;
- reduced-motion schakelt niet-essentiële animatie uit;
- disabled publicatie blijft visueel en semantisch disabled;
- korte desktopviewports gebruiken de beschikbare hoogte zonder een
  geforceerde 720px-editor.

## 4. Uitgevoerde controles

| Controle | Resultaat |
|---|---|
| `pnpm db:reset` | groen; alle migraties plus seed opnieuw opgebouwd |
| `pnpm test:rls` | groen; 29 bestanden, 511 assertions |
| `pnpm lint` | groen; 20/20 taken |
| `pnpm typecheck` | groen; 20/20 taken |
| `pnpm test` | groen; 20/20 taken |
| `pnpm build` | groen; 13/13 workspaceprojecten |
| `pnpm test:player` | groen; 41 Chromiumtests |
| `pnpm test:player:offline` | groen; 7 Chromiumtests |
| `playwright test tests/e2e --workers=1` | groen; 11 geslaagd, 2 expliciet opt-in live tests overgeslagen |
| `playwright test tests/a11y --workers=1` | 21/22 in één volledige run; de enige dev-remountassertion is herhaalbaar gestabiliseerd en afzonderlijk groen |

## 5. Grote keuzes die expliciet openblijven

1. Een versieerbaar visueel template-rendercontract voor Control, manifest en
   Player.
2. Een algemene, versleutelde multi-intent offlinequeue met
   afhankelijkheden en mergebeleid.
3. Een afzonderlijke planningcapability en de bijbehorende tenantrolmatrix.
4. Optionele server-sync voor persoonlijke UI-voorkeuren.

Deze keuzes zijn niet nodig om de geleverde Publisher-workflows te gebruiken,
maar mogen niet impliciet via een lokale component of ad-hoc databasekolom
worden vastgezet.

## 6. Externe releasegates

- deployment naar staging en production;
- echte live-Pilotflow tegen een geconfigureerde Supabase-omgeving;
- fysieke Android TV/LG-validatie;
- 24-uurs mixed-media soak;
- restore-drill en operationele alertdelivery.

Er is vanuit deze branch niets gepusht of gedeployed.
