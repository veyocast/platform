# VeyoCast — canon voor exacte Sites UI/UX-overname

Versie 1.0 · 11 oktober 2026 · Broncodevergelijking, geen uitgevoerde browseracceptatie.

## 1. Opdracht en bronvastlegging

De gebruiker vraagt de huidige Sites-interface, inclusief alle templates en mobiele workflows, exact in VeyoCast te gebruiken. De opdracht is een broncode-overname met productiekoppeling. Het ontwerp mag niet opnieuw worden geïnterpreteerd vanaf screenshots.

| Bron | Vastgelegde versie | Betekenis |
|---|---|---|
| Sites `veyocast-ui` | `b1cae899af19fc39908217253094c5240d7359fc` | Visuele en interactionele referentie voor de vertegenwoordigde schermen |
| GitHub `veyocast/platform` | `6fcc26f02c8050b7244e3660a93b85f02491e121` | Functionele productiearchitectuur, autorisatie, backend, Player en uitrol |

Alle paden hieronder zijn relatief aan de desbetreffende bronrepository. De meegeleverde Sites-broncode en assets vormen de uitvoerbare referentie. `UI-TOKENS.csv` bevat 1.341 brondeclaraties: custom properties, fontregistraties en de feitelijke shell-/primitive-CSS, inclusief selector en breakpoint. Het CSV is een inspectiehulpmiddel, geen vervanging voor de CSS-cascade. De exacte modulegeometrie staat in de originele CSS-modules.

## 2. Wat de vergelijking aantoont

1. **De basiskleuren alleen zijn niet het verschil.** Sites `app/tokens.css` is bytegelijk aan GitHub `tokens/veyocast-design-tokens.css`. De eerste semantische FieldFlow-variabelen van beide `fieldflow.css`-bestanden komen grotendeels overeen. Het verschil zit in de feitelijk gebruikte componenten, DOM-compositie, latere overrides, gewichten, tussenruimten en routeflows.
2. **De Sites-interface is een eigen componentlaag.** `app/prototype/shared.tsx`, `app/globals.css` en alle `app/prototype/*.module.css` bepalen samen het resultaat. Het kopiëren van uitsluitend `app/fieldflow.css`, het instellen van groen/oranje of het gebruiken van bestaande shadcn-defaults kan de gelijkenis niet leveren.
3. **GitHub heeft meerdere historische CSS-lagen.** `apps/control/app/globals.css` en `apps/control/app/fieldflow.css` bevatten basisregels en late tenant-/route-/viewportoverrides. De laatste desktopblokregels lijken al gedeeltelijk op de referentie, maar hebben andere geometrie. Nieuwe regels onder de oude stapelen veroorzaakt onvoorspelbare verschillen. Migreer gericht en verwijder aantoonbaar vervangen route-overrides.
4. **De huidige mobiele navigatie is aantoonbaar anders.** Sites heeft onderaan `Overzicht, Playlists, Studio, Schermen, Meer`; GitHub gebruikt in `control-shell.tsx` de labels `Vandaag, Schermen, Studio, Planning` plus Meer. De directe playlistingang is een expliciete verbetering die moet worden meegenomen.
5. **De Sites-playlist is een nieuw werkproces.** Het is niet dezelfde productie-editor met andere kleuren. Sites gebruikt een schermvullende mobiele editor, aparte inhoudkiezer, meervoudige selectie en vaste acties. GitHub heeft reeds echte wijzigingsbewaking, publicatiecontrole en media-/dynamische gegevens; die functionele garanties moeten achter de Sites-compositie komen.
6. **Broadcastthema's zijn een afzonderlijk ontwerpgebied.** Sites voegt `onzetrots-tv` en eerdere blauw/witte OnzeTrots LED-stijlen toe. GitHub heeft momenteel FieldFlow-only authoring en Royal Current/Navy Glass v8 als zichtbare presentatie. Een nieuwe optie in een dropdown is daarom onvoldoende; authoring-, snapshot-, renderer- en assetcontracten moeten coherent worden uitgebreid.
7. **Officiële merkbestanden hoeven niet te worden gereconstrueerd.** Alle twintig bestanden in Sites `public/brand/` zijn bytegelijk gevonden in GitHub `assets/brand/`. Ook alle vier Sites FieldFlow-foto's zijn bytegelijk aan `apps/control/public/fieldflow/photos/`. Hergebruik dezelfde bytes.

## 3. Voorrang en grenzen

De actuele expliciete gebruikersopdracht maakt deze Sites-bronversie leidend voor de **zichtbare UI/UX** in deze migratie. Leg dit als een nieuwe, versieerbare canon-delta in GitHub vast voordat componenten worden omgezet. Werk `docs/design-implementation-canon.md`, relevante `docs/redesign/`-verwijzingen en de thema-authoringdocumentatie bij zodat een volgende agent niet terugmigreert naar de oude vormgeving.

Concreet vervangen voor deze opdracht:

- oude Publisher-aanwijzingen voor een driepanelen-desktopplaylisteditor waar ze botsen met de Sites-editor;
- oude donkere grijs/oranje visuele voorschriften waar Sites petrol/groen en de nieuwe oppervlaktes gebruikt;
- shellafmetingen, navigatievolgorde, CSS-geometrie en visuele acceptatiebeelden van oudere uitvoeringen;
- de productkeuze dat uitsluitend `fieldflow` authorable mag zijn, voor zover nodig om de expliciet gevraagde extra Sites-thema's te ondersteunen. Dit vereist een gecontroleerde contractuitbreiding; verwijder geen validatie.

Blijven onverkort van toepassing:

- echte tenantcontext, server-side capabilities, MFA/AAL2 waar vereist, RLS en veilige Storage;
- immutable publicatieconfiguratie, revision guards, idempotentie, actuele brondata volgens het bestaande contract;
- bestaande Player/device-authenticatie, volledige assetverificatie, last-known-good en offlineherstel;
- locked VeyoCast-logo's en normale Player system mark linksonder op 40% opacity;
- toegankelijkheid, keyboardbediening, reduced motion, zichtbare fout- en laadstatus;
- beschermde bestaande deployketen en expliciete productiepromotie.

De opdracht geeft geen reden om de echte login, tenantselectie, operationele statussen of aanvullende bestaande mogelijkheden uit het productieplatform te verwijderen. Waar Sites geen equivalent heeft, gebruik dezelfde nieuwe componenten en visuele taal met behoud van het bestaande gedrag. De native Expo-app en Android-playerhost blijven eigen implementaties; CSS uit Sites is niet rechtstreeks native uitvoerbaar.

## 4. Exacte visuele basis

### 4.1 CSS-volgorde en namespace

Sites importeert `app/globals.css`; dat importeert eerst `tokens.css` en daarna `fieldflow.css`. De rest van `globals.css` overschrijft vervolgens onderdelen. Daarna worden componentmodules en `onzetrots-tv.css` via hun componenten gebruikt.

Gebruik een expliciete scope voor de overgenomen productlaag; voorkom dat `h1`, `button`, `img` of een algemene `.preview` broadcast-, platform-, marketing- en Playercontent tegelijk veranderen. Alle `.onzetrots-tv`-regels moeten binnen die namespace blijven. CSS-modules moeten samen met hun oorspronkelijke JSX worden overgenomen zodat classnamen/childselectors blijven kloppen. Preserveer de volgorde van late mobile-overrides binnen een module.

Wanneer hardcoded Sites-waarden naar centrale semantische tokens worden verplaatst, moet de berekende waarde gelijk blijven. Gebruik bijvoorbeeld een nieuwe productactie-token voor `#ff8127`; verander hiervoor niet het locked VeyoCast-merkpalet. Een nabijgelegen kleur of radius uit een bestaande token is geen exacte overname.

### 4.2 Kleuren en componentgeometrie

| Onderdeel | Feitelijke Sites-waarde | Bron |
|---|---|---|
| Werkruimte | `#f4f7f5` | `app/fieldflow.css` |
| Canvas/muted | `#eaf0ed` | idem |
| Paneel | `#ffffff` | idem |
| Basistekst | `#17201e` | idem |
| Secundaire tekst | `#5d6b67` | idem |
| Basisrand | `#d7e0dc` | idem |
| Petrol | `#07504a` | idem |
| Appactie oranje | `#ff8127` | `app/globals.css`, `--vx-orange` |
| Appaccent groen | `#159f74` | idem, `--vx-green` |
| Sidebar | `linear-gradient(160deg,#156760 0%,#084c47 48%,#043b36 100%)` | `.vx-sidebar` |
| Actieve sidebar | `linear-gradient(105deg,#17a879,#138961)` | `.vx-nav a.active` |
| Appbutton | radius 11px, minhoogte 42px desktop / 44px mobiel, tekst 13px/650, padding 10px 15px | `.demo-button` |
| Primaire buttontekst | `#142b23` | `.demo-button.primary` |
| Iconbutton | 42×42px, radius 12px; in mobiele dialoog 44×44px | `.demo-icon` |
| Normale dialoog | radius 22px, padding 24px, max 90dvh, breedte min(560px,100%−30px) | `.demo-modal` |
| Brede dialoog | min(1050px,100%−30px) | `.demo-modal.wide` |
| Dialoogbackdrop | `#032c2870`, blur 5px | `.demo-modal::backdrop` |
| Focus | 3px outline, `--ff-focus`, offset 3px | `app/globals.css` |

Modulegebonden subtiele verschillen zijn onderdeel van de referentie: de playlist heeft onder andere `--pe-orange:#ff811f`, inhoudkiezer `#ff8428` en bibliotheek `#ff8222`. Vereenvoudig deze niet ongemerkt naar één willekeurige oranje. Eerst exact reconstrueren; een latere harmonisatie vergt een apart, zichtbaar ontwerpbesluit.

### 4.3 Typografie

- Gebruik de bijgeleverde lokale `public/fonts/inter.woff2` en `manrope.woff2` voor visuele pariteit. Sites registreert `Inter Variable` 100–900 en `Manrope Variable` 200–800. Controleer de daadwerkelijke file-load voordat screenshots worden vergeleken.
- De effectieve Sites-body is **14px, line-height 1.5** door de late regel in `globals.css`; de 16px/1.55 uit `fieldflow.css` is hier niet de uiteindelijke waarde.
- `h1/h2/h3` krijgen Manrope, maar Sites schakelt de vaste `font-variation-settings: "wght" 680` van FieldFlow uit. Componentgewichten worden dan effectief.
- De grote shelltitel is 36px, gewicht 500, letterafstand −1.9px, line-height 1.15, kleur `#0b4541`; op ≤1500px 31px, ≤1100px 29px, mobiel 21px wit.
- Mobiele invoervelden zijn 16px en minimaal 44px; dit voorkomt ongewenst inzoomen en kleine bediening.
- Gebruik de originele Lucide-iconen en afmetingen; vervang ze niet door emoji, teksttekens of een afwijkende iconset.

### 4.4 Layout en responsive gedrag

| Gebied | Sitesgedrag | Belangrijk productieverschil |
|---|---|---|
| Desktop shell | 248px sidebar + flexibel werkgebied; ingeklapt 78px; viewport 100dvh | GitHub ingeklapt 72px en desktopgrens 1024px |
| Middelbrede shell | ≤1100px 216px sidebar; header/content 24px padding | Exact Sites-breakpoint behouden |
| Desktop header | minhoogte 143px; padding 24px 44px 23px | GitHub late override rechts 60px en andere titelvariatie |
| Inhoud | 44px zijpadding, maxbreedte 2100px; ≤1500px 28px | Niet terugbrengen tot oude 1440px-contenttoken |
| Mobiel | ≤767px eigen shell; donkerpetrol header, drawer min(320px,87vw) | Niet miniaturiseren van desktop |
| Mobiele ondernavigatie | 5 items, 67px + safe-area, actieve groene streep | Overzicht / Playlists / Studio / Schermen / Meer |
| Scroll | Sidebar en `.vx-main` afzonderlijk; editor heeft eigen scrollbody | Geen extra page-scroll onder een modal |
| Mobiele ruimte onderaan | 76px + safe-area | Geen overlap met acties of nav |

Belangrijke modulegrenzen: playlisteditor 999/720/359px; picker 1050/650/380px; playlistbibliotheek 1100/767/359px; algemene Studio 1350/1100/700px; Sportlink 1100/800/480px; LED 1100/650/420px; Menu/commerce 1200/960/620px. Neem de originele regels mee. Er bestaat geen universeel 768px-grid dat deze composities exact vervangt.

Bij 100dvh, safe-area en virtueel toetsenbord blijven kop en primaire acties bereikbaar. Controleer bovendien een telefoon in landscape met hoogte ≤500px; de playlist en picker hebben hiervoor aparte compacte regels.

## 5. Component- en routemigratie

| Sites-uitvoering | Productie-aanknopingspunt | Verplichte aanpak |
|---|---|---|
| `app/prototype/app.tsx` + `app/globals.css` | `apps/control/app/(shell)/_components/control-shell.tsx`, Control CSS | Neem DOM-hiërarchie/uitstraling/navigatie over; behoud echte Next-routes, sessie, capabilityfilter en tenantcontext |
| `shared.tsx` Button/Badge/Field/Modal/Empty | `packages/ui/src/components/`, `packages/ui/src/styles.css` | Maak gedeelde semantische varianten met exacte Sites-styling; behoud Radix-focusmanagement/ARIA en echte disabled/loadingstates |
| `overview.tsx` + module | `dashboard/page.tsx`, `publisher-overview.module.css` | Zelfde zones, beelden, kaarten en acties; waarden uit productiegegevens |
| `screens.tsx` + module | `dashboard/screens/**`, screen groups | Zelfde grid/details/pairingjourney; echte telemetry en devicecommands behouden |
| `planning.tsx` + module | bestaande scheduling/planningroutes | Visuele tijdlijn, filters, modals behouden; echte conflict-/prioriteitsregels blijven leidend |
| `content.tsx` + `playlist-library.tsx` + module | `dashboard/playlists/page.tsx`, `playlist-library-workspace.tsx` | Sites cards en mobiele compacte rijen gebruiken; echte status, filters, serverpaginatie en delete-impact behouden |
| `playlist-editor.tsx` + module | `dashboard/playlists/_components/publisher-studio-workspace.tsx` | Sites editorflow overnemen rond revision-aware productiemutaties |
| `playlist-media-picker.tsx` + module | bestaande media library en picker in Publisher | Exacte selectie-/zoek-/uploadervaring met echte gereedheidsstatus en tenantmediabronnen |
| `studio.tsx` + module | `dashboard/studio/**`, `packages/studio/**` | Sites gallery/editor/inspector/wizards; echte versie-/autosave-/renderjobs behouden |
| `led-scores.tsx`, `sportlink.tsx`, `commerce.tsx` + modules | bestaande gelijknamige Studio's, bronnen en Menu Studio | Sites stappen en voorbeeldpanelen over echte verbindings-/configuratiecontracten |
| `settings.tsx` + module | settings/team/account/support/activity/platformroutes | Zelfde componenttaal; bestaande platformfuncties en toegangsgrenzen behouden |
| `marketing.tsx` + module | `apps/marketing/` | Overnemen als aparte publieke frontend; geen Control-auth of globale broadcast-CSS laten lekken |
| `onzetrots-tv*`, `led-slide*`, `experience*` | `packages/content-templates`, broadcastrenderers, preview/thumbnail/Player | Gedeelde presentatielaag; snapshot- en offline-assets juist binden |

Sites gebruikt `window.location.hash` en browserstate. Dat is geen nieuwe productierouter en ook geen nieuwe authlaag. Preserveer deep links en bestaande Next.js-serverroutes; maak de zichtbare compositie gelijk. Prototypefooter, vaste persoonsnamen, fake statistieken, demo-integratiestatus en demo-toasts worden vervangen door de echte status of verdwijnen waar uitsluitend uitleg over de demo stond.

## 6. Mobiele playlist: bindende interacties

Bronnen: `playlist-library.tsx`, `playlist-editor.tsx`, `playlist-media-picker.tsx` en hun modules.

1. Playlists staan direct in de onderste navigatie. De lijst heeft zoeken, filters, compacte herkenbare thumbnails en een direct bereikbare inhoudactie.
2. Op ≤720px opent de editor als één schermvullende taak (`100vw × 100dvh`, geen buitenmarge/radius). Desktop heeft een begrensd venster van maximaal 1200px × 900px, met lijst en preview naast elkaar.
3. Inhoud, voorbeeld en details blijven afzonderlijk bereikbaar. Op mobiel verdwijnt de desktop-previewkolom; de preview heeft een eigen scherm/tab.
4. De inhoudkiezer zit binnen de editorflow. Behoud broncategorieën, zoekopdracht, map/filter/favoriet, upload, geselecteerde volgorde, selectieteller, verwijdering uit selectie en één vaste toevoegknop. Mobiel twee kolommen; geen lange desktoplijst in een klein modaalvak.
5. Pas toe ná expliciete toevoegactie. Selectie over tabs/filters heen blijft behouden. Opnieuw klikken mag niet onbedoeld dubbele items maken; eventuele duplicatie moet bewust zijn.
6. Iteminstellingen zijn inline uitklapbaar; duur is snel instelbaar met presets. Behoud verplaatsen met pijlen als toegankelijke/touchbediening, meervoudige selectie, bulkduur, verwijderen met herstel en per-item/thema-bulkkeuze.
7. Onderste acties en save-status blijven zichtbaar. `Opgeslagen` verschijnt pas na bevestigde productiemutatie. `Gepubliceerd` alleen na echte publicatiebevestiging; een offline of falende aanvraag mag geen succes nabootsen.
8. Terug, Escape, Android-back en sluiten volgen de huidige flow; niet-opgeslagen werk vraagt een heldere keuze. Sluit de inhoudkiezer eerst, daarna de editor. Behoud focusherstel en voorkom dubbele browserhistorie.
9. De visuele doelselectie bij publiceren wordt gecombineerd met de bestaande productiepreflight, capabilities, ready-assets, variant-/schermcompatibiliteit en immutable releasebevestiging. Die controles mogen niet verdwijnen om hetzelfde aantal demoklikken te krijgen.

Koppel uploads aan de bestaande TUS-/Storage-/workerflow, inclusief voortgang, retry, quarantaine en alleen `ready` assets toevoegen. Het Sites `media-assets.tsx`-IndexedDB-model en de `veyocast-demo-*` keys zijn uitsluitend prototypemechaniek.

## 7. Templates en alle Studio's

### 7.1 Ongewijzigd over te nemen visuele bronnen

- Algemene Studio: `studio.tsx`, `studio.module.css`, inclusief bestaande categorieën, filmlijst, canvas, layoutkeuze, foto-/typografie-/logo-/huisstijl-/animatiecontrols, galerij, undo/redo en mobiele paneelwissel.
- Gedeelde dynamische preview: `experience.tsx`, `experience.module.css`.
- Eerdere OnzeTrots LED-stijl: `led-slide.tsx`, `led-slide.module.css`, `led-sizing-controls.tsx/.module.css`, `led-fullscreen.tsx/.module.css`.
- Extra OnzeTrots TV: `screen-themes.ts`, `screen-theme-picker.tsx/.module.css`, `onzetrots-tv.tsx`, `onzetrots-tv.css`, `onzetrots-tv-adapter.ts`, `onzetrots-tv-templates.ts`, `onzetrots-tv-editor.tsx`.

Een themawissel behoudt inhoud, bronbinding, selectie, tijdsduur en targets. Het mag geen bewerkte slide terugzetten naar voorbeeldrijen. Bestaande snapshots zonder `themeId` blijven hun eerdere renderer gebruiken. Pas toe op één slide, een selectie of het gehele ontwerp/de playlist met expliciete actie en ongedaan-mogelijkheid.

### 7.2 OnzeTrots TV-geometrie en fonts

Acht startcomposities: wedstrijddag, programma, uitslagen, stand, kantine, clubnieuws, partners en welkom; daarnaast uitbreidingen voor stand/goal/lineup/generic. Landscape is een logisch canvas 1920×1080, portrait 1080×1920. De renderer schaalt proportioneel; portrait is een eigen compositie.

- Basisblauw `#03438a`, donker `#052a55`, papier `#fbfaf6`, lichtblauw `#b8d7f2`.
- Landscape broadcastheader: links/rechts 72px, top 40px, hoogte 92px. Inhoud: top 168px, onder 122px. Footer: onder 32px, hoogte 64px.
- Portrait broadcastheader: links/rechts 64px, top 56px, hoogte 134px. Inhoud: top 230px, onder 160px. Footer: onder 37px, hoogte 94px.
- Clubmuur-default gebruikt exact `clubmuur-wall.webp`; multiplylaag op opacity .3. Geen vervangende blauw/witte stocktexture.
- De woordmarkering gebruikt exact `clubmuur-lettering.webp` als mask. Een brush-fonttekst “OnzeTrots” is geen identieke vervanger.
- `club-font-0..3.ttf`: Barlow Condensed 600/700/800/900, geregistreerd als `OnzeTrots TV Display`.
- `club-font-4..8.ttf`: Manrope 400/500/600/700/800, geregistreerd als `OnzeTrots TV Body`.
- `club-font-9.ttf`: Permanent Marker 400, geregistreerd als `OnzeTrots TV Brush`.
- Eerdere LED-variant gebruikt `public/fonts/onzetrots-brush.ttf` (Permanent Marker) en `onzetrots-display.ttf` (Barlow Condensed Black), plus `type-distress.svg`. Preserveer brush/grunge-maskers, leesbaarheidslagen en schaalcontrols; geen imitatie met gewone bold/italic.

Neem de **hele** uiteindelijke CSS mee: na de oorspronkelijke composities volgen verbeteringen voor dichtheid, paginering, achtergrond, schaal, lange tekst en bewerkbare content. Alleen het oude overdrachtspakket importeren mist die latere wijzigingen.

### 7.3 Beelden en presentatiewaarheid

Behoud bytes en openbare relatieve paden, of herschrijf verwijzingen systematisch met checksumcontrole:

- `public/brand/**` (locked VeyoCast-set);
- `public/fieldflow/photos/**` (vier oorspronkelijke referentiefoto's);
- `public/onzetrots/**` (Duindorp-logo, premium landmarks, originals, brush overlays en provenance);
- `public/onzetrots-tv/assets/**` (Clubmuur, woordmerk, spelersuitsneden, sponsors, logo, distress);
- `public/fonts/**` en `public/onzetrots-tv/fonts/**` plus aanwezige licentie-/provenancedocumenten.

De exacte herkenningspunten — lichttoren, kerk, luchtfoto, historische boog, clubhuis — zijn reeds uitgewerkt in de bestaande assetset. Niet opnieuw genereren of vervangen. Bewaar fotobijschriften/provenance en aanwezige attributie. Vermijd cropwijzigingen die een herkenningspunt wegsnijden. Gebruik bij logo's `contain`; behoud de aangeleverde verhoudingen.

Uploads moeten echte tenantassets worden; een `asset://`/object-URL/IndexedDB-key is geen transporteerbare Playerasset. Neem fonts, masks, achtergronden, logos en spelersfoto's expliciet mee in de nieuwe release-/templateassetverzameling. Test dezelfde pixels bij editorpreview, thumbnail, uitgevoerde Studio-render en Player, inclusief Static LG indien de bestaande feature daar ondersteund is. De Studio-documentrenderer mag niet ongecontroleerd in Player worden geïmporteerd: behoud de bestaande packagegrenzen en export-/snapshotroute.

## 8. Dialoog, motion en toegankelijkheid

Neem de originele afmetingen en scrollverdeling over, maar behoud of verbeter de semantiek van de productieprimitives. Visuele pariteit vereist niet dat de losse Sites `Modal`-helper de bestaande Radix Dialog vervangt.

- Toetsenbordfocus blijft binnen open dialoog en keert terug naar de trigger.
- Elke iconactie heeft een naam; statussen hebben tekst naast kleur.
- Alle mobiele primaire doelen minimaal 44px; grotere Sites-targets blijven groter.
- Invoervelden houden afstand van scrollbar, `min-width:0` en viewportgrenzen.
- Geen content achter mobiele navigatie, vaste footer of beeldschermuitsparing.
- Functionele hover/overgang volgt bron: buttons 150ms, drawer 220ms, toast 200ms; `prefers-reduced-motion` schakelt niet-essentiële beweging uit.
- De bron heeft geen volledig visueel goedgekeurde darkmode-uitwerking voor alle hardcoded modules. De lichte Sites-weergave is de exacte baseline. Behoud bestaande systeem-/dark-/high-contrastvoorkeuren waar functioneel nodig, maar claim pariteit pas na aparte controle; laat oude dark-overrides de baseline niet ongemerkt beïnvloeden.

## 9. Visuele acceptatie — verplicht door uitvoerende Codex

Voor deze overdracht is broncode geïnspecteerd; er zijn geen nieuwe browsercaptures of fysieke toesteltests uitgevoerd. Bestaande broncommentaren of eerdere testverslagen zijn geen nieuw bewijs voor de integratie.

Maak in een geschikte ontwikkelomgeving referentiebeelden van de meegeleverde Sites-bronversie en vergelijk de geïmplementeerde productieroutes bij identieke fixturedata, fonts, viewport, device scale, animatiestatus en tijd. Gebruik deze matrix:

| Controle | Minimale set |
|---|---|
| Controlbreedtes | 360×800, 390×844, 430×932, 768×1024, 1024×768, 1440×900, 1920×1080 |
| Telefonen landscape | 844×390; virtueel toetsenbord en browserchrome gecontroleerd |
| Routecategorieën | Overzicht; playlistlijst/editor/picker/details/publiceren; media/upload; Studio gallery/editor; drie dynamische Studio's; bronnen; schermen/detail/pairing; planning; instellingen/team/account/support; platform; marketing |
| States | Default, selected, filtered, empty, loading, validation error, network error, permission denied, dirty, saved, publishing, confirmed |
| Broadcast | Iedere template en relevant LED-moment op 1920×1080 én 1080×1920; gewone en grootste ondersteunde schaal; korte/lange namen; ontbrekend logo; meer rijen dan één pagina |
| Regressie | Bestaand ontwerp zonder thema; oude immutable release; themawissel en opslaan/herladen; screenpreview; echte publicatie en offline playback |

Controleer side-by-side en met overlaydiff. Onderzoek alle duidelijke geometrische of tekstafbrekingsverschillen. Leg bewuste verschillen uitsluitend vast als echte data-/rechten-/toegankelijkheidscorrectie. Gebruik geen permissieve pixeldifftolerantie om een andere compositie alsnog goed te keuren.

Een PR is visueel niet gereed als alleen de eerste pagina is overgezet, de primaire desktoproute klopt maar de mobiele picker afwijkt, templates door screenshotafbeeldingen zijn vervangen, een font niet lokaal laadt of de grote preview andere compositie gebruikt dan daadwerkelijke Playeroutput. Combineer dit bewijs met de verplichte bestaande type-, unit-, a11y-, e2e-, RLS- en Playergates voor de geraakte code.
