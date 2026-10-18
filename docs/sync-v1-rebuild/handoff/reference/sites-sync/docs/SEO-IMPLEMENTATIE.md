# Publieke VeyoCast-website — SEO en productieovergang

Datum: 17 oktober 2026. Publieke referentie: https://veyocast.dgwebserv.chatgpt.site. De website en werkplek gebruiken één bronbasis met afzonderlijke entrypoints. SEO-optimalisatie maakt de site begrijpelijk en toegankelijk voor bezoekers en zoekmachines; dit document belooft geen ranking, indexering of rich results.

## 1. Publieke informatiearchitectuur

Elke route heeft een eigen inhoudelijke titel, omschrijving, H1, intro, relevante interne links en canonical. De routekaart en teksten staan in `src/Marketing.tsx`. De zichtbare navigatie verbindt platform, toepassingen, koppelingen, players, narrowcasting-uitleg en demo.

| Route | Hoofdonderwerp / zoekintentie | Inhoud en conversie |
|---|---|---|
| `/` | VeyoCast narrowcasting | Merkhero, productvoorbeeld, maak/plan/publiceer, toepassingen, thema’s, koppelingen, player, FAQ, demostap |
| `/narrowcasting/` | Wat is narrowcasting? | Heldere uitleg, werkwijze en voorbeelden voor verschillende locaties |
| `/functies/` | Narrowcasting software en beheer | Studio, bibliotheek, playlists, planning, schermen, rechten en publicatieketen |
| `/oplossingen/sportverenigingen/` | Narrowcasting voor sportverenigingen | Wedstrijdinformatie, ontvangst, clubnieuws, sponsors, kantine en dagplanning |
| `/oplossingen/horeca/` | Narrowcasting voor horeca / menuschermen | Menu, dagaanbod, sfeer, evenementen, planning en gecontroleerde productimport |
| `/oplossingen/bedrijven/` | Narrowcasting voor bedrijven / ontvangst | Welkom, medewerkersinformatie, nieuws, meerdere ruimtes en locaties |
| `/koppelingen/` | Sportlink, RSS, YouTube, Twelve CSV | Concrete bronmogelijkheden, beschikbaarheid, importproces en beperkingen |
| `/players/` | Narrowcasting player | Hero als opstartbeeld, koppelen, gereedmaken, afspelen, landscape/portrait en herstel |
| `/demo/` | VeyoCast demo / kennismaking | Zelf verkennen, aanvraagformulier, betekenisvolle bevestiging en FAQ |

De content is Nederlands (`lang="nl"`, passende locale). Voeg geen extra plaats-/branchelandingspagina’s met vrijwel dezelfde tekst toe. Publiceer geen verzonnen klantlogo’s, testimonials, gebruikersaantallen, garanties, prijzen of certificeringen. Toon providerclaims met de juiste begrenzing: Twelve-exportimport, online YouTube en dataset-/accountafhankelijke Sportlink.

## 2. Render- en metadata-eisen

De publieke bronentry is `src/marketing-main.tsx`; de Vite-config is `vite.marketing.config.ts`. De werkplek blijft via `src/main.tsx` apart. Publieke pagina’s horen hun relevante tekst en metadata al in de opgevraagde HTML te hebben. Alleen client-side `document.title` aanpassen is daarvoor niet voldoende.

De publieke build voorbereiden vanuit de bronroot:

```sh
npm run build:marketing
MARKETING_SITE_URL=https://veyocast.dgwebserv.chatgpt.site MARKETING_APP_URL='https://veyocast-v1-design-lab.dgwebserv.chatgpt.site/?design=sync' node scripts/prerender-marketing.mjs --dir=dist-marketing --template=marketing.html
```

Het prerenderscript gebruikt de publieke URL-configuratie voor de route-HTML en metadata. Controleer de resulterende bestanden én de gedeployde routes; een geslaagde build bewijst nog niet dat de hosting nested routes met de juiste statuscodes serveert.

De definitieve export/bouw moet per route het volgende leveren:

- HTTP 200 voor bestaande pagina’s en een echte 404 voor onbekende paden.
- Eén unieke `<title>`, beschrijvende meta description en zelfverwijzende absolute canonical.
- Eenduidig beleid voor trailing slashes en redirects; geen dubbele indexeerbare homepage via `marketing.html` of queryvarianten.
- Open Graph- en Twittermetadata met absolute URL’s, juiste titel/omschrijving en een bereikbaar passend merkbeeld.
- `robots.txt` en `sitemap.xml` met uitsluitend publieke indexeerbare canonical URL’s.
- Gestructureerde gegevens die alleen controleerbare zichtbare informatie beschrijven. Gebruik bijvoorbeeld Organization/WebSite, breadcrumbs en waar passend SoftwareApplication; geen verzonnen offers, reviews of waardering. FAQ-markup geeft geen garantie op een zoekresultaatuitbreiding.
- Werkende interne ankerlinks en echte `<a href>`-navigatie; belangrijke bestemmingen mogen niet alleen via klikhandlers bereikbaar zijn.

De app, accountpagina’s, demoqueries, preview-/player-/support-/platformroutes en interne opleverbestanden horen niet in de publieke sitemap. De werkplek krijgt `noindex` en echte toegangscontrole. `robots.txt` is geen beveiliging. Vermijd dat een publieke assetsmap een ZIP met interne mockfixtures beschikbaar maakt; het overdrachtspakket hoort bij de private prototypeplek.

Bij verhuizing naar een eigen productiedomein: pas canonical, sitemap, robotsverwijzing, structured-data IDs, OG URL’s, formulier-originallowlist, navigatie en eventuele redirects samen aan. Gebruik in productie niet het Sites-domein als canonical. Laat oude publieke URL’s waar van toepassing doorverwijzen naar hun inhoudelijke opvolger.

## 3. Merkbeeld, performance en toegankelijkheid

De bestaande Screen Sync-hero blijft de hoofdvisual. Gebruik de geleverde 480/800/1254-pixel WebP-afleidingen met `srcset`/`sizes`. Stel breedte/hoogte of aspect-ratio expliciet in om layoutverschuiving te voorkomen. De primaire hero krijgt prioriteit; beelden lager op de pagina laden lazy. Gebruik waar nodig een aparte uitsnede voor social sharing, met behoud van het hele woordmerk en veilige marges.

Fonts worden lokaal geserveerd. Preload alleen het werkelijk kritische font/beeld; laad niet alle varianten en alle routes alvast. Houd de publieke JavaScriptbundle vrij van AppProvider, tenantseed, adminmodules, devicefixtures en interne bundeldownloads. Lange marketingpagina’s mogen het playerprototype pas openen na de bewuste gebruikersactie.

Gebruik één H1 per pagina en een logische H2/H3-structuur, beschrijvende linkteksten, altteksten voor betekenisvolle beelden en lege alt voor decoratie. Zorg voor skiplink, toetsenbordnavigatie, zichtbare focus, correct geopend/gesloten mobiel menu, gelabelde formuliervelden en leesbare foutmeldingen. De marketinghero en playerintro respecteren reduced motion. Maak lezen of actie nemen niet afhankelijk van hover.

Meet voor de gedeployde productieversie daadwerkelijke laadtijd, visuele stabiliteit en interactierespons op mobiel. Rapporteer de meetmethode en omstandigheden; claim geen Lighthouse-score die niet gemeten is. De bouwacceptatie bestaat uit gerenderde inhoud en gezonde assets/links; echte gebruiksmetingen komen na bereikbaarheid van de omgeving.

## 4. Aanvraagflow en configurator

De huidige demoaanvraag is expliciet lokaal: geen mail, agenda-afspraak of gedeelde inbox. Het formulier bewaart fictieve voorbeeldinvoer in browseropslag en biedt wissen. De publieke marketingorigin en private werkplekorigin delen die opslag niet. De mockaanvragen in de beheeromgeving zijn daarom geen daadwerkelijk ontvangen publieke aanvragen.

Voor productie wordt de keten:

1. Bezoeker kiest toepassing, scherm-/locatieopstelling en gewenste bronnen. Bewaar deze setup-intent bij de verdere demoaanvraag.
2. Formulier valideert naam, e-mail, organisatie, toepassing, schermbereik en vrije toelichting. Behoud invoer bij herstelbare fouten. Server valideert opnieuw; voeg passende abusebescherming toe.
3. De server schrijft een aanvraag met ID, UTC-tijd, bronroute, setup-intent en status naar de administratie. Een idempotency key verhindert dubbele aanvragen bij retry.
4. De eigen beheerinbox ontvangt deze aanvraag met status, verantwoordelijke, notities en historie. Toegang vereist een bevoegde rol.
5. Bevestigings- en notificatie-e-mails lopen via de daadwerkelijke mailketen met verzend-/foutstatus. Een aanvraag mag niet verloren gaan wanneer mail tijdelijk faalt; laat retry/reconciliation toe.
6. De website toont een bevestiging die klopt met de actie: aanvraag ontvangen is geen automatisch geplande afspraak. Een agenda-integratie wordt pas als afspraak benoemd na echte bevestiging.
7. De beheerder kan vervolgstatus wijzigen en de klantgegevens volgens het vastgestelde beleid verwerken/verwijderen. Gebruik een actuele privacy-informatiepagina en echte contactgegevens voordat persoonlijke gegevens live worden verzameld.

De huidige demo-tekst blijft zolang de keten lokaal gesimuleerd is. Verwijder deze pas als serveropslag, inbox, mail en foutherstel werkelijk zijn aangesloten en getest. Plaats geen analytics of tracking vanuit de verwachting dat het voor SEO nodig is; maak inzet en voorkeuren bewust onderdeel van de productieconfiguratie.

## 5. Controle per publieke route

Voor iedere URL vastleggen: statuscode, canonical, titel/omschrijving, één H1, zichtbare routecontent zonder JavaScript, interne links, afbeeldingstatus, OG-metadata, mobiel en toetsenbord. Test ook direct openen/herladen van nested routes, onbekend pad, formulierinvalidatie, lokale demo-wisactie, reduced motion en overgang naar de juiste Sync-werkplek/player.

Publicatiebewijs en uitgevoerde controles staan uitsluitend in `TESTRESULTATEN.md`. Nog benodigde productiegates: werkelijk domein en redirects, server-side aanvraagketen, productieprivacy/contactcontent, mailbezorging, realtime prestatiemeting en eventuele zoekmachinebeheer-/indexeringscontrole.
