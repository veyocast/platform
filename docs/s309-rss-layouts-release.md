# S309 — RSS-indelingen en gecombineerde hotfixrelease

## Opdracht en toestemming

Op 11 november 2026 autoriseert de gebruiker expliciet committen, pushen,
mainintegratie en staging-/productie-uitrol. Eerst de bijgevoegde RSS-opdracht,
daarna samen met de voorafgaande menu-/playlist-hotfix uitrollen. Deze toestemming
hoort bij dit VeyoCast-traject; bestaande releaseguards blijven verplicht.
Regenerabele Next-cachebestanden ouder dan zeven dagen zijn gericht verwijderd
uit drie oude werkruimten om lokale schijfruimte vrij te maken. Geen bronbestanden,
databasevolumes, runtime-assets, environments of secrets verwijderd of aangepast.

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
- Zes extra proeven met de echte `SyncStudioMedia` Player-component groen:
  alle combinaties, geverifieerde assetbytes/fontloading en ready-framebevestiging.
- Zes volledige Worker-captures groen met onafhankelijk gedecodeerde artikel-QR.
  De bestaande Worker/preview-pixelvergelijking en artikelwisseling zijn opnieuw
  groen. De meting blijft serialisatie-veilig: geen externe/named helperclosure
  die tijdens browserinjectie een niet-beschikbare transpilerhelper nodig heeft.
- Twee echte create-wizardproeven op 320/1440 px groen: toetsenbordselectie,
  onmiddellijke preview, portrait, reload, behouden selectie van zeven artikelen,
  verloren HTTP-response en exact dezelfde bevestigde opdracht bij retry.
  Beide geteste schermen hebben nul geteste axe-A/AA-overtredingen.
- Zes regressie-units bewaken seed/duplicatie/serialisatie, beide oriëntaties,
  historische ontbrekende keuze, ongeldige waarden, uitgever/datum/URL en tekst.
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
- Vijf transactionele DB-suites met beide migrations samen: 215 assertions
  groen (46 + 14 + 40 + 45 + 70), inclusief historische OnzeTrots-contracten.

De zes reguliere native composities staan in `docs/evidence/s309-rss-layouts/`.
Dit zijn gecontroleerde voorbeeldberichten, geen claim van echte providers.
De titels, QR-bestemming, fonts, bounds en volledige frames zijn daadwerkelijk getest.

## Release en bewijsgrens

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
