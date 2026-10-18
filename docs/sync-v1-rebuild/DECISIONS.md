# S226 · gerichte uitvoeringsbesluiten

- Actuele Source-binary is runtimecache bij een immutable configuratie,
  geen contentgeschiedenis. De bestaande queue en dynamicworker worden
  hergebruikt met drie vaste private prefixen, vijf minuten tussen gewijzigde
  encodes en duurzaam budget voor ook gedeeltelijke uploads. De bestaande
  device-bootstrap/ETag bevat de bevestigde binary-identiteit. Zie
  `PUBLISHED-BINARY-REFRESH.md` voor lokale echte ketens, foutproeven en herstel.
- De Source-versiegeschiedenis gebruikt weer de originele zichtbare trigger
  en dialoogtitel. Het aantal komt uit de geautoriseerde bewaarde revisies;
  een prototypecounter of revisieconflictsimulator wordt geen productiedienst.
  Bestaande herstelrechten, CAS en identieke commandoreceipts blijven leidend.

- Sync-documenten krijgen het optionele, strikt gevalideerde veld
  `syncPresentation`; bestaande `sitesPresentation`-identiteiten en de bestaande
  releasekolom blijven exact begrensd. Gecontroleerde PNG/MP4-exports zijn de
  compatibiliteitsbasis; nieuwe live Player/LG-integratie vereist afzonderlijk
  bewijs en wordt nog niet als gereed behandeld.
- De database gebruikt hetzelfde gegenereerde Zod-outputschema via de door
  Supabase ondersteunde `pg_jsonschema`-extensie. Zie de
  [officiële documentatie](https://supabase.com/docs/guides/database/extensions/pg_jsonschema).
  De eigen lokale database biedt versie 0.3.3. Tenantassets, checksums,
  URL-protocollen en pollprivacy krijgen daarnaast expliciete private checks;
  clientrefinements worden niet verondersteld in JSON Schema te staan.
  Alle oorspronkelijke publieke writers, rechten en authoring-pauzes blijven
  leidend. Er ontstaat geen tweede publieke writer.
- Een nieuwe renderclaim begint op 1% en behoudt dezelfde jobidentiteit,
  attempt_count, budgetten, vertragingen en fencing. Een daling binnen dezelfde
  poging blijft verboden. Dit herstelt de werkelijk gevonden 23514 na een
  automatische retry; er wordt geen bestaand document of release herschreven.

- De gebruikersopdracht omvat staging en productie via de bestaande pipeline.
- De gebruiker stelt fysieke Android-/LG-tests en de 24-uursproef expliciet uit
  (antwoord: “Dat komt achteraf wel”). Ze blijven onbewezen en worden niet als
  PASS geregistreerd; ze blokkeren deze geautoriseerde uitrol niet.
- Mailprovider is SendGrid API. De gebruiker stelt API-key en geverifieerde
  afzender/ontvanger expliciet uit (“achteraf”). Ontvangst wordt duurzaam
  geregistreerd; verzending blijft afzonderlijk pending zolang configuratie
  ontbreekt. Er wordt geen e-mailverzending of aflevering geclaimd.
- De originele gepubliceerde marketinghome heeft 60 Axe-contrastmeldingen.
  De geporteerde home heeft dezelfde 60. Andere routes bevatten tevens
  kopvolgordefouten. Toegankelijkheid behoudt zijn hogere governancegrens.
  `accessibility-overrides.json` registreert uitsluitend gemeten voorgrond-
  correcties; canvas, spacing, lettergroottes, assets en bronbestanden blijven
  behouden. Onzichtbare koppen herstellen de semantische volgorde.
- De bestaande ondertekende opstellingsflow blijft bereikbaar via `/opstelling`
  en bestaande `/#opstelling`-links. Het geverifieerde setup-intent wordt bij de
  nieuwe aanvraag opgeslagen; een ongeldig token levert geen gefingeerde setup.
- SendGrid-202 betekent aangeboden aan de provider, geen afleverbewijs.
  Een onzekere time-out of verlopen sendlease wordt nooit automatisch opnieuw
  verzonden. Expliciete retries vereisen platformrechten, AAL2 en revisioncontrole.
- Contact en afspeelbewijs worden afzonderlijk afgeleid. Een heartbeat met een
  active-release-ID is zonder passende `publicationTrace.firstFrameAt` geen
  zichtbaar-framebewijs. Recente fouten, verkeerde release-ID's en toekomstige
  tijden leveren geen bevestiging op. De bestaande operationele afleiding en
  Sync lezen dezelfde bewijsfunctie; oudere LKG-referenties worden buiten het
  venster van twintig recente releases afzonderlijk tenantgebonden opgehaald.
- De oorspronkelijke oranje decoratielaag rond het oude pairinglogo is vervangen
  door de volledige aangeleverde hero. De reduced-motion-regressie controleert
  nu de echte hero: geen animatie/transformatie, contain en originele vierkante
  verhoudingen. De afwezigheid van oude decoratie is geen aanleiding de
  toegankelijkheidscheck weg te laten.
- De developmenthost liep tijdens verificatie terug tot circa 800 MB vrije
  opslag. Alleen zestien Git-ignored `.next/cache`-paden zonder actief proces in
  de betreffende worktree zijn verwijderd (5.602.390.016 bytes). Broncode,
  overige buildoutput, rollback, databases en configuratie zijn behouden.
- De echte Sync-bron bepaalt de responsive shell: 228 px desktopsidebar,
  205 px tot 1200 px, 235 px drawer onder 761 px en vijf vaste mobiele taken.
  Oude lokale collapsevoorkeuren veranderen deze gekozen Sync-indeling niet.
  De oude 248/216-px- en navigatietests worden op deze vastgezette bron geijkt;
  toetsenbordbediening, contextscheiding, touchdoelen en overflow blijven gates.
- PWA- en browsericonen gebruiken de ongewijzigde 192/512-px-kitexports; native
  Control gebruikt de 1024-px-exports. SVG-woordmerken worden intact gebruikt.
  Normale playback behoudt precies één mark linksonder op 40% opacity.
  LG krijgt de volledige lokale hero met contain; de watermarkbreedte heeft
  een expliciete px-fallback voor de oudere CSS-engine. Geen pairing-, asset-
  of releasecache wordt daarvoor vervangen.
- Sync-planning gebruikt de bestaande timezone/DST/recurrence-expansie en
  serveracties; maandweergave, groepsfilters, prioriteit en CAS blijven behouden.
  De geldende serverregel scherm-vóór-groep blijft expliciet zichtbaar. Een lege
  dag heet Geen planning zolang geen vaste release voor dat doel bewezen is.
- De bronnenlijst telt opgeslagen koppelingen; beschikbare providers staan in
  Bron toevoegen. Een mislukte statuslezing is onbekend, geen geslaagde sync.
  De themacatalogus toont uitsluitend de twee bestaande authorable pakketten;
  historische renderbare thema-ID’s blijven voor oude releases behouden.
- Mobiele modals erven de Sync-scope via een optionele generieke PortalProvider.
  Andere apps houden hun standaard portalcontainer. Een genest dialoogvenster
  bezit Escape/focus tot het sluit; de navigatie sluit niet in dezelfde toetsaanslag.
- Producten vergelijkt uitsluitend bevroren snapshots uit framebevestigde releases;
  oude geformatteerde prijzen hebben geen verzonnen catalogusbaseline. Meerdere
  publicatieprijzen en expliciete plaatsingsprijzen blijven afzonderlijk. De
  read begrenst devices/releasereferenties/items/snapshots en meldt ontbrekend of
  onvolledig bewijs als onbekend. Nog geen nieuwe bulk-prijspublicatiecommand.
- De lokale echte Producten-journey vond een bestaande Next-redirectfout:
  127.0.0.1 werd localhost, waardoor de cookie voor de oorspronkelijke host niet
  meeging. De officiële skipMiddlewareUrlNormalize-optie is alleen in development
  actief; de productie-instelling blijft gelijk. De expliciete loopbackhelper
  accepteert geen andere hosts of poorten. Alle tijdelijke authdiagnostiek is weg.
  Bron: https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware
- Tenantabonnement gebruikt de Sync-planpresentatie met het bestaande goedgekeurde
  tarief € 5,95 incl. btw per actief billable scherm en echte ledger-/providerdata.
  De € 49-prototypeprijs, fake customer/payment-ID's en gesimuleerde webhooks zijn
  niet overgenomen. Billing-/retentionflags, incasso en enforcement zijn niet
  geactiveerd. Bij leesfouten blijven accountsetup en onzekere financiële data weg.
- De contentbibliotheek gebruikt één tenantgebonden readprojectie. Reeksleden en
  renderoutput verschijnen niet nogmaals als losse ontwerpen/uploads. Gereedheid
  vereist een export bij de huidige drafthash; oude exports blijven immutable.
  Gemengde selectie gebruikt de bestaande atomaire CAS-playlistbatch. Bij een
  verloren antwoord blijven opdrachtidentiteit en invoer behouden, ook wanneer de
  gebruiker de playlistlijst opnieuw laadt. Alleen een bewezen revisieconflict
  maakt een nieuwe beoordeelde poging mogelijk.
- De visuele vergelijking vond twee opmaakverschillen door de port: Tailwind
  maakte SVG's block/middle en extra CSS-scope veranderde de prioriteit van
  mobiele marketingkoppen. SVG-defaults en :where()-scope herstellen de bron;
  er is geen eigen spacing-/typografiekeuze toegepast. De afzonderlijk vastgelegde
  contrastcorrecties en feitelijke productiecopy blijven gerichte uitzonderingen.

- Native Control gebruikt de originele Sync-Manropebron, verliesvrij uit WOFF2
  gedecodeerd en op de exacte benodigde gewichten geïnstantieerd met fontTools
  4.60.1. Alle zeven TTF-bestanden behouden de 280 bron-glyphs; herkomst, hashes
  en OFL staan naast de fonts. De bestaande Inter-assets blijven beschikbaar.
  De lichte werkplek volgt de Sync-kleuren/geometrie, met één gemeten native
  tekstcontrastcorrectie #718285 → #51666a (minimaal 4,5:1 op alle drie
  bronoppervlakken). Donkere systeemvoorkeuren blijven compatibel. De native
  telefoonbalk en tabletrail gebruiken nu de bronoppervlakken; routekeys,
  capabilities, sessies, lokale tenantcache, uploadqueue en app-lock blijven
  behouden. Dit bewijst nog geen fysieke native UI-pariteit of store-release.
  Reproductie: execution/tools/rebuild-native-fonts.py; upstreamtechniek:
  https://fonttools.readthedocs.io/en/latest/varLib/instancer.html

- Een beschikbaarheidsretry bewaart nu per product de volledige oorspronkelijke
  CAS-opdracht en idempotencykey. De server reconstrueert die niet uit een
  inmiddels gewijzigde catalogus. De bestaande guarded product-RPC valideert
  iedere waarde en tenant/revisie. Een echte AAL2/PostgREST-proef heeft na een
  verloren gecommit antwoord en een latere wijziging het oorspronkelijke
  ontvangstbewijs teruggekregen; de latere naam/prijs/revisie zijn behouden.
  Bewijs: execution/evidence/product-receipt-recovery.json. Geen schemawijziging.

- De bestaande browsercases blijven behouden en volgen nu de vastgezette Sync-
  bediening: vijf hoofdtaken, acht beheertaken, een Beheer-dialoog bij compacte
  hoogte/breedte en een vaste sidebar van 228/205 px. De eerdere inklapbare
  78/248-px-sidebar en mobiele Studio/Meer-knoppen zijn geen tweede ontwerp.
  Disabled-, tenant-, invoer-, Escape-, focus- en scrollchecks blijven aanwezig.
  Oorspronkelijke case-ID’s blijven herkenbaar; een gecontroleerde component-
  HTTP-grens wordt niet als live opslag- of providerbewijs geregistreerd.
- Studio bewaart dezelfde save-/renderopdracht bij een verloren antwoord. De
  bestaande negen mobiele browserstates bewijzen nu ook twee identieke
  opslagpogingen met behouden invoer. De mailworker geeft zijn lifecycle-abort
  door aan zowel queue- als providerrequests; een onderbroken mogelijke send
  blijft leased en wordt later unknown, zonder automatische dubbele verzending.

- De bestaande mobiele scrolltest vond een echte portregressie: de generieke
  paddingreset op vx-main had de ruimte voor de vaste navigatie weggehaald.
  Het laatste contentblok eindigde op y=605 achter de balk vanaf y=573. De
  adapter reserveert nu precies de bestaande 65-px-balk plus safe-area in één
  gedeelde CSS-variabele. De oorspronkelijke 35-px-contentpadding blijft intact.
  Er is geen testassertion versoepeld of content onder de balk geaccepteerd.

- De brede verkenningsrun telde 883 gevonden Controlcases: 278 pass, 23 fail,
  563 bestaande opt-in skips en 19 niet uitgevoerd na setup-/serialfouten. Er
  werden tijdens die run fixes en testlabels aangepast; enkele oude verzamelde
  testnamen bestonden daardoor niet meer in een nieuwe worker. Dit is geen
  acceptatierun op één vaste codeversie. De ruwe foutstatus blijft vastgelegd,
  naast afzonderlijke specifieke groene herhalingen en de finale vaste run.
- Volledige pagina-Axe vond ook het mobiele navigatietekstcontrast: #718285
  haalt slechts 4,01:1 op wit. Alleen de muted-voorgrond is #5b6d70 geworden,
  minimaal 4,87:1 op de drie lichte Sync-oppervlakken. De legacy Sportlink-
  boventitel gebruikt de afzonderlijk gemeten correctie #4b7064. Bronassets,
  spacing en de originele handoff blijven ongewijzigd.

- De catalogus gebruikt één expliciete SECURITY INVOKER-read per zoek-/filter-
  wijziging, na 250 ms invoerrust, en maximaal vijftig producten. Exacte totalen
  en categorieën komen uit dezelfde tenant/RLS-projectie. De eerste tweehonderd
  categorie-opties zijn begrensd en zichtbaar onvolledig; zoeken op categorienaam
  blijft over de volledige catalogus werken. Verlies of veroudering van een
  readrespons vervangt geen betrouwbare rijen door een fictief leeg resultaat.
  De prijsverschilmetric vermeldt bij paginering expliciet de huidige pagina;
  immutable menuprijzen en de bestaande productwriter blijven behouden.

- De nieuwe catalogusread is additief. Deploy voert de forwardmigratie uit vóór
  de nieuwe Control-image. Een rollback naar de voorafgaande image kan de
  ongewijzigde producttabellen en oude writers blijven gebruiken; de readfunctie
  en index kunnen veilig blijven bestaan. Er is geen backfill, ID-wissel of
  mutatie van een opgeslagen menu of release nodig.

- De gedeelde Button-primitive behoudt haar bestaande semantische API. Binnen
  de daadwerkelijke Sync-app-shell krijgt zij exact dezelfde brondeclaraties,
  varianten en responsive/disabled/focusregels als `.btn`. De expliciete shell-
  scope wint van de historische `html[data-design-system=fieldflow]`-regels;
  andere apps en historische renderer-CSS veranderen niet. Het importtrigger
  gebruikt de aangeleverde secundaire Twelve-knop met het originele Upload-icoon.
- Een echte formulierproef vond dat opties en hulptekst onderdeel werden van
  toegankelijke veldnamen. Zichtbare labels sturen nu de naam via aria-labelledby;
  de artikelnummerhulp is een afzonderlijke beschrijving. Er is geen visuele
  formulierwijziging nodig om categorie en artikelnummer correct te benoemen.

- Een verloren beschikbaarheidsantwoord wordt als afzonderlijke eerdere
  opdracht bevestigd. Een verse catalogusread of een latere wijziging wijzigt
  de payload/key van die eerdere opdracht niet. De huidige toggle blijft tot
  bevestiging geblokkeerd voor dat product; andere fouten/opdrachten worden per
  product behouden. Een ouder ontvangstbewijs overschrijft geen nieuwere
  canonieke revisie. Een tenantwissel gebruikt een nieuwe UI-instantie op basis
  van de server-gevalideerde tenant-ID. De echte browser/AAL2-proof behoudt na
  verloren antwoord en concurrente wijziging de latere naam/275 cent/revisie 4.
# Sync Studio-renderer en QR-afhankelijkheid

De Sync-presentatie krijgt een afzonderlijke renderer/source-identiteit naast
de bestaande Sites-v11/v17-contracten. De bestaande releasekolom en decoders
worden niet verbreed. Oude mediapublicaties blijven hun bestaande formaat houden.
De nieuwe renderer leest uitsluitend gevalideerde invoer en geverifieerde
assetreferenties; Source-demodata en de lokale demostore worden niet overgenomen.

Voor dezelfde QR-matrix als de Source wordt `qrcode@1.5.4` toegevoegd aan
content-templates, met de al aanwezige gepinde types. Beide pakketten staan al
in de workspace-lockfile. Dit is een expliciete dependency-taak voor de exacte
renderer; alleen de importer wordt uitgebreid, zonder upgrades. De matrix wordt
als vertrouwde SVG-geometrie getekend, zodat Player geen externe link, willekeurige
HTML of data-URI hoeft te accepteren. Pixelvergelijking blijft een aparte gate.



### S226 · herstel van Studio-opdrachten en handmatige retries

De nieuwe Source-editor bewaart de volledige oorspronkelijke Save-, Render-,
Copy- en Restore-opdracht per tab in sessionStorage. Een ontvangen schrijfreceipt
blijft onderscheiden van een mislukte actuele leesactie. Kopiebevestiging van een
oudere invoer navigeert niet weg van nieuwere invoer. Gecontroleerde uitvoer wordt
tegen de immutable ontwerpversie vergeleken en kan zichtbaar verouderd zijn.
Elf browsergevallen controleren deze grenzen; dit vervangt geen echt RLS-bewijs.

De nieuwe renderreceipt-helper reconstrueert uitsluitend een al gecommitteerde
request vanuit de immutable job/revision en laat de bestaande receiptfunctie de
originele requesthash controleren. Huidige actor-/tenant-/capabilitygrenzen blijven
vooraf gelden; er komt geen publiek receipt-writerpad bij.

Een handmatige retry na drie claims was onclaimbaar door `least(rowmax, globalmax)`.
De extra kolom `manual_retry_through_attempt` wordt uitsluitend door de bestaande
geautoriseerde retrywriter op precies `attempt_count + 1` gezet (hard maximum tien).
De automatische workerlimiet blijft drie. Een mislukt extra attempt vereist een
nieuwe expliciete command; replay van dezelfde receipt verleent geen nieuwe poging.
Claim behoudt de huidige S123 image/video-manifestlogica. Afmetingen, duur en fps
komen nu uit de immutable renderrevision, zodat een latere draft de reeds gevraagde
uitvoer niet verandert. De gerichte reeks is 77/77 groen; de vier bestaande Studio-
regressiebestanden zijn 135/135 groen. Verse volledige reset/RLS volgt.


### S226 · apart Sync Player-protocol

De historische Player valideert zijn Sites-systeemmanifest strikt op precies 82
assets. Sync-assets daar toevoegen zou oude offlineclients een release laten
weigeren. Daarom krijgt Sync een eigen optioneel `syncSystemAssets`-manifest en
aparte itemvelden; de bestaande Sites-identiteiten en manifestvalidatie blijven
ongewijzigd. De complete geverifieerde PNG/MP4 blijft altijd het compatibele
fallback-item. Nieuwe clients controleren ook alle Sync-assets vóór activatie.
Een zelfstandige releasekolom wordt uitsluitend uit dezelfde immutable
Studio-exportrevision afgeleid, met eigen vastgelegde paginatiming. Een plaatsing
mag de volledige opgeslagen paginareeks niet afkappen. Oudere clients negeren de
nieuwe optionele velden en volgen hun bestaande PNG/MP4-pad; dit krijgt afzonderlijk
compatibiliteitsbewijs. Live provideracceptatie volgt niet uit deze ontwerpkeuze.
# S226 dependency-taak: functionele Source-Motion

Control gebruikt voor de Source-Motion-preview rechtstreeks `motion` met de
reeds gelockte versie 12.42.2, die ook Marketing gebruikt. Alleen de Control-
importer en de directe dependency worden toegevoegd; geen versie-upgrade.
Geanimeerde Source-ontwerpen krijgen een volledige MP4-export. Oude documenten
zonder expliciete Motion-keuze blijven leesbaar en behouden hun bestaande
uitvoer. Raster, preview en Player krijgen dezelfde begrensde paginatransitie.


### Source-reeksen en plaatsingsvarianten

Reeksen blijven de bestaande tenanttabellen en oorspronkelijke project-ID’s
gebruiken. Het nieuwe Source-membershipcommand laat de bestaande gevalideerde
project-/archiefwriters de documenten maken of archiveren; er is geen tweede
documentstore. Elk command bewaart zijn volledige oorspronkelijke sleutel en
CAS-context bij een onbekend antwoord. Voorbereiding zoekt het actorgebonden
ontvangstbewijs vóór de veranderlijke reeksrevisie en membership; nieuwe
verouderde intenties blijven geweigerd. Een thema of andere Source-duur per
plaatsing maakt eerst een aparte immutable render. Bronontwerp en bestaande
releases blijven gelijk. Source-fit/focus gebruikt dezelfde geometrie als de
binaire fallback; een inkorting kan geen onvolledige Source-paginalus publiceren.

- Gekoppelde Source-menu’s brengen de originele lichte kaartbijschriftkleur
  `#8b9aab` daadwerkelijk in beeld. Axe meet 2,87:1 op wit. De CSS-generator
  laat alleen dat bijschrift de bestaande donkere Source-kaarttekst erven;
  font, maat, spacing en compositie blijven gelijk. Deze concrete correctie
  volgt de hogere toegankelijkheidsgrens en geldt gedeeld voor preview,
  worker en Player. De vastgelegde oorspronkelijke Source blijft ongewijzigd.

- De volledige Source-playlistdialoogcontrole vond zes oorspronkelijke
  tekstkleuren onder AA: de actieve tab en status-/previewbijschriften.
  Alleen tekst gebruikt nu de al aanwezige `--pe-ink`/`--pe-muted` semantiek;
  actieve onderstreping, achtergronden, maten, fonts en indeling blijven gelijk.
  De contrastgate blijft op de hele zichtbare dialoog actief.

### S226: semantische QR-wrapper in gelinkte voorbeelden

De echte RSS-kopieproef rondde create/herstel/full MP4/private SHA en behoud van het originele document af, maar registreerde React-hydratatiefouten. Directe readonly GET- en kopienavigatieprobes reproduceerden die fout niet. Los daarvan kan de betekenisloze QR-`a` zonder href binnen een gelinkte kaart een tweede anchor vormen, waardoor de HTML-parser de kaart splitst. De decoratieve wrapper is daarom een `span` met dezelfde img-rol; de generator behoudt de exacte Source-QR-afmetingen. Matrix en pixels wijzigen niet. Een SSR-regressie bewijst één navigatiedoel. De echte verloren-antwoordketen wordt met hetzelfde ontvangstbewijs opnieuw getoetst; de eerste fout blijft in het bewijspakket.


De exacte RSS-herstelproef bleef na de QR-correctie rood en slaagde in dev;
QR was dus geen aangetoonde oorzaak van de navigatiefout. Create-success gebruikt
nu `router.replace` zodat de Next Server Action en paginawissel via dezelfde
router lopen. De productie-replay in bouw `fr92zEN4P5nfnqFN0YUca` is foutloos:
twee identieke receipts, geen nieuwe geschiedenis, origineel behouden. De
hervatte mediaproef schrijft niets en bevestigt dezelfde private volledige MP4.


### S226: tokengebonden schermoriëntatie voor de bestaande realtime-bootstrap

De echte Source LED-publicatie vond HTTP 503 op de bestaande realtime-route.
De serverloader las rechtstreeks `screens.orientation`, terwijl de service-role
terecht geen algemene SELECT op `screens` heeft. De bestaande, met device-token
geautoriseerde bootstrap retourneert nu alleen de oriëntatie van zijn eigen
gekoppelde scherm. De loader gebruikt dat veld. De bestaande functiebody behoudt haar immutable alertselectie en
catch-upvolgorde; er komt geen algemeen schermleesrecht. Unitmocks weigeren iedere directe schermread en
SQL bewijst tokenbinding, onbekend-device-denial en behouden privégrenzen.
Dit herstelt dezelfde globale stream voor historische en Source-content.


De volgende echte delta bleef uit door het multiplexed Realtime-kanaal:
`service_role` mocht niet filteren op `screens.id`. Supabase gaf expliciet
`invalid column for filter id`; dat blokkeerde ook het LED-abonnement binnen
hetzelfde kanaal. Alleen SELECT op `id`, `tenant_id`, `target_revision` is nu
toegekend aan de serverrol. Naam, oriëntatie en overige scherminstellingen zijn
niet rechtstreeks leesbaar; anonieme schermreads blijven door tenant-RLS
geweigerd. Geen extra stream, queue of polls. De echte Source-publicatie volgt
nu 5–1, bevriest op 18:25 en herlaadt offline met die laatste stand; de volledige
5s-binaire publicatie blijft immutable. Eerste pogingen zijn bewaard.

- Source Engage bewaart de publieke campagne-UUID in het ontwerp en resolveert
  de interne campagne-ID binnen dezelfde tenant voor de bestaande playlistwriter.
  Alleen de bestaande publieke RPC bepaalt resultaatzichtbaarheid; managementmetrics
  komen niet in de kaart. De volledige export is de immutable offlinefallback.
- Source YouTube bewaart uitsluitend de canonieke URL van een bestaande geverifieerde
  tenantbron. Bronnen beheren behoudt de bestaande providercontrole. De playlistbatch
  vervangt alleen de plaatsingsfallback, nooit de oorspronkelijke bronfallback.
  Videofallback is alleen toegestaan voor een checksum-geverifieerde Source-YouTube-
  Studio-export; de bestaande algemene afbeeldingsgrens blijft behouden. Een extra
  releaseguard koppelt die kaart aan dezelfde immutable online video/playlist.
- YouTube-terugval op een Source-video heeft één natuurlijke itemgrens. De bestaande
  YouTube-afbeeldingstimer blijft gelden waar de fallback zelf geen grens beheert.

## Definitieve gekozen Sync responsivecohort

Alle66 oorspronkelijke RESP-IDs zijn opnieuw uitgevoerd op Source8b1fdf1f,
met zes vaste viewports, expliciete lege readmodels en werkelijke productie-JSX/CSS.
De strikte v4-cohort is66/66 groen; iedere huidige pagina heeft nul Axe-fouten,
geen horizontale overflow en geladen bronassets. Het opgeslagen readback bevat
één codefingerprint. De CI-verifier weigert ontbrekende IDs, gemengde oude
asserties, ontbrekende Axe-resultaten en gefingeerde PASS bij ruwe fouten.
De bestaande644 exacte screen-rendererframes en76 starters blijven apart.

Dit is geen algemene pixelacceptatie. Ruwe productiebeelden en maten blijven
bewaard. Een tweede, uitdrukkelijk counterfactual meting herstelt uitsluitend
het oorspronkelijke kleinere hit area om de reeds verplichte44px-touchcanon
te isoleren. Productie houdt44px, de65px-footer en de noodzakelijke5px-headergap.
De bronnenbadge gebruikt feitelijk ‘Opgeslagen bronstatus’ in plaats van de
onware prototypeclaim ‘Interactieve demo · geen externe verbindingen’. Alleen
in die tweede meting wordt de oorspronkelijke tekstbreedte geïsoleerd; de
ruwe productiecopy blijft zichtbaar en is afzonderlijk exact geassert.

De originele Sources/Support-routes laten hun nulrijenstatus weg. De vergelijking
rendert daarvoor hun ongewijzigde gedeelde Source-EmptyState met feitelijke
productietekst. Dit is expliciet component-statebewijs, geen ongewijzigde
hele-paginacapture. De zes Settingscases hebben geen overeenkomstige Source-
contentroute: uitsluitend shell/overflow/assets/touch/Axe zijn hier PASS;
contentpariteit is N_A, functionele rechten/opslag blijven afzonderlijke gates.
Zie execution/evidence/sync-responsive en de v4-spec/verifier.

## Twelve-import: duurzaam ontvangen formulier

De werkelijke productiebuild reproduceerde na succesvolle mapping een303
Server Action-respons zonder voltooide browserbevestiging. Rechtstreekse GET
met dezelfde sessie en succesquery rendert wel correct; provider-, Auth- en
CSP-fouten zijn hierbij niet aangetoond. Dit is lokaal bewijs van de vastloper,
geen algemene verklaring voor een specifieke upstreamframeworkbug.

Mapping en toepassen gebruiken nu gewone POST-formulieren met303 naar de
canonieke route. Een64KiB-bound, exacte Origin/Host/protocolcontrole, live
actieve tenant, capability, URL/form-import-ID en tenantread gelden vóór de
bestaande guarded RPCs. Dezelfde import-ID bewaart de ontvangstidentiteit;
een eerdere of concurrent toegepaste import veroorzaakt geen tweede writer.
De bestaande serveracties blijven compatibel beschikbaar. Bron-ID's,
importparser, CSV/XLSX-normalisatie en atomaire databasewriter veranderen niet.
Er zijn zeven gerichte guard-/concurrency-/receiptchecks toegevoegd; echte
CSV/XLSX-upload/mapping/apply/herladen wordt afzonderlijk vastgelegd.

De aparte lokale .next-qa-output is generated buildoutput, net als .next.
ESLint en de bestaande source-boundaryinventaris slaan beide gegenereerde
mappen over; oorspronkelijke bronbestanden en importedges blijven gecontroleerd.
