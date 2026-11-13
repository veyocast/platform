# VeyoCast-blog

## Doel en reikwijdte

Voeg blog en artikelen toe aan de publieke VeyoCast-website en blogbeheer aan de bestaande beheeromgeving. SocialHero maakt na campagnegoedkeuring een websiteconcept aan, publiceert de goedgekeurde revisie op de geplande tijd en laat gekoppelde socialposts verdergaan zodra de website de verwachte openbare publicatie toont.

De DartFlow-namen, domeinen en inhoud uit de algemene opdracht zijn voorbeelden. Gebruik de VeyoCast-identiteit, de geverifieerde VeyoCast-omgevingsconfiguratie en de publieke VeyoCast-stijlen. Gebruik `nl-NL`, `/blog` en VeyoCast als standaard redactieauteur zolang de bron geen bestaande conventie voor dezelfde functie heeft. Voor productie gebruikt de onderzochte bron `https://veyocast.nl` als canonieke basis. Gebruik voor de proef de lokale Marketing-app of een apart ingerichte marketingtesthost. Het standaard stagingprofiel levert geen Marketing-app.

## Referentie voor overname

De meegeleverde prototypebron en eventuele referentiebeelden zijn leidend voor de toegevoegde blogschermen. De VeyoCast-repository is leidend voor het bestaande product, componenten, routeconventies en releaseproces. Lees [BRONBASIS.md](BRONBASIS.md) en het oplevermanifest. Controleer desktop en mobiel naast het prototype met dezelfde inhoud, lettertypes, toestand en viewport. Neem de bestaande lay-out, kleuren, typografie, ruimteverdeling, bediening, focus en waarneembare overgangen over. Laat voor toegang tot beheer de bestaande identiteit en autorisatie gelden. De VeyoCast-marketingwebsite is platformbreed. Beperk publicatie tot de expliciet bevoegde platformredactie. Vervang demonstratiegegevens en lokale opslag door de werkelijke appservices.

## Publiek

| Oppervlak | Gedrag |
|---|---|
| Blogoverzicht | Toont uitsluitend gepubliceerde artikelen, met titel, samenvatting, beeld, categorie en waar het ontwerp die gebruikt auteur en datum. Gebruik bestaande lijst- en navigatiecomponenten. |
| Detailpagina | Leest de gepubliceerde revisie op de canonieke slug. Rendert titel als enige H1, inhoud vanaf H2, auteur, zichtbare publicatiedatum, semantische rich text en een responsieve portret-hero met opgeslagen alt-tekst en focuspunt. |
| Delen | Deel de canonieke URL. Gebruik de aparte brede afbeelding voor Open Graph en social metadata als die is ingesteld. Val terug op het eigen hero-beeld met echte afmetingen. Render titel, samenvatting en beeldmetadata in de serverrespons zodat crawlers ze zonder JavaScript kunnen lezen. |
| Indexering | Gebruik absolute canonical URL zonder meetparameters, SEO-titel, metaomschrijving, passende `BlogPosting` of `Article` JSON-LD, echte auteur, eerste publicatiedatum, inhoudelijke wijzigingsdatum en absolute afbeeldings-URL's. Neem gepubliceerde canonieke routes op in de sitemap. |
| Routehistorie | Titelwijzigingen houden een al gepubliceerde slug vast. Bij bewuste publicatie met een nieuwe slug krijgt de oude URL een permanente redirect. Los eerdere slugs rechtstreeks op naar de huidige canonieke URL. |

Onderscheid redactietoegang van publieke toegang. Concepten en nieuwe conceptrevisies zijn afgeschermd. Controleer rechten bij elke previewrequest, stuur private/no-store en noindex waar passend en houd deze URLs buiten sitemap en publieke zoekresultaten. Publieke pagina's blijven de actuele live-revisie lezen totdat een nieuwe revisie daadwerkelijk live staat.

## Beheer

| Onderdeel | Te behouden gedrag |
|---|---|
| Artikelen | Aanmaken, terugvinden, bewerken als revisie, afgeschermd bekijken, concept opslaan en publiceren. Laat conceptstatus en live-status gelijktijdig zien waar beide bestaan. |
| Identiteit | Titel, bewerkbare slug en zichtbaar URL-voorstel, type blog/artikel, taal, auteur, categorie, tags en samenvatting. Herleid slug automatisch zolang de redacteur hem niet heeft vastgezet. Laat conflicten zien bij het veld. |
| TipTap | Gebruik het gestructureerde documentmodel en één gedeelde extensieset voor bewerken, valideren en renderen. Ondersteun opmaak en sneltoetsen, H2–H4, lijsten, taken, links, quotes, scheidingslijn, tabellen, afbeeldingen met alt-tekst, undo/redo, plakverwerking, selectie- en invoegbediening en een inhoudsopgave uit koppen waar getoond in het prototype. Valideer elke ingestuurde node en mark en verwerk het plakken van HTML volgens het toegestane schema. |
| SEO | SEO-titel en omschrijving, canonieke URL als afgeleide waarde, zoekresultaatvoorbeeld en voorbeeld van de socialkaart. Tekstlengte is redactionele feedback. Valideer verplichte inhoud, links, koppen en toegankelijk beeld met concrete terugkoppeling. |
| Media | Upload of selecteer een portret-hero, vul alt-tekst in en bepaal het focuspunt op het beeld. Toon de gekozen uitsnede. Laat een afzonderlijk breed deelbeeld toe. Asset-ID, type en afmetingen komen uit de gecontroleerde serververwerking. |
| Publiceren | Laat publicatie- en revisieconflicten terugkomen in de interface. Een wijziging mag de openbare artikelversie pas aanpassen na geslaagde publicatie. |

Bewaar redactionele inhoud in één CMS- of databasebron. Zet Markdown van SocialHero om naar het gevalideerde documentmodel of map het veilig naar het bestaande CMS-formaat. Publieke weergave en SEO komen uit dezelfde gepubliceerde revisie. Inhoud en gegenereerde fragmenten mogen geen uitvoerbare HTML of gevaarlijke URL-schema’s introduceren. Bewaar afbeeldingsreferenties aan eigen assets. Gebruik bij optionele embeds alleen een gecontroleerde provider- en attributenlijst als de editor en renderer die beide ondersteunen.

## SocialHero

Voeg per website en omgeving een verbinding toe onder de bestaande beheerstructuur. Gebruik de wizard voor websitebasis-URL, omgeving, type, servercredential, taal, standaardauteur, categorie en beschikbare beeldpresets. Lees ondersteunde velden, routes en limieten via capabilities of het bestaande CMS. Ondersteun read-only verbindingstest, herverbinden en ontkoppelen, met een expliciete schrijfproef op development of staging. Het scherm toont hoogstens gemaskeerde credentialgegevens.

Maak per goedgekeurde campagne een zelfstandig blog of artikel met zoekintentie, relevante trefwoorden, geverifieerde feiten, passende interne links, voorbeelden en CTA. Vul alle websitevelden, beeld en alt-tekst vooraf in en houd ze bewerkbaar vóór goedkeuring. Geef een verdiepend artikel een eigen invalshoek wanneer dezelfde campagne ook een blog bevat. Gebruik de bestaande revisie- en goedkeuringsflow zodra inhoud of bestemming na akkoord verandert.

Leg de goedgekeurde revisie vast. Upload definitieve media, lever het concept af, publiceer volgens de bestaande planning en controleer de publieke pagina. Bewaar tijden in UTC en toon ze in de projecttijdzone. Maak status en vervolgactie zichtbaar. Koppel socialposts aan de geverifieerde publicatie, met hun eigen meetparameters en een schone canonieke URL voor de website. Volg [SOCIALHERO-CONTRACT.md](SOCIALHERO-CONTRACT.md) voor contract, hervatten en statusovergangen.
