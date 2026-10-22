# Definitieve visuele specificatie

De goedgekeurde eindreferentie is de meegeleverde `broncode/`, vastgelegd op `ae83f2b4312408eacae9f29177d3c743e104185b`. De schermafbeeldingen in `voorbeelden/` zijn van diezelfde bron gemaakt. Gebruik de laatste cascade in `style.css`; oudere regels bovenin worden bewust door latere iteraties overschreven. Alleen de eerste passende CSS-regel overnemen geeft een verouderd ontwerp.

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

## Achtergrond en kleur

Gebruik de zes aangeleverde brushachtergronden onder `broncode/assets/clubmuur-brush-v25/`. Houtrust is de standaard. De wijk/Meeuwenhof en kust/havenhoofd zijn volwaardige alternatieven, met eigen wide- en portraitbestand. Behoud de grunge, zichtbare architectuur en uitsnede.

De lichte variant gebruikt onder meer `--blue:#164ccf`, `--ink:#102441`, `--dim:#65768d`, `--line:#dce4f0`, lichte afwisselende rijen en standaard `rgba(255,255,255,.94)` voor containers. De donkere variant gebruikt `--ink:#f1f5ff`, `--dim:#a6b6d0`, `--blue:#91b2ff`, `--line:#ffffff19` en `rgba(12,31,58,.94)` voor containers. De eigen standrij behoudt de sterke blauwe markering. Achtergrondlagen, mengmodus en transparantie uit de CSS zijn onderdeel van het beeld.

De prototype-instelling 80–100% containerdekking is een demonstratie van personalisatie. De screenshots gebruiken de goedgekeurde standaard 94%.

## Typografie en herkenning

- **OnzeTrots-woordmerk:** origineel transparant artwork `assets/clubmuur-lettering.webp`, via CSS-masker gekleurd. Niet opnieuw zetten in een vergelijkbaar lettertype.
- **Brushkoppen en felicitaties:** Permanent Marker, lokale CSS-alias `Marker`, `club-font-9.ttf`.
- **Body en informatielabels:** Manrope.
- **Compacte teamnamen, grote leeftijden en scorecijfers:** Barlow Condensed, lokale alias `Barlow`.

De volledige mapping van tien fontbestanden, gewichten en herkomst staat in `07-ASSETS-EN-HERKOMST.md` en `inventaris/asset-audit.json`. Fonts en beeldassets moeten ook offline en tijdens capture geladen zijn voordat een frame gereed is.

## Containerkoppen en footer

Er staat geen afzonderlijke grote slideheader boven de inhoud. Bestaande containerheaders bevatten de relevante titel en het eigen clublogo uiterst rechts. Bij bijzondere composities is de kop in de kaart geïntegreerd; introduceer geen tweede titelbalk. Het welkomslogo staat na de aftraptijd. Lege gridplekken krijgen geen logo.

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

## Families met expliciet goedgekeurd gedrag

| Familie | Eindbesluit |
| --- | --- |
| `standings`, `period-standings`, standpaneel in `matchday` | Volledige bewegende stand; blauwe eigen rij klemt boven/onder, overige rijen lopen door |
| `visitors`, `welcome` | Maximaal vier eerstvolgende eigen thuiswedstrijden; grote bezoekerscrest, volledige wedstrijd apart |
| `scoreboard` | Blauwe tijd-/momentchip boven de tussenstand; 18 logische pixels tussenruimte |
| `birthdays`, `activities`, `agenda` | Altijd zes slots, 3×2 in beide formaten; ongebruikte slots volledig leeg |
| `matchday` | Drie samenhangende panelen: uitslagen, volledige stand, programma; portrait stapelt deze |

Welkom liggend: 1 grote kaart, 2 gelijke kaarten, 3 één grote links plus twee rechts, 4 in 2×2. Welkom staand: 1–4 verticale kaarten. Het eigen clublogo is klein in de kop; alleen het uitteam heeft een groot hoofdlogo in de inhoud.

Zie voor iedere familie de precieze compositie, helper en databehoefte in `06-SLIDE-CATALOGUS.md`. Zie voor alle randgevallen en acceptatie `05-ACCEPTATIE-EN-TESTEN.md`.
