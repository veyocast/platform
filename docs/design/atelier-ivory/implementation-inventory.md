# Atelier Ivory — implementatie-inventaris

Status: nulmeting vóór implementatie  
Branch: `veyocast/s50-atelier-ivory`  
Basiscommit: `8061cd7e1d1677cd78ea9699a5d4404575127bce`  
Bronnen: Atelier Ivory Design Canon v1.0, Component Library v1.0 en de vijftien unieke referentiebeelden uit `Screenshots.zip`

## Besluit en afbakening

Atelier Ivory wordt als volledige presentatie- en interactiemigratie boven op de bestaande productcontracten gebouwd. Bestaande Supabase-queries, tenantgrenzen, capabilities, server-actions, auditpaden, immutable releases, Studio-documenten en player/offlinegedrag blijven leidend. De fictieve namen en waarden uit de referentiebeelden worden niet overgenomen.

De migratie omvat tenant-Control en Studio. Platformbeheer blijft functioneel bruikbaar en erft de nieuwe shell en gedeelde componenten, maar krijgt geen nieuw informatieontwerp wanneer dat niet door de Atelier Ivory-bronnen is gespecificeerd. Marketing, publieke auth en players vallen buiten de visuele scope, behalve waar gedeelde tokens hun bestaande merkcontract veilig laten erven.

## Technische nulmeting

| Onderdeel | Huidige implementatie | Migratiebesluit |
| --- | --- | --- |
| Framework | Next.js App Router 15, React 19, TypeScript | Behouden; servercomponenten en server-actions blijven de standaard |
| Styling | Tailwind-workspace plus 5.346 regels Control-CSS, 1.674 regels UI-CSS en route-CSS-modules | Atelier Ivory-tokens centraal toevoegen; cascade gefaseerd vervangen |
| UI | `@veyocast/ui`, Lucide, lokale shell-primitives, beperkt Radix Dialog/Collapsible/Slot | Eén canonieke componentlaag in `@veyocast/ui`; routecomponenten gebruiken semantische props |
| Data | Tenantgebonden Supabase-loaders en server-actions | Geen demo- of mockdata toevoegen; bestaande fout- en permissiegrenzen behouden |
| Auth | Server-side Control-sessie en capabilitychecks | Ongewijzigd; zichtbaarheid blijft aanvullend op server-side afdwinging |
| PWA | Manifest, publieke shell-cache, offlinepagina en update/offline-toast | Functioneel behouden; visuele presentatie naar Atelier Ivory |
| Studio | `@veyocast/studio`, Konva, autosave/recovery, revisions, renderjobs | Document- en rendercontract behouden; editorchrome responsief herontwerpen |
| Teststack | Vitest, Playwright E2E, a11y, visual en player suites | Viewportmatrix, overflow- en thema-asserties uitbreiden |

De repository gebruikt `pnpm@11.5.2` en Node 24+. Aanwezige interactiebibliotheken zijn `@dnd-kit`, Konva en Lucide. Nieuwe afhankelijkheden worden alleen toegevoegd wanneer een bestaand toegankelijk primitive het canonieke gedrag aantoonbaar niet kan leveren.

## Bronnen en referentiebeelden

De ZIP bevat 25 bestanden en vijftien unieke beelden. De beelden vormen visuele richting; de canon, toegankelijkheid, echte productdata en bestaande functionele contracten gaan voor bij verschillen.

| # | Referentie | Te implementeren route of toestand |
| --- | --- | --- |
| 1 | Desktop licht — Overzicht | `/dashboard` |
| 2 | Desktop donker — Overzicht | `/dashboard` donker thema |
| 3 | Desktop licht — Schermen met detaildrawer | `/dashboard/screens` en schermdetail |
| 4 | Desktop donker — Schermdetail | `/dashboard/screens/[screenId]` |
| 5 | Desktop licht — Playlistbibliotheek | `/dashboard/playlists` |
| 6 | Desktop donker — Playlistbuilder | `/dashboard/playlists/[playlistId]` |
| 7 | Desktop licht — Media met detaildrawer | `/dashboard/media` |
| 8 | Desktop donker — Planning met inspector | `/dashboard/planning` |
| 9 | Desktop licht — Studio-overzicht | `/dashboard/studio` |
| 10 | Desktop donker — Studio-editor met timeline | `/dashboard/studio/[designId]` |
| 11 | Mobiel licht — Overzicht | `/dashboard` op 390 px |
| 12 | Mobiel donker — Schermen als accordeon/cards | `/dashboard/screens` op 390 px |
| 13 | Mobiel licht — Playlists | `/dashboard/playlists` op 390 px |
| 14 | Mobiel donker — Studio snel bewerken | `/dashboard/studio/[designId]` op 390 px |
| 15 | Mobiel licht — Dagagenda met sheet | `/dashboard/planning` op 390 px |

## Bestaande routes en functionele contracten

### Primaire werkplek

| Route | Echte data en acties | Bestaande states die behouden moeten blijven | Atelier Ivory-doel |
| --- | --- | --- | --- |
| `/dashboard` | operationele afleiding uit screens, devices, releases, media en tenantstatus | live/demo, onboarding, waarschuwingen, actielijst, capability-gestuurde CTA's | rustige operationele cockpit met hiërarchische KPI's en duidelijke vervolgstap |
| `/dashboard/screens` | vlootloader, zoeken/filteren/pagineren, tabelvoorkeuren, bulkselectie en bulkacties | online/offline/sync, leeg, fout, readonly en demomodus | desktop datagrid, mobiele statuscards/accordions, detail als drawer/sheet |
| `/dashboard/screens/new` | scherm aanmaken, onboarding en pairingclaim | validatie, permissie, pairingstatus | compacte sequentiële invoer met canonieke feedback |
| `/dashboard/screens/[screenId]` | detail, heartbeat, sync, planning, audit, automatisering en player commands | ontbrekend scherm, commandstatus, capability support en recovery | inhoudelijke detailworkspace; gevaarlijke acties expliciet en gescheiden |
| `/dashboard/media` | echte mediabibliotheek, upload, TUS-video, verwerking, folders, tags, favorieten, usage, saved views | upload/verwerking/fout/preview/archief/restore en lege resultaten | visuele bibliotheek met desktop inspector en mobiele bottom sheet |
| `/dashboard/playlists` | server-side lijst/filter/paginering, create/duplicate/archive | draft/published, leeg, fout, readonly en demomodus | compacte bibliotheek met cards op mobiel en scanbare desktoplijst |
| `/dashboard/playlists/[playlistId]` | DnD-builder, secties/items, preview, autosave recovery, revisions en publicatievoorbereiding | dirty/saving/error/conflict/recovery/readonly | gerichte builder; controls niet over de preview laten concurreren |
| `/dashboard/playlists/[playlistId]/publish` | preflight en immutable publicatie | blocking warnings, permissions en publish result | rustige bevestigingsflow met ondubbelzinnige impact |
| `/dashboard/planning` | schedules, conflictcheck, create/update/enable | tijdzone, overlap, leeg, readonly en serverfout | weekplanner op desktop, dagagenda op mobiel, inspector als sheet |
| `/dashboard/studio` | projecten, templates, brand kit en renderqueue | draft/rendering/ready/failed, filters, leeg en readonly | premium ontwerpdocumentbrowser |
| `/dashboard/studio/new` | projectdocument uit formaat/template | validatie en capability | beknopte create-flow |
| `/dashboard/studio/[designId]` | Konva-canvas, elementbibliotheek, inspector, lagen, motion timeline, autosave, local recovery, revisions en renderjobs | saving/saved/error/conflict/recovery, multi-select, readonly, renderprogress | desktop vrije canvas; mobiel uitsluitend snel bewerken, data, preview en publiceren |

### Beheer en secundaire journeys

| Routefamilie | Contract dat behouden blijft | Consolidatie |
| --- | --- | --- |
| screen groups en templates | tenantgebonden CRUD, archief en instantiate | gedeelde resourceheader, cards/table, dialogs en lege states |
| releases | immutable historie, detail, reassignment en draft restore | statusmatrix, preflightblokken en auditpresentatie |
| integrations en products | Twelve-import, mapping en productupdate | gedeelde datagrid, importprogress, filters en feedback |
| team | invites, rollen, leden en custom roles | gedeelde tabel/cards, dialogflow en danger confirmations |
| auditlog | tenantactiviteit | gedeelde datagrid, tijd- en actorweergave |
| settings | tenantinstellingen en dirty-savebar | gedeelde form sections en sticky savebar |
| support | tickets, berichten, attachments en status | gedeelde threadlayout en drawer/sheet |
| pilot | bestaande gecontroleerde pilotflow | functioneel behouden; secundaire route |

## Shell, navigatie en thema

De huidige `ControlShell` is 937 regels en bevat navigatie, tenantwissel, account, command search, mobiele navigatie, sidebarvoorkeuren, thema/dichtheid en uploadstatus. De shell gebruikt:

- `veyocast-control-theme`;
- `veyocast-control-density`;
- `veyocast-control-sidebar-collapsed`;
- `veyocast-control-management-open`;
- tenantgescopeerde hersteldata en uploadvoorkeuren.

Deze opslagcontracten blijven bestaan. De nieuwe shell krijgt:

- 232 px uitgeklapte en 80 px compacte desktopsidebar;
- een 72 px sticky desktopheader en 56 px mobiele header;
- vaste mobiele ondernavigatie met exact Overzicht, Schermen, Playlists, Studio en Meer;
- een toegankelijke Meer-sheet voor secundaire routes;
- persistente licht/donker/systeemvoorkeur zonder hydration-flash;
- minimaal 44 bij 44 px touchdoelen;
- contentpadding voor de mobiele navigatie en safe areas.

De sidebar blijft donker in beide thema's. De officiële locked VeyoCast-logoassets en Electric Orange-token blijven ongewijzigd.

## Tokenmigratie

Atelier Ivory wordt via semantische `--ai-*`-tokens gekoppeld aan bestaande `--vc-*`-contracten. De officiële merkwaarde blijft `var(--vc-brand-electric-orange)`; de fallback uit het aangeleverde document wordt niet de nieuwe merkbron.

Te introduceren families:

- achtergrond: `bg`, `canvas`, `surface`, `raised`, `muted`;
- tekst: `ink`, `ink-soft`, `ink-muted`, inverse;
- border: standaard, strong en brand;
- status: success, warning, danger en info, elk met rustige surface;
- ruimte: 4/8/12/16/20/24/32/40/48;
- radius: 6/8/12/16, pill alleen voor semantische pills;
- elevations: maximaal drie subtiele niveaus;
- shellmaten, z-indexlagen, focusring en motion;
- dichte datamodus als bestaande gebruikersvoorkeur.

Hardcoded routekleuren worden tijdens routeconversie naar semantische tokens verplaatst. Letterlijke PWA-manifestkleuren blijven noodzakelijk, maar worden uit dezelfde gecanoniseerde waarden afgeleid en getest.

## Componentconsolidatie

`@veyocast/ui` bevat al Button, IconButton, Card, Alert, Badge, Dialog, Sheet, Field, FilterBar, TablePreferences, states, resources, Progress, SummaryStrip en operationele lijsten. Deze worden de enige canonieke basis.

Benodigde uitbreidingen of normalisaties:

- app shell, page header, breadcrumb en command/search trigger;
- segmented control, checkbox/radio/switch en selectcontract;
- tabs en accordion;
- tooltip/popover/menu;
- toast en inline feedback;
- data grid met desktoptable en mobiele cardadapter;
- empty, loading, skeleton, error, offline, no-permission en readonly states;
- drawer op desktop die als bottom sheet op mobiel presenteert;
- metric- en contentcardvarianten;
- form field, help/error/required en sticky actionbar;
- mobile bottom navigation;
- Studio toolbar, inspectorsection, layer row, timeline controls en mobiele quick-edit.

Een eerste statische scan vindt veel migratiekandidaten, vooral in de playlistworkspace, Studio-editor, media, planningdialogs en schermdetail. Niet elk native element is fout: canonieke wrappers mogen intern semantische `button`, `input`, `select` en `table` blijven renderen.

## Responsieve contracten

De verplichte controleviewports zijn:

- 390 × 844;
- 768 × 1024;
- 1440 × 900;
- 1920 × 1080;
- elk in licht en donker thema.

Globale regels:

- geen horizontale documentoverflow;
- desktopdatatables pas vanaf 1024 px;
- mobiel gebruikt cards, accordions of sequentiële flows;
- drawer wordt bottom sheet;
- planning wordt een dagagenda;
- Studio vrije canvas verdwijnt op mobiel ten gunste van quick edit;
- vaste navigatie bedekt geen content;
- tekstzoom tot 200% en browserzoom blijven bruikbaar;
- 320 px is het minimum zonder functioneel verlies.

## Toegankelijkheid en interactie

De bestaande server-rendered labels en headings blijven de basis. De migratie borgt:

- zichtbare focusring op ieder interactief element;
- correcte dialog/sheet focus trap, herstel van focus en Escape;
- toetsenbordbediening voor menu's, tabs, accordions, datagridacties en Studio;
- tekst plus icoon voor statussen;
- `aria-live` voor upload, autosave, render, offline en mutatieresultaten;
- contrast volgens WCAG AA in beide thema's;
- reduced-motion ondersteuning;
- geen raw errors of kleur als enige betekenisdrager.

## Test- en bewijsplan

1. Vóór de redesign: lint, typecheck, unit tests, build, a11y en E2E vastleggen.
2. Automatische viewportmatrix voor shell en primaire routes in licht/donker.
3. Asserties op horizontale overflow, mobiele navigatie, focus, dialog/sheet en thema-persistentie.
4. Functionele regressies voor media, playlists, screens, planning en Studio behouden.
5. Na iedere routegroep visuele screenshots vergelijken met canon en referenties.
6. Eindgate: root lint, typecheck, test, build, a11y en Chromium E2E.

Screenshots worden als gegenereerde testartefacten behandeld. Alleen representatieve, gecontroleerde referentiebeelden en de captureconfiguratie worden in Git opgenomen om de repository niet met tientallen redundante binaries te belasten.

## Risico's en beheersing

| Risico | Beheersing |
| --- | --- |
| Grote globale CSS-cascade veroorzaakt routebreuk | tokens en shell eerst; routes in kleine, visueel geteste commits |
| Server/client themaverschil veroorzaakt flash | bestaande pre-hydration bootstrap behouden en uitbreiden |
| Mobiele vaste navigatie bedekt acties | canonieke safe-area/content-offset en viewporttests |
| Desktoptabellen krimpen onbruikbaar | expliciete cardadapter onder 1024 px |
| Drawer/sheet raakt focus of scroll kwijt | één toegankelijk primitivecontract en E2E-toets |
| Studio-layoutregressie | documentmodel en canvaslogica ongemoeid; chrome apart migreren |
| Referentiedata lekt naar product | uitsluitend echte loaders en bestaande demo-safe states gebruiken |
| Routefunctionaliteit verdwijnt tijdens vereenvoudiging | bestaande actions, states en capabilitychecks per route afvinken |
| Performance verslechtert door visuele lagen | minimale schaduwen, geen decoratieve animatie, routebundles bewaken |

## Commitvolgorde

1. inventaris en nulmeting;
2. regressiebaseline;
3. tokens en gedeelde primitives;
4. shell en navigatie;
5. Overzicht en Schermen;
6. Playlists en Media;
7. Planning;
8. Studio-overzicht en editor;
9. secundaire Control-routes;
10. a11y, visuele regressie, documentatie en eindrapport.

Iedere commit blijft een zelfstandig toetsbare eenheid. De task ledger wordt bij de eindoplevering bijgewerkt met de werkelijk behaalde gates en resterende, expliciete beperkingen.
