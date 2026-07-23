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

### Vastgelegde screenshots

De screenshots zijn rechtstreeks uit de lokale live tenantflow genomen met de
reproduceerbare pilotseed. Next.js-developmentchrome is niet onderdeel van de
beelden.

- `docs/screenshots/publisher-dashboard-desktop.png` — 1440 × 1000;
- `docs/screenshots/publisher-dashboard-mobile.png` — 390 × 844;
- `docs/screenshots/publisher-screens-desktop.png` — 1440 × 1000;
- `docs/screenshots/publisher-screens-mobile.png` — 390 × 844;
- `docs/screenshots/publisher-media-desktop.png` — 1440 × 1000;
- `docs/screenshots/publisher-media-mobile.png` — 390 × 844.

De visuele controle hiervan heeft twee aanvullende correcties opgeleverd:
SummaryStrip-inhoud kan niet meer door de vaste shellhoogte worden
samengedrukt en previews gebruiken uitsluitend een werkelijk bestaande
neutrale design-token.

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
| `PLAYWRIGHT_EXTERNAL_SERVERS=1 playwright test tests/a11y --workers=1` | groen; 22/22 tegen vooraf opgewarmde developmentservers |

## 5. Besluiten en resterende productgrenzen

| Vraag | Besluit | Resterende grens |
|---|---|---|
| Kunnen tenanttemplates worden aangepast? | Ja. S31-B laat metadata en bronplaylist wijzigen en maakt vanuit dezelfde Playlist Studio een nieuwe revision-guarded snapshot. | Vrij invulbare tekst-, beeld- en kleurzones blijven een afzonderlijk versieerbaar Player-templatecontract. |
| Moeten álle offline wijzigingen automatisch in een wachtrij komen? | Nee. De huidige uploadresume en Studio-herstel blijven de begrensde offlineoplossing. | Een algemene queue komt alleen terug met een expliciet conflict- en encryptiemodel. |
| Kan een tenant eigen rollen en rechten bepalen? | Ja. S31-B levert custom werkrollen voor content, publicatie, schermen, instellingen, audit en supportexport. | Eigenaarschap, rollenbeheer en de gedeelde leesbaseline blijven beschermd; planning volgt voorlopig contentauthoring. |
| Moeten voorkeuren tussen apparaten synchroniseren? | Nee. Thema, dichtheid, kolommen en opgeslagen views blijven persoonlijke browservoorkeuren. | Latere sync vereist een expliciete privacy- en retentiekeuze. |

De S31-B-implementatie en resterende grenzen staan in
`docs/s31b-configurable-templates-roles-evidence.md`.

## 6. Externe releasegates

- deployment naar staging en production;
- echte live-Pilotflow tegen een geconfigureerde Supabase-omgeving;
- fysieke Android-validatie op telefoon/tablet/TV en LG-validatie;
- 24-uurs mixed-media soak;
- restore-drill en operationele alertdelivery.

Er is vanuit deze branch niets gepusht of gedeployed.
