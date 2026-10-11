# OnzeTrots TV — ontwerpinstructies en overdracht

Dit document beschrijft de daadwerkelijk aanwezige narrowcastinguitwerking voor Duindorp SV. De broncode is het ontwerpuitgangspunt: behoud de huidige composities, kleurwaarden, lettertypen, illustraties, logo’s en verhoudingen bij het overnemen of verder ontwikkelen.

De module bevat **acht schermtypen, elk in liggend 16:9 en staand 9:16 formaat**, plus een interactieve studio en schermweergave. Het betreft een werkend ontwerpconcept met voorbeeldinhoud. Een live Sportlink-koppeling voor deze narrowcastingschermen, een kantinebeheerder, een centrale afspeellijstendatabase en extern apparaatbeheer zijn **geen bestaande functies van deze module**.

De beschrijving is gecontroleerd aan de hand van de meegeleverde componenten en stylesheets. De onderstaande QA-lijst is een controle-instructie voor overname en vervolgwijzigingen; deze lijst is geen verklaring dat alle toekomstige browsers, televisies of gewijzigde inhoud al getest zijn.

## 1. Bronbestanden en verantwoordelijkheid

De bronpaden `app/` en `components/` hieronder beschrijven de oorspronkelijke Sites-module. Die bestanden staan in deze ZIP onder `origineel-sites/`. De zelfstandige kopie staat onder `src/components/` en `src/styles/`; assets staan onder `public/`. `app/globals.css` en `app/layout.tsx` beschrijven de oorspronkelijke websitecontext en zijn niet als volledige websitebestanden meegeleverd. Voor de zelfstandige preview zijn de benodigde basisregels opgenomen in `src/styles/base.css`.

| Bestand | Verantwoordelijkheid |
| --- | --- |
| `app/narrowcasting/page.tsx` | Route `/narrowcasting`, paginametadata en import van de drie narrowcastingstylesheets. |
| `components/narrowcasting-studio.tsx` | Studio, acht schermdefinities, liggend/staand, afspeellijst, lokale voorkeuren, klok, URL-instellingen, schermmodus en gedeelde broadcastheader/footer. |
| `components/narrowcasting-sports.tsx` | Wedstrijddag, programma, uitslagen en stand; alle huidige sportgegevens staan hier als voorbeeldinhoud. |
| `components/narrowcasting-club.tsx` | Kantine, clubnieuws, partners en welkom; voorbeeldmenu, sponsorverwijzingen en clubteksten. |
| `app/narrowcasting.css` | Studio, schaalmechanisme, beide broadcastcanvassen, gedeelde header/footer, schermmodus en responsive bediening. |
| `app/narrowcasting-sports.css` | Sportcomposities, gegevenstabellen en expliciete staande varianten. |
| `app/narrowcasting-club.css` | Kantine-, nieuws-, sponsor- en welkomstcomposities met expliciete staande varianten. |
| `app/fonts.css` | Lokale lettertypebestanden en gewichten. Wordt via `app/globals.css` geladen. |
| `app/globals.css`, `app/layout.tsx` | Gedeelde basis, resets, lettertypen en overige websitecontext. |
| `public/assets/`, `public/fonts/` | Lokale afbeeldingen, logo’s, maskers en lettertypen. |

De volledige website bevat daarnaast andere pagina’s en mogelijk eigen gegevensintegraties. Daaruit volgt niet dat de narrowcastingmodule die gegevens al gebruikt. Beoordeel de drie narrowcastingcomponenten afzonderlijk.

Bij het isoleren naar een ander project: neem niet alleen de TSX over. Neem ook de relevante CSS, de lokale fontdefinities, alle daadwerkelijk gebruikte assets en de gedeelde resets mee. Controleer onder meer `box-sizing: border-box`, standaardmarges, linkstijlen, afbeeldingstijlen en de regelhoogte. De originele uitvoering draait binnen de bestaande websitebasis; een ander CSS-reset kan zichtbare verschuivingen veroorzaken.

## 2. Ontwerprichting: dezelfde OnzeTrots-identiteit

De uitzending combineert een uitgesproken blauwe clubachtergrond met witte of gebroken witte informatievlakken. Grote, compacte kapitalen bepalen de hiërarchie. Transparante spelersbeelden, het bestaande OnzeTrots-penseelwoordmerk en de subtiele muurstructuur verbinden deze module met Clubmuur.

Behoud deze uitgangspunten:

- Gebruik de bestaande clubassets en lokale lettertypen. Vervang het penseelwoordmerk niet door gewone cursieve tekst.
- Zet de hoofdboodschap groot neer. Gebruik korte ondersteunende zinnen en vaste aantallen gegevensregels.
- Houd illustratieve spelersbeelden los van tekst en cijfers. De huidige uitsneden, laagvolgorde en `object-fit: contain` horen bij de compositie.
- Behoud de donkerblauwe of lichtblauwe accenten, dunne scheidingslijnen en bescheiden kaartafrondingen. De broadcastkaarten hebben meestal 5–7 px afronding op het volledige canvas.
- Gebruik het clublogo in zijn eigen verhouding en sponsorlogo’s met vrije ruimte. Sponsorlogo’s worden niet bijgesneden of uitgerekt.
- De studio is een lichte bedieningsomgeving. De uitzending behoudt de blauwe identiteit, onafhankelijk van de algemene website-instelling voor een donker thema.

### Bestaande hoofdkleuren

Dit is een selectie van de daadwerkelijke CSS-waarden. De stylesheets bevatten daarnaast subtiele transparante varianten, randen, verlopen en secundaire tekstkleuren; behoud die bij visuele overname.

| Functie | Waarde | Gebruik |
| --- | --- | --- |
| Clubblauw | `#03438a` | Broadcastachtergrond, knoppen, sportcijfers, eigen-teamregel. |
| Donkere studiotekst | `#07274a` | `--nc-ink`. |
| Studioachtergrond | `#f3f5f7` | Omgeving buiten de uitzending. |
| Sportkaart | `#fbfaf6` | `--ns-paper`; wedstrijd-, programma-, uitslagen- en standkaart. |
| Witte kaart | `#ffffff` | Kantine, sponsorvlakken en verschillende nieuwskaarten. |
| Lichtblauw sportaccent | `#b8d7f2` | `--ns-sky`, ondersteunende accenten. |
| Lichtblauwe combikaart | `#d9ecf7` | Kantineaanbieding. |
| Sportsteunvlak | `#0b559e` | Programma- en uitslagenaccenten. |
| Donkere nieuwskaart | `#0b3266` | Positieve-supportbericht. |
| Winst | `#dcebdd` / `#2d6241` | Achtergrond / tekst vormblokje W. |
| Gelijk | `#eee8d9` / `#806522` | Achtergrond / tekst vormblokje G. |
| Verlies | `#eee1df` / `#955b53` | Achtergrond / tekst vormblokje V. |

De broadcastachtergrond bestaat uit `#03438a` met daarover een pseudo-element: `linear-gradient(125deg, #061f4899, transparent 58%)` en `clubmuur-wall.webp`, `center/cover`, `mix-blend-mode: multiply`, `opacity: .3`. Onderaan staat een 7 px witte lijn met `.75` opacity. Neem deze structuur over; gebruik geen ander willekeurig blauw of een vervangende textuur.

## 3. Lettertypen en werkelijke tekstmaten

**Barlow Condensed** is het displaylettertype voor grote koppen, teamnamen, tijden, uitslagen en veel cijferweergaven. **Manrope** is het leeslettertype voor toelichting, labels, prijsnamen en bediening. Het OnzeTrots-woordmerk is een bestaand beeldmasker. Het aanwezige lettertype Permanent Marker is niet de vervanging voor dat masker.

De lokale bestanden staan in `public/fonts/`:

| Familie | Gewichten | Bestanden |
| --- | --- | --- |
| Barlow Condensed | 600, 700, 800, 900 | `club-font-0.ttf` t/m `club-font-3.ttf`, in dezelfde volgorde. |
| Manrope | 400, 500, 600, 700, 800 | `club-font-4.ttf` t/m `club-font-8.ttf`, in dezelfde volgorde. |
| Permanent Marker | 400 | `club-font-9.ttf`; aanwezig in de website, niet het broadcastwoordmerk. |

Onderstaande maten zijn CSS-pixels **op het volledige ontwerpcanvas**, vóór verkleining in de studio. Het zijn de huidige waarden, geen algemene minimale leesbaarheidsnorm.

| Element / selector | Liggend | Staand |
| --- | --- | --- |
| Clubnaam in header `.nc-broadcast-brand strong` | 42 px | 42 px |
| Slogan onder clubnaam | 13 px | 13 px |
| Schermcategorie | 20 px | 16 px |
| Nederlandse klok | 38 px | 38 px |
| Footerclubzin | 24 px | 21 px |
| Conceptvermelding in footer | 13 px | 13 px |
| Sportkop `.ns-heading h2` | 76 px | 81 px |
| Sportkoptoelichting | 21 px | 22 px |
| Wedstrijddagcampagnetekst | 142 px | 170 px |
| Aftraptijd | 139 px | 145 px |
| Teamnamen op wedstrijdkaart | 43 px | 43 px |
| Programma: tijd | 39 px | 48 px |
| Programma: eigen team | 30 px | 34 px |
| Programma: tegenstander | 19 px | 22 px |
| Programma: veld | 23 px | 25 px |
| Uitslagen: teamnaam | 27 px | 32 px |
| Uitslagen: score in tabel | 47 px | 58 px |
| Uitslagen: grote highlightscore | 138 px | 108 px |
| Stand: teamnaam | 32 px | 33 px |
| Stand: cijfers in gewone rij | 32 px | 30 px |
| Stand: punten | 38 px | 37 px |
| Stand: legenda | 12 px | 13 px |
| Algemene clubkop `.nk-club-screen h1` | 108 px | 118 px |
| Kantinecategorie | 45 px | 47 px |
| Kantineproduct | 26 px | 27 px |
| Kantineprijs | 29 px | 29 px |
| Kantinecombiprijs | 72 px | 70 px |
| Walking Football-hoofdkop | 77 px | 96 px |
| Walking Football-toelichting | 21 px, liggende override | 27 px |
| Kleine nieuwskaartkop | 52 px, liggende override | 56 px |
| Partnerhoofdkop | 102 px | 120 px |
| Welkomsthoofdkop | 97 px | 124 px |
| Welkomsttoelichting | 25 px | 29 px |

Kleine labels en conceptregels zijn secundair. Beoordeel de kerninformatie op de echte kijkafstand van de club. Als een toekomstige variant grotere letters vereist, ontwerp dan expliciet minder inhoud per scherm; verlaag of verhoog niet blind alle maten en forceer geen regels in dezelfde kaart. Bewaar deze bronuitwerking als visueel referentiepunt.

Laad de lokale fonts vóór het beoordelen of vastleggen van de uiteindelijke screenshots. Een fallbackfont kan koppen laten afbreken en kolommen verschuiven.

## 4. Canvas, inhoudsvakken en veilige ruimte

Er zijn twee afzonderlijke composities. Het televisiescherm zelf is **geen vloeibaar webgrid**.

| Geometrie | Liggend | Staand |
| --- | --- | --- |
| Canvas | 1920 × 1080 | 1080 × 1920 |
| Verhouding | 16:9 | 9:16 |
| Hoofdinhoud links / rechts | 72 / 72 px | 64 / 64 px |
| Hoofdinhoud boven / onder | 168 / 122 px | 230 / 160 px |
| Beschikbare hoofdinhoud | 1776 × 790 px | 952 × 1530 px |
| Header links / rechts | 72 / 72 px | 64 / 64 px |
| Header boven / hoogte | 40 / 92 px | 56 / 134 px |
| Footer links / rechts | 72 / 72 px | 64 / 64 px |
| Footer onder / hoogte | 32 / 64 px | 37 / 94 px |
| Footerwoordmerk | 184 × 61 px | 192 × 64 px |

De horizontale inhoudsmarge is liggend 3,75% van de canvasbreedte en staand ongeveer 5,93%. Noem dit niet een uniforme 5%-safe-area: de code gebruikt de bovenstaande vaste maten. Achtergrond, decoratie en de onderste witte lijn mogen tot de canvasrand komen. Belangrijke informatie blijft binnen de vastgelegde inhoudsvakken.

De staande categorie staat onder de headerlijn. Controleer die categorie samen met de bovenkant van de hoofdinhoud; haal deze positionering niet weg bij het herschrijven van de header.

Gebruik op de televisie een beeldinstelling die het volledige signaal toont. Controleer de vier randen, header en footer op de daadwerkelijke installatie. Indien een scherm overscan toepast, pas eerst de beeldinstelling aan voordat het ontwerp wordt vervormd.

### Schalen in de studio en schermweergave

`ResizeObserver` meet het beschikbare `.nc-stage`-vlak. Het canvas blijft 1920 × 1080 of 1080 × 1920; een buitenste frame krijgt de geschaalde afmetingen en de binnenste laag gebruikt `transform: scale(...)` met `transform-origin: 0 0`.

De actuele schaal is:

```text
padding = schermmodus ? 0 : 44
scale = max(0.02, min(
  (beschikbareBreedte - padding) / canvasBreedte,
  (beschikbareHoogte - padding) / canvasHoogte
))
```

De 44 px wordt van iedere beschikbare totale afmeting afgetrokken, niet aan iedere zijde afzonderlijk. In de studio ontstaat zo rondom ruimte. In schermmodus wordt maximaal ingepast zonder uitrekken of afsnijden. Bij een afwijkende schermverhouding blijven zwarte balken zichtbaar.

Een 4K-scherm kan het canvas groter weergeven, maar dit maakt meegeleverde rasterafbeeldingen niet automatisch echte 4K- of 8K-bronnen. Behoud de resolutievermelding als canvasmaat; claim geen niet-aanwezige assetresoluties.

## 5. De acht uitgewerkte schermen

De onderstaande volgorde is de huidige vaste afspeellijstvolgorde. Er is selectie van onderdelen, maar geen sleepfunctie voor een eigen volgorde.

| ID | Studiotitel | Liggend | Staand |
| --- | --- | --- | --- |
| `wedstrijd` | Onze wedstrijddag | 44% campagnebeeld links, 56% gebroken witte wedstrijdkaart rechts; grote zondagkop, spelers, badges en aftraptijd. | Campagnebeeld bovenaan, wedstrijdkaart daaronder; beeldgedeelte 715 px hoog en 22 px tussenruimte. |
| `programma` | Vandaag op het veld | Vijf wedstrijdregels links en spelers-/clubvlak rechts; verhouding 1,94 : 1, tussenruimte 28 px. | Dezelfde vijf regels in een lijst van 810 px hoog; clubvlak daaronder, tussenruimte 26 px. |
| `uitslagen` | Zo speelden we | Vijf uitslagen links en een uitgelichte eerste-elftalzege rechts; verhouding 1,94 : 1, tussenruimte 28 px. | Dezelfde vijf uitslagen in een lijst van 835 px hoog; highlight daaronder, tussenruimte 27 px. |
| `stand` | De stand van zaken | Vijf teams rondom Duindorp SV 1, volledige statistiekkolommen, vorm en drie kengetallen onderaan. | Eveneens vijf teams en alle kolommen; teamnamen mogen afbreken, hogere rijen; drie kengetallen en slogan eronder. |
| `kantine` | Even naar de kantine | Drie categoriekaarten naast elkaar; vier producten per kaart; combibalk onderaan. | Drie categoriekaarten onder elkaar; producten binnen elke kaart in twee kolommen; combikaart onderaan. |
| `clubnieuws` | Dit leeft op de club | Groot Walking Football-bericht links; twee kleinere kaarten rechts boven elkaar. | Groot bericht bovenaan; twee kleinere kaarten daaronder naast elkaar. |
| `partners` | Samen maken we de club | Zes witte logotegels, drie kolommen × twee rijen; dankregel onderaan. | Dezelfde zes tegels, twee kolommen × drie rijen; aangepaste kop en dankregel. |
| `welkom` | Dit is onze trots | Groot OnzeTrots-woordmerk en kop links, spelersgroep rechts, waardenstrook onderaan. | Woordmerk en kop bovenaan, spelersgroep lager; drie waarden onder elkaar. |

### Sportdetails die behouden moeten blijven

- De huidige wedstrijd is het voorbeeld **Duindorp SV 1 – SVV Scheveningen 2**, zondag 11 oktober, 14:30, Sportpark Houtrust, veld 1. De tekst benoemt expliciet dat datum en teams ter illustratie zijn. Het is geen live of geverifieerde wedstrijdvermelding.
- Programma en uitslagen bevatten elk vijf regels. Voeg niet onbeperkt regels aan het vaste canvas toe. Voor grotere toekomstige datasets zijn aparte pagina’s of meerdere schermen nodig; die automatische paginering is nu niet geïmplementeerd.
- De stand toont de voorbeeldposities 3 t/m 7. Duindorp staat op plek 5 met 5 gespeeld, 2 gewonnen, 2 gelijk, 1 verloren, +3 doelsaldo en 8 punten. De kaart is een vaste array, geen automatisch berekend venster rond het eigen team.
- De standkolommen zijn in beide oriëntaties: **Plek | badge | Team | G | W | GL | V | +/− | PTN | Vorm**. De staande uitvoering verwijdert dus geen statistiekkolommen.
- De eigen-teamregel is blauw met witte tekst. De overige regels zijn licht. Winst/gelijk/verlies worden door zowel een letter als kleur aangeduid; de recentste vorm staat rechts.
- De liggende standrij is 80 px hoog, de eigen-teamrij 94 px. Staand zijn deze 151 en 165 px. De kop is respectievelijk 47 en 67 px hoog; de legenda 50 en 83 px.
- Tegenstanders krijgen in de huidige module een rond initialenbadge. Dit zijn geen opgehaalde officiële tegenstanderlogo’s. Het eigen clublogo is wel een afbeelding.

### Clubdetails die behouden moeten blijven

- De kantine heeft de categorieën **Koffie & thee**, **Lekker fris** en **De derde helft**, met in totaal twaalf producten. De combi is **Koffie + tosti ham-kaas — € 5,00**. Alle prijzen zijn voorbeeldprijzen.
- Liggend is het menugrid 440 px hoog met 22 px tussenruimte. Staand is het 1031 px hoog met drie rijen en 20 px tussenruimte. De combikaart is respectievelijk 153 en 260 px hoog, met 26 px ruimte erboven.
- Het nieuwsbericht gebruikt **27 oktober 2026 — Eerste training** voor Walking Football. Behoud de datum als inhoudelijk aangeleverd conceptgegeven; de pagina heeft geen nieuwsagenda die de datum automatisch actualiseert.
- Het liggende nieuwsgrid heeft een kolomverhouding van 1,92 : 1. Staand zijn de rijen 879 en 414 px hoog, met 26 px tussenruimte. De twee onderste berichten zijn de vrijwilligersoproep en positieve support langs de lijn.
- De partnermodule bevat BNU, Kwaliteit Kozijnen Holland, Proto Tegelzetbedrijf, Deelman Daktechniek, RW Repair en DG Webservices. De tegels hebben geen klikactie in de uitzending.
- Het partnergrid is liggend 464 px hoog met 20 px tussenruimte; staand 958 px hoog met 22 px tussenruimte. Behoud afzonderlijke logoklassen voor vierkante en brede logo’s.
- Het welkomscherm heeft het decoratieve jaartal **1950**, de kop **Dit is Duindorp. Dit zijn wij.** en de waarden **Respect voor elkaar**, **Positief langs de lijn** en **Samen houden we het mooi**. De waardenstrook is liggend 87 px hoog en staand 213 px.

## 6. Bestaande beeldassets

De browserpaden beginnen met `/assets/`; de bestanden zelf staan onder `public/assets/`. Onderstaande bestanden zijn rechtstreeks in de narrowcastingcomponenten of -CSS gebruikt en moeten mee verhuizen.

| Bestand onder `public/assets/` | Inhoud / toepassing | Gecontroleerde bronafmetingen |
| --- | --- | --- |
| `logo.png` | Clublogo in header, studio en sportkaarten. | 1759 × 2000 px |
| `clubmuur-wall.webp` | Achtergrondtextuur. | 1643 × 957 px |
| `clubmuur-lettering.webp` | Masker voor het OnzeTrots-woordmerk. | 2172 × 724 px, RGBA |
| `type-distress.svg` | Verweerd tekstmasker voor onder meer de wedstrijdkop en BEDANKT. | SVG |
| `clubmuur-portraits-v17/10-strijd-1280.webp` | Spelersbeeld wedstrijddag. | 1122 × 1402 px, RGBA |
| `clubmuur-portraits-v14/05-juichen-1280.webp` | Spelersbeeld programma en uitslagen. | 1280 × 853 px, RGBA |
| `clubmuur-portraits-v14/07-walking-1280.webp` | Walking Football-bericht. | 1280 × 960 px, RGBA |
| `clubmuur-players/trio-1280.webp` | Spelersgroep welkom. | 1280 × 853 px, RGBA |
| `sponsors/bnu.svg` | BNU-logo. | SVG |
| `sponsors/kwaliteit-kozijnen-holland.svg` | Kwaliteit Kozijnen Holland-logo. | SVG |
| `sponsors/proto-tegelzetbedrijf.svg` | Proto-logo. | SVG |
| `sponsors/deelman-daktechniek.svg` | Deelman-logo. | SVG |
| `sponsors/rw-repair.png` | RW Repair-logo. | 226 × 226 px, RGBA |
| `sponsors/dg-webservices.svg` | DG Webservices-logo. | SVG |

Transparante randen in spelersbeelden zijn onderdeel van het ontwerp. Behoud de bestaande alpha-kanalen. Verander deze afbeeldingen niet naar JPEG. De lage bronmaat van het RW Repair-logo is een eigenschap van het huidige bestand; noem het geen vectorlogo.

Het welcome- en footerwoordmerk wordt wit gemaakt met een CSS-masker, niet door een witte rechthoekige afbeelding te plaatsen. Behoud zowel de standaard- als `-webkit-mask`-declaratie voor de betrokken weergaven.

## 7. Bestaande bediening en gedrag

### Studio

- Standaard wordt `wedstrijd` in liggend formaat getoond. Afspelen staat uit en de standaardduur is 15 seconden.
- Alle acht schermen zijn aanvankelijk ingeschakeld. Via het vinkje kunnen schermen worden uitgesloten. Minimaal één scherm blijft ingeschakeld.
- Het selecteren van een scherm toont de compositie. Als tijdens afspelen een uitgesloten scherm wordt geselecteerd, brengt de afspeellogica de selectie terug naar de ingeschakelde lijst.
- Vorige/volgende doorloopt de ingeschakelde schermen en loopt aan de uiteinden rond.
- Schermduur heeft precies vier opties: **10, 15, 20 of 30 seconden**.
- De weergegeven teller is het vaste schermnummer binnen de acht ontwerpen, bijvoorbeeld `5 / 8`. Dit is niet automatisch de positie binnen een verkorte afspeellijst.
- De voortgangsbalk hoort bij de studio en wordt in schermmodus verborgen.
- Bij een selectie, duurwijziging of afspeelwijziging begint de voortgang opnieuw. Pauzeren en hervatten bewaren dus niet de resterende seconden van een half bekeken scherm.
- Er is geen contenteditor in deze studio. Wedstrijden, prijzen, nieuws en sponsorselectie worden momenteel in de broncode aangepast.

### Lokale voorkeuren

De sleutel `duindorp-narrowcasting-v1` in `localStorage` bewaart alleen:

```json
{
  "portrait": false,
  "seconds": 15,
  "enabled": ["wedstrijd", "programma", "uitslagen", "stand", "kantine", "clubnieuws", "partners", "welkom"]
}
```

Selectie, actuele voortgang en afspeelstatus zijn geen permanent opgeslagen voorkeuren. Deze opslag is lokaal per browser; er is geen centrale synchronisatie tussen meerdere schermen. Als lokale opslag niet beschikbaar is, blijft de module functioneren met de overige instellingen.

### Schermmodus en sneltoetsen

- **Volledig scherm** opent de presentatie en probeert de browser-fullscreen-API. Bij weigering blijft de ingepaste presentatieweergave bruikbaar. Deze knop start de afspeellijst niet vanzelf; de bestaande afspeelstatus blijft gelden.
- **Open scherm** opent een nieuw tabblad met formaat, huidige selectie, duur en gekozen lijst. Deze link zet afspelen wel aan en opent direct de schermmodus.
- **Kopieer schermlink** maakt dezelfde URL. Bij een niet-beschikbaar klembord verschijnt een melding om Open scherm en de adresbalk te gebruiken.
- In de presentatie verdwijnen de bediening en cursor na ongeveer **2,2 seconden** zonder pointeractiviteit. Pointerbeweging of -druk toont de bediening opnieuw. Toetsenbordfocus op de overlay houdt deze zichtbaar.
- Spatie schakelt afspelen/pauzeren; pijl links/rechts wisselt scherm; Escape verlaat schermmodus. De algemene toetsenafhandeling grijpt niet in als de focus op een input, select, textarea, button of link staat.
- Het verlaten van browser-fullscreen schakelt de playerweergave uit. De Terug naar studio-actie verwijdert `tv` uit de huidige URL.
- De klok gebruikt `Intl.DateTimeFormat('nl-NL', ...)` met expliciet **Europe/Amsterdam** en wordt elke 15 seconden bijgewerkt. Dit is de actuele klok van het apparaat, geen tijd afkomstig van een sportgegevensdienst.

### URL-parameters

URL-instellingen worden bij het openen gelezen en kunnen opgeslagen browservoorkeuren overschrijven.

| Parameter | Ondersteunde waarde |
| --- | --- |
| `formaat` | `staand` geeft 9:16; `liggend` geeft 16:9. |
| `scherm` | Een van de acht geldige scherm-ID’s. |
| `lijst` | Kommalijst van geldige scherm-ID’s; minimaal één geldig ID wordt gebruikt. |
| `duur` | `10`, `15`, `20` of `30`. |
| `afspelen` | `1` start de rotatie. |
| `tv` | `1` opent de ingepaste schermmodus; browser-fullscreen vergt nog een geschikte gebruikersactie. |

Voorbeeld van een staande presentatie met drie onderdelen:

```text
/narrowcasting?formaat=staand&scherm=programma&lijst=programma,kantine,partners&duur=20&afspelen=1&tv=1
```

Een schermlink bevat instellingen, geen gerenderde export en geen kopie van de inhoud. De ontvanger gebruikt de versie van de website die op de gekozen host beschikbaar is.

## 8. Responsive studio versus staande uitzending

De bedieningsinterface reageert op de browserbreedte. De uitzending verandert alleen van ontwerp door de gekozen oriëntatie. **Een smal browservenster mag een liggend televisiescherm niet automatisch naar de staande compositie ombouwen.**

| Studio-breekpunt | Huidige aanpassing |
| --- | --- |
| Basis | Zijbalk 258 px, hoofdgrid 26 px tussenruimte, werkruimte maximaal 1800 px breed. Liggende stage `clamp(360px, 40vw, 650px)`, staande stage 660 px. |
| Maximaal 1150 px | Zijbalk 225 px en 18 px tussenruimte; compactere bediening; liggende stage 390 px, staande stage 620 px. |
| Maximaal 850 px | Preview bovenaan, afspeellijst eronder; vier schermkeuzes per rij. Liggende stage 51vw met minimum 290 px; staande stage 620 px. |
| Maximaal 560 px | Intro en formaatkeuze onder elkaar; twee schermkeuzes per rij; compactere knoppen. Liggende stage 59vw met minimum 210 px; staande stage 590 px. |

Beoordeel wijzigingen altijd in beide lagen: een goed passende studio zegt niets over mogelijke overlap in het 1080 × 1920-canvas, en een perfecte uitzending kan nog steeds slecht bedienbaar zijn op mobiel.

## 9. Animatie en toegankelijkheid

De hoofdinhoud krijgt bij een schermwissel een korte `nc-reveal`-animatie van **0,5 seconde**: opacity van 0 naar 1 en verticale verschuiving van 10 px naar 0. Er is geen continu lopende wedstrijdticker of scrollende stand in deze uitvoering.

`prefers-reduced-motion: reduce` verwijdert deze animatie en CSS-transities. De automatische afspeellijst zelf blijft een aparte gebruikersinstelling: reduced motion stopt de playlist niet vanzelf.

Behoud bestaande `aria-labels`, `aria-pressed`, zichtbare focusranden, alt-teksten, `role="status"` voor de tijdelijke melding en de indicatorletters in de vormblokjes. Decoratieve illustraties of symbolen hebben waar passend `aria-hidden`. Maak betekenisvolle informatie niet alleen door kleur duidelijk.

## 10. Voorbeeldinhoud en toekomstige live aansluiting

### Wat nu bestaat

De footer toont op alle schermen **CONCEPT · VOORBEELDGEGEVENS**, behalve bij de kantine: **CONCEPT · VOORBEELDPRIJZEN**. De studio vermeldt dat wedstrijden, standen en prijzen voorbeelden zijn. Sportkaarten bevatten aanvullende voorbeeldvermeldingen. Bewaar deze aanduidingen zolang de module met deze conceptinhoud draait.

De Nederlandse klok is actueel. Dat maakt wedstrijden, scores of prijzen niet actueel. Sommige clubgegevens zijn aangeleverd, maar de uitzending is als geheel een conceptpresentatie; behandel de voorbeeldmenu’s, wedstrijden en uitslagen niet als officiële publicatie.

### Vervolgwerk, nog niet gebouwd in de narrowcastingmodule

De volgende punten zijn aanbevelingen voor een toekomstige integratie, geen beschrijving van bestaande functionaliteit:

1. **Sportgegevens:** sluit een genormaliseerde servergegevenslaag aan op de bestaande schermcomponenten. Vervang datum, teamnamen, thuis/uit, veld, scores en stand als samenhangende records. Laat de presentatielaag de gekozen clubidentiteit behouden.
2. **Tegenstanderlogo’s:** voeg officiële afbeeldings-URL’s toe wanneer beschikbaar; houd het huidige initialenbadge als fallback. Download of cache volgens de bronvoorwaarden en zorg dat ontbrekende afbeeldingen de layout niet breken.
3. **Vijf teams rond het eigen team:** bereken het venster uit de volledige stand. Vul bij de boven- of onderkant aan de andere zijde aan. De huidige vaste array voert dit algoritme niet uit.
4. **Datums en actualiteit:** maak voorbeelddata expliciet vervangbaar. Toon bij livegebruik een begrijpelijke actualiteitsstatus; bepaal vooraf wat het scherm toont bij ontbrekende of verouderde gegevens.
5. **Meer regels:** bouw paginering met een vaste schermcapaciteit. Vermijd onbegrensde tabellen of automatisch verkleinde lettertypen.
6. **Kantine en nieuws:** voeg desgewenst beheerbare inhoud met publicatieperiode toe. Verwijder voorbeeldlabels pas wanneer de verantwoordelijke de echte prijzen en berichten heeft bevestigd.
7. **Centrale playlists en apparaten:** behandel schermregistratie, authenticatie, koppelen aan locaties, centrale opslag, offlinecache, herverbinding en automatisch opstarten als afzonderlijke toekomstige functies.

Verander bij het aansluiten van gegevens de vormgeving niet onbedoeld. Scheid gegevensophalen, dataformattering en schermpresentatie; behoud de bestaande CSS-klassen en geometrie totdat een gewijzigde compositie bewust is beoordeeld.

## 11. Praktische werkwijze voor wijzigingen

1. Start vanuit deze bronbestanden en maak eerst referenties van alle zestien combinaties.
2. Bepaal of een wijziging de inhoud, de studiobediening of het vaste broadcastcanvas raakt. Pas de betreffende laag aan.
3. Houd de liggende en staande variant naast elkaar. Iedere nieuwe kaart of inhoudswijziging moet in beide varianten worden beoordeeld.
4. Gebruik de bestaande kleuren, fonts, maskers en assetverwijzingen. Introduceer een nieuw designonderdeel alleen met een expliciete reden.
5. Test lange teamnamen, lange productnamen, ontbrekende afbeeldingen en afwijkende cijferlengtes voordat dynamische gegevens worden aangesloten.
6. Controleer de echte canvasafmetingen en vervolgens de ingepaste studio. Maak geen beoordeling uitsluitend op een kleine preview.
7. Beoordeel ten slotte de weergave op de daadwerkelijke televisie of staande display, inclusief letterleesbaarheid, schaal en randen.

## 12. QA-checklist voor overname en verdere ontwikkeling

### Ontwerp en inhoud

- [ ] Alle acht schermtypen bestaan in zowel 1920 × 1080 als 1080 × 1920.
- [ ] Lokale Barlow Condensed- en Manrope-bestanden laden; er is geen onbedoelde fallback.
- [ ] Achtergrondblauw, muurstructuur, penseelwoordmerk en clublogo komen overeen met de bron.
- [ ] Header, hoofdinhoud en footer behouden hun vastgelegde posities en overlappen niet.
- [ ] Programma en uitslagen tonen elk vijf volledige regels zonder afsnijding.
- [ ] Alle standkolommen en alle vijf vormblokjes passen in beide oriëntaties.
- [ ] De eigen-teamrij blijft duidelijk herkenbaar, de recentste vorm staat rechts.
- [ ] Lange namen veroorzaken geen botsing met tijden, badges, scores of prijzen.
- [ ] Twaalf kantineproducten, drie categorieën en de combikaart passen; alle prijzen blijven herkenbaar als voorbeelden.
- [ ] Walking Football-datum, spelersbeeld en beide kleinere nieuwskaarten blijven binnen hun kaders.
- [ ] Alle zes sponsorlogo’s blijven volledig zichtbaar en behouden hun verhouding.
- [ ] Welkomsttekst, spelersgroep, jaartal en drie waarden hebben de bedoelde laagvolgorde.
- [ ] Conceptvermeldingen zijn aanwezig zolang voorbeeldinhoud wordt gebruikt.

### Bediening en presentatie

- [ ] Liggend/staand wisselen verandert de compositie en niet alleen de schaal.
- [ ] Schermen selecteren, in-/uitschakelen en minimaal één scherm behouden werkt.
- [ ] Volgende/vorige doorloopt alleen ingeschakelde onderdelen en loopt correct rond.
- [ ] Rotatie werkt met 10, 15, 20 en 30 seconden en pauzeren/hervatten heeft het beschreven resetgedrag.
- [ ] Gekopieerde schermlinks bewaren formaat, lijst, duur en selectie; ze openen met afspelen aan.
- [ ] De klok toont Europe/Amsterdam, inclusief de bij die datum geldende zomer- of wintertijd.
- [ ] Schermmodus past het canvas in zonder vervorming; eventuele balken zijn zwart.
- [ ] Browser-fullscreen en de ingepaste fallback werken; Escape en Terug naar studio verlaten de presentatie.
- [ ] Overlay en cursor verdwijnen na inactiviteit en verschijnen bij pointeractiviteit.
- [ ] Sneltoetsen verstoren geen gefocuste formulier- of bedieningselementen.
- [ ] De studio blijft bruikbaar bij desktop-, tablet- en mobiele breedtes rond de bestaande breekpunten.
- [ ] Reduced motion verwijdert overgangsanimaties; toetsenbordfocus blijft zichtbaar.
- [ ] Asset- en fontverzoeken leveren geen ontbrekende bestanden op; console toont geen relevante fouten.
- [ ] De vier canvasranden en primaire gegevens zijn zichtbaar op het fysieke clubsysteem.

### Alleen wanneer livefunctionaliteit wordt toegevoegd

- [ ] Geen voorbeeldscore of conceptprijs wordt ongemerkt als officieel gepubliceerd.
- [ ] Brondata, actualiteitsmoment en fallback bij storing zijn duidelijk vastgesteld.
- [ ] Ontbrekende logo’s gebruiken een werkende fallback zonder layoutverschuiving.
- [ ] Vijf-teamselectie is gecontroleerd voor een eigen team bovenaan, middenin en onderaan.
- [ ] Grotere datasets worden gepagineerd binnen de vaste schermcapaciteit.
- [ ] Verouderde nieuwsberichten of aanbiedingen verdwijnen volgens de gekozen publicatieregels.
- [ ] Centrale opslag, rechten en apparaatbeheer worden afzonderlijk getest als die functies worden gebouwd.

