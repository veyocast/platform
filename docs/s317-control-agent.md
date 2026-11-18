# S317 — Bevestigde Control-agent

## Afbakening en bron

Opdracht van 18 november 2026, actuele main vooraf bevestigd als
`67d8470198acec4272c47c4c7979b6071a915c4b`. S315/PR344 bevat de afzonderlijke
refresh-/database-/Workeroptimalisaties. S316/PR345 herstelt thema versus Media
voor alle verenigingen, onafhankelijk van AI. Deze kandidaat volgt hun gewone
commits; workflows, omgevingen, secrets, dependencies, locked assets, Player,
serviceworker en bestaande dynamische renderers zijn niet aangepast.

## Werkelijke acties

De agent gebruikt de actieve serversessie, tenant, tijdzone en bestaande
capabilities. Leesvragen gebruiken actuele tools, met begrensde paginering en
expliciete more-indicatie; geen globaal tenantcache of onbeperkte databasequery.
De chattaal volgt de beheerder; de bestaande Control-interface is Nederlands.

| Onderdeel | Geïmplementeerd |
|---|---|
| Schermen | Zoeken/lezen, naam wijzigen met updated-at-CAS, groepen toewijzen |
| Groepen | Zoeken/lezen, aanmaken/bewerken/archiveren via bestaande groeps-RPC |
| Players | Doeltoewijzing, gemelde actieve release, laatste contact, syncfase en foutcode lezen; geen extra devicebeheermacht |
| Media | Zoeken/lezen, hernoemen, archiveren en herstellen met bestaande gebruikscontrole |
| Studio | Actueel document lezen; vrij ontwerp aanmaken/bewerken; metadata hernoemen, dupliceren, archiveren, herstellen/verwijderen via gewone services |
| Dynamische slides | Zoeken/lezen en bestaande gepubliceerde slide aan playlist toevoegen; brongebonden inhoud blijft in eigen Sportlink/RSS/Menu/Twelve-editor |
| Playlists | Aanmaken, gegevens/defaults, media toevoegen/vervangen/verwijderen, duur/presentatie, exacte vermelding ordenen/dupliceren, secties beheren, archiveren/herstellen/dupliceren/verwijderen |
| Planning | Effectieve programmering lezen, v2-regels aanmaken/bewerken/in-/uitschakelen/verwijderen met echte conflictcontrole |
| Publicatie | Bestaande gedeelde readiness/preflight en publish-to-targets-v3, onveranderlijke release en bestaande targets/verversing |

Niet gekoppeld: vrije SQL, financiële/platformacties, devicecredentials,
onbeperkte bronnenbeheeracties, dynamische providerconfiguratiebewerking,
videosynthese en Studio-render/export aanvragen vanuit de agent. Een nieuw
Studio-concept opent de normale editor voor render/export. Ontbrekende acties
worden expliciet naar de gewone editor verwezen, niet gesimuleerd. Het oude
brongebonden document kan ook via de directe agent-RPC niet door een vrije
Studio-save worden vervangen.

## Voorstel, akkoord en herstel

Toolcalls zoeken eerst concrete eigen objecten en kunnen alleen een voorstel
maken. Eén gerichte verduidelijkingsvraag met keuzes voorkomt gegokte doelen.
Voorstellen tonen namen, IDs, exacte itemidentiteit, volgorde-/duurwijzigingen,
lokale tijden plus oorspronkelijke ISO-tijd, doelschermen en gedeelde gevolgen.
De bereikquery omvat ook actuele groepsdefaults, planningsdoelen en actieve
compositionbindings; vóór iedere playlist-/planningsstap wordt dat bereik opnieuw
met het getoonde voorstel vergeleken. Een veranderd schermbereik blokkeert de
stap en vraagt een aangepast voorstel, zonder nieuwe rechten te geven.
Gewone naam-/tekst-/duurvelden zijn direct bewerkbaar; volledige stapgegevens
zijn aanvullend beschikbaar. Wijzigen maakt een nieuwe immutable voorstelhash;
oude niet-goedgekeurde voorstellen in hetzelfde gesprek worden geannuleerd.
Expliciet vervangen controleert ook de oude hash en uitvoercursor.

SQL bindt akkoord aan tenant, gebruiker, SHA256 van opgeslagen JSON en de
exacte stap. Iedere stap hercontroleert huidige capabilities, actieve tenant,
agentschakelaar, objectversie en normale domeinvoorwaarden. De wijziging en
receipt committen atomisch. Verloren antwoorden, dubbelklikken en hervatting
geven dezelfde receipts; een vertraagde cursor kan geen volgende stap uitvoeren.
Bij gedeeltelijke fouten blijven eerdere receipts en objecten behouden.
Revisieconflicten vragen een nieuw voorstel, geen blinde overwrite.

Publicatie/planning vereisen een kort geldige server-only preflightproof voor
dezelfde hash/gebruiker/tenant/stap. De browser kan die niet maken. Concrete
waarschuwingen worden apart getoond; toestemming is aan hun huidige hash en
stap gekoppeld. Een gecombineerde wijziging-plus-publicatie stopt na bevestigde
conceptopslag vóór publicatie: het vernieuwde werkelijke playlistvoorbeeld en
de afzonderlijke publicatiestap moeten eerst worden gecontroleerd. Dit voorkomt
dat een nog niet bestaand/gewijzigd concept als exact previewbewijs wordt gebruikt.

Studio gebruikt het bestaande Konva-canvas met het echte document en originele
geautoriseerde beelden. Playlists gebruiken dezelfde gewone preview, inclusief
Sync-/Menu-DOM en vastgezette media-ontwerpen, in 16:9 of 9:16. Geen signed URL
in voorstelhash of verbruiksregistratie. Publicatie wordt nooit gelijkgesteld
aan ontvangst: devicebevestigingen tonen de gemelde actieve release en leeftijd.

## Bijlagen en beeldgeneratie

Meerdere afbeeldingsbestanden en MP4/WebM zijn beschikbaar via hetzelfde gesprek.
Bestaande MIME-/byte-/pixel-/decoderlimieten, batches, TUS met 6-MiB-chunks,
hervatten, originele bestanden, thumbnails en playervarianten blijven gelden.
Ook een chunked afbeeldingsbody is begrensd vóór multipartparsing. Een privé-ID
wordt vóór afbeeldingsinvoer gereserveerd; video-intent plus privéregistratie
committen samen. Andere leden, gewone Media-lijsten en normale assetreferenties
krijgen onbewaarde privébijlagen niet te zien of te gebruiken. De eigenaar kan
TUS HEAD/resume uitvoeren. Gereedheid blijft een echte verwerkingstoestand.

Behoud/gebruik vereist een aparte goedgekeurde retain-stap. Een FK-boundaryguard
voorkomt een omweg via een normale domein-RPC. Uploadretry bindt hetzelfde ID aan
een inhouds-/naam-/titelhash. Het nieuwste eigen gesprek en zijn serverbijlagen
blijven na heropenen beschikbaar; voor onderbroken TUS moet de gebruiker het
oorspronkelijke lokale bestand opnieuw aanwijzen. Gesprekstekst staat alleen in
de huidige browsersessie; voorstellen/receipts en bijlagen zijn duurzaam.

Ongebruikte privébijlagen vervallen na zeven dagen. Eén begrensde Worker-runner
controleert leases, normale FK- én documentreferenties en exacte tenantpaden.
Gedeelde/retained/gepubliceerde media worden niet verwijderd. Processing blijft
beschermd. Storage wordt eerst verwijderd, pas daarna variantmetadata bevestigd;
een mislukte verwijdering blijft hervatbaar met lease. Idle één controle per uur,
foutretry na vijftien minuten, maximaal twintig kandidaten per batch. Deze privacy-
opruiming blijft nodig bij AI-uit; zij start geen agentbeheeractie of providercall.

De server gebruikt officiële Responses- en Images-generation/edit-API's, geen
SDK met verborgen retries. De beheerder kiest expliciet het betaalde voorbeeld;
een agentsuggestie genereert niets vanzelf. Ingezonden beelden zijn onbetrouwbaar
bronmateriaal, nooit instructie of akkoord. Formaat/kwaliteit zijn begrensd;
vervolgens gaat het PNG-resultaat door de gewone veilige beeldverwerking.
Originele logo's blijven aparte originele assets. Exacte titel, datum, tijd en
sponsorinformatie zijn bewerkbare Studio-tekst. Tekst die niet past wordt geweigerd,
niet onzichtbaar afgekapt of onbegrensd verkleind. Passen en bijsnijden zijn zichtbaar.

## Platform, sleutel en verbruik

Platform → Integraties → OpenAI (`/platform/integrations/openai`): bestaande
projectsleutel invoeren/vervangen/testen/intrekken met platformrechten en AAL2.
Alleen AES-256-GCM ciphertext/IV/tag wordt opgeslagen, met externe bestaande
SPORTLINK_CONFIG_ENCRYPTION_KEY en aparte domeinscheiding. Geen nieuwe secret,
geen plaintextteruggave, logs, browserbundle of Playerconfig. Modelnamen zijn
configureerbaar; de test controleert beide modellen tegen de echte projectlijst.
Defaults gpt-5.4-mini en gpt-image-1.5 zijn geen bewijs van projecttoegang.

Platform → Vereniging → Productuitrol → AI-agent inschakelen gebruikt het normale
v2-rolloutcontract met revisie, idempotentie, AAL2 en audit. Nieuwe en bestaande
verenigingen krijgen geen activatierij: standaard uit. Uitzetten blokkeert nieuwe
provideradmissie en iedere volgende uitvoerstap; bestaande handmatige functies
en uitzendingen zijn onafhankelijk. Reeds toegelaten providerverzoeken kunnen
kosten veroorzaken; hun uitkomst wordt geregistreerd en na uitschakelen niet
gebruikt. Reeds ontvangen privébestanden mogen veilig hun normale verwerking
afronden, maar worden niet automatisch bewaard/gepubliceerd.

Eén centrale betaalde-checkpoint controleert tenant/rechten/flag/configuratierevisie
en reserveert een uniek requestrecord vóór fetch. Sleutelrotatie invalideert oude
admissie. Iedere echte poging heeft een apart request-ID bij dezelfde operatie-ID.
Opslag: tenant, actor, omgeving, tijd, bewerking, model, operatie/request-ID,
provider-request-ID, status en gerapporteerde tokenvelden/returned_images.
Onbekend blijft null, niet nul. Settlement overschrijft nooit een terminale poging.
Geen prompts, bestanden, sleutelwaarden, ongefundeerde kosten of facturatieclaims.
Een timeout wordt unknown; de server herhaalt een betaalde call nooit automatisch.

`ai_provider_requests` is met RLS opvraagbaar op tenant/created_at/operation, met
samengestelde periode-index en operatie-index; gewone leden kunnen geen gebruik
vervalsen. Tenant-settingsbeheerders lezen hun tenant; platformbeheerders hun
bevoegde scope. Dit is de voorbereide reserveren/verrekenen-grens voor latere
gelijktijdig veilige maandquota. Dashboard, quota, meldingen en facturatie zijn
uitdrukkelijk vervolgwerk, geen stilzwijgend geleverde functionaliteit.

## Bewijs, uitrol en grenzen

De laatste normale hosted-Controlgate vond tweemaal een bestaande meetrace in
de ongewijzigde Goal-readinessproef, bij afwisselend1440/390px. Beide traces
geven de referentiebouwer width0/height0/fontSizeleeg: de fonts-ready-remount had
juist de gemeten fallbacknode losgekoppeld. Het origineel slaagt lokaal20/20,
maar dat neemt de echte CI-rood niet weg. Na expliciete scope-/stoprapportage
wacht uitsluitend die test op het daadwerkelijk ontkoppelen van de oorspronkelijke
fallbacknode en de zichtbare definitieve canvas, en eist positieve afmetingen.
Alle bestaande strikte font-/rendererpariteit, leesbaarheid, focus, invoer,
fout-/writeasserties en deadlines blijven behouden; geen productpreview,
locked renderer, Player of workflow aangepast. Beide gevallen elk twintigmaal:
40/40 groen in2,9min; foundation ieder32/32 met32/32/31cachehits. Nieuwe
volledige exacte-head-gates blijven vereist.

Aanvullende pre-uitrolreview: twee nieuwe echte Storage-RLS-proeven waren rood
wanneer een eerdere uploader zijn Media-lees- én schrijfrechten kwijtraakte.
Beide private-owner/storage-grenzen controleren die huidige rechten nu ook;
TUS met geldige lees- of schrijfrechten blijft werken. Beide oude rode gevallen
zijn groen. Definitieve ronde:164bestanden/5737SQL-asserties,109gericht,37agent-
units, Control2300PASS34bestaandeSKIP en opnieuw32/32 foundation pergate plus
Controlproductiebuild/auth/secretgrenzen. JPEG/WebP-editbronnen behouden hun juiste
MIME/extensie en een gearchiveerde bron kan vóór de betaalde call niet worden
gebruikt. De volledige normale hostedgates lopen opnieuw op deze correctie;
de vorige kandidaat en zijn bewijzen blijven historische informatie.

De afzonderlijk goedgekeurde lokale reconciliatie is daarna databehoudend
afgerond: vier bestaande functiedefinities hersteld naar de werkelijk
gereconstrueerde main én dezelfde hashes op staging/productie. Alle969functie-
definities en1051semantische structuur-/indexobjecten matchen daarna main.
Functie-identiteiten, ACL’s, beheerde Supabase-bootstrapprivileges, fysieke
kolomvolgorde en alle gegevens blijven behouden;0tenants/0Auth-gebruikers en225
historierijen blijven gelijk. Volledige backup en transactie-/hashreceipt staan
buiten Git. Geen reset en geen herstelwijziging op staging/productie.

Definitieve lokale kandidaat: lint/typecheck/test elk32/32 groen; Control2297
PASS/34 bestaande SKIP, Worker458PASS/343 bestaande native-conditionele SKIP.
De verplichte native Sites-/Player-workflows blijven volledig vereist. Eigen
agentunits34/34, cleanupunits9/9; alle164 SQL-bestanden en5735asserties groen,
waarvan107 nieuwe gerichte assertions. Gecombineerde echte Workspace-/thema-
browserproeven42/42 groen (2,1min), met9 agentgevallen, axe, mobiel/toetsenbord,
meerdere privébeelden, expliciete generatieknop, behoud bij mislukte read en
ontvangst van de specifieke receipt-release op uitsluitend gekozen schermen.
Controlproductiebuild, auth-/client-secretboundaries en Workerbuild slagen.

Een extra SQL-tegenproef maakte twee echte orderfouten zichtbaar in de eerste
kandidaat: legacy sort_order verschoof wel, maar position_key en de echte
immutable publicatie niet. De agent gebruikt nu de bestaande v2-volgordeservice
met de canonieke position_key, niet een eigen sorteermodel. Beide oorspronkelijke
rode assertions en de echte publicatie zijn daarna groen. De normale UI/DnD-
services zelf zijn niet gewijzigd.

Een tijdelijke lokale Config-rood kwam uitsluitend door de gegenereerde
`.next-qa`-serverbundel in de broncodewalker. Het eigen buildartifact is buiten
de repository bewaard; de ongewijzigde echte bron-/secretgraphgate is opnieuw
11/11 groen. Geen ignorelijst of securitygate versoepeld. De finale gewone
productiebuild staat in de normale `.next`-uitvoer.

Kandidaat-SHA, volledige hostedgates en live rolloutbewijzen worden bij de PR en
workflowruns vastgelegd. Deze broncommit claimt geen reeds uitgevoerde uitrol.
Vooraf zijn beide live omgevingen op67d8470 en migratie20261113124946 bevestigd;
S315-index/agenttabellen ontbraken en nul verenigingen hadden een AI-activatie.

- Gerichte provider-/crypto-/input-/kosten-/scope-/bodyproeven met gecontroleerde
  transporten; echte SQL-domeinservices voor opslag, ordening, publicatie naar
  twee schermen, receipts, herhaling, partial failure, stale revisions en flag-uit.
- Privévideo-intent, werkelijk Storage-metadata/RLS, TUS-resumefinalisatie en
  exact één bestaande verwerkingsjob worden SQL-getest; geen eigen mockfinalizer.
- Echte Workspace-browsercomponent: verduidelijking, gedeelde schermen, bewerken,
  annuleren, exact akkoord, risico-hash, toetsenbord, mobiel390/desktop1440 en axe.
  Alleen servertransporten worden gecontroleerd; geen nep-ingelogde productieclaim.
- De gedeelde lokale database is niet gereset. Een dumpkloon bleek functioneel
  af te wijken van main ondanks haar migratiehistorie. Daarom zijn alle actuele
  applicatiemigraties met echte postgres-eigendom in een aparte wegwerpdatabase
  opnieuw opgebouwd en met de gewone seed getest. Eerste volledige schone ronde:
  163 SQL-bestanden groen; de definitieve extra domeinproef wordt opnieuw meegenomen.
- Volledige foundation/build/hostedgates en exacte live revisies worden per
  kandidaat/run geregistreerd. Een dispatch of groene build is geen live bewijs.

Op dit moment is geen projectsleutel verstrekt of aangebracht, geen vereniging
geactiveerd en geen echte provideroproep verricht. De gebruiker kiest uitsluitend
het beveiligde platformformulier. Een aangewezen stagingtestvereniging/account
en de nieuwe Tailscale-toegangscontrole zijn gevraagd maar nog niet bevestigd.
Geen fysieke LG-/Android-, live betaalde provider- of ingelogde hosted schrijfclaim.
Een ontbrekende sleutel blokkeert het onafhankelijke themaherstel of de normale
deployment niet; AI wordt niet ongemerkt bij klanten aangezet.

## Wanneer schermen wijzigen

Agentwijzigingen gebruiken exact de normale immutable publicatie/targetflow.
Na een bevestigd opgeslagen playlistconcept verandert de uitzending nog niet.
Na geslaagde publicatie halen online moderne/LG-players hun normale manifest
op (bestaand circa acht seconden plus maximaal750ms jitter na de vorige read),
downloaden/verifiëren alle gewijzigde assets en wisselen op de veilige item-/loop-
grens. Dynamische gegevens hebben daarnaast de eigen providerpolicy, Worker-
wakeup/fallback en eventuele legacy-binary-cooldown; zie S315 voor de hele keten.
Geen universele bron-tot-schermgrens zonder itemduur/provider- en netwerkcontext.
Offline houdt de player de laatste complete werkende release. De agentstatus
leest zichtbare online devicebevestigingen iedere acht seconden tot ontvangst,
maximaal tien minuten; geen overlap tijdens een lopende read en geen achtergrond-
polling bij een verborgen/offline tab. Daarna kan de beheerder gericht hercontroleren.
