# S309 — RSS-indelingen en gecombineerde hotfixrelease

## Opdracht en toestemming

Op 11 november 2026 autoriseert de gebruiker expliciet committen, pushen,
mainintegratie en staging-/productie-uitrol. Eerst de bijgevoegde RSS-opdracht,
daarna samen met de voorafgaande menu-/playlist-hotfix uitrollen. Deze toestemming
hoort bij dit VeyoCast-traject; bestaande releaseguards blijven verplicht.
Regenerabele Next-cachebestanden ouder dan zeven dagen zijn gericht verwijderd
uit oude werkruimten om lokale schijfruimte vrij te maken. Geen bronbestanden,
databasevolumes, runtime-assets, environments of secrets verwijderd of aangepast.
Bij hernieuwde schijfdruk zijn ook Next-caches ouder dan één dag en de ongebruikte
Playwright-browsercache 1208 verwijderd; de gebruikte browsercache 1228 blijft staan.

## Onderzoek en configuratiemapping

De actuele routes zijn `/dashboard/studio/new?family=rss&mode=connected`, de
bestaande Sync Studio en `/dashboard/slides/[slideId]/edit`. De oude RSS-route is
alleen een redirect. Er is geen tweede nieuwsengine of player gebouwd.

De bestaande v9-authoringconfiguratie krijgt één optioneel veld:

`authoring.rssLayout = beeldheld | nachteditie | clubkrant`.

- Gekoppeld: `dynamic_slides.configuration_json.syncConfiguration.seed.authoring.rssLayout`,
  dezelfde configuratie in de slideversie en immutable snapshot/release.
- Handmatig: `StudioDocument.syncPresentation.authoring.rssLayout`.
- Dezelfde Zod-/JSON-schema's bewaken create, save, duplicatie, readmodel en Player.
  De twee private databaseschemafuncties worden met een forwardmigration bijgewerkt;
  er komt geen tabel, nieuwe infrastructuur of bulkconversie.
- Ontbrekende waarde blijft ontbreken bij heropenen van een bestaande slide.
  De editor meldt dat de bestaande indeling actief is. Alleen een expliciete
  selectie kiest een nieuwe compositie; opslaan behoudt overige broninstellingen.
- Een nieuw OnzeTrots-RSS-ontwerp begint met Beeldheld. Zonder tenantstandaard
  kiest de RSS-aanmaakflow OnzeTrots. Een expliciete bestaande themastandaard
  blijft leidend; via de bestaande themakeuze zijn de OnzeTrots-indelingen bereikbaar.
- Layout is onderdeel van de opgeslagen seed en daardoor van de bestaande
  configuratie-/renderidentiteit. Publiceren volgt dezelfde gecontroleerde flow
  als de gecombineerde hotfix; immutable historische releases worden niet herschreven.

## Vormgeving en inhoud

De meegeleverde ZIP-referentie is als concrete visuele bron gelezen. De privé-URL
was niet via de browse-tool bereikbaar; het complete lokale HTML/CSS-pakket wel.
De gekozen composities zijn herkenbaar overgenomen als HTML/CSS op de bestaande
1600×900 / 900×1600-canvassen. Permanent Marker en Manrope zijn bestaande lokale,
geverifieerde assets. Geen demoartikel, nieuwe clubfoto, font of homepage-QR uit
de ZIP is als productie-inhoud overgenomen.

- Beeldheld: canvasvullende artikelfoto, donkerblauwe leesverlopen, witte QR-zone.
- Nachteditie: donker canvas, witte gedraaide fotolijst met blauwe schaduw.
- Clubkrant: blauw canvas, wit gescheurd papier, blauwe brush-titel.
- Portrait heeft eigen foto-, tekst- en QR-geometrie; geen geroteerde landscape.
- De titel wordt gecontroleerd passend gemaakt met een vloer van 30 logische
  pixels; alleen de samenvatting mag zichtbaar met ellipsis worden verkort.
  Gemeten Marker-glyphs krijgen ruimte, niet alleen hun CSS-linebox.
- Bron komt uit echte artikel-/feedmetadata, eventueel uit het artikeldomein;
  de tenant staat afzonderlijk als schermbeheerder. De neutrale kop is Nieuws.
  Alleen expliciete headerteksten verschijnen als aangepaste kop/subtitel.
- Een echte geldige publicatiedatum wordt doorgegeven; geen datumfallback.
  Er worden geen categorieën, clubnieuwsclaims of fotocredits verzonnen.
- Uitgeverslogo is een bronmarkering, nooit een artikelfoto. Ontbrekend/defect
  beeld krijgt een neutrale kleurachtergrond; bestaande focusgegevens blijven behouden.
- De bestaande QR-generator encodeert uitsluitend de actuele gevalideerde
  artikelbestemming, met vier witte modules quiet zone en integrale native
  modulepixels. Het bestaande Sync-contract staat HTTPS zonder credentials toe.
  Ongeldige/ontbrekende URL verbergt QR én CTA; de tekst krijgt de ruimte terug.
- Kop, beeld, tekst, bron, datum en QR worden vanuit hetzelfde artikel/index
  gerenderd. Geen los asynchroon QR-resultaat of nieuwe afbeeldingsgeneratiecyclus.

## Lokale verificatie

- 31 Chromium-renderproeven groen: drie ontwerpen, twee formaten, reguliere en
  400-tekentitels/lange tekst, lange URL, ontbrekende foto/URL, tweede artikel
  met eigen bron en defecte foto. QR's zijn onafhankelijk met ZXing uit het
  volledige native frame gedecodeerd, niet uit de verwachte matrix of DOM.
- Zeven extra proeven met de echte `SyncStudioMedia` Player-component groen:
  alle combinaties, geverifieerde assetbytes/fontloading en ready-framebevestiging.
  Een live feitenwisseling A→B controleert ook foto/fallback, titel, bron en de
  onafhankelijk gedecodeerde artikel-QR, zonder Playerherstart. De fotonode is
  aan de geverifieerde beeld-URL gekoppeld zodat een vorige decode/foutstatus
  niet bij een volgende foto blijft hangen. De native portraitfixture gebruikt
  daadwerkelijk een 1080×1920 Player-host.
- Zes volledige Worker-captures groen met onafhankelijk gedecodeerde artikel-QR.
  De bestaande Worker/preview-pixelvergelijking en artikelwisseling zijn opnieuw
  groen. De meting blijft serialisatie-veilig: geen externe/named helperclosure
  die tijdens browserinjectie een niet-beschikbare transpilerhelper nodig heeft.
- Twee echte create-wizardproeven op 320/1440 px groen: toetsenbordselectie,
  onmiddellijke preview, portrait, reload, behouden selectie van zeven artikelen,
  verloren HTTP-response en exact dezelfde bevestigde opdracht bij retry.
  Beide geteste schermen hebben nul geteste axe-A/AA-overtredingen.
- Twaalf regressie-units bewaken seed/duplicatie/serialisatie, beide oriëntaties,
  historische ontbrekende keuze, ongeldige waarden, uitgever/datum/URL en tekst.
  De volledige canonical projector behoudt ook artikelen met een ontbrekende,
  ongeldige, credentialhoudende of niet-toegestane artikel-URL. Alleen QR/CTA
  vallen weg. Dit hergebruikt dezelfde bestaande HTTPS-contractvalidatie;
  ongeldige bronfeiten laten niet alsnog de volledige nieuwe RSS-slide afvallen.
- De uitgebreide bestaande RSS-databaseproef telt 45 assertions, alle groen.
  De echte guarded writer bewaart alle drie indelingen in bestaande logische
  slides en behoudt bron en artikelselectie. Tenant-/viewernegatieve proeven
  blijven actief. Beide nieuwe migrations zijn samen toegepast in een transactie
  met rollback op de aanwezige lokale database, zonder shared reset.
- De menu-/playlist-hotfix heeft daarnaast 60 DB-assertions, 12 menu-, acht
  playlist- en 18 Player/offlinebrowserproeven; zie het eigen hotfixdocument.
- Gecombineerde lokale workspacecontrole: 75/75 lint-, type-, test- en buildtaken
  groen, inclusief Control2232, content300, Player755 en worker436 tests. Na de
  laatste serialisatiecorrectie zijn de echte Worker-/Player-proeven opnieuw
  groen (14/14) en de renderercontroles opnieuw uitgevoerd.
- De aanvullende URL-correctie heeft opnieuw 19/19 packagegates groen, nu
  content306 tests; de zes ontbrekende-URL-, zes Worker- en zeven echte
  Player-componentproeven zijn opnieuw groen (19/19). Ook een na normalisatie
  te lange URL en een niet-codeerbare QR-bestemming vallen veilig weg.
- Vijf transactionele DB-suites met beide migrations samen: 215 assertions
  groen (46 + 14 + 40 + 45 + 70), inclusief historische OnzeTrots-contracten.

De zes reguliere native composities staan in `docs/evidence/s309-rss-layouts/`.
Dit zijn gecontroleerde voorbeeldberichten, geen claim van echte providers.
De titels, QR-bestemming, fonts, bounds en volledige frames zijn daadwerkelijk getest.

## Release en bewijsgrens

De eerste verse hosted RLS-run bij `c6a03bd5` wees terecht publicatiefixtures
zonder bruikbare output af en vond een conflict met de bestaande seizoensherstelproef.
De productieguard is niet versoepeld: de vier publicatie-/beheerfixtures krijgen
een echte ready mediarecord plus original-variant. Twee historische retentieproeven
maken hun bewust onvolledige legacy-metadata nu expliciet als historische publicatie,
zonder te doen alsof dit nieuwe valide Worker-output is.

Automatische playlistdoorwerking wordt uitsluitend vanuit geslaagde finalisatie
aangeroepen. Een willekeurige wijziging van een historische actieve-versiepointer
(bijvoorbeeld het bestaande seizoensherstel met eigen frozen releases) start geen
tweede publicatieketen. De bestaande S305-proeven blijven daardoor ongewijzigd.
De complete lokale SQL-suite wordt aanvullend met de ontbrekende migratiesuffix
per transactie gecontroleerd; dit reset of migreert de gedeelde database niet blijvend.
De acht door hosted CI gevonden gevallen zijn met die suffix lokaal hersteld en
groen, inclusief beide ongewijzigde S305-herstelproeven. De brede lokale controle
vond daarnaast ontbrekende standaardseed/pgTAP-setup en twee S295-baselineafwijkingen;
die zijn afzonderlijk tegen de situatie zonder deze hotfix vergeleken. Dat is
geen vervanging voor de verplichte verse hosted reset/RLS-run bij de nieuwe SHA.
De daaropvolgende verse SQL/RLS- en concurrencycontroles zijn groen. De echte
uploadproef slaagt ook; de publicatieproef liep nog op één verouderde knopnaam
uit. Alleen die selector is bijgewerkt naar `Omhoog verplaatsen: …`; geen opslag-,
conflict-, publicatie- of first-frameassertie is verwijderd of overgeslagen.

De verse hosted run bij `530568ec` bevestigt alle 158 SQL-bestanden (5.450
assertions), concurrency/advisors en beide echte opslag-/publicatiebrowserproeven.
De daaropvolgende browsermatrix vond verouderde transportfixtures: publicatiestatus
is een leesactie, geen mutatie. Die adapters volgen nu de echte queued status,
zonder een preview gepubliceerd of plaatsbaar te verklaren. Previewselectors
richten zich op het zichtbare scherm en niet op de aria-hidden all-page-fitprobes.
Een nieuwe Beeldheld-preview wordt naast de ongemarkeerde legacy-RSS gecontroleerd.

De originele menuhoeken zijn hersteld zonder de overflowmeting te verwijderen;
de pixelvergelijking van de originele categoriekoppen blijft ongewijzigd. Bij
productafbeeldingen telt de afbeelding niet meer als tekstbaseline. De klassieke
MenuScene meet ook buiten de eigenlijke body groeiende kolommen en botsingen
met zwevende blokken. De menu-goldenfixture heeft nu twee expliciet ingedeelde
pagina's in plaats van impliciete capaciteitsafhankelijke paginering: dezelfde
negen producten blijven aanwezig. Nieuwe goldens bewaken de aangevraagde
prijsbaseline; de bestaande pixeltolerantie wordt niet verruimd. Een volle
widgetproef past vóór opslaan expliciet het thema aan; de volmelding wordt niet
genegeerd. Lokale parallelle hercontroles liepen tegen schijf-/geheugendruk en
timeouts aan en worden daarom sequentieel herhaald, niet als geslaagd geteld.
De herhaalde lint/typecheck/testtaken zijn groen (elk 30/30 inclusief
afhankelijkheden); alle 44 bijgewerkte menu-goldens plus de tien overige
menu-Playerproeven en alle negen gerichte opslag-/publicatiepreviewproeven zijn
groen. De twaalf compacte/volle widgetproeven en de ongewijzigde originele
categoriekoppixelvergelijkingen blijven groen. De volledige hosted browsermatrix
moet vóór mainintegratie ook bij de definitieve SHA groen zijn.

De aanvullende late-completioncontrole vond nog een randgeval: de waarschuwing
na twee minuten stopte ook het lezen van de status. De UI blijft nu na die
waarschuwing iedere vijftien seconden observeren, zonder opnieuw te publiceren.
Vier echte componentbrowserproeven met een gecontroleerde statusboundary en
virtuele klok bewaken late voltooiing, langzame dashboardverversing, annuleren
van een vertraagde response na sluiten en herstel na een leesstoring. Alle vier
zijn groen; dit is geen vervanging van de echte Worker-/RLS-publicatieproef.

De volledige hosted Control-matrix bij `72308ed7` is groen: 811 proeven uitgevoerd,
629 verwachte opt-in-skips; de originele referentiecohorten zijn apart groen.
De geïsoleerde Player-matrix bereikte proef 464/536 en vond een fout in de nieuwe
QR-proef. De bewaarde trace toont `data-sync-ready=false` en een volledig verborgen
frame: de proef maakte de afbeelding vóór de echte font-/beeldvoorbereiding af
was. Dit was geen aangetoonde artikel-/QR-mismatch in een zichtbaar Player-frame.
De proef wacht nu op de echte eenmalige ready-bevestiging én volledige zichtbaarheid,
vertraagt de echte fontdecoder bewust met 750 ms en decodeert zowel artikel A als
artikel B uit het volledige beeld. Vijf koude herhalingen zijn groen. Ook behoud
van de ready-bevestiging en het aantal fontloads bij de wisseling wordt bewaakt;
er is geen productiecode of QR-assertie versoepeld.

De aanvullend lokaal uitgevoerde laatste Player-cohorten vonden daarna twee
ongewijzigde watchdogproeven die de extra itemverversing terecht afkeurden:
een gewoon ongewijzigd manifest overschreef onmiddellijk de herstelmelding
van de decoder/watchdog. De bestaande herstelactie en heartbeat bleven werken,
maar de diagnose verdween. Zo'n gewone ontvangst behoudt nu de actuele
operatiemelding; een echte terugkeer van offline of ingetrokken pending release
krijgt wel de bijbehorende synchronisatiemelding. Beide oorspronkelijke proeven
blijven ongewijzigd als regressiebewaking.
De Player-lint/typecheck, 755 unittests en productiebuild zijn opnieuw groen.
Alle 28 aanvullende activatie-/offline-/watchdogbrowserproeven zijn groen,
inclusief de twee oorspronkelijke, niet aangepaste herstelproeven.

De gecombineerde branch/PR gaat via de ongewijzigde normale CI, immutable
main→staging-build en expliciete productiepromotie met dezelfde digests.
Exacte SHA's, workflowlinks en resultaten worden na de uitrol vastgelegd in het
PR-commentaar en het afsluitbericht, zonder een extra applicatierelease alleen
voor een achteraf aangebrachte logtekst.

Geen fysieke Android-/webOS-televisie is lokaal bediend. Browserproeven gebruiken
echte productiecomponenten met gecontroleerde transportfixtures; dit is geen
claim van een geauthenticeerde klantbewerking of fysieke offlineproef. De lokale
SQL-posterfixture is metadata, geen echte upload/workercompletion. Nieuwe velden
zijn opt-in; een oude decoder moet een onbekende kandidaat afwijzen en zijn
geverifieerde vorige release behouden, niet onbekende layoutdata interpreteren.

## Gewijzigde onderdelen

- Contracts: v9-authoring, rich nieuwsmetadata, headerdefaults en gegenereerde
  Sync-slide-/dynamic-JSON-schema's met bijbehorende gelijkheidstests.
- Control: bestaande gedeelde authoringbediening/CSS, aanmaakdefaults,
  wizardstate/serverdata en gerichte tests.
- Content templates: dezelfde view/projector, bronprojectie en serialisatie-veilige
  v9-layoutmeting; één nieuwe RSS-compositiecomponent binnen de bestaande renderer.
- Database: `20261111020903_rss_onzetrots_layouts.sql`, bestaande RSS-opslag/RLS-proef.
- Bewijs: RSS-unit, wizard-, renderer- en echte Player-componenttests; zes beelden.
- Generator: `scripts/build-rss-onzetrots-schema.mts` schrijft uitsluitend de
  expliciet gekozen nieuwe RSS-migration en nooit historische SQL.
- De voorafgaande hotfixbestanden staan volledig in
  `docs/hotfix-menu-publication-playlists.md`.
