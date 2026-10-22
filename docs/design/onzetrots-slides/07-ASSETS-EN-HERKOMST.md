# Assets, huisstijl en herkomst

Dit document hoort bij het definitieve OnzeTrots-prototype, broncommit `ae83f2b4312408eacae9f29177d3c743e104185b`. De meegeleverde bestanden in `broncode/assets/` zijn de visuele basis voor de implementatie. De volledige bestandscontrole staat in `inventaris/asset-audit.json`: relatieve paden, bestandsgroottes, SHA-256-hashes, rasterafmetingen, fontmetagegevens en vastgestelde herkomst.

## 1. Het OnzeTrots-woordmerk is artwork

Het herkenbare, ruwe **OnzeTrots-woordmerk** staat in `broncode/assets/clubmuur-lettering.webp`: een transparant beeld van **2172 × 724 pixels**. Dit is het bestaande artwork van de Duindorp SV-website. Het is geen fontbestand en kan dus niet als lettertype worden toegepast op een willekeurige slidetitel.

De website gebruikt dit bestand als CSS-masker; het prototype neemt dezelfde werkwijze over. De transparante vorm bepaalt de lettering, de achtergrondkleur van het element bepaalt de zichtbare kleur. Gebruik dit bestand rechtstreeks en teken de letters niet opnieuw na.

```css
.brand-brush {
  display: block;
  background: currentColor;
  -webkit-mask: url('/assets/clubmuur-lettering.webp') center / contain no-repeat;
  mask: url('/assets/clubmuur-lettering.webp') center / contain no-repeat;
}
```

Voor **bewerkbare brushkoppen** gebruikt het definitieve prototype het font **Permanent Marker**, met CSS-alias `Marker`. Dat levert dynamische tekst op; het vervangt het vaste OnzeTrots-woordmerk niet. Beide onderdelen moeten zichtbaar behouden blijven: de brushuitstraling in de koppen én het originele woordmerk in de ondertekening.

`broncode/assets/type-distress.svg` is uitsluitend een herhaalbare grunge-/slijttextuur voor een CSS-masker. Het bevat geen lettertekens en is geen tweede brushfont.

## 2. Exacte fontbestanden

Alle fonts worden lokaal geladen. Gebruik de aangeleverde bytes en val niet terug op een netwerkfont of een vergelijkbaar systeemfont: verschillen in letterbreedte, regelhoogte en glyphvorm verschuiven de lay-out.

| Bestand onder `broncode/assets/fonts/` | Familie | Gewicht | Toepassing |
| --- | --- | ---: | --- |
| `club-font-0.ttf` | Barlow Condensed | 600 | Meegeleverd websitegewicht |
| `club-font-1.ttf` | Barlow Condensed | 700 | Meegeleverd websitegewicht |
| `club-font-2.ttf` | Barlow Condensed | 800 | Compacte koppen en cijfers |
| `club-font-3.ttf` | Barlow Condensed | 900 | Grote cijfers en nadruk |
| `club-font-4.ttf` | Manrope | 400 | Basistekst |
| `club-font-5.ttf` | Manrope | 500 | Meegeleverd websitegewicht |
| `club-font-6.ttf` | Manrope | 600 | Informatie en leesbare tabeltekst |
| `club-font-7.ttf` | Manrope | 700 | Meegeleverd websitegewicht |
| `club-font-8.ttf` | Manrope | 800 | Labels en nadruk |
| `club-font-9.ttf` | Permanent Marker | 400 | Bewerkbare brushkoppen |

In `broncode/style.css` heet Barlow Condensed kortweg `Barlow` en Permanent Marker `Marker`. De huidige stylesheet declareert Barlow 800/900, Manrope 400/600/800 en Marker 400. De overige gewichten zijn behouden website-assets; de levering van tien bestanden betekent niet dat alle tien op iedere slide worden ingeladen. De audit bevat de interne fontnamen en ingebedde licentiemetagegevens.

## 3. Zes herkenningsachtergronden

Alle achtergronden staan onder `broncode/assets/clubmuur-brush-v25/`. Iedere scène heeft een afzonderlijke liggende en staande compositie. Gebruik de juiste oriëntatie en maak van de liggende afbeelding niet zelf een willekeurige uitsnede voor staand beeld.

| Scène | Liggend — 1672 × 941 | Staand — 941 × 1672 |
| --- | --- | --- |
| Houtrust / clubgebouw | `houtrust-wide-1672.webp` | `houtrust-portrait-941.webp` |
| De wijk / Meeuwenhof en kerk | `de-wijk-wide-1672.webp` | `de-wijk-portrait-941.webp` |
| Aan zee / havenidentiteit | `aan-zee-wide-1672.webp` | `aan-zee-portrait-941.webp` |

Dit zijn de bestaande, goedgekeurde website-artworks: gegenereerde of samengestelde brushbeelden op basis van aangeleverde architectuurreferenties. Ze bewaren de herkenningspunten en de blauw-witte huisstijl. Het zijn geen onbewerkte documentaire foto’s. Hergebruik de bestanden; laat geen nieuwe interpretatie van gebouwen, perspectief, kerk of haven genereren.

De achtergrond blijft onderdeel van de slide. De panelen zijn voldoende gesloten om tekst goed te lezen, terwijl de buitenranden en tussenruimten het beeld zichtbaar houden. De ingestelde paneelopaciteit is standaard 94%; de prototype-instelling kan dit wijzigen.

## 4. Kleuren, panelen en ondertekening

Onderstaande waarden zijn de waarden van het **definitieve prototype**, geen vervangende interpretatie van de huisstijl. De volledige en laatste CSS-regels in `broncode/style.css` blijven leidend.

| Eigenschap | Licht | Donker |
| --- | --- | --- |
| Accentje / `--blue` | `#164ccf` | `#91b2ff` |
| Hoofdtekst / `--ink` | `#102441` | `#f1f5ff` |
| Ondergeschikte tekst / `--dim` | `#65768d` | `#a6b6d0` |
| Paneel, standaard | `rgba(255,255,255,.94)` | `rgba(12,31,58,.94)` |
| Lijnen | `#dce4f0` | `#ffffff19` |
| Afwisselende rij | `#edf2f8b0` | `#bed6ff0a` |
| Basiskleur scherm | `#eef2f8` | `#071831` |

Panelen hebben in de logische slidecoördinaten een hoekradius van 14 pixels, een lijn van 1 pixel en de bestaande zachte schaduw. Donker beeld gebruikt dezelfde achtergrondscène met een donkere kleuroverlay en aangepaste leesbaarheid; het is geen afzonderlijk opnieuw gemaakt achtergrondbestand.

**Rechtsonder staat het compacte OnzeTrots-artwork in wit, rechtstreeks op de achtergrond.** Het heeft in de laatste CSS géén vlak, rand, afgeronde badge of container erachter. De maat is 126 × 42 logische pixels, zowel liggend als staand. Een kleine slagschaduw houdt het witte beeld leesbaar. Daaronder staat de witte tekst `ONZE CLUB. ONZE TROTS.` De definitieve footerhoogte is 65 pixels liggend en 78 pixels staand. De kleine bronregel links in het prototype beschrijft de demonstratie-inhoud; die bronvermelding maakt de inhoud niet tot live data.

Let op de CSS-volgorde: er staan eerdere, later overschreven ontwerpregels in de bron. Neem bij een componentrefactor de **uiteindelijk berekende stijl** over en herstel niet per ongeluk de oude badge achter het woordmerk.

## 5. Club- en sponsorlogo’s

- `broncode/assets/logo.png` is het bestaande originele Duindorp SV-clubembleem. Bewaar verhouding en kleuren; laat het niet door filters, afgeronde uitsneden of nieuwe generatie veranderen.
- `broncode/assets/clubs/` bevat **217 daadwerkelijk gedownloade KNVB-emblemen** voor tegenstanders en teams. De gebruikte bron-URL’s kwamen uit het opgehaalde Sportlink-antwoord van de clubwebsite; de afbeeldingen werden van de KNVB-assetserver geladen.
- `broncode/assets/club-logos.json` bevat **732 naamverwijzingen** naar lokale emblemen: exacte namen, kleine letters en genormaliseerde aliassen. Het aantal aliassen is geen aantal unieke clubs.
- Alle tegenstanders uit de demonstratie van de eerste-elftalstand hebben een echt clubembleem. Een ontbrekend embleem heeft in de code een expliciete terugval op initialen; toon nooit ongemerkt het Duindorp-embleem als vervangend tegenstanderlogo. Bij de broncontrole gaf Futsal Haaglanden VR2 een 404.

De sponsorbestanden onder `broncode/assets/sponsors/` zijn `dg-webservices.svg`, `bnu.svg`, `deelman-daktechniek.svg`, `kwaliteit-kozijnen-holland.svg`, `proto-tegelzetbedrijf.svg` en `rw-repair.png`. De SVG-beschrijvingen vermelden bestaande vectorreconstructies van aangeleverde beeldmerken. Het zijn logo-assets uit het websiteontwerp; hun aanwezigheid in het prototype is geen bevestiging van een actuele sponsorovereenkomst of contractstatus.

## 6. Foto’s, illustraties en credits

| Groep | Betekenis en herkomst |
| --- | --- |
| `club-life-v28/*.webp` | Bestaande gegenereerde, illustratieve club-lifebeelden. De oorspronkelijke ontwerpprompts beschrijven fictieve scènes. Niet gebruiken als bewijs van echte leden of gebeurtenissen. |
| `clubmuur-portraits-v17/` en `clubmuur-portraits-v18/` | Bestaand gegenereerd of samengesteld websitebeeldmateriaal. Dit vormt geen betrouwbare bron voor de echte selectie, een spelersidentiteit of een opstelling. |
| `team.png`, `terrace.webp`, `floodlight.webp` | Bestaande prototypebeelden. De werkelijke herkomst van de afgebeelde scène is in deze controle niet onafhankelijk vastgesteld. |
| `club-archive/elftal-1950.webp` | Historische reproductie; de website beschrijft het eerste elftal in seizoen 1950/1951. |
| `club-archive/kampioen-1973.webp` | Historische reproductie; elftalfoto uit seizoen 1972/1973. |
| `club-archive/promotie-1984.webp` | Historische reproductie; promotieploeg uit seizoen 1983/1984. |

De bestaande websitecollectie schrijft de drie historische beelden toe aan **De Haagse Voetbalhistorie**. Behoud die credit in de contentgegevens en bijbehorende broninformatie. Bron: [De Haagse Voetbalhistorie — Duindorp SV](https://dehaagsevoetbalhistorie.nl/club/duindorp_sv/). De herkomstregistratie is overgenomen uit de bestaande websitecode `lib/club-archive-seed.ts`; deze assetcontrole is geen nieuw onderzoek naar het fysieke origineel.

## 7. Echte emblemen, demonstratiegegevens

De logobestanden zijn echte clubidentiteiten. **De gegevens die ernaast worden getoond zijn grotendeels vaste demonstratiegegevens.** Houd dat onderscheid bij de overdracht intact.

| Onderdeel | Status in het prototype | Wat Codex moet aansluiten |
| --- | --- | --- |
| Standen en periodestanden | Vaste team-/puntenarrays; eigen positie is instelbaar voor demonstratie | Bestaande echte stand- en poulegegevens |
| Programma, uitslagen en ontvangst | Voorbeeldwedstrijden, tijden, velden en kleedkamers; de selectie demonstreert filter- en sorteergedrag | De bestaande wedstrijd-, locatie- en synchronisatiestroom |
| Verjaardagen, vrijwilligers en opstelling | Fictieve of illustratieve namen, leeftijden en taken | Geautoriseerde bestaande clubgegevens en zichtbaarheid |
| Activiteiten, agenda en nieuws | Vaste voorbeelditems en teksten; geen live RSS-verwerking | Bestaande inhoud en publicatiestatus |
| Kantine en sponsorweergave | Voorbeeldprijzen en visuele plaatsing van logo’s | Echte productprijzen en geldige sponsorselectie |
| Scorebord, doelpunt en poll | Lokale demonstratiestatus en voorbeeldtellingen | De bestaande echte score- en interactiestroom, waar van toepassing |
| Video | Visuele demonstratie | Bestaande videobron en afspeelgedrag |

Bij opstarten haalt het prototype alleen de lokale `repo-inventory.json` en `assets/club-logos.json` op. Het is geen live Sportlink-client. Een bronlabel met “Sportlink” is dus geen bewijs van een actuele koppeling. Importeer de demonstratienamen, verjaardagen, prijzen, uitslagen of wedstrijden nooit als productiegegevens.

## 8. Baseline behouden en controleren

De assetcontrole omvat **259 bestanden in de definitieve bronmap**, samen **9.057.776 bytes**. De bestaande website-assets die in beide projecten aanwezig zijn, zijn byte voor byte identiek gekopieerd. De SHA-256-hashes in `inventaris/asset-audit.json` maken de aangeleverde baseline controleerbaar.

Behoud in de eerste implementatie de bestanden en paden. Zo blijven de brushvorm, beeldverhouding, uitsnede, letterbreedtes, logokleuren en referentieschermen reproduceerbaar. Optimaliseer of hernoem pas wanneer de uitgangsversie correct is en vergelijk daarna gericht met de definitieve screenshots. Een nieuwe compressie, een nieuw fontbestand of een opnieuw gegenereerde afbeelding heeft een andere hash en moet daarom als bewuste assetwijziging worden behandeld.

De oude screenshots `studio-preview.jpg`, `welcome-brush-preview.jpg`, `visitors-counts-preview.jpg` en `container-headers-preview.jpg` zijn van vóór de laatste v5-aanpassingen en zijn **geen definitieve visuele instructie**. De twee bestaande zes-verjaardagenbeelden horen wel bij v5, maar tonen slechts die weergave. Gebruik voor de implementatie de verse, definitieve referenties uit dit overdrachtspakket en de bijbehorende broncode.
