# Onafhankelijke eindcontrole S313

De controle omvatte de nieuwe databasekernel, `packages/blog/src/server.ts`, `media.ts`, `document.ts`, `urls.ts`, de Marketing SocialHero- en mediaroutes, de Control-redactie- en mediaroutes en `apps/control/lib/blog-service.ts`. De controle zelf wijzigde geen actieve integratiedatabase. De hieronder genoemde SQL-correctie is afzonderlijk transactioneel getest en vervolgens uitsluitend op de tweede lege lokale acceptance-database gemigreerd.

## Gevonden en afgehandeld

- De SQL-validator gebruikte voor de slug JSON-tekstuitlezing zonder stringtypecontrole. Daardoor konden `123` en `true` rechtstreeks via een bevoegde RPC worden opgeslagen terwijl de publieke Zod-validator een string verlangt. Een read-only probe bevestigde het verschil. De kernel eist nu `jsonb_typeof(slug) = 'string'`; beide typen hebben een publicatievalidatieregressie. De afzonderlijke SQL-proef slaagde met 131 assertions en een volledige rollback.
- UUID-velden accepteren hoofdletters, terwijl PostgreSQL UUID's canoniek in kleine letters teruggeeft. De publieke assetlookup en storagepadvergelijking waren daardoor gevoelig voor letterkast. Dit is aan de bovenliggende implementatie doorgegeven; die normaliseert nu de publieke UUID-lookup, beeld-URL's en media-GET-parameter en heeft gerichte regressies toegevoegd. De UUID-foreign keys in de database waren al ongevoelig voor letterkast.
- De Marketing-media-API liet een parsefout uit `formData()` doorvallen naar de algemene tijdelijke 503-respons. Een native Web API-proef bevestigde dat een ongeldige multipartbody met een syntactisch geldige boundary een `TypeError` geeft. De route vangt dit nu expliciet af als `INVALID_MEDIA` met 422 en heeft een gerichte contractregressie; de uitvoering van die routetest staat in het bovenliggende testbewijs.

## Autorisatie en publicatie

Nieuwe RPC's geven geen anonieme uitvoerrechten. Iedere definer heeft een expliciete lege `search_path`; interne helpers zijn niet exposed. De publieke publicatieview gebruikt `security_invoker=true`. Rijbeleid en kolomrechten geven uitsluitend de huidige gepubliceerde revisie vrij; de conceptpointer en interne redacteur-ID zijn niet publiek. De globale bestaande allowlist van 23 anonieme Player-/publieksdefiners wordt niet uitgebreid.

Control-mutaties vereisen de bestaande geverifieerde sessie, een platformredactiecapability, AAL2 en dezelfde origin. De menselijke JWT bereikt de databaseguards. API-routes controleren de credential en vereiste scope vóór de aanvraagbody en decoder. De server vergelijkt de geconfigureerde publieke origin met de databasebestemming. Service-roletoegang staat uitsluitend in servermodules.

Media worden begrensd gelezen, volledig gedecodeerd en opnieuw gecodeerd met behoud van JPEG/PNG/WebP als formaat. De duurzame intent bestaat vóór de create-only opslagwrite. Een timeout of botsing moet hetzelfde object via lengte en SHA-256-readback bewijzen voordat voltooiing kan plaatsvinden. Menselijke voltooiing kan uitsluitend via een service-only attestatie voor het bestaande receipt, dezelfde actor en dezelfde fingerprint. De mediabucket blijft private; publieke GET's controleren eerst actuele publicatiereferenties en daarna opgeslagen bytes.

Identiteit, revisies, slugreserveringen, routehistorie en publicatiepointers worden transactioneel geschreven. Receipts binden methode, doel, inhoud en preconditie; de oorspronkelijke respons wordt na herautorisatie vóór verouderde revisiecontroles gereplayed. Publieke routes lezen zonder persistente cache, zodat na een bevestigde databasecommit geen los cache-effect nodig is voor zichtbaarheid.

## Validatorvergelijking

Alle velden en attributen zijn vergeleken met de gedeelde JS-validator: veldtypen en maxima, UTF-16-stringlengtes, Unicode-trim, UTF-8-documentbudget, boomdiepte, nodes, marks, ouder-kindstructuur, eigen assetreferenties en voorwaarden voor publicatie. Buiten de gecorrigeerde slugtypegrens is geen andere concrete payload gevonden die door de database publiceerbaar is en daarna door de publieke documentvalidator wordt geweigerd. SQL weigert sommige exotische hostnamen en documenten aan de bytegrens conservatiever; dit gebeurt vóór bevestigde publicatie.
