# S226 acceptance scripts

Deze scripts bewaren de daadwerkelijk uitgevoerde lokale journeys. Ze gebruiken
uitsluitend de vastgelegde worktree, localhostpoorten en disposable
`supabase_db_veyocast-s226`. Ze zijn geen deployment- of productiescripts.

Elke uitvoering vereist expliciet `VEYOCAST_S226_LOCAL_ACCEPTANCE=1`. Voor de
beheerscripts is de echte AAL2-cookieopslag in
`/tmp/veyocast-s226-qa-auth-state.json` nodig. Voor de worker staat de lokale
Supabase-configuratie in `/tmp/veyocast-s226-local-status.json` met mode 0600;
die bestanden en hun waarden zijn niet opgenomen in Git. De fixture-identiteiten
komen uit `tests/helpers/sites-local-qa.sql`.

- `prepare-local-auth.mjs`: echte password/TOTP/AAL2-aanmelding voor uitsluitend
  de toegewezen disposable fixture-identiteit; cookieopslag buiten Git met mode
  0600. Herhaald uitvoeren vereist aandacht voor de bestaande lokale MFA-factor.
- `product-receipt-recovery.mjs`: echte AAL2-PostgREST-productopdracht, eenmaal
  een werkelijk gecommit antwoord achterhouden, concurrerende wijziging en replay
  van het oorspronkelijke ontvangstbewijs zonder verlies van de latere wijziging.
- `studio-render-journey.mjs`: echte editorcreatie/save → echte Studio-queue →
  `render-one-local-studio.mts` → private renderoutput/checksum/readback.
- `studio-publication-journey.mjs`: output uit het voorgaande bewijs selecteren,
  guided preflight/publicatie, echte browserpairing en eerste-framebevestiging.
  Het vastgelegde QA-scherm moet ongekoppeld zijn; dit script wist geen pairing.
- `content-concurrency-journey.mjs`: echte upload + Studio-reeksselectie,
  concurrerende sessie, revisieconflict, eenmaal een echt serverantwoord weggooien
  en dezelfde opdracht opnieuw proberen. DB-readbacks bewijzen geen duplicatie.
- `compare-public-marketing.mjs`: alleen lezen; negen publieke routes op beide
  viewports vastleggen tegen de ongewijzigde publicatie, met pixelverschilbeelden.

De browserjourneys verwachten Control op 3220 en Player op 3222, met de lokale
Supabase-API op 57621. De marketingvergelijking gebruikt referentiepoort 3229 en
de echte Next-productiebuild op 3228. Start één Next-proces per builddirectory.
De statische Studio-worker gebruikt de bij Playwright geïnstalleerde Chromium;
de harness geeft het concrete executable-pad door, zonder systeem-Chromium of
een gesimuleerde renderstatus te gebruiken.

Deze scripts voegen uitsluitend lokale testresources toe. Ze schakelen geen
mailprovider, billingflag, restrictie, retention of extern releasekanaal in.
Voor een andere worktree/poort of herhaalde pairing is eerst een expliciet
bijgewerkte lokale fixture nodig. De bijbehorende JSON-bewijzen bevatten geen
tokens, signed URL's of andere credentialwaarden.

`rebuild-native-fonts.py` is een afzonderlijke reproduceerbare assettool, geen
netwerk- of DB-journey. Gebruik een tijdelijke Python-omgeving met
`fonttools[woff]==4.60.1`; de tool leest uitsluitend de gepinde Manropebron,
behoudt de glyphset en schrijft de zeven native TTF’s met SHA256-provenance en
het oorspronkelijke OFL. De workspace-lockfile verandert niet.

- `catalog-paging-journey.mjs`: een ongebruikte disposable QA-catalogus vullen (of uitsluitend de eigen complete fixture hergebruiken)
  met 1.005 producten, daarna de echte AAL2-beheerpagina gebruiken voor pagineren,
  zoeken voorbij de oude limiet, beschikbaarheid wijzigen en één product via het
  formulier aanmaken. Controleert de echte DB/revisies, nul onbedoelde releases,
  volledige pagina-Axe en vijf breedtes. Deze proef vereist een nieuwe lokale
  fixture; zij wist of overschrijft geen bestaande catalogus.

- `product-browser-receipt-recovery.mjs`: gebruikt het eigen nieuw aangemaakte
  product van de catalogusproef. Laat één werkelijk gecommit Next-actionantwoord
  weg, wijzigt het product via een onafhankelijke echte AAL2-client, ververst de
  catalogus en bevestigt de oorspronkelijke opdracht vanuit dezelfde browser.
  Bewijst gelijke opdracht, behouden latere velden/revisie en nul extra releases.
  Werkt uitsluitend met de complete eigen fixture en wist geen records.

- `sync-slide-source-comparison.mjs`: leest de ongewijzigde lokale Sync-referentie
  op 3230 en vergelijkt 144 geometrie-/typografievarianten met de pure renderer.
  Alleen een aparte tijdelijke Vite-entry wordt toegevoegd; de originele
  bronbestanden worden byte-identiek gecontroleerd. Geen database of sessie nodig.
  Dit is geen vervanging voor pixel-, editor- of provideracceptatie.
- `sync-studio-real-worker.mts`: echte AAL2-create/rendercommands, echte
  Chromium-/FFmpeg-uitvoer, private Storage en checksums voor PNG en een
  multipage-MP4. Opdrachtkeys en bevestigde project-/job-ID’s blijven buiten Git
  in een checkpoint met mode 0600 bewaard. Reruns maken geen tweede project.
  Gebruik de aanwezige FFmpeg-tools via het lokale, begrensde pad; de bewezen
  image is `sha256:12d5b97adea07581b32a53068b04abd97497fdcef653b680c94a6bd7cea46e79`.
  Alleen de eigen `/tmp/veyocast-studio-render-*` directory mag worden gemount,
  netwerk is uit en de containerroot is de rootless hostgebruiker. De mislukte
  oorspronkelijke job wordt behouden. Het script bewijst geen nieuwe editor,
  live providerbinding, Playerpublicatie of hosted deployment.

- `sync-studio-browser-create.mjs`: echte Next/AAL2-templatekeuze, een werkelijk
  gecommitteerde create waarvan het browserantwoord wordt afgebroken, herladen
  en dezelfde volledige opdracht opnieuw bevestigen; daarna naam/tekst/portrait
  via de Source-editor bewaren en authenticated readback/Axe/vijf breedtes.
- `sync-template-picker-browser.mjs`: uitsluitend read-only echte templatekeuze,
  alle 36 kaarten, groepsfilter, Axe, vijf breedtes en Escape/focusherstel.

- `sync-legacy-cache-compatibility.mjs`: voert de echte cachemodule uit Git-basis
  20729be en de huidige module uit tegen hetzelfde gecontroleerde manifest.
  Bewijst de aparte optionele Sourcevelden en behoud van de oude strikte
  Sites-validatie; geen volledig oud APK- of hardwarebewijs.

- `sync-publication-player-journey.mjs`: hergebruikt de werkelijk gerenderde
  multipage-MP4 en de bestaande AAL2-sessie. Publiceert via de playlist- en
  preflightschermen, koppelt uitsluitend de eigen lokale Entree-Player en
  controleert immutable Source-identiteit, timing, bytes, first-frame-heartbeat,
  beide pagina’s en een volledige offline reload met dezelfde pairing. Een
  lokaal checkpoint voorkomt een tweede playlist/publicatie; het afgeschermde
  browserprofiel behoudt de echte IndexedDB/cache tussen pogingen.
  Vereist productiebouw van Control/Player met de disposable lokale
  entitlement-key en HTTPS-transport naar de bestaande lokale Supabase, zodat
  de echte productie-CSP en service worker behouden blijven. Geen deployment,
  native signing of provideraccounttest. Tokens en signed URL’s komen niet in
  het bewijsbestand. Eerste mislukte poging gebruikte de bestandsnaam als
  zoekterm; de geslaagde poging zoekt op de werkelijke mediatitel.

- `sync-editor-background-journey.mjs`: echte AAL2-editor, Strepen/Arial bewaren,
  beveiligde image-upload, private Storage downloaden en hashen, daarna de
  bewaarde achtergrond heropenen. Hergebruikt één eigen project en één eigen
  upload met checkpoint; bij onbekende uploaduitkomst wordt eerst dezelfde
  unieke lokale media gecontroleerd. Controleert Axe, vijf breedtes en behoud
  van bestaande release-hashes. De input is een lokaal synthetisch testbeeld.
- `sync-editor-source-comparison.mjs`: vergelijkt de originele Studio en de
  daadwerkelijke port-Frame op vier breedtes en vier tabs met dezelfde inhoud.
  Controleert ongewijzigde Sourcebestanden, schrijft screenshots en registreert
  verschillen in plaats van deze als visuele PASS aan te merken. Geen echte
  schrijfopdracht, provider- of deviceacceptatie uit deze meting afleiden.
- `sync-motion-real-worker.mts`: één eigen AAL2-project/renderopdracht, echte
  getimede Chromium-capture en FFmpeg-MP4, private Storage en checksumreadback.
  Decodeert begin-, tussen- en eindframe om de werkelijk geselecteerde beweging
  te controleren. Dezelfde begrensde FFmpeg-wrapper en projectguard als de
  eerdere workerproef zijn vereist. Eerste poging normaliseerde optionele
  `undefined`-velden niet bij de DB-vergelijking; hetzelfde project is daarna
  hergebruikt. Geen publicatie-/deviceclaim uit deze losse workerproef afleiden.

- `sync-motion-runtime-recheck.mjs`: hergebruikt het daadwerkelijk gekoppelde
  lokale browserprofiel en dezelfde immutable release. Meet natuurlijke
  Motion-lusgrenzen online en na offline cold reload, controleert assets,
  pairing en ongewijzigde releasehash. Geen nieuwe publicatie of nieuwe
  eerste-framebevestiging afleiden; die staan in de oorspronkelijke journey.
  `sync-publication-player-journey.mjs` kiest met
  `VEYOCAST_S226_JOURNEY_KIND=motion` de afzonderlijke echte Motion-publicatie.

- `sync-library-playlist-journey.mts`: daadwerkelijke Source-selectie onder
  Slides, immutable export/herladen en een aparte thema-/duurrender. Draait de
  echte worker uitsluitend wanneer de enige pending job de gecontroleerde eigen
  fork is. Verifieert privébytes/SHA, beide pagina’s na reload, vijf breedtes en
  behoud van bron/releasehashes. Hergebruikt dezelfde playlist; na een onbekende
  theme-save stopt een nieuwe poging voor inspectie. Twee herstelde harness-
  selectorfouten en de geannuleerde fixturejob staan bij het bewijs.

- `sync-series-real-journey.mts`: eigen AAL2-project, echte reeksopdracht met
  opzettelijk verloren Next-antwoord, exact herstel na reload, volgorde, kopie,
  herstelbaar verwijderen en naam. Expliciete selectie start uitsluitend de
  twee eigen renders; echte worker, private bytes/SHA en playlist-herladen
  worden gecontroleerd. De herstelde route-announcer-selector staat bij het
  bewijs. Geen publicatie of provideracceptatie uit deze proef afleiden.
- `sync-filmstrip-real-read.mjs`: read-only echte Source-filmstrip, eerste
  bibliotheekpagina plus huidige reeks, Axe/vijf breedtes en navigatie naar
  een bestaand ontwerp. Bewijst dat drafts, jobs en releases gelijk blijven.

- `sync-dynamic-real-worker.mts`: alleen de bewaakte lokale QA-installatie op
  57621/57622; eigen AAL2-bron en vijf echte cataloguscommando’s, canonical Source-
  snapshot, dezelfde dynamic renderqueue, complete 2-pagina-MP4 en onafhankelijke
  poster met authenticated Storage-readback en gedecodeerde paginaframes.
  Volledige eigen checkpointmetadata staat buiten Git op mode 0600. Claim geen
  UI-, provider-, live refresh-, publicatie-, hardware- of deployacceptatie.
  De oude create-RPC heeft geen production receipt; de harness herkent alleen
  haar unieke eigen fixture bij een hervatting. Start met
  `VEYOCAST_S226_LOCAL_ACCEPTANCE=1` en de reeds gecontroleerde FFmpeg-tools.

- `sync-dynamic-publication-player.mjs`: gebruikt de eigen echte bronrender als
  dynamische AAL2-playlistplaatsing (snapshotprovenance blijft bestaan), echte
  Control-publicatie naar het eerder ongebruikte lokale Hoofdveld en een
  productiegebouwde Player. Drie capabilityprofielen/ETags, twaalf DOM-cacheassets,
  één binary-cacheasset, beide cold-offlineboots en pairing/readback. Bewaakte
  lokale service-/tenant-/checkpointcontroles; geen provider-, Source-binding-UI-,
  live-delta-, hardware- of hosted-deployclaim.

- `sync-dynamic-live-player.mts`: gebruikt de bestaande lokale bronpublicatie en
  haar bewaarde Player-profiel; echte AAL2-productwijziging en exact herhaalde
  opdracht, bestaande published-dataworker, drie complete oude paginaintervallen
  vóór de nieuwe productprijs en offline herladen met negen actuele regels.
  Controleert gelijk gebleven releases/items/versies/snapshots/renderjobs en
  houdt pairing/cache in stand. Het binary-profiel behoudt de volledige
  oorspronkelijke fallback. De eerste meetfouten zijn bewaard; hervatten gebruikt
  dezelfde receipt, zonder nieuwe bronrecords of opnieuw verwerken.

- `sync-dynamic-editor-real.mts`: alleen de bewaakte eigen lokale Source-bron en
  AAL2-sessie; nieuwe versie via Control, read-only bronpreview, werkelijk
  gecommitteerd opslagantwoord onderscheppen/verliezen, herladen en dezelfde
  opdracht bevestigen. Alleen expliciet voorbereiden start één volledige
  Chromium/FFmpeg-render; private download/SHA, Axe, vijf breedtes en gelijk
  gebleven publicaties. Querystring- en verborgen streamingmarkupmeetfouten
  zijn vastgelegd en hervat op dezelfde versie. Geen Source-aanmaak-,
  sportselectie-, provider-, hardware- of hosted-deployclaim.

- `sync-dynamic-create-real.mts`: echte AAL2-Source-menu-aanmaak vanuit de nieuwe
  gegevensbrontab, expliciete bestaande bronkeuze, read-only preview, verloren
  gecommitteerd antwoord/herladen/exact receipt en één volledige 15s-MP4.
  Huidige snapshot/media-ID’s en private SHA/bytes blijven de autoriteit.
  De laatste detailmeting hervatte dezelfde entity/job na een verborgen-markup-
  locatorfout; geen nieuwe aanmaak. Geen RSS-, sport-, originele-kopie-,
  hardware- of hosted-deployacceptatie uit deze menuproef afleiden.

- `sync-dynamic-library-real.mjs`: eigen AAL2-Source-bibliotheek, één volledige plaatsing en pinned reload; checkpoint hervat dezelfde playlist zonder duplicaten. Bewijs in `sync-dynamic-library-real.json`.

- `sync-dynamic-placement-real.mts`: echte AAL2-thema/duurvariant, verloren prepare-ACK en dezelfde key, bestaande worker, volledige private MP4/SHA, pinned reload/Axe/vijf breedtes. De eigen eerste followerfout wordt via de gewone UI hersteld; checkpoints bewaren beide pogingen.

- `sync-dynamic-variant-player.mjs`: dezelfde echte Source-variant via preflight/publicatie en bestaande pairing naar DOM/binary offline; bewaart de eerste immutable publicatie en hergebruikt ongewijzigde configuratie.
- `sync-dynamic-variant-live.mts`: daadwerkelijke prijsrevisie bij het gepubliceerde variantontwerp, bestaande coalesced queue en natuurlijke paginagrens; geen nieuwe release/versie/snapshot/renderjob. Alleen PASS-rapport geldt als bewijs.

- `sync-sportlink-binding-real.mts`: echte AAL2-team/poule/periodekeuze en readonly canonical preview over expliciete opgeslagen providerfixtures; automatische sync uit, externe provider niet geverifieerd. Exact verloren create-herstel, één volledige workerjob/private SHA; hergebruik hetzelfde checkpoint en dezelfde bron.

- `sync-rss-copy-real.mts`: echt handmatig Source-RSS-project naar expliciete
  gekoppelde kopie, opgeslagen RSS-fixtures zonder externe acquisitie, readonly
  preview, exacte create-receipt en volledige private MP4/SHA. Hervatten gebruikt
  dezelfde entity/job en controleert behoud van origineel en publicaties.
- `sync-rss-recovery-replay.mjs`: herhaalt uitsluitend het reeds gecommitteerde
  RSS-createcommand, verliest opnieuw het eerste antwoord en herlaadt; bewijst
  twee exacte receipts zonder nieuwe geschiedenis en nul productie-browserfouten.

- `sync-led-binding-real.mts`: bewaakte eigen lokale LED-verbinding, AAL2-feature-
  en bronkeuze, bestaande leased ingestion over expliciete fixturedata, canonical
  readonly preview, exacte verloren create-receipt en volledige private 5s-MP4.
  Geen externe providerverbinding. Checkpoint hergebruiken, nooit opnieuw aanmaken.
- `sync-led-publication-player.mjs`: dezelfde Source-output, nieuw eigen QA-scherm,
  echte publicatie/pairing/eerste frame, device-bound globale stream en actuele
  stand/stale-klok/offline. Geen nieuwe release/versie/job voor de delta. De
  eerste twee opgeslagen maar nog niet weergegeven updates blijven in het
  checkpoint; de bevestigde laatste stand is 5–1. Complete frozen binary LKG.

- `sync-engage-binding-real.mts`: eigen echte AAL2-campagne met resultaatbeleid
  na sluiting, Source-selectie/preview/Axe/vijf breedtes, expliciete save/render,
  volledige private MP4/SHA en behoud van bestaande releases. HTTPS-Control op
  57632 is nodig voor de echte veilige QR; checkpoint voorkomt dubbele resources.
- `sync-engage-publication-player.mjs`: bestaande campagne/project/export vanuit
  het vorige bewijs, echte Slides-selectie/batch/preflight/publicatie naar een
  nieuw eigen QA-scherm, pairing/first frame, Secure/HttpOnly-anonieme stem en
  deduplicatie, privacy tot echte sluiting, Source-/binary-offline en behoud van
  pairing/andere releases. De campagne is na PASS gesloten; checkpoint behouden.

- `sync-binary-refresh-real.mts`: oorspronkelijke bestaande data-/renderworker-
  en private-bytes/offlineproef. Het rapport blijft PARTIAL omdat de eerste
  timingassertion geen oude/nieuwe SHA correleerde; bewaarde pogingen niet als
  volledige natuurlijke wissel lezen. Niet opnieuw muterend uitvoeren.
- `sync-binary-installation-continuity.mjs`: volledige eigen bestaande
  installatie-identiteit, twee onderbroken installatieverzoeken en echte
  registratie-recovery tijdens ononderbroken 24s-binaryloops. Geen secrets
  in bewijs; de eerdere token-only browserfixture is gericht hersteld.
- `sync-binary-refresh-boundaries.mts`: exacte AAL2-receipts en eerste bewezen
  SHA-grens. De ETagfout en hervattingsassertion blijven als pogingen bewaard;
  de laatste cooldownassertion vond terecht een inmiddels verstreken deadline.
  Geen algemene PASS en geen nieuwe mutaties/replay zonder checkpointreview.
- `sync-binary-refresh-cooldown.mts`: éénmalige eigen QA-prijsmutaties,
  bestaande coalescer/v3-renderworker/FFmpeg, werkelijk vijf minuten wachten,
  SHA-gecorreleerde volledige wissels, plaatsen 1→2→0, nieuwste offlineboot,
  volledige pairing en immutable historie. PASS. QA-product 1 staat nu op
  € 6,55/revisie 12; het checkpoint blokkeert opnieuw uitvoeren.
- `sync-binary-corrupt-candidate.mjs`: echte manifest/Storage/Player, uitsluitend
  een gecontroleerde transportfout door evenveel bytes met verkeerde SHA.
  PASS voor weigeren, bestaand retrybudget, oude complete cold-offlineboot en
  geldige recovery op natuurlijke grens. Eenmalige oude-LKG-cohort; het profiel
  bevat nu de nieuwste kandidaat, dus niet blind opnieuw uitvoeren.
