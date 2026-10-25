# S291 — onderzoek en bewijs

Baseline, GitHub main en werkelijk gedeployde Control zijn op 24 oktober 2026
`f5f3535375f067a9c9a28b2c0021c5be08ea7994`. De oorspronkelijke lokale main
was verouderd en is niet gebruikt als implementatiebasis. De bijlagen zijn
niet als bestanden beschikbaar; de opgegeven beschrijving is gebruikt.
Een reproductiefixture is geen bewijs van dezelfde live selectie of tv-scan.

## Integratiekaart vóór wijziging

| Ingang | Opslag/authoring | Projectie en compositie | Uitvoer |
|---|---|---|---|
| Content → Nieuw ontwerp | `SyncCreateWizard`, Studio-document of gekoppelde `syncConfiguration` | `projectSyncDynamicSnapshot` → `SyncSlideStaticView` → `SyncOnzeTrotsView` | Worker `sync-dom-capture`/`sync-dynamic-render`, PNG/MP4 |
| Algemene Studio, handmatig | `syncPresentation`, renderer `sync-onzetrots-v9`, v9-headerfamiliemaps | dezelfde `SyncSlideStaticView`/`SyncOnzeTrotsView` | opgeslagen document → capture → playlist → `SyncStudioMedia` |
| Sportlink Studio en gekoppelde editor | dezelfde seed plus tenantgebonden team-/pouleconfiguratie | read-only `preview_dynamic_slide_v1` → canonieke snapshot → dezelfde projector | snapshot/assets → Worker en dezelfde Player |
| RSS Studio / feed → Nieuwsslide | dezelfde wizard, `newsSelection` en seed | news-snapshot → `DynamicTemplateView` → OnzeTrots-projector → `Feature` | dezelfde capture/export/Player |
| Twelve/Menu Studio | Sites-configuratie, widgets, `onzeTrotsStyle=v9-marker-*` | `SitesMenuWidgets` → `SitesApprovedMenu` → dezelfde `SyncOnzeTrotsView`; widget-CSS heeft eigen kopfont | Sites-capture en Sites-Player gebruiken dezelfde compositie |
| Historische ingangen | `sync-v1`, `sync-onzetrots-v1`, ongetagde v9, oudere Sites/FieldFlow | eigen vastgelegde compatibiliteitsrenderer | historische binaire fallback blijft behouden |

De actuele catalogus bevat 36 families: fixtures, results, period-standings,
cancellations, dressing-rooms, officials, team-info, activities, training,
volunteers, visitors, matchday, club-program, team-program, pool-program,
club-results, team-results, pool-results, standings, team-arrivals, welcome,
referees, changing-rooms, next-match, birthdays, lineup, scoreboard, goal,
menu, engage, rss, sponsors, agenda, club-story, youtube en free.
Cataloguskaarten en wizardvoorbeelden komen uit `sync-template-preview`;
handmatige starters uit `packages/studio/src/sync.ts`. Twelve-widgets verschillen
in bediening en prijsdata, en gebruiken sinds S290 hetzelfde buitenframe.

## Vastgestelde onderzoekspunten

- Actieve RSS `Feature` bevat een CTA én een QR zonder eigen maatcontext;
  de brede `svg{width:18px;height:18px}` geldt ook voor deze QR.
- Feature-copy centreert een onbegrensde kop/samenvatting in een kleiner
  flexvlak met vaste padding/gaps en overige inhoud. Lange inhoud moet worden
  gemeten in het uiteindelijke canvas, inclusief settled/reduced motion.
- De rich news-projector neemt artikelbeelden over, maar laat het al aanwezige
  `view.providerLogoUrl` vallen. Er is geen leverancierfooter in `Feature`.
- De RSS-worker verwerkte hoogstens twaalf foto's, terwijl de actuele wizard
  twintig artikelen kan kiezen en historische ontwerpen tot vijftig bevatten.
- Sync Sportlink-controls/compiler laten het bestaande `matchLocation` weg;
  de oudere bulkflow heeft dit veld al. De rijke welkomselectie heeft geen
  configureerbare bovengrens en neemt de eerstvolgende vier thuiswedstrijden.

Voorbeelden vóór wijziging: `/tmp/s291-before`, vijf families × twee
oriëntaties × twee modi, werkelijke Worker-PNG's met geladen lokale fonts.
T3-preview is onbeschikbaar wegens AppArmor; de repo-eigen Playwright- en
Worker-browserworkflow wordt gebruikt.

## Vastgestelde oorzaak en oplossing

| Melding | Oorzaak / bewijs | Implementatie en controle |
|---|---|---|
| Verkeerd titel-/headerfont | `fc-scan` identificeert zowel `onzetrots-display.ttf` als het al geregistreerde `club-font-3.ttf` als **Barlow Condensed Black**, PostScript `BarlowCondensed-Black`, gewicht 900. De oorspronkelijke lokale Menu-slogan tekent daadwerkelijk glyphs uit deze displaybron (CDP); de historische S290-markereditie is een aparte stijl. De bijlage zelf ontbreekt. | Eén huidige titelrol `--ot-title-font`, beperkt tot expliciete revisie; CDP `CSS.getPlatformFontsForNode` bevestigt het werkelijk getekende custom font voor 144 familie-/oriëntatie-/modusheaders én RSS-artikelkoppen. Geen nieuw netwerkfont of gereconstrueerd woordmerk. |
| RSS-kop afgedekt | De oude `Feature` centreert kop, onbegrensde body, CTA en QR in een kleiner flexvlak. Het gezamenlijke blok loopt boven de beschikbare ruimte uit. | Eigen rustige RSS-inhoud binnen hetzelfde frame; kop krijgt voorrang, samenvatting wordt na fontload begrensd met zichtbare ellipsis. Afzonderlijke staande compositie. Browser meet alle titelglyphs binnen het inhoudsvlak, inclusief 400 tekens en lange woorden. De onbekende kopregel uit de foto is niet verzonnen. |
| QR onzichtbaar | De werkelijk gebruikte brede SVG-regel zet ook de RSS-QR op 18×18; RSS zit buiten `.engage-qr`. | Semantische `ot-icon` en `ot-qr`, echte gereserveerde QR-zone, witte vrije rand van vier modules. Native modulemaat hangt van dichtheid af; volledige browser- en Worker-PNG's zijn met onafhankelijke ZXing gedecodeerd. Ook circa 2.048 tekens, geen URL en artikelwisseling vallen onder de regressie. Geen CTA teruggebracht. |
| Leverancierlogo ontbreekt | Snapshot en assetketen hadden het logo, maar de rijke projector liet `view.providerLogoUrl` vallen; footer kende alleen OnzeTrots. | Echt providerasset naar `rich.news[].providerLogo`; leverancier rechtsonder, artwork direct links, clublogo rechtsboven. Feedbeheer kan een eigen gereed media-asset kiezen; tenant/rechten/assetcontrole in RPC. AD-logo daadwerkelijk veilig opgehaald uit channel/image. Omroep West had bij onderzoek geen opgeslagen logo: bronnaam tot correcte configuratie. |
| Artikelfoto ontbreekt | Live AD/Omroep West-artikelen hadden al hero-assets. Daarnaast stopte media-acquisitie na twaalf items terwijl authoring twintig en historische snapshots vijftig toelaten. Geen bewijs dat iedere gefotografeerde ontbrekende foto dezelfde oorzaak had. | Tot vijftig begrensde items; gedeclareerde Media RSS-aliases, image-enclosure, HTML/CDATA/Atom/relatieve URLs; maximaal zes gerangschikte kandidaten via bestaande veilige fetch/decode. Werkelijke artikelfoto krijgt voorrang op clubfoto. Defecte optionele media laten tekst geldig. Veilige echte AD-feed → normalisatie → verwerving → projector → Worker in beide oriëntaties bewezen. |
| Thuis/uit ontbreekt | De canonieke instelling `teamSelection.matchLocation` bestond al, maar Sync-bediening en compiler voerden haar niet mee. | Alle drie keuzes in wizard/editor/review/journal/command; filtering in de database vóór limiet/paginering. Eigen officiële team-ID's; neutraal veld verandert de rol niet. Interne clubwedstrijd één record in beide, relevant voor elke toepasselijke richting. Geen namenmatching. Stand wordt niet op thuis/uit gefilterd. |
| Matchday-bronfout Duindorp | Productielog van 24 oktober 14:10 UTC bevat de echte fout `Select a published team competition, pool and season for this OnzeTrots design`. Het actuele automatische teamcontextonderzoek vond officiële league-/cup-poules, maar matches bevatten een synthetische pool-context-hash. `match_details` kon bij upsert de officiële poule uit de normale matchsynchronisatie vervangen. Daarnaast waren seizoenen nullable en standen `unknown`, terwijl de rijke builder een niet-null seizoen eiste. | Match-details gebruikt nu dezelfde officiële catalogusverrijking. Scoped resolver herleidt bestaande hashes uitsluitend via exacte tenant/bron/eigen-team/competitie/phase/seizoen en de oorspronkelijke SHA-256, met unieke officiële poule. Nullable seizoen blijft nullable. Nieuwe matchday-builder maakt Uitslagen + volledige Stand + Programma uit één toegestane context. Oude functies/publicaties worden niet herschreven. Reproductie en daadwerkelijke geautoriseerde preview-RPC in geïsoleerde DB slagen. De specifieke productie-wizardcontrole volgt pas na normale uitrol; de bestaande productiedata zijn niet handmatig veranderd. |
| Welkom dagen vooruit / lege slide | De rijke selectie koos de volgende vier thuiswedstrijden zonder instelbare bovengrens. | Nieuwe ontwerpen zeven dagen, wizard 1–42; bestaande afwezige instelling behoudt de oude selectie. Bestaand `arrival.minutesBefore` bewaart de keuze, filtert vóór vier-recordlimiet; huidige lege welkompresentatie wordt in Playerselectie overgeslagen, ook met lokale offlinegegevens. |

## Huidige versies en compatibiliteit

De renderer/source-identiteit blijft `sync-onzetrots-v9` /
`5ba52a657d6d16ad103ba2fb43b8db18aa83715a`, met expliciete **optionele**
`authoring.visualRevision=onzetrots-20261024`. Zonder tag blijven historische
Rubik/Marker-cascades actief. Nieuwe starters/defaults/catalogusvoorbeelden
krijgen de tag; bewust bewerkte v9-concepten krijgen haar in de gewone
opslagflow. Openen publiceert niets. Lege/eigen headerfamiliemaps blijven
behouden. Menu gebruikt `v10-barlow-light|dark`; bestaande prijzen, producten,
bronbinding en documentrevisie blijven behouden bij expliciete voorbereiding.

| Actuele ingang | Opgeslagen contract | Gedeelde uitvoer |
|---|---|---|
| Content / algemene Studio / handmatige ontwerpen | getagde v9 `syncPresentation` | `SyncSlideStaticView` → `SyncOnzeTrotsView` → bron-CSS + fit/motionadapter |
| Sportlink / RSS wizard en gekoppelde editor | dezelfde getagde seed in `syncConfiguration` plus bestaande broninstellingen | canonieke DB-snapshot → `projectSyncDynamicSnapshot` → exact dezelfde compositie |
| Twelve/Menu Studio | Sites-v17 met `v10-barlow-*` | `SitesApprovedMenu` → dezelfde v9-compositie en huidige titelrol; bestaande prijswidgets |
| Worker / PNG / MP4 | dezelfde geparste presentatie + assetchecksums + vaste klok | `sync-dom-capture` met dezelfde fit- en motionfuncties |
| Webplayer / Android-WebView | huidige capability plus dezelfde presentatie; offline geverifieerde assets | dezelfde component; client zonder nieuwe capability krijgt complete binaire fallback |

Forwardmigratie: `20261024173000_onzetrots_consistency.sql`; historische
migraties zijn intact. JSON-schema's worden uit dezelfde Zod-contracten
gegenereerd. De bestaande CSS-generator neemt nu de beheerbare bron
`sync-onzetrots-current.css` mee. Het fontbestand, copyrightvermelding, manifest en cache waren
al lokaal aanwezig; fontbytes en assetidentiteiten zijn onveranderd. De volledige
Barlow Condensed SIL OFL staat nu ook lokaal bij beide apps als
`public/fonts/BarlowCondensed-OFL.txt` (officiële Google Fonts-bron).
De nieuwe capability `X-VeyoCast-Sync-OnzeTrots-Current` scheidt manifest-ETags
en beschermt oudere strikte DOM-contracten tegen het nieuwe authoringveld.

`Bron controleren` blijft uitsluitend de geautoriseerde opgeslagen gegevens
lezen. RPC-fout, ongeldige envelop, ontbrekende assets, payload en projector
hebben afzonderlijke fases/codes en een correlatie-ID. Geen providerrefresh,
mutatie of gevoelige payload in de diagnostiek. De test doorloopt alle fases,
een verbindings-exceptie en daarna succesvol herstel. SQL vergelijkt aantallen
ontwerpen/revisies/snapshots/syncs/playlists/schermen vóór en na de controle.

## Beeldbewijs en reproduceerbaarheid

- [RSS vóór/na liggend](implementation/s291-onzetrots-consistency/before-after-rss-landscape.png), [staand](implementation/s291-onzetrots-consistency/before-after-rss-portrait.png).
- [Programma vóór/na](implementation/s291-onzetrots-consistency/before-after-fixtures-landscape.png), [uitslagen](implementation/s291-onzetrots-consistency/before-after-results-landscape.png), [matchday](implementation/s291-onzetrots-consistency/before-after-matchday-landscape.png).
- De overeenkomstige staande paren staan naast deze bestanden. Twelve heeft daarnaast [eigen native vóór/na-widgetbeelden liggend](implementation/s291-onzetrots-consistency/before-after-twelve-landscape.png) en [staand](implementation/s291-onzetrots-consistency/before-after-twelve-portrait.png), met dezelfde opgeslagen prijzen/producten en expliciete historische/huidige stijl.
- [Werkelijke AD-feed liggend](implementation/s291-onzetrots-consistency/rss-live-ad-landscape.png), [staand](implementation/s291-onzetrots-consistency/rss-live-ad-portrait.png): echte artikelfoto, channel-logo en artikelbestemming. Dit is read-only feed-/renderbewijs, geen productiecontentpublicatie.
- [36 families liggend licht](implementation/s291-onzetrots-consistency/gallery-landscape-light.png), [liggend donker](implementation/s291-onzetrots-consistency/gallery-landscape-dark.png), [staand licht](implementation/s291-onzetrots-consistency/gallery-portrait-light.png), [staand donker](implementation/s291-onzetrots-consistency/gallery-portrait-dark.png).
- [Matrix met 144 native framehashes](implementation/s291-onzetrots-consistency/matrix.json). Volledige native bestanden en ruwe testlogs: eigen ontwikkelartefacten `/home/codex/.local/state/veyocast-s291`.

De helpers `s291-onzetrots-capture.mts`, `s291-live-rss.mts`,
`s291-worker-frame.mts`, `s291-decode-qr.mts` en `s291-menu-capture.mts` gebruiken
het echte capture-/projectorpad. Er is geen tweede productrenderer.
Browser en Worker gebruiken voor de hele rastervergelijking hetzelfde volle
Chromiumbestand; de driverpakketten zijn 1.61.1 en vastgepinde 1.54.2. De bestaande
grens van 2% gemiddelde kanaalafwijking blijft behouden. Titelgeometrie, echte
fontglyphs, paginanummer en QR-bestemming worden apart strikt gecontroleerd.

## Uitgevoerde verificatie en grenzen

- Eigen Supabase-reset met alle forwardmigraties en seed geslaagd.
- Volledige RLS-suite: **142 bestanden / 4.737 assertions geslaagd**, inclusief 70 S291-bron-/rechten-/leveranciercontroles.
- Workspace lint/typecheck/unit: elk 30 taken geslaagd; volledige build 18/18. Latere gerichte wijzigingen worden vóór de PR opnieuw gecontroleerd en de normale CI bouwt de exacte commit.
- Contracts: 201 tests geslaagd, inclusief huidige lege-welkomselectie met stabiele identiteit en drie-blokkenassetcollectie.
- Werkelijke detailworker: 116 tests geslaagd; RSS-integraties 227 tests; twintig-image-/alternatieve-candidaatfixture geslaagd.
- Wizard/header/reload/receipt-regressies: 33 van de eerste 35 geslaagd; twee welkomfixtures misten ten onrechte de actuele authoringcapability en zijn hersteld, daarna 2/2 geslaagd. Alle negen thuis-/uitcombinaties worden naar de echte commandovorm gestuurd.
- Alle 144 headerfontcombinaties + vier Menu-widgetcomposities + ongetagde historische Rubik + werkelijk getekende oorspronkelijke slogan: 10 browsercases geslaagd.
- Huidige RSS: 20 browsercases geslaagd: volledige kop, woordbreuk, maximumtitel, geen summary/URL, dichte/maximale URL, volledige Worker-PNG en echte artikelwisseling met overeenkomstige bron/QR. Eerdere harnasproblemen zijn bewaard; de volledige uiteindelijke suite is groen.
- Bestaande v9-Player: 35/36 in de eerste ronde; één card-readinessdeadline onder hostdruk, afzonderlijke herhaling 1/1 geslaagd. Intro, pauze, reduced motion, echte Worker/Player-entreepixels en verjaardagsrollen zijn uitgevoerd.
- Relevante echte Control-routes voor dynamische inhoud, Bronnen en Studio: 3/3 toegankelijkheids-/bedieningschecks geslaagd. Negen volledige offlineplayerchecks geslaagd.
- Werkelijke canonieke RSS-export met veilige assetverwerving, Chromium, FFmpeg en ffprobe: 1920×1080, 5 seconden / 150 frames. QR uit het uiteindelijke MP4-frame op 4 seconden decodeert naar de echte artikelbestemming. Op 2 seconden loopt de behouden intro nog; daar is bewust nog geen QR zichtbaar.
- Unit-opt-ins worden niet als uitgevoerd geteld: Control 34 overgeslagen browseropt-ins; Worker 338 overgeslagen native/originele bronopt-ins in de gewone unitrun. Afzonderlijke browser/native-uitvoering hierboven vermeld; de volledige bestaande CI blijft verplicht.
- Database-lint: geen melding op S291-functies. Bestaande pgTAP-extensie-/historische lintwaarschuwingen zijn behouden en niet als schoon geheel geclaimd.

Niet geclaimd: fysieke tv-scan, fysieke Android-hardware, 24-uursduurtest of de
exacte gefotografeerde live wizard vóór uitrol. De concrete productiefout is
met read-only logs en opgeslagen context vastgesteld; de reparatie is met de
gelijkvormige geautoriseerde fixture/RPC uitgevoerd. Een ontbrekend werkelijk
leverancierlogo vereist correcte media/configuratie door beheer. De oorspronkelijke
bijlagen en de onbekende bovenste titelregel zijn niet beschikbaar.

De eerste brede lokale browserruns gebruikten verkeerd een productie-Control
zonder demo-auth, en latere devruns raakten de gedeelde hostlimieten (128
inotify-instanties, geheugen/swap). Deze mislukkingen staan in de ruwe logs;
geen ervan is omgelabeld tot PASS. Gerichte suites gebruiken de bestaande
demo-/fixtureflow en begrensde resources. Volledige integratieacceptatie en
productiepromotie blijven afhankelijk van de normale CI/staginggates.


De oude directe Sportlink-/verjaardags-/RSS-aanmaakpagina’s sturen een
actuele OnzeTrots-tenantvoorkeur nu naar dezelfde nieuwe Studio-wizard.
FieldFlow en expliciete historische catalogi behouden hun compatibiliteitsflow.
Historische bewerkers en gepubliceerde v1/v17-versies zijn geen stil opgewaardeerde
actuele ontwerpen; de nieuwe getagde revisie wordt via de normale ontwerp- en
publicatiestappen gebruikt.

De schemawijziging is additief en forward-only. Na publicatie van een nieuwe
visuele revisie moet een herstelbuild dit contract blijven begrijpen; kies
een forwardfix in de gewone pipeline. Geen productiegegevens of historische
releases terugschrijven om een oude appbuild te laten passen.


Aanvullende eindcontrole: de drie directe historische ingangen zijn als echte
serverpage aangeroepen voor zowel OnzeTrots als FieldFlow: 6/6 geslaagd, zonder
RPC/providercommando. Menu Studio herberekent de gedeelde headerfit na fontload
en behoudt donker bij een expliciete upgrade van een oud opgeslagen menu.
[MP4-framebewijs](implementation/s291-onzetrots-consistency/rss-video-frame.png)
en [exportmetadata](implementation/s291-onzetrots-consistency/rss-export.json)
staan bij de beelden.

Nieuwe expliciete thuis-/uitinstellingen voor de bestaande FieldFlow-poulefamilies worden eveneens vóór de limiet gefilterd; acht aanvullende geautoriseerde preview-/opslagcontroles dekken beide families en richtingen. Ontbrekende historische instellingen behouden hun bestaande gedrag.

De volledige lijst gewijzigde bestanden staat in [changed-files.txt](implementation/s291-onzetrots-consistency/changed-files.txt).

## Aanvullende normale CI-controles

De eerste PR-commit `6835cf6d` doorliep lint/typecheck/unit/build en Android
groen. De echte database-suite bevestigde alle 4.737 assertions. In de
aansluitende media-/publicatiebrowserflow ontbrak na herladen één geopend
metadata-venster, terwijl de server-readback van tags/collectie/favoriet al
slaagde. De volledige gefaalde database-job is op dezelfde commit herhaald
en slaagde daarna inclusief immutable publicatie, eerste-framebevestiging en
offlinecontrole. De oorspronkelijke fout is behouden, niet als PASS geboekt.

De brede Control-run had 634 PASS, 629 expliciete opt-in SKIP en één fout:
`sync-create-wizard-fixture` registreerde bij iedere remount dezelfde
`dialog.accept`-handler opnieuw. Bij `beforeunload` werd één dialoog daardoor
tweemaal afgehandeld. De fixture bewaart nu één handler per browserpagina;
geen productgedrag of geometrieassertie is aangepast. De oorspronkelijke acht
Engage-cases slagen allemaal (1,8 minuut), zonder retries of skips; de volledige
CI blijft vereist op de uiteindelijke commit.

Een aanvullende read-only productiecontrole met de echte Duindorp-bron en
team `218380` herleidde de automatische context naar poule `826233` en
`seasonId=null`. De bestaande stabiele snapshotbuilder reproduceerde daarmee
`23514: Complete matchday competition, pool and season required`. Dit was
een technische beheerdersread met een diagnostische configuratie in het
geheugen; geen opgeslagen ontwerp, gebruikersimpersonatie of providersync.
De readback na de normale uitrol wordt bij de PR/release vastgelegd.

De laatste grenscontrole met 400 brede W-letters vond nog circa 8 native pixels
afkapping in de liggende kaart. De gedeelde meting gebruikt daarvoor eerst
compactere padding/gaps; de vaste ondergrens blijft 36 native pixels. De
samenvatting levert ruimte in voordat titel of paginanummer verdwijnt. Deze
zelfde meting draait in alle previews, Worker en Player. Een eerste lokale
uitwerking bevatte een niet-serialiseerbare helper; de echte Worker-check vond
die en de adapter is weer volledig zelfstandig gemaakt. Geen fout is als PASS
geregistreerd. De aparte headless-shell en full Chromium hebben verschillende
tekst-hintingmetrics: de volledige rastervergelijking gebruikt daarom hetzelfde
volle browserbestand aan beide zijden, zonder de pixelgrens te verruimen.

Uiteindelijke lokale controle: **20/20 RSS-cases geslaagd** in full Chromium,
inclusief het complete Worker-frame met 400 brede letters en onafhankelijke
QR-decodering. De aanvullende twee headless-shell-cases bewijzen eveneens
volledige titel- én paginanummergrenzen. [Native grensframe](implementation/s291-onzetrots-consistency/rss-wide-title-frame.png).
