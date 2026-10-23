# Definitieve visuele specificatie

De actuele ontwerpversie is **v9 van23oktober2026**, broncommit `5ba52a657d6d16ad103ba2fb43b8db18aa83715a`. Rubik Distressed400 en de bewerkbare subtitel boven de titel blijven behouden. Alle160 individuele layoutbeelden zijn nieuwe v9-opnamen en tonen de definitieve binnenkoppen- en verjaardagswijziging. De drie v7-motionbeelden zijn afzonderlijk historisch bewijs van de behouden entreevolgorde. Menu Studio heeft vier eigen actuele beelden en een apart gepinde bronsnapshot. Gebruik de laatste cascade in `style.css`; oudere regels bovenin worden bewust door latere iteraties overschreven. Alleen de eerste passende CSS-regel overnemen geeft een verouderd ontwerp.

## Canvas en compositie

| Eigenschap | Liggend | Staand |
| --- | --- | --- |
| Logisch canvas | 1600×900 | 900×1600 |
| Beoogde native uitvoer | 1920×1080 | 1080×1920 |
| Uitvoerschaal | 1,2× | 1,2× |
| OnzeTrots-artwork in footer | 126×42 logisch | 126×42 logisch |
| Footerhoogte | 65 logisch | 78 logisch |
| Verjaardagen/activiteiten/agenda | 3 kolommen × 2 rijen | 3 kolommen × 2 rijen |
| Gridgap van die drie families | 22 logisch | 18 logisch |

Behoud de maatverhoudingen en de familiegebonden hoogte uit de referentie. Een staande lijst vult niet automatisch het hele scherm; het zichtbare onderste achtergrondgebied in de voorbeelden hoort bij het goedgekeurde ontwerp. Maak van de portrait-zesvaksrasters geen twee kolommen of verticale lijst.

## Gefaseerde entree van de slide

De entree uit `11-MOTION-V7.md` hoort bij alle families, thema’s en oriëntaties. Eerst verschijnt de achtergrond, dan de aparte kopcontainer, vervolgens de daadwerkelijke bovenliggende inhoudspanelen en daarna de footer. De uiteindelijke maten en rasterindelingen hieronder blijven gelden. Inhoudelijke tabelrijen of geneste panelen worden niet nog eens afzonderlijk achter elkaar geanimeerd.

De achtergrond gaat in 0,85 s van opacity 0 en scale 1,025 naar opacity 0,95 (licht) of 0,6 (donker) en scale 1. De kop begint op 1,25 s en beweegt in 0,65 s van opacity 0, translateY −16 en blur 3 naar de normale zichtbare positie. Inhoudspaneel i begint op `2,1 + i × 0,12` s en gaat in 0,65 s van opacity 0, translateY 24, scale 0,985 en blur 4 naar normaal. Alle translate/blur-maten zijn logische pixels. De footer begint op `2,6 + max(0, n−1) × 0,12` s en verschijnt in 0,4 s.

Bij pauze of reduced motion is direct de complete eindlayout zichtbaar. Hervatten na pauze start de intro niet opnieuw; expliciet opnieuw afspelen of een nieuwe render doet dat wel wanneer beweging is toegestaan. De exacte timing en toestandstransities zijn verder uitgewerkt in `11-MOTION-V7.md`.

## Achtergrond en kleur

Gebruik de zes aangeleverde brushachtergronden onder `broncode/assets/clubmuur-brush-v25/`. Houtrust is de standaard. De wijk/Meeuwenhof en kust/havenhoofd zijn volwaardige alternatieven, met eigen wide- en portraitbestand. Behoud de grunge, zichtbare architectuur en uitsnede.

De lichte variant gebruikt onder meer `--blue:#164ccf`, `--ink:#102441`, `--dim:#65768d`, `--line:#dce4f0`, lichte afwisselende rijen en standaard `rgba(255,255,255,.94)` voor containers. De donkere variant gebruikt `--ink:#f1f5ff`, `--dim:#a6b6d0`, `--blue:#91b2ff`, `--line:#ffffff19` en `rgba(12,31,58,.94)` voor containers. De eigen standrij behoudt de sterke blauwe markering. Achtergrondlagen, mengmodus en transparantie uit de CSS zijn onderdeel van het beeld.

De prototype-instelling 80–100% containerdekking is een demonstratie van personalisatie. De screenshots gebruiken de goedgekeurde standaard 94%.

## Typografie en herkenning

- **OnzeTrots-woordmerk:** origineel transparant artwork `assets/clubmuur-lettering.webp`, via CSS-masker gekleurd. Niet opnieuw zetten in een vergelijkbaar lettertype.
- **Alle koppen:** het echte Rubik Distressed, gewicht 400, lokaal bestand `RubikDistressed-Regular.ttf`, met de meegeleverde OFL-licentie. Gebruik geen systeemfallback, Permanent Marker of synthetisch zwaarder gewicht als visueel eindresultaat.
- **Headersubtitel:** Manrope 800, afzonderlijk van de Rubik-titel.
- **Body en informatielabels:** Manrope.
- **Compacte teamnamen en scorecijfers:** Barlow Condensed, lokale alias `Barlow`.

De mapping van de behouden oude fontbestanden plus het nieuwe Rubik-bestand en de licentie staat in `07-ASSETS-EN-HERKOMST.md` en `inventaris/asset-audit.json`. Fonts en beeldassets moeten ook offline en tijdens capture geladen zijn voordat een frame gereed is.

## Aparte slidekop en footer

Iedere slide heeft een **afzonderlijke kopcontainer boven de inhoud**. De gebruiker kan subtitel en titel per slide aanpassen. Ze staan links onder elkaar, subtitel boven titel. Het eigen clublogo staat helemaal rechts in die kop, uitgelijnd volgens de v8-bron. Verwijder de extra `.panel-head`-secties uit alle niet-matchday-binnencontainers. Alleen Onze wedstrijddag behoudt precies drie binnenkoppen: uitslagen, stand en programma. Datums, semantische context-/gegevensstroken en tabelkolomlabels blijven; daadwerkelijke inhoudstitels van feature-artikelen blijven ook. Het generieke decoratieve eigen-clublogo wordt binnenin niet herhaald. Echte teamlogo’s in wedstrijdkaarten, standen en andere sportinhoud blijven behouden. Lege gridplekken krijgen geen logo.

De altijd zichtbare bediening `SLIDEHEADER` bevat `Subtitel boven de kop` (aria-label `Subtitel van deze slide`) en `Headertekst` (aria-label `Headertekst van deze slide`), elk `maxlength=120`. De standaardtitel is `family.label`; de standaardsubtitel is `Duindorp SV · ${family.group}`. Iedere familie onthoudt beide teksten via de maps `headerSubtitles` en `headerTexts` in `localStorage`-sleutel `onzetrots-studio`; leeg blijft leeg. `Standaard herstellen` herstelt beide teksten van alleen de huidige familie. Productie bewaart dit per opgeslagen slide/ontwerp in de bestaande authoringflow. Toon beide invoeren als gewone tekst.

| Kopmaat, logische pixels | Liggend | Staand |
| --- | --- | --- |
| Hoogte kopcontainer | 120 | 128 |
| Marge onder kop | 18 | 22 |
| Padding verticaal / horizontaal | 16 / 30 | 18 / 25 |
| Eigen clublogo, breedte × hoogte | 58×68 | 56×66 |
| Tekstwrapper, hoogte | 88 | 92 |
| Rubik Distressed-titel, uitgangsgrootte | 42 | 38 |
| Subtitel, Manrope 800 | 12 / 1,4 | 11 / 1,4 |

De titel kan automatisch verkleinen tot minimaal 14 logische pixels. De beschikbare titelruimte wordt berekend uit de wrapperhoogte minus de zichtbare subtitel en de 7-pixel tussenruimte; bij lege subtitel vervalt die aftrek. De subtitel kan zo nodig van 12/11 tot 9 verkleinen om binnen maximaal 30 logische pixels hoogte te passen. Behoud het v8-fitgedrag, met het logo zichtbaar helemaal rechts. De regels gelden voor beide thema’s. Lege subtitel en/of titel blijven toegestaan en bewerkbaar.

Het OnzeTrots-artwork rechtsonder is in beide kleurvarianten wit en klein. De definitieve CSS bevat:

```css
.signature {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  padding: 0 !important;
  gap: 2px;
  transform: none;
}
.signature .brand-brush {
  width: 126px;
  height: 42px;
  background: #fff !important;
  filter: drop-shadow(0 2px 2px #000d) drop-shadow(0 0 1px #000e);
}
.signature small {
  font: 800 6px/1.5 Manrope, sans-serif;
  letter-spacing: 1.2px;
  color: #fff;
  text-shadow: 0 2px 3px #000, 0 0 2px #000;
}
```

De onderregel blijft `ONZE CLUB. ONZE TROTS.`. De schaduw hoort bij het witte artwork en de tekst, zonder achtergrondpaneel. De bestaande VeyoCast-systeemoverlay is een afzonderlijk Playeronderdeel.

## Verjaardagskaart in v9

Behoud zes vaste slots. Binnen iedere gevulde kaart is de volgorde: **grotere datum linksboven → `Gefeliciteerd, Sam K.` → leeftijd in Rubik Distressed 400 → teaminformatie**. Gebruik voornaam plus achternaaminitiaal als zichtbare naam, met punt achter de initiaal. De datum is groter dan in de vorige kaartversie; de uiteindelijke bron bepaalt de exacte maat. Er wordt hier geen nieuwe pixelmaat verzonnen. De felicitatie is echte kaartinhoud en verdwijnt niet bij het verwijderen van de extra `.panel-head`-secties.

## Families met expliciet goedgekeurd gedrag

| Familie | Eindbesluit |
| --- | --- |
| `standings`, `period-standings`, standpaneel in `matchday` | Volledige bewegende stand; blauwe eigen rij klemt boven/onder, overige rijen lopen door |
| `visitors`, `welcome` | Maximaal vier eerstvolgende eigen thuiswedstrijden; bezoekerscrest/-naam/begroeting standaard 150% van v5 en schaalbaar; volledige wedstrijd apart, vet en groter |
| `scoreboard` | Blauwe tijd-/momentchip boven de tussenstand; 18 logische pixels tussenruimte |
| `birthdays`, `activities`, `agenda` | Altijd zes slots, 3×2 in beide formaten; ongebruikte slots volledig leeg |
| `matchday` | Drie samenhangende panelen: uitslagen, volledige stand, programma; portrait stapelt deze |

Welkom liggend: 1 grote kaart, 2 gelijke kaarten, 3 één grote links plus twee rechts, 4 in 2×2. Welkom staand: 1–4 verticale kaarten. Het eigen clublogo staat in de aparte slidekop; alleen het uitteam heeft een groot hoofdlogo in de kaartinhoud.

De bezoekerscrest, bezoekersnaam en `Van harte welkom` hebben standaard een **gevraagde schaal van 150%** ten opzichte van de v5-basis. De slider heet `WELKOMSBLOK`, met aria-label `Grootte bezoekerslogo en welkomstekst`: **100–200%, stap 5, standaard 150%**. De instelling wordt gedeeld door `visitors` en `welcome` en bewaard in `onzetrots-studio`. Dit is geen schaal van de hele kaart: datum, wedstrijdcaption, veld en kleedkamers blijven afzonderlijk vormgegeven en leesbaar.

Gebruik een schaalfactor van 1,5 voor 150%. De werkelijke schaal is `min(gevraagdeSchaal, beschikbareBreedte / natuurlijkeBreedte, beschikbareHoogte / natuurlijkeHoogte)`, waarbij de natuurlijke maat de bijbehorende v5-identiteitsgroep is. De UI bewaart de gevraagde schaal, terwijl de getoonde groep zo nodig kleiner wordt om te passen. Gebruik dezelfde fit in preview, capture en Player. Test 1–4 kaarten op 100%, 150%, 200% en een tussenwaarde zonder overflow, overlap of afgesneden logo/tekst.

De volledige wedstrijdcaption heeft gewicht **800** en is in elke compositie **3 logische pixels groter dan de bijbehorende v5-basis**:

| Wedstrijdcaption, logische pixels | Liggend | Staand |
| --- | --- | --- |
| 1 kaart | 26 | 28 |
| 2 kaarten | 20 | 23 |
| 3 kaarten | Grote kaart 19; compacte kaarten 16 | 20 |
| 4 kaarten | 16 | 17 |

De compacte liggende kaarten bij drie wedstrijden delen de compacte basisstijl; de definitieve CSS blijft leidend. De aparte kopcontainer en footer blijven bij alle schaalwaarden vrij van overlap.

Zie voor iedere familie de precieze compositie, helper en databehoefte in `06-SLIDE-CATALOGUS.md`. Zie voor alle randgevallen en acceptatie `05-ACCEPTATIE-EN-TESTEN.md`.
