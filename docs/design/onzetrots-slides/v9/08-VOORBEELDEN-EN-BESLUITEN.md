# Voorbeelden en laatste goedgekeurde besluiten

Dit document beschrijft de definitieve **v9-referentie van 23 oktober 2026**, broncommit `5ba52a657d6d16ad103ba2fb43b8db18aa83715a`. De bijbehorende Sites-publicatie is geslaagd. De afzonderlijke Menu Studio-referentie is vastgelegd op commit `77eec81092ab829302dd835fb430161fe93be220`, gepubliceerd als Sites-versie 18.

## Laatste ontwerpbesluiten

1. Alle 36 VeyoCast-families gebruiken de OnzeTrots-huisstijl, in licht/donker en liggend/staand, met de bestaande herkenningsachtergronden en goed leesbare containers.
2. Het vaste OnzeTrots-woordmerk blijft origineel artwork. Voor de bewerkbare koppen wordt het echte lokale **Rubik Distressed 400** gebruikt; de subtitel staat in Manrope 800.
3. Iedere slide heeft één aparte buitenkop: bewerkbare subtitel boven de titel links en één eigen clubcrest uiterst rechts. Decoratieve herhalingen van het eigen clublogo in binnencontainers vervallen; inhoudelijke teamlogo’s blijven behouden.
4. Alle extra `.panel-head`-binnenkoppen vervallen op niet-matchday-slides. **Alleen `matchday` behoudt precies drie binnenkoppen**: uitslagen, stand en programma. Gegevens-/contextstroken, tabelkolomlabels en daadwerkelijke feature-inhoudstitels blijven bestaan.
5. Welkom en bezoekende teams tonen maximaal vier geldige aankomende eigen thuiswedstrijden. De bezoekerscrest, naam en begroeting vormen één schaalbare groep, standaard 150% van de v5-basis. De volledige wedstrijd blijft apart, vet en groter. De composities voor één tot vier wedstrijden blijven passen.
6. Verjaardagen, activiteiten en agenda houden een vast 3×2-raster. Minder items laten de overige posities leeg. Een verjaardagskaart toont datum linksboven, vervolgens de felicitatie met voornaam en achternaaminitiaal, daaronder de leeftijd in Rubik Distressed 400 en daarna de teaminformatie. Voorbeeld: `Gefeliciteerd, Sam K.` De datum is 13 logische pixels liggend en 12 staand.
7. Het kleine witte OnzeTrots-woordmerk rechtsonder staat zonder achtergrondvlak, met schaduw en de bestaande onderregel. De blauwe live-tijdchip staat boven de tussenstand.
8. De v7-entree blijft onderdeel van het ontwerp: eerst achtergrond, daarna buitenkop, vervolgens bovenliggende inhoudspanelen en als laatste footer. Binnenrijen/geneste panelen krijgen geen eigen stagger. Pauze en reduced motion tonen de complete eindcompositie; hervatten start geen nieuwe intro, expliciete replay wel wanneer beweging is toegestaan. De historische observaties staan in `11-MOTION-V7.md`.

De laatste bron en deze besluiten gaan vóór eerdere concepten. Oudere v6-, v7- en v8-opnamen zijn geen actuele v9-font-, binnenkoppen- of verjaardagsreferentie.

## Definitieve beeldcollectie

Open `voorbeelden/index.html` voor het beeldarchief. De **160 individuele slidecaptures zijn volledig opnieuw gemaakt met v9**; er zijn geen v8-beelden als nieuwe v9-opnamen hergebruikt.

| Collectie | Dekking | Aantal |
| --- | --- | ---: |
| V9-basiscollectie | 36 families × licht/donker × liggend/staand | 144 |
| V9-bezoekersdetails | `visitors`, 1/2/3/4 wedstrijden × licht/donker × liggend/staand | 16 |
| Contactbladen | Eén overzicht van de 36 basisbeelden per thema-/formaatcombinatie | 4 |
| Menu Studio-bewijs, afzonderlijk | Liggend/staand × licht/donker, broncommit `77eec81092ab829302dd835fb430161fe93be220` | 4 |
| Historisch v7-motionbewijs | Drie representatieve entreeframes, broncommit `d5005d8cc7cdb794edb3b1a40cda70a3491b2b0c` | 3 |

De standaardcontext van de 160 v9-opnamen is Houtrust, 94% containerdekking, zes voorbeelditems per zesvaksfamilie, vier welkomswedstrijden, bezoekersschaal 150%, de standaard subtitel/titel van de familie, eigen standpositie vijf en een gepauzeerde eindcompositie. De zestien bezoekersdetails veranderen het aantal wedstrijden. De bijbehorende inventaris registreert per opname het pakketpad, de bronidentiteit, de clipmaten en de werkelijk geobserveerde DOM-metagegevens.

Alle 160 opnameframes hebben hun eigen DOM-controle; dit staat los van de 72 vooraf uitgevoerde controles. Daarmee zijn de extra binnenkoppen, de buitenkop, de echte kopfont en de verjaardagsopbouw gekoppeld aan de daadwerkelijk opgenomen beelden. De volledige uitslagen en grenzen van dat bewijs staan in `09-VALIDATIE.md`.

De vier Menu Studio-opnamen dienen als aanvullende referentie voor de aparte kopcontainer, bewerkbare subtitel/titel, Rubik Distressed, clublogo rechts en witte transparante footer. De meegeleverde minimale Menu Studio-snapshot omvat 32 bestanden, samen 4.933.285 bytes. Hij bewaart de relevante bron en lokale importcontext, maar is **geen zelfstandig draaiende volledige applicatie**. Kopieer deze referentie niet als vervanging van de bestaande VeyoCast-runtime.

De drie motionbeelden blijven nadrukkelijk **historisch v7-bewijs**. Ze tonen de toenmalige font-/headerlay-out en maken de nieuwe v9-vormgeving niet frame voor frame bewezen. De vermelde hosttijden en opacitywaarden horen bij die eerdere bron; ze zijn niet opnieuw als v9-metingen gelabeld.

Browsercaptures tonen het geschaalde logische canvas, geen native 1080-export of videobewijs. Voor exacte geometrie geldt de bron. De uitgebreide acceptatiematrix in `05-ACCEPTATIE-EN-TESTEN.md` bevat meer gevallen dan de statische detailcollectie, waaronder lege grids, scoremomenten en ranglijstgrenzen. Zulke implementatiecriteria zijn niet automatisch een claim van een afzonderlijke actuele screenshot.

## Voorbeeldbediening

| Doel | Handeling |
| --- | --- |
| Familie kiezen | Kies links of in “Alle 36 slides” |
| Thema / formaat | Licht/donker en 16:9 / 9:16 boven het canvas |
| Slidekop wijzigen | `SLIDEHEADER`: `Subtitel boven de kop` en `Headertekst`, elk maximaal 120 tekens |
| Kop herstellen | `Standaard herstellen` herstelt alleen subtitel en titel van de huidige familie; beide leeg laten is toegestaan |
| Welkom 1–4 | Kies Bezoekende teams of Welkomstscherm en gebruik de aantallenbalk |
| Bezoekersschaal | `WELKOMSBLOK`: 100–200%, stap 5, standaard 150%; gedeeld door de twee bezoekersfamilies |
| Grids 0–6 | Gebruik de aantal-dropdown bij Verjaardagen, Clubactiviteiten of Clubagenda |
| Eigen standrij | Vormgeving → Duindorp in de stand; kies eerste, vijfde of laatste plaats |
| Gegevensbeweging | Zet beweging aan en wacht de beginpauze af |
| Entree opnieuw | `Opnieuw afspelen` in studio of op volledig scherm; respecteert reduced motion |
| Achtergrond | Vormgeving → Ons clubhuis / Onze wijk / Onze kust |
| Scoremoment / doelpunt | Live scorebord → Wedstrijdmoment of `+ Doelpunt Duindorp` |
| Hele collectie | Vormgeving → Afspelen → Hele collectie, 15 seconden per slide |
| Presenteren | Presenteren-knop; Esc of Terug naar studio keert terug |

Het prototype bewaart de familiekoppen en gedeelde gevraagde bezoekersschaal onder `localStorage`-sleutel `onzetrots-studio`. De werkelijke bezoekersgroep kan vanwege beschikbare ruimte kleiner worden getoond dan gevraagd. In productie horen deze instellingen bij de bestaande authoring-, revision- en publicatiestroom. De voorbeeldtellers zijn demonstratiebediening; productie volgt de geautoriseerde bronrecords.

## Aanvullende prompt is een volgende stap

`14-AANVULLENDE-PROMPT-CONTEXTREGEL.md` bevat de losse opdracht om de contextregel onder de hoofdheader circa 30% groter te maken. **Die aanpassing is nog niet in het prototype, de v9-bron of de screenshots verwerkt.** Behandel haar als afzonderlijke vervolgstap; wijzig de betekenis van de vastgelegde v9-beelden niet achteraf.

## Bron en inhoud

Prototype: https://veyocast-onzetrots-slides.dgwebserv.chatgpt.site

De meegeleverde bron omvat 261 bestanden en 9.969.905 bytes; manifest, assetaudit en checksums leggen de exacte levering vast. De online versie is een hulpmiddel. Het prototype heeft geen live Sportlink-koppeling. Echte clubemblemen en bestaand artwork maken de demonstratienamen, scores, standen, jarigen of agenda-items niet tot echte bronfeiten. Gebruik ze alleen als herkenbare test-/pickerfixtures.
