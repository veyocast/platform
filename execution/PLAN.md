# S226 · Sync V1 rebuild

Opdracht: de aangeleverde startprompt uitvoeren, inclusief staging en productie
via de bestaande releaseflow. Basis: `20729be35d38dc8eb67b836160632ac7c3ea5153`.
Writer: root, branch `veyocast/s226-sync-v1-rebuild`, geïsoleerde worktree
`/home/codex/repos/castivo-s226` op `codex-worker-01`.

1. Pakket, actuele bron, branches, configuratienamen, runtime en herstel vastleggen.
2. De exacte Sync-marketing en gedeelde assets porten naar Next.js; alle negen
   routes serverrenderen. Aanvragen werkelijk opslaan, idempotent verwerken en
   in platformbeheer beschikbaar maken, met eerlijke mailstatus/retry.
3. Sync-Control verbinden met bestaande geautoriseerde diensten; geen prototype-
   store, vaste codes of tweede database als functionele vervanging.
4. Playerhero en Androidiconen toepassen met behoud van identiteit, offlinecache,
   signing en updatekanalen. Bestaande decoder- en LG-correcties behouden.
5. Domeinmapping, alle 148 scenario's, visuele vergelijking en vereiste gates
   uitvoeren; uitsluitend bewezen overbodige bron verwijderen.
6. Getoetste commits en één PR; bestaande CI/main→staging→expliciete promotie van
   dezelfde release. Geen wijzigingen in bestaande billing-/retentionflags.

De pakketcontrole is PASS (236 gemanifesteerde bestanden, 91 Sites-bestanden,
45 assets, 148 scenario's). Bewijs en open gates blijven afzonderlijk van
implementatiestatus. Hardware, 24 uur playback en installatieversies worden
niet uit een browserbuild afgeleid.

## Vervolg na de lokale Source-reeksacceptatie

- Source Studio-kiezer, plaatsingsvariant en reeks zijn lokaal met echte diensten
  bewezen; hosted deploy is nog niet uitgevoerd. Volledige Source-workeroutput,
  onafhankelijke Playerprofielen en echte live DOM-verversing op natuurlijke
  grenzen/offline zijn inmiddels bevestigd. Source-create/edit, onafhankelijke bibliotheek en gekoppelde plaatsingsvarianten
  zijn ook bevestigd. Variantpublicatie/Player en actuele DOM-prijsrefresh zijn ook bevestigd.
  Team-/poule-/periodebinding en RSS/gekoppelde kopie zijn met echte AAL2-diensten en expliciete opgeslagen fixtures bevestigd. Source LED-aanmaak/publicatie/globale stream/offline zijn ook met leased lokale fixtures bevestigd. Source Engage met echte campagne/stem/sluiting/publicatie/offline is ook bevestigd. YouTube-binding en gecontroleerde IFrame-/fallbackgrens zijn getoetst; echte provideracceptatie blijft open. Begrensde actuele binary-refresh, SHA-gecorreleerde veilige wissel, echte vijfminutencooldown, beschadigde kandidaat/LKG en offline recovery zijn nu lokaal bewezen; zie PUBLISHED-BINARY-REFRESH.md. Volgende hoofdtaak is de strikte Sync-responsive/scenariogate en brede afrondering.
- Hergebruik `dynamic_data_sources`, de bestaande canonical snapshots,
  `dynamic_slides`/versions/snapshots en dezelfde dynamic-renderqueue/fencing.
  De Source-renderroute levert volledige PNG/MP4 met dezelfde queue/fencing.
  Private plaatsingsvarianten mogen nooit de hoofdbon/open draft of andere
  playlistconcepten volgen; de Source-only followerguard en pin zijn getoetst.
- `projectSyncDynamicSnapshot` is de getoetste pure projector voor alle 17
  sporttypes/menu/RSS/LED; maak bron/team/pool/periodekeuzes afkomstig uit de
  bestaande tenantreadmodels. Geen browser-providerfetch of tweede bronstore.
- Providerassetversies zijn globale, immutable cacheobjecten. Hun logische IDs
  mogen uitsluitend vanuit de geautoriseerde canonical snapshot worden
  opgelost, zoals het bestaande Sites-dynamic-pad; sla ze nooit blind als
  tenant-Media-FK in een Studio-draft op. Houd de publieke Studio-assetvalidator
  en de canonical dynamic-assetautoriteit apart.
- Houd nieuwe Source-dynamicconfiguratie/presentatie/profiel naast de oude
  Sites-identiteiten. Oudere decoders krijgen een complete binaire fallback;
  zij mogen een nieuwe Source-uitzending niet via een oude DOM-template anders
  vormgeven. Toets ook nieuwste LG/browserclients met alleen binary-profiel,
  datarefresh zonder release-/timerreset en behoud van last-known-good.
- Engage/YouTube gebruiken hun bestaande echte autoriteiten, officiële
  playback en privacybesluiten. Een Source-voorbeeld is geen bewijs dat die
  live ketens al zijn aangesloten. Daarna volgen de strikte responsive gate,
  overige scenario’s, brede eindgates en de geautoriseerde PR/releaseflow.

## Actuele release-afronding

De gekozen Sync responsivecohort is66/66 groen, inclusief huidige Axe0 en
expliciete44px-/copy-/lege-stategrenzen. De CI gebruikt nu deze gekozen
workplacebaseline; historische beide screen-rendererfamilies blijven intact.
Player/offline en brede gecontroleerde Controlbrowsercases zijn afgerond;
de laatste Next-routenavigatie-/viewportgate en finale resource-DB-admissie
worden gesloten vóór commit. Daarna bewijs/mapping actualiseren, één PR en
bestaande CI, main→staging→dezelfde immutable release productie. De gesigneerde
standaard-/TV-Player volgen via hun bestaande environment en Play internal.
