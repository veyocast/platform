# Technische overdracht — OnzeTrots TV

## Doel en bron

Dit pakket bevat uitsluitend de narrowcastingmodule van Duindorp SV · Onze Trots. De bestaande acht ontwerpen blijven het uitgangspunt. `BRONVERSIE.json` vermeldt de exacte broncommit en de aanpassingen voor zelfstandig gebruik. Het pakket is samengesteld uit de opgehaalde bron op 11 oktober 2026; het is geen export van database-inhoud.

Er zijn twee routes:

1. **Zelfstandig bekijken of doorbouwen:** `preview/` en `src/`.
2. **Integreren in een Next.js/Vinext-app:** de oorspronkelijke bestanden in `origineel-sites/`.

## Zelfstandige preview

Open `START-HIER.html` na het uitpakken. De gebouwde preview bestaat uit gewone HTML, een gebundeld klassiek JavaScript-bestand en CSS. Afbeeldingen en fonts staan lokaal. CSS-maskers, achtergronden en fonts worden bij het bouwen bovendien als data-URL in de preview-CSS opgenomen; zo hebben de maskers geen HTTP-server nodig om te laden bij het openen van een lokaal HTML-bestand. Voor de preview is geen npm-installatie nodig.

Een lokale HTTP-server kan zonder installatie worden gestart met `node scripts/serve.mjs`; deze luistert alleen op 127.0.0.1, standaard poort 4173. De server is een ontwikkelhulpmiddel. Voor echte hosting gebruik je een normale statische webserver.

Voor een nieuwe build: `npm install` gevolgd door `npm run build`. De exacte directe versies staan vast in package.json. Voor reproduceerbare verdere ontwikkeling maak en commit je daarna ook het door je pakketbeheerder gegenereerde lockbestand. De meegeleverde preview is al gebouwd en vereist geen dependency-download.

## Structuur

| Bestand | Verantwoordelijkheid |
| --- | --- |
| src/main.tsx | React-entrypoint en gezamenlijke stylesheet-imports |
| src/components/narrowcasting-studio.tsx | Studio, formaatkeuze, afspeellijst, timer, fullscreen, queryparameters |
| src/components/narrowcasting-sports.tsx | Wedstrijd, programma, uitslagen en stand; voorbeelddata in het bestand |
| src/components/narrowcasting-club.tsx | Kantine, clubnieuws, partners en welkom; voorbeeldprijzen in het bestand |
| src/styles/narrowcasting.css | Studio, vaste schermcanvassen, gemeenschappelijke header/footer en schaalgedrag |
| src/styles/narrowcasting-sports.css | Sportcomposities en hun staande varianten |
| src/styles/narrowcasting-club.css | Clubcomposities en hun staande varianten |
| src/styles/fonts.css | Lokale fontdeclaraties |
| src/styles/base.css | Basisreset en de benodigde algemene typografieregels voor zelfstandig gebruik |
| scripts/build.mjs | Bouwt React/TypeScript en CSS met esbuild; kopieert lokale assets |
| scripts/serve.mjs | Eenvoudige lokale server voor de meegeleverde preview |

De zelfstandige kopie gebruikt relatieve assetpaden en previewlinks die naar het huidige HTML-bestand wijzen. De teruglinks naar Clubmuur zijn absolute verwijzingen naar de bestaande website. Dit zijn de functionele aanpassingen ten opzichte van de originele module; de acht schermcomposities en hun voorbeeldinhoud zijn overgenomen.

## Inbouwen in een bestaande app

1. Kopieer `origineel-sites/components/narrowcasting-*.tsx` naar je componentenmap.
2. Kopieer `origineel-sites/app/narrowcasting*.css` en de route `origineel-sites/app/narrowcasting/page.tsx` naar overeenkomstige locaties.
3. Kopieer de bestanden uit `public/assets` en `public/fonts` naar de publieke map van de doelapp, zonder bestaande bestanden onnodig te overschrijven.
4. Laad de fontdeclaraties en benodigde basisregels. De originele app levert deze via de globale layout. In dit pakket is `src/styles/base.css` de afzonderlijke basis voor de preview.
5. Controleer de alias `@/components`, React en lucide-react. De originele page.tsx gebruikt het Next Metadata-type; pas alleen de routerintegratie aan als de doelapp een andere router heeft.
6. Behoud de bestaande route `/narrowcasting`, of pas de aanmaak van schermlinks expliciet aan.
7. Vergelijk alle zestien combinaties met de meegeleverde preview, inclusief portretstand, lange namen, afspeellijst en volledig scherm.

Neem de zelfstandige src-versie en de oorspronkelijke Sites-versie niet tegelijk op dezelfde route op. Ze bieden dezelfde module met verschillende omgevingspaden.

## Instellingen en links

De studio bewaart formaat, wisselduur en geselecteerde schermen lokaal onder `duindorp-narrowcasting-v1`. Dit zijn browservoorkeuren; ze zijn niet centraal gesynchroniseerd.

| Parameter | Waarden / werking |
| --- | --- |
| formaat | liggend of staand |
| scherm | wedstrijd, programma, uitslagen, stand, kantine, clubnieuws, partners, welkom |
| tv | 1 opent de presentatie zonder studio-omlijsting |
| afspelen | 1 start de afspeellijst |
| duur | 10, 15, 20 of 30 seconden |
| lijst | Kommagescheiden scherm-ID's in de afspeellijst |

Voorbeeld: `preview/index.html?formaat=staand&scherm=kantine&tv=1&afspelen=1&duur=15&lijst=kantine,partners,welkom`.

Een tv-link gebruikt nog steeds dezelfde toegangsregels als de host waarop hij wordt gepubliceerd. De zelfstandige lokale preview bevat geen authenticatie; Sites-authenticatie is niet meegenomen. De knop Volledig scherm vraagt browser-fullscreen aan na een gebruikersklik. De presentatie past zich ook zonder toestemming voor native fullscreen aan het venster aan. Browserbeperkingen kunnen kopiëren naar het klembord verhinderen; daarvoor toont de studio een terugvalmelding.

## Data en toekomstige productie-integratie

De narrowcastingmodule importeert geen Sportlink-hook en doet geen datafetch. Gebruik de bestaande voorbeelddata alleen als ontwerpfixture. De overige website kan wel andere koppelingen hebben; die maken geen onderdeel uit van dit pakket.

Voor productie zijn live gegevens, foutafhandeling, actualisatietijd, beheer van prijzen/berichten en eventueel centrale scherminstellingen afzonderlijke vervolgtaken. Bij zo'n opdracht: scheid gegevens van de presentatielaag, normaliseer teamnamen/logo-URL's, toon een eerlijke status bij ontbrekende of verouderde data en houd de laatste geldige gegevens beschikbaar. Presenteer voorbeeldprijzen of verzonnen wedstrijden nooit als echte actuele informatie.

## Gecontroleerd en nog te controleren

De zelfstandige bundel is gebouwd. De lokale asset- en fontverwijzingen, overeenkomst van de originele bronbestanden en ZIP-integriteit zijn gecontroleerd; zie CONTROLE.json. Er is geen visuele browsercontrole van deze export uitgevoerd. Controleer voor ingebruikname op de echte clubschermen onder meer leesafstand, uitsnede, fullscreen, beeldrotatie, schermslaapstand en de werking bij langere afspeelduur.

Het pakket bevat geen .git-map, node_modules, toegangstokens, omgevingsbestanden, Sites-hostingidentiteit of databasekopie. Logo's en beelden zijn de bestaande projectassets; rechten gaan niet over door het opnemen in deze overdracht.
