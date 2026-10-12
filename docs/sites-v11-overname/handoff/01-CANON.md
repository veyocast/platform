# VeyoCast — Canon exacte Sites UI/UX-overname

Versie 1.0 · 11 oktober 2026 · opdracht van de producteigenaar in deze conversatie.

## 1. Bindend doel en bronnen

Implementeer de huidige Sites-interface, workflows, media, templates en narrowcasting-ontwerpen in het echte `veyocast/platform`. Gebruik de meegeleverde broncode als implementatiebasis. Het resultaat moet dezelfde vormgeving en bediening hebben, met echte opslag, rechten, integraties en playback. Een vergelijkbare nieuwe interpretatie voldoet niet.

Visuele referentie: `source/sites/`, exact uit Sites-versie 11, commit `b1cae899af19fc39908217253094c5240d7359fc`. Bronwebsite: https://veyocast-ui.dgwebserv.chatgpt.site. Technische vergelijkingsbasis: GitHub `main`, commit `6fcc26f02c8050b7244e3660a93b85f02491e121`. De GitHub-HEAD is geen bewijs van de momenteel gedeployde productieversie. Controleer die vóór uitrol.

### Voorrang en gerichte wijziging van bestaande canons

1. Behoud tenantisolatie, server-side capabilities, AAL2, private media, immutable configuraties, offline-last-known-good, deviceauthenticatie, locked VeyoCast-merkassets en aantoonbare toegankelijkheid.
2. Voor de zichtbare pagina's en templates in deze overdracht is Sites v11 de door de gebruiker gekozen nieuwe visuele en interactionele bron. Dit vervangt conflicterende oudere pagina-indelingen en stijlkeuzes uit de bestaande designcanons voor deze oppervlakken.
3. Deze opdracht autoriseert het uitwerken van de aanvullende OnzeTrots-authoringthema's. De bestaande FieldFlow-only authoringgrens moet daarvoor gericht en forward-only worden uitgebreid; de controle zelf mag niet verdwijnen. Behoud alle bestaande historische render-ID's en immutable snapshots.
4. Functionele contracten van het huidige platform blijven leidend waar Sites alleen een demonstratie toont. Vooral S185-publicatie-, data- en targetrevisies blijven intact. Geen nieuwe publicatie bij iedere bronupdate.
5. Bij een werkelijk conflict tussen exacte weergave en beveiliging, locked branding of toegankelijkheid: leg het specifieke conflict en de kleinste noodzakelijke afwijking vast. Gebruik dat niet als reden om de hele UI opnieuw te ontwerpen of de reeds gekozen Sites-stijl opnieuw ter discussie te stellen.

Voeg deze beslissing als scoped design-delta toe aan de doelrepository, met verwijzing naar deze opdracht en beide bron-SHA's. Verwijder geen oude canons; markeer gerichte delen als vervangen. Verklaar niet de hele technische of securitycanon ongeldig.

## 2. Wat exact betekent

- Componentstructuur, informatiehiërarchie, kaarten, tabbladen, volgorde, navigatie, knoppen, iconen, dialogen, wizardstappen, lege toestanden en feedback volgen de referentie.
- Neem de **effectieve cascade** over: `app/tokens.css`, `app/fieldflow.css`, `app/globals.css` en alle relevante CSS Modules. Alleen basistokens kopiëren is onvoldoende. Hardcoded referentiewaarden mogen gecontroleerd naar semantische tokens worden verplaatst mits hun berekende weergave gelijk blijft.
- Behoud lokale fonts, exacte gewichten, letterspatiëring, regelhoogte, radius, schaduw, randen, gradients, padding, componenthoogte en iconformaat. Geen systeemfontfallback als definitief resultaat.
- Gebruik de bestaande bestanden onder `public/` byte-identiek. Geen nieuwe AI-generaties, vervangende stockfoto's, nagetekende logo's, gewijzigde landmarkgeometrie of onnodige hercompressie. De hashinventaris legt de referentie vast.
- Behoud bronvermeldingen die in de assets of provenance aanwezig zijn. De bestanden met `sources.json` en fontmetadata horen bij de overdracht.
- Neem de daadwerkelijke responsieve composities over. Een desktopeditor verkleinen tot mobiel voldoet niet. Een staande slide is een eigen 1080×1920-compositie, niet een uitgerekte landscape.
- Alleen gegevensgebonden inhoud verandert: echte namen, aantallen, accountgegevens, statussen, wedstrijden en prijzen. Demobadges verdwijnen waar echte werking is geleverd; fake online-, succes- en publicatiestatussen zijn verboden.
- Productiefuncties die niet zichtbaar zijn in Sites verdwijnen niet. Maak ze bereikbaar in dezelfde componenttaal, eventueel via bestaande geavanceerde instellingen. Claim voor deze nieuwe schermen geen pixelidentieke bron als die niet bestaat.

De exacte waarden, componenten en breakpointbewijzen staan in `docs/UI-STYLING-CANON.md` en `inventory/UI-TOKENS.csv`.

## 3. App-shell en mobiele bediening

Breng de Sites-shell over naar de bestaande geauthenticeerde Next.js-routes. Behoud de sidebar, inklappen, actieve selectie, zoekdialoog, tenant-/accountbediening, koppen en kleuren. Gebruik echte Next.js-navigatie, deep links, browsergeschiedenis en server-side routeguards; de hashrouter uit de demonstratie wordt geen productie-autoriteitslaag.

De actuele mobiele primaire navigatie is **Overzicht · Playlists · Studio · Schermen · Meer**. Dit is bewust de nieuwere Sites-versie; eerdere screenshots met Planning als primaire mobiele knop zijn niet de actuele bron. Planning blijft bereikbaar via Meer.

Op mobiel:

- inputs op leesbaar formaat en aanraakdoelen van minimaal 44 px waar de referentie dat voorziet;
- rekening houden met safe-area, softwaretoetsenbord, Android-terugactie en veranderende viewporthoogte;
- vaste primaire acties blijven bereikbaar zonder de laatste lijstregel te bedekken;
- dialogen openen binnen de viewport, sluiten met focusherstel en bevestigen verlies van niet-opgeslagen wijzigingen;
- alleen het bovenste venster reageert op terug/Escape; geen onbedoeld sluiten van de onderliggende editor;
- geen horizontale pagina-overflow bij 360, 390 en 412 px breedte;
- landscape op telefoon blijft bruikbaar; geen zwevende miniatuur met onbereikbare knoppen.

De responsieve web-Control-UI valt volledig onder deze opdracht. De aparte Expo/React Native-beheerapp blijft bestaan met haar echte API's, uploadqueue, biometrie en notificaties. Zie de routematrix: onderdelen zonder native Sites-bron worden apart verantwoord; dit ZIP is geen complete nieuwe native app of storesubmissie.

## 4. Media en playlists — primaire gebruikersflow

Neem `playlist-library`, `playlist-editor` en `playlist-media-picker` als leidende interactie over. De algemene oude `content.tsx`-playlistmodal is niet de actuele editor.

Verplicht:

- snel een playlist openen en inhoud toevoegen vanaf mobiel;
- overzichtelijke bronkeuze en zoeken/filteren, selecteren van meerdere items en één duidelijke toevoegactie;
- media, Studio-ontwerpen en dynamische ontwerpen in dezelfde toevoegflow;
- volgorde aanpassen met bereikbare pijlacties; bestaande toegankelijke drag-and-drop mag aanvullend blijven;
- preview en iteminstellingen bereikbaar zonder onbruikbare driepanelenweergave;
- bulkduur, selectie, verwijderen, ongedaan maken en wijzigingswaarschuwing;
- naam, duur per gegevenspagina, oriëntatie en thema op de juiste plek;
- thema per item, selectie en volledige playlist; data blijft behouden bij heen-en-weer wisselen;
- expliciet verschil tussen concept opslaan en publiceren; serverbevestiging vóór succesmelding.

Productie behoudt secties, crop/trim/volume, concurrency-/revisionguards, readiness, video, bestaande dynamische items, YouTube en Engage. De Sites-beperking tot browserafbeeldingen is geen productielimiet. Hervatbare video-upload, scanning/verwerking en ready/quarantine-statussen moeten via de bestaande pipeline bereikbaar blijven.

`asset:`-referenties, `blob:`-URL's, IndexedDB en `veyocast-demo-*` mogen geen productiegegevensbron worden. Persistente records en uploads krijgen bestaande tenantveilige identifiers en private Storage-referenties. Browservoorkeuren zoals sidebarstand mogen lokaal blijven.

Let op AVIF: Sites accepteert AVIF, de gecontroleerde productiepolicy niet. Volledige functionele parity vereist veilige servernormalisatie en tests voordat dit formaat in productie selecteerbaar wordt. Houd bestaande productieformaten en videofuncties intact.

## 5. Studio, templates en thema's

Er zijn drie verschillende stijlniveaus. Verwar ze niet:

| Niveau | Bron | Vereiste |
| --- | --- | --- |
| Beheerinterface | Sites FieldFlow-shell en modules | Zelfde UI op bestaande Control-/Marketingroutes |
| Narrowcasting-thema | `fieldflow` / `onzetrots-tv` en bestaande LED-stijlkeuzes | Opgeslagen, gevalideerde keus per ontwerp/snapshot |
| Tenantinhoud | Logo, kleuren, beelden, teams, bronselectie | Echte tenantcontext; geen Duindorp-data naar andere tenants kopiëren |

Alle bestaande Studio-startpunten blijven beschikbaar. Voeg de acht OnzeTrots TV-startpunten volledig bewerkbaar toe:

1. Onze wedstrijddag (`wedstrijd`).
2. Vandaag op het veld (`programma`).
3. Zo speelden we (`uitslagen`).
4. De stand van zaken (`stand`).
5. Even naar de kantine (`kantine`).
6. Dit leeft op de club (`clubnieuws`).
7. Samen maken we de club (`partners`).
8. Dit is onze trots (`welkom`).

Neem ook de aanvullende score-, goal-, opstelling- en generieke renderers mee. De bestaande blauwe/witte OnzeTrots LED-stijlen, brush-/grunge-lettertypen en vijf herkenbare achtergronden blijven beschikbaar. OnzeTrots TV komt erbij.

Teksten, teams, logo's, fotokeuze, uitslagen, prijzen, categorieën, nieuws, partners, clubwaarden en instellingen blijven echte bewerkbare velden. Sla alle velden op; een werkende slider die na herladen verdwijnt voldoet niet. Templatefixtures mogen alleen als herkenbare startvoorbeelden worden gebruikt, nooit ter vervanging van geselecteerde providerdata.

Algemene Studio: thema per slide en voor het volledige project, undo/redo, upload-/mediakeuze, beide oriëntaties en gegevenspaginering. Eén duur is de duur **per gegevenspagina**. Totale playlistduur en werkelijke playback rekenen alle pagina's mee.

LED Scores: behoud goal eigen team/tegenstander, start, rust, einde, opstelling en live tussenstand, de afzonderlijke titel-/score-/logo-/teamschalen, branding, klok, tijdlijn en achtergrondinstellingen. Eigen team is niet automatisch thuisteam. Gebruik gevalideerde echte team-/eventidentiteit; parsing van mocklabels uit Sites is geen productiecontract.

Sportlink: de zes zichtbare Sites-wizardfamilies krijgen dezelfde bediening en output. Alle extra bestaande GitHub-varianten blijven behouden. Gebruik gestructureerde providergegevens, niet het uit elkaar trekken van samengestelde demoteksten. Ontbrekende statistieken blijven onbekend; geen verzonnen vorm of score.

Menu/Twelve: behoud productselectie, categorieën/groepering, prijzen, logo's, oriëntatie en paging, inclusief bestaande uitgebreidere product- en menufuncties.

YouTube: de nieuwe Sites-themakeuze betreft de fallbackkaart. Behoud de echte officiële IFrame-/metadata-integratie en lokale fallback van het platform; presenteer de Sites-fallback niet als een nieuwe videoplayer. Sites biedt ook YouTube-playlists aan, terwijl het onderzochte productiecontract alleen één video ondersteunt. Volledige parity vereist versieerbare playlistconfiguratie, gecontroleerde providerresolutie en werkende playback met fallback. Tijdelijk uitschakelen is open werk, geen afgeronde oplevering.

## 6. Renderer- en opslagarchitectuur

GitHub Studio compileert versioned documenten naar media; Sites rendert React/CSS. Een bestaande SVG-template dezelfde naam geven levert niet deze layout op.

De voorkeursroute voor deze overname is daarom:

1. Extraheer de Sites-presentatiecomponenten, stijlbestanden en assets naar een gedeelde, vertrouwde renderlaag. Gegevens en authoring-UI blijven gescheiden.
2. Maak een versioned, Zod-gevalideerd productiedocument voor deze layouts en de volledige instellingenset. Voeg expliciete adapters toe vanuit Studio, Sportlink, LED Scores en Menu; gebruik server-side selectie en rechten.
3. Laat Control-preview en moderne dynamische Player-output dezelfde layoutlaag en themeversie gebruiken.
4. Voeg voor statische/gerenderde Studio-output een begrensde vertrouwde DOM-captureadapter toe aan de bestaande workerjobketen, tenzij de bestaande compiler aantoonbaar alle referentiecomposities exact kan produceren. Bewijs dat vóór een alternatieve keuze. Geen door gebruikers aangeleverde HTML, scripts of willekeurige netwerktoegang in de renderworker. Behoud leases, resource-/tijdlimieten, hashvalidatie en immutable output.
5. Bouw voor Static LG een expliciete compatibele projectie of versiegebonden gegenereerde fallback. Gebruik geen React-hookcode in de legacyruntime. Fallback alleen gebruiken waar deze de vereiste dataverversing, timing en doelpuntfunctie behoudt; een stale screenshot voldoet niet voor live scores.
6. Verzamel alle benodigde foto's, logo's en fonts in het geverifieerde release-/assetmodel. Externe provider-URL's en tijdelijke signed URLs zijn geen immutable assetidentiteit.

`themeId`, rendererversie, layout, oriëntatie, alle tekst-/beeldinstellingen en veilige marges blijven bevroren in de gepubliceerde configuratie. Nieuwe brondata gebruiken het onafhankelijke S185-datapad zonder itemtimer, volgorde of actieve release onnodig te resetten.

Werk schema's, serveracties, databasevalidatie, authoringcatalogus, templatecatalogus, worker, modern Player, Static LG, previews en cache-/assetcollectie samen bij. Alleen de selector zichtbaar maken is onvolledig.

## 7. Schermindeling, planning en publicatie

De Sites-wizard voor volledig beeld, zijvlak, onderbalk en drie vlakken is een daadwerkelijke gewenste functie. De huidige productie-venuezones en sponsorposities zijn niet automatisch hetzelfde. Definieer en implementeer een getypeerde contentzoneconfiguratie met tenantveilige playlist-/ontwerpverwijzingen, verhoudingen, oriëntatie, fallback, zone-specifieke timing en publicatiepreflight. Implementeer de gezamenlijke viewport in beide Playerpaden. Bewaar de bestaande sponsor- en planningsprioriteiten; leg conflictafhandeling expliciet vast en test deze.

De nieuwe UI gebruikt de bestaande server-side planning- en publicatiecommando's. Behoud Amsterdamse tijdzone, herhaling, planningprioriteit, groepsunie, readiness en rolbeperkingen. Controleer zomer-/wintertijd. Een wijziging van defaultcontent mag een lopende planning niet stil beëindigen.

Een geslaagde serveropslag of een online heartbeat betekent niet dat een scherm het nieuwe beeld heeft gepresenteerd. Toon gewenste configuratie, voorbereiding, verificatie en echte actieve/first-framebevestiging volgens de bestaande productiestatussen.

## 8. Niet regressief migreren

- Geen bestaande accounts, tenants, screens, planning, publicaties of mediagegevens verwijderen voor een mooiere start.
- Geen volledige vervanging van het Next.js/Supabase-monorepo door de Sites/Vinext/Cloudflare-hostingconfiguratie.
- Geen nieuwe productieclaims op basis van de referentiedemo.
- Geen bulkconversie of herschrijven van historische releases. Gebruik forward-only migraties, versioned nieuwe authoring en compatibele readers.
- Laat bestaande draftvelden die de compacte Sites-editor nog niet toont intact. Bewaar expliciete defaults en aanvullende productiefuncties.
- Native Android gebruikt de bestaande hosted Player-shell; pairing/cache/logica niet dupliceren. Voor webOS blijft de aparte legacycompatibiliteit aantoonbaar.
- Support, billing, integratiebeheer, audit, MFA, onboarding en diepere platformbeheerpagina's uit GitHub blijven bestaan en krijgen waar nodig dezelfde nieuwe visuele laag.

## 9. Acceptatie: exact én echt werkend

Acceptatie bestaat uit twee onafhankelijke bewijzen:

**Visueel:** vergelijk referentie en nieuwe UI in dezelfde browser, viewport, taal, zoom, fixturedata, fontready-status en motionstand. Controleer alle routes, open dialogen, wizardstappen en templates. Gebruik `inventory/VISUAL-CASES.csv` en `docs/ACCEPTATIE-EN-QA.md`. Font, componentpositie, crop, layout, knopvolgorde en informatiehiërarchie mogen niet afwijken. Pixelverschiltolerantie geldt uitsluitend voor beperkte rasterisatie; geen globale snapshot-update om een afwijkend ontwerp te accepteren.

**Functioneel:** met echte stagingopslag en rollen uploaden → verwerken → toevoegen → volgorde/duur/thema aanpassen → opslaan → herladen op tweede sessie → publiceren → gereed downloaden/verifiëren → werkelijk tonen. Herhaal voor beide schermstanden, alle templatefamilies, gewijzigde live data, offline en reconnect. Test lange teamnamen, dubbele cijfers, veel rijen, ontbrekende logo's en lege gegevens.

Tests uit de doelrepository blijven de releasegates. Bekijk de exacte scripts en de deploymentworkflow vóór uitvoering. Een publicatie met nog uitgeschakelde featureflags is geen voltooide gebruikersoplevering; lees rechten, flags en opgeslagen configuratie op staging terug.

## 10. Definition of done

Alle routemappingrijen zijn afgehandeld; alle templatefamilies bestaan bewerkbaar in beide oriëntaties; relevante scripts en migraties zijn getest; bronassets zijn herleidbaar; screenshots tonen visuele parity; de echte tweede-sessiestest en Playerketen werken; alle technische/operationele beperkingen zijn afzonderlijk gemeld. Nieuwe productie-uitrol volgt de bestaande beschermde pipeline na stagingacceptatie, geen handmatige ongetraceerde serverkopie.

Dit pakket is de overdracht en de vastgelegde referentie. Het voert die productiemigratie niet zelf uit en beweert geen fysieke telefoon-/tv-acceptatie.
