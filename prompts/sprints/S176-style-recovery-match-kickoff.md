# S176 — Stijleditorherstel en aftrapselectie

## Opdracht en volgorde

De gebruiker meldt een clientcrash bij geforceerd wijzigen van de stijl en wil
begonnen wedstrijden uitsluitend op uitslagslides, ook zonder bekende uitslag.
S175 moest eerst gecommit, gepusht en uitgerold worden. Dat is voltooid via
PR #200, productie-SHA `5a672fb428800d763dcc5e7e5c125d4b17f1a3c3` en workflow
`34695700540`; alle productie-healthroutes en pairing/LG-recovery zijn groen.
S176 start daarvan in een eigen branch/worktree.

## Analyse en implementatie

- De screenshot bevat alleen de algemene Next.js-clientfout. De echte mobiele
  browserreproductie na Alles donker en lettertype wijzigen geeft
  `TypeError: Cannot read properties of null (reading 'value')` in
  `settings/tenant-theme-editor.tsx`. Vijf handlers sluiten het tijdelijke
  React-event in een deferred state updater op. Waarde/checked worden nu tijdens
  de handler gekopieerd; de updater gebruikt uitsluitend die stabiele waarde.
- De S158-projectie achter `build_dynamic_snapshot_data_before_s159_theme_runtime_v2`
  kiest programma op `scheduled/postponed` en uitslagen op `finished`, zonder
  aftrapgrens. De nieuwe private fasehelper combineert status en absolute aftrap.
  Vanaf `starts_at <= now()` gaat een nog scheduled wedstrijd naar uitslagen.
  Afgelaste en uitgestelde wedstrijden worden niet als begonnen behandeld.
- De bestaande clubidentiteit-, thuis/uit-, exacte poule-/fase-/seizoenselecties,
  datumvensters, logo's en scorepublicatiegrens blijven de selectie bepalen.
  Programma's vereisen een toekomstige aftrap. Uitslagen behoeven geen score;
  niet-gepubliceerde bronwaarden worden niet als echte scores weergegeven.
- De bestaande workerfunctie voor tijdgevoelige Sportlink-slides vernieuwt nu
  ook wedstrijdsnapshots na een geslaagde bronwaarneming, zelfs zonder nieuwe
  bronhash. De bestaande queue leest exact de gepubliceerde versie, dedupliceert
  identieke content en behoudt concepten en vastgezette versies.
- Nieuwe snapshots bevatten `kickoffAt`. De gedeelde renderer filtert aan de hand
  van dat absolute tijdstip; historische rijen zonder dat veld blijven leesbaar.
  De moderne player herberekent bij de eerstvolgende aftrap dezelfde payload;
  Static LG controleert tijdens zijn bestaande wedstrijdklokinterval. Een
  gedeeltelijke lijst verandert zonder release-/documentreload, ook offline.
  Een lege programmaslide gebruikt de bestaande oversla-/playlistflow.
  Tijdens een gepauzeerde Goal Alert wordt de onderlaag niet doorgeschoven.
- De playerbrede zichtbaarheidsplanner plant ook de aftrapgrenzen in. Alleen
  filteren in de slide bleek onvoldoende: een heartbeat kon de lege slide eerder
  ontkoppelen dan haar afsluitcallback. De planner selecteert nu het volgende
  speelbare item en houdt een actieve goalpauze vast. Paginanummers worden binnen
  het resterende aantal pagina's begrensd wanneer rijen vervallen.

## Migratie en uitrol

`20260912133821_s176_match_kickoff_selection.sql` vervangt bestaande private
projecties, introduceert één private fasehelper en breidt de bestaande
worker-refreshfunctie uit. De migratie queue't nieuwe immutable opvolgsnapshots
voor gepubliceerde latest-wedstrijdslides. Geen nieuwe tabellen, RLS-uitzondering,
media-/groep-/releasearchitectuur of gewijzigde historische payloads.

Uitrol: migratie vóór apps/worker, bestaande staging → productie-workflow met
exacte SHA/images en health-/pairingreadback. Terugdraaien vereist een forward
migratie die de selectiefuncties herstelt; bestaande snapshots en releases worden
niet gewist of gewijzigd. Nieuwe resultaten komen via de bestaande veilige
snapshot-/releasevernieuwing beschikbaar; de lokale aftrapfilter voorkomt dat een
gecachet nieuw programmapayload op die vernieuwing moet wachten om te vervallen.

## Verificatie

- Mobiele reproduceerbare crashtrace vóór fix bewaard buiten de repo; de bestaande
  palettest en nieuwe interactieve mobiele stijltest zijn na de fix groen.
- Fasegrens vóór/op/na aftrap, timezone-equivalentie, home/away, club/pool,
  ongepubliceerde scores, tenantafbakening en private/worker-permissions via pgTAP.
- Volledige RLS-suite: 81 bestanden, 2.076 assertions groen.
- Productiebuild-player: 16 aftraptests groen voor React/Static LG, landscape en
  portrait, gedeeltelijke/laatste programmarij, uitslag onbekend, offline en een
  aftrap tijdens een lopende Goal Alert. Document blijft behouden; de volgende
  normale playlistslide wordt zichtbaar. De 20 bestaande Goal Overlay-browser-
  en rendertests zijn eveneens op de productiebuild gecontroleerd.
- Manifest-unittest bewijst de twee opeenvolgende aftrapgrenzen, volgende-item-
  selectie en ongewijzigde payload. De drie gedeelde rendererchecks omvatten
  grensmomenten, onbekende score en historische payloads zonder absolute aftrap.
- Relevante oudere fixtures plaatsen programma's daadwerkelijk ná nu en resultaten
  vóór nu binnen hun lokale dag, ongeacht het tijdstip waarop CI draait.
- Definitieve workspace lint/typecheck en uncached unit-tests: elk 30/30 taken
  groen. Definitieve productiebuild: 18/18 taken groen, inclusief Control-auth-
  en secretvrije clientbundlecontroles.
- Browsergates effectief: a11y 36, beheer-E2E 41, player 157, offline 7 groen;
  16 bestaande skips vereisen live fixtures of externe referenties. De brede run
  had twee Next-devserverherstarts door de geheugenlimiet en een eerste-load
  marketingactie-timeout. Alle onderbroken/niet-uitgevoerde checks zijn met
  ongewijzigde assertions afzonderlijk herhaald: 19/19 groen. Traces en logs zijn
  bewaard; er is geen onbekende testfout overgeslagen.
- De eerste build raakte een volle lokale schijf. Alleen gecontroleerde,
  ongetrackte Next-buildcaches zijn verwijderd; bronbestanden, lokale releases en
  databasevolumes bleven behouden. Daarna was de workspacebuild groen.
- Exacte hosted CI- en deploymentreadbacks worden in de PR vastgelegd.
