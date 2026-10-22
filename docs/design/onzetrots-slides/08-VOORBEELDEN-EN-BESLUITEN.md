# Voorbeelden en laatste goedgekeurde besluiten

## Definitieve beslisvolgorde

Dit pakket verwerkt alle goedgekeurde correcties tot en met de laatste versie:

1. Alle 36 VeyoCast-families in OnzeTrots-stijl, licht/donker, met herkenningsachtergronden, containers en clublogo’s.
2. Het echte OnzeTrots-woordmerk als artwork; Permanent Marker voor bewerkbare brushteksten.
3. Welkom en bezoekende teams tonen uitsluitend maximaal vier aankomende eigen thuiswedstrijden. Het bezoekerslogo staat centraal, de volledige wedstrijd staat apart. Ook één, twee en drie wedstrijden hebben een ontworpen compositie.
4. De losse buitenheader is weg. Het eigen clublogo staat uiterst rechts in de bestaande containerkop.
5. OnzeTrots rechtsonder is kleiner, wit, zonder achtergrond en met schaduw. De onderregel blijft.
6. De blauwe live-tijdchip staat boven de tussenstand.
7. Jarigen, clubactiviteiten en clubagenda hebben zes voorbeelditems in een vast 3×2-raster. Minder items laten de overige posities leeg, ook staand.

De laatste bron en deze besluiten gaan vóór eerdere screenshots of concepten in de repo. Er zijn geen oude v1–v4-ontwerpbeelden in deze galerij opgenomen.

## Beeldarchief

Open `voorbeelden/index.html` om te bladeren. Het archief bevat:

- **144 basisbeelden:** alle 36 families × licht/donker × liggend/staand.
- **75 detailbeelden:** welkom 1–4 in alle vier varianten; jarigen/activiteiten/agenda 0–5 in beide formaten en drie items ook in donker; aftrap/rust/eindstand; eigen standpositie 1/5/14; wijk- en kustachtergrond.
- **4 contactbladen:** alle 36 families tegelijk per variant.

De individuele screenshotbestanden hebben herkenbare IDs en aantallen. `inventaris/captures.json` legt iedere opname met clipmaten en detailmetadata vast. Liggende basisbeelden zijn 1363×766; staande 526×936. Ze zijn browsercaptures van het geschaalde logische canvas en dus geen native 1080-render of videobewijs. Gebruik ze voor beeldvergelijking; gebruik de bron voor exacte maatvoering.

De basisbeelden zijn gemaakt met Houtrust, 94% containerdekking, zes items per zesvaksfamilie, vier welkomswedstrijden, eigen standpositie vijf en een gepauzeerde scène. Hierdoor zijn kaarten, fonts en cijfers zichtbaar zonder binnenkomsttransitie. Detailbeelden wijzigen alleen de benoemde voorbeeldinstelling. De eigen standrij op positie één en veertien toont de grenswerking; `standings-own-5-clamped-top-landscape-light.jpg` toont positie vijf na handmatig scrollen tot het einde.

Stilstaande beelden leggen geen volledige animatie vast. Het meegeleverde prototype laat het werkende browsergedrag zien; de codevoorbeelden leggen de tijdsregels vast. Productie-export en pauze-/fallbackgedrag moeten nog in de VeyoCast-implementatie worden aangetoond.

## Voorbeeldbediening in de bron

| Doel | Handeling |
| --- | --- |
| Alle families | Kies links of in “Alle 36 slides” |
| Licht/donker | Knoppen boven het canvas |
| Liggend/staand | 16:9 / 9:16 |
| Welkom 1/2/3/4 | Kies Bezoekende teams of Welkomstscherm; gebruik aantallenbalk |
| Grids 0–6 | Kies Verjaardagen, Clubactiviteiten of Clubagenda; gebruik aantal-dropdown |
| Stand 1e/5e/laatste | Open Vormgeving; kies Duindorp in de stand |
| Stand bewegen | Zet beweging aan; wacht door de beginpauze |
| Achtergronden | Vormgeving → Ons clubhuis / Onze wijk / Onze kust |
| Aftrap/rust/eindstand | Kies Live scorebord; Vormgeving → Wedstrijdmoment |
| Doelpunt | Scorebordinstellingen → + Doelpunt Duindorp |
| Hele collectie | Vormgeving → Afspelen → Hele collectie, 15 seconden |
| Volledig scherm | Presenteren-knop; Esc of Terug naar studio om terug te keren |

De voorbeeldkeuzes worden lokaal onthouden. Voor de basisreferentie herstel je de instellingen uit de alinea hierboven. De animatie respecteert ook de browservoorkeur voor verminderde beweging. Programma’s wisselen in het prototype na acht seconden; nieuws/verhalen na twaalf seconden.

## Bron en inhoud

Prototype: https://veyocast-onzetrots-slides.dgwebserv.chatgpt.site

De online versie is een hulpmiddel. De vastgelegde lokale bron en hashes zijn de stabiele referentie. Het prototype heeft geen live Sportlink-koppeling. Echte clubemblemen en echt bestaand artwork maken de namen, scores, standen, jarigen of agenda-items uit de demonstratie niet tot echte bronfeiten. Neem die alleen over als expliciet gelabelde test-/pickerfixtures.
