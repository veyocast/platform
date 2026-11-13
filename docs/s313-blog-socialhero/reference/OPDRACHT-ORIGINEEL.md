Ik wil op de publieke pagina een blog systeem hebben, met perfecte SEO optimalisatiemogelijkheden en een koppeling met SocialHero. Ik wil dat je gebruik maakt van alle moderne mogelijkheden van de TipTap editor om blogs te kunnen maken, ik wil dat indien een bericht gedeeld wordt op social media kanalen de hero image meegenomen wordt, etc. het moet perfect zijn. Onderstaande zijn de werkzaamheden die naar Codex moeten om de koppeling in orde te krijgen, maar ik wil dat jij in het bestaande prototype alvast het blogsysteem toevoegt, daarna een overdrachtspakket maakt voor Codex om alles pixelperfect over te nemen.







CODEX-OPDRACHT — BLOGBEHEER EN AUTOMATISCHE PUBLICATIE MET SOCIALHERO



Gebruik deze opdracht per website. Plak de volledige prompt eerst in Codex in de repository van de doelwebsite en laat deel A uitvoeren. Gebruik dezelfde prompt daarna in de SocialHero-repository voor deel B. Deel B wordt één keer gebouwd en vervolgens per project ingesteld. Deel C is het gedeelde contract voor beide kanten als er nog geen bruikbare integratie bestaat.



Vul in wat bekend is. Laat Codex ontbrekende gegevens uit de repository bepalen of als configuratie opleveren.



WEBSITE_NAAM   = DartFlow

WEBSITE_URL    = https\://dartflow\.nl

TEST_URL       = https\://staging.dartflow\.nl

BLOGPAD        = /blog

TAAL           = nl-NL

STANDAARDAUTEUR = WEBSITE_NAAM

OMGEVING       = allen

UIT TE VOEREN  = A: doelwebsite / B: SocialHero



Doel: na één goedkeuring van een campagne maakt SocialHero de SEO-blog of het artikel met beeld, levert het als concept aan bij de juiste website en publiceert het op de geplande tijd. De website geeft de definitieve openbare URL terug. Blogvelden zijn automatisch ingevuld en blijven in concept bewerkbaar. De beheerder voert per website eenmalig de koppeling en eventuele standaardwaarden in.



A. DOELWEBSITE — BLOG, BEHEER EN ONTVANGST VAN CONTENT



Inspecteer het bestaande CMS, de database, contenttypes, URL-structuur, authenticatie, mediaverwerking en deployflow. Hergebruik het blog en de beheerinterface als die bestaan. Gebruik bij een bestaand CMS bij voorkeur de bestaande API als die veilige mediaverwerking, concepten, revisies en betrouwbare publicatie ondersteunt. Bouw zo nodig een compatibele adapter. Gebruik één bron van waarheid voor artikelen. Als de site geen blog heeft, voeg een overzicht en detailroute toe, bijvoorbeeld /blog en /blog/[slug], in de bestaande huisstijl. Voeg de nodige migraties toe aan de bestaande releaseworkflow.



Voeg aan bestaand, beveiligd beheer een blogeditor toe of breid die uit. Ondersteun:



Titel, met een automatisch slugvoorstel dat de redacteur kan aanpassen. Toon de resulterende URL. Normaliseer de slug en dwing uniciteit af per werkelijke route-scope, bijvoorbeeld per taal als de taal in het pad zit. Een bestaande slug van een ander artikel geeft een duidelijk conflict. Een titelwijziging wijzigt een gepubliceerde slug pas na een bewuste URL-wijziging. Bewaar bij een bewuste wijziging een permanente redirect van de vorige openbare URL.



Type (blog of artikel, passend bij het CMS), samenvatting, inhoud, taal, auteur, categorie en tags. Gebruik Markdown zonder uitvoerbare HTML of het bestaande gestructureerde rich-textformaat. Laat redacteuren artikelen handmatig aanmaken en wijzigen.



SEO-titel en metaomschrijving, hero-afbeelding met alt-tekst en focuspunt, en een optionele brede deelafbeelding. Bij handmatige artikelen mag een gewone upload het beeld leveren. Bied een afgeschermde preview, concept opslaan, publiceren en bewerken als revisie. Laat bij een revisie de huidige openbare versie beschikbaar tot de nieuwe versie wordt gepubliceerd.



Gebruik op de publieke pagina de titel als H1 en artikelinhoud met een logische koppenstructuur. Toon een portret-hero passend bij desktop en mobiel met de gekozen uitsnede en alt-tekst. Gebruik waar beschikbaar de aparte brede deelafbeelding voor Open Graph. Render SEO-titel, metaomschrijving, absolute canonical URL en passende Article- of BlogPosting-gegevens met werkelijke auteur, datums en afbeeldings-URL’s. Neem openbare canonieke blog- en artikel-URL’s op in de sitemap en werk die samen met de detailpagina en lijstcache bij na publicatie. Houd concepten, previews en testartikelen buiten publieke routes, zoekresultaten en sitemap. Gebruik de cachetechniek passend bij de bestaande frameworkversie. Laat publiceren zonder herdeploy werken als de huidige hosting runtime- of CMS-content ondersteunt. Gebruik anders de bestaande build- of revalidatiehook en meld pas ‘live’ zodra de nieuwe versie aantoonbaar bereikbaar is.



Richt een afzonderlijke serverkoppeling in per website en omgeving. Gebruik HTTPS buiten de lokale ontwikkelomgeving. Scope het credential tot die site en alleen de benodigde media- en blogrechten. Bewaar het server-side, ondersteun intrekken en roteren en laat tokens weg uit UI-responses, logs, querystrings en repository. Houd de OpenAI-sleutel bij de AI-configuratie van SocialHero. De blog-API werkt zelfstandig ten opzichte van de meetpixel. Pas server-side validatie, payloadlimieten en rate limiting toe. Valideer de werkelijke media-inhoud en bestandsgrootte. Serveer publieke media via de bestaande mediahost of opslag. Gebruik eigen asset-ID’s om uploads te koppelen en behandel rich text en links als onbetrouwbare invoer.



B. SOCIALHERO — WEBSITEKOPPELING EN UITVOERING



Breid de bestaande websitekoppeling uit of voeg onder Beheer → Websites / Blogpublicatie per project een wizard toe. Vraag websitebasis-URL, omgeving, koppelingstype en servercredential. Lees waar mogelijk het blogpad, toegestane inhoudstypen, afbeeldingsvereisten, uploadlimieten en auteurs/categorieën uit capabilities of de bestaande CMS-API. Toon taal, standaardauteur, categorie en eventueel een portret- en deelbeeldpreset als instelbare defaults. Ondersteun opslaan, verbinding testen, opnieuw verbinden en ontkoppelen. Laat de verbindingstest standaard alleen lezen en toon welke site, omgeving en mogelijkheden zijn geverifieerd. Bied in development of staging een expliciete concept- en mediatest. Gebruik in de UI alleen gemaskeerde credentialinformatie.



Genereer per goedgekeurde campagne een zelfstandig bruikbaar, inhoudelijk diepgaand blog of artikel. Vul titel, voorgestelde slug, samenvatting, inhoud, SEO-titel, metaomschrijving, categorie, tags, interne links, hero en alt-tekst in. Gebruik zoekintentie, relevante trefwoorden, geverifieerde bronfeiten, concrete voorbeelden en een passende CTA. Geef een verdiepend artikel een eigen invalshoek wanneer de campagne ook een blog bevat. Houd websitevelden bewerkbaar in het campagneconcept. Volg het bestaande revisie- en goedkeuringsmodel wanneer iemand na akkoord inhoud of bestemming wijzigt.



Gebruik de bestaande planning en werkvoorraad van SocialHero. Zet na akkoord de goedgekeurde revisie vast. Upload de definitieve media, maak een websiteconcept en bewaar de teruggegeven artikel- en revisie-ID. Roep publicatie aan op het geplande tijdstip. Sla tijd in UTC op en gebruik de gekozen tijdzone in de UI. Controleer vlak voor uitvoering of het project, de bedoelde websiteverbinding, de geplande revisie en het websitekanaal nog geldig en actief zijn. Verifieer de canonieke URL op de geconfigureerde website: de pagina moet openbaar en succesvol bereikbaar zijn en overeenkomen met de verwachte publicatie. Laat afhankelijke socialposts pas daarna verdergaan met die URL en hun eigen meetparameters. Houd de openbare canonical URL zelf vrij van campagneparameters.



Toon per artikel concept, ingepland, bezig, wacht op website, live of aandacht nodig. Bewaar externe ID, canonieke URL, publicatietijd, revisie, foutcode en laatste poging. Bij een onduidelijk resultaat door een time-out lees je eerst de status via de externe ID. Probeer tijdelijke netwerkfouten, 429 en tijdelijke 5xx begrensd opnieuw, met respect voor Retry-After waar opgegeven. Ongeldige gegevens, autorisatieproblemen en revisie- of slugconflicten vragen een concrete correctie. Gebruik de oorspronkelijke idempotentiesleutel bij herhalen van dezelfde operatie. Een wijziging of publicatie van een nieuwe revisie is een nieuwe operatie.



C. GEDEELD API-CONTRACT ALS STANDAARD



Gebruik het al bestaande SocialHero-publicatiecontract als dat aanwezig en geschikt is. Leg dan vast hoe onderstaande stappen en velden daarop worden gemapt. Als er nog geen geschikt contract is, implementeer aan beide kanten deze versie. Alle paden hieronder vallen onder /api/socialhero/v1. Verzoeken zijn server-to-server met Authorization: Bearer \<site-token>. Gebruik voor lokale tests de bestaande appconfiguratie. Toon in voorbeelden alleen placeholders.



GET  /capabilities                Lees site-ID, omgeving, contractversie, blogpad,

schrijf- en publicatiemogelijkheden, mediaformaten

en limieten, en beschikbare velden of taxonomieën.

POST /media                       Upload bestand via multipart/form-data. Retourneer

assetId, width, height en type. Gebruik een aparte

idempotentiesleutel per te uploaden bestand.

PUT  /posts/{externalId}          Maak een concept of werk de conceptrevisie bij.

Retourneer site-ID van het artikel, externalId,

revision en status. Vereis een verwachte revisie

bij updates, bijvoorbeeld via If-Match.

GET  /posts/{externalId}          Lees concept- en publicatiestatus, met afzonderlijke

conceptrevisie en live-revisie als die uiteenlopen.

POST /posts/{externalId}/publish  Publiceer de expliciet meegestuurde revision.

Retourneer status, id, externalId, publishedRevision,

publicUrl en publishedAt zodra beschikbaar.

Geef 202 met een uitleesbare status bij asynchrone

verwerking. Meld ‘published’ alleen na verwerking.



Gebruik als externalId een stabiel SocialHero-content-ID per artikel en bestemming. Voor ieder schrijvend verzoek ontvangt de server een Idempotency-Key. Leg het verzoekresultaat duurzaam vast per site, operatie en sleutel. Een herhaling van dezelfde operatie met dezelfde inhoud levert hetzelfde resultaat. Dezelfde sleutel met andere inhoud of een onverwachte revisie geeft een conflict. Borg unieke slugs en externe ID's ook in de database. Leg foutcodes vast die de wizard kan tonen, zoals SLUG_CONFLICT, REVISION_CONFLICT, INVALID_MEDIA en PERMISSION_DENIED.



Voorbeeld van een conceptpayload voor DartFlow. Alle waarden en media-ID’s zijn illustratief. Content in productie bestaat uit het volledige artikel.



{

"type": "blog",

"locale": "nl-NL",

"title": "Zo organiseer je een darttoernooi in je club",

"slug": "darttoernooi-organiseren-club",

"excerpt": "Een praktisch draaiboek voor inschrijving, speelvorm en scoreverwerking.",

"content": {

"format": "markdown",

"body": "## Kies je speelvorm\nBegin met het aantal spelers, beschikbare banen en tijdsloten. Kies daarna welke indeling bij de clubavond past."

},

"seo": {

"title": "Darttoernooi organiseren in je club | DartFlow",

"description": "Plan je darttoernooi met een praktisch draaiboek voor inschrijvingen, banen, speelvorm en live scores."

},

"authorId": "redactie",

"categoryId": "toernooien",

"tags": ["darts", "darttoernooi", "clubavond"],

"hero": {

"assetId": "media-hero-voorbeeld",

"alt": "Een vrijwilliger bemant de wedstrijdtafel tijdens een darttoernooi.",

"focalPoint": {"x": 0.55, "y": 0.4}

},

"ogImageAssetId": "media-deelbeeld-voorbeeld"

}



De website leidt echte beeldafmetingen af uit de upload. Focuspunten zijn relatieve waarden van 0 tot 1, gemeten vanaf links en boven. Het publicatieantwoord bevat een absolute canonieke URL, bijvoorbeeld https\://dartflow\.example/blog/darttoernooi-organiseren-club. SocialHero controleert het doeldomein en elke eventuele redirect. Gebruik voor ingestelde website-URLs de bestaande veilige server-fetch en houd test- en productiebestemmingen en credentials gescheiden.



D. ACCEPTATIE EN OPLEVERING



Vanuit SocialHero lukt een read-only verbindingstest met de juiste site en omgeving. Verlopen, verkeerd gescopete of ontbrekende tokens geven een duidelijke fout zonder gegevens te lekken.



Een lokaal of staging-testartikel doorloopt automatisch media → concept → planning → publicatie → openbare URL. Het concept is voordien alleen via bevoegde toegang zichtbaar. De live blog heeft de juiste titel, slug, portret-hero, alt-tekst, metadata, canonical URL en sitemapvermelding. Gebruik een testbestemming voor deze end-to-end proef.



Herhaal media-upload, concept en publicatie. Simuleer een timeout na een geslaagde write. Er blijft één artikel en één logisch resultaat per operatie. Twee verschillende artikelen met dezelfde slug leveren een zichtbaar conflict. Een oudere job kan geen nieuwere revisie overschrijven.



Bewerk een reeds gepubliceerd artikel. De oude inhoud blijft live tot publicatie van de nieuwe revisie. Een gewone titelwijziging behoudt de URL. Bij een expliciete slugwijziging verwijst de oude URL permanent naar de nieuwe.



Pauzeer de koppeling of maak de blog-URL tijdelijk onbereikbaar. Afhankelijke socialposts wachten. Na herstel kan dezelfde publicatie verder zonder dubbele posts of blogs.



Lever per repo het gebruikte contract, blogpad, benodigde configuratievelden zonder geheime waarden, toegepaste migraties, lokale test-URL en werkelijke testresultaten op. Benoem welke verbinding met een echte website en welke met een testadapter is gecontroleerd.



Technische referenties



Google Search Central, artikelgegevens: https\://developers.google.com/search/docs/appearance/structured-data/article



Google Search Central, sitemap: https\://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap



Next.js App Router, cacheverversing waar toepasselijk: https\://nextjs.org/docs/app/api-reference/functions/revalidatePath



OWASP, REST API-beveiliging: https\://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/REST_Security_Cheat_Sheet.md
