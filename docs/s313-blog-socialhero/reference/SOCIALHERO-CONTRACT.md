# VeyoCast ↔ SocialHero

Inspecteer eerst beide repositories op een bestaand publicatiecontract. Leg de koppeling per operatie en veld vast als dat contract de vereiste garanties levert. Dit document definieert de fallback bij afwezigheid daarvan.

## Routes en toegang

Alle paden zijn relatief aan `/api/socialhero/v1`. Verzoeken gaan server-to-server met `Authorization: Bearer <site-token>`. Gebruik HTTPS buiten lokale ontwikkeling. Bind de credential aan de beoogde website en omgeving. Houd rechten minimaal en afzonderlijk intrekbaar en roteerbaar. Voorzie aparte scopes voor capabilities/status, media, concept en publicatie. De organisatie kan voor de read-only wizardcontrole dezelfde geldige verbinding gebruiken met een verzoek dat uitsluitend capabilities leest.

| Methode en pad | Verzoek | Succes |
|---|---|---|
| `GET /capabilities` | Bearer | `200` met `siteId`, `environment`, `contractVersion`, `blogPath`, ondersteunde acties, typen en talen, beschikbare auteurs/categorieën en mediaformaten en limieten. |
| `POST /media` | Multipart met één `file`, Bearer en `Idempotency-Key` | `201` met `assetId`, werkelijke `width`, `height` en MIME `type`. |
| `PUT /posts/{externalId}` | JSON-concept, Bearer en `Idempotency-Key`. Gebruik `If-Match: "<revision>"` bij update. | `201` bij aanmaken, `200` bij update, met `id`, `externalId`, `revision` en `status`. |
| `GET /posts/{externalId}` | Bearer | `200` met `id`, `externalId`, `status`, `draftRevision`, `publishedRevision`, `publicUrl` en `publishedAt` waar beschikbaar. |
| `POST /posts/{externalId}/publish` | JSON `{"revision":7}`, Bearer en `Idempotency-Key` | `200` met `status: "published"`, `id`, `externalId`, `publishedRevision`, `publicUrl`, `publishedAt` of `202` met een statusreferentie zolang verwerking loopt. |

`externalId` is het stabiele SocialHero-content-ID per artikel en bestemming. Gebruik een beperkte veilige URL-padsyntax. `id` verwijst naar de stabiele website-identiteit en `revision` identificeert de specifieke conceptinhoud. Een publicatiejob bindt aan één goedgekeurde revisie. Wanneer de actuele conceptrevisie vóór dispatch is gewijzigd, geef een revisieconflict en laat de nieuwe revisie via de campagneflow goedkeuren. Een al verwerkt verzoek geeft bij een herhaling het originele resultaat terug.

## Voorbeeld van het websiteconcept

Waarden en IDs zijn placeholders voor de geïnstalleerde taxonomieën en geverifieerde media. Het voorbeeld bevat een verkorte inhoud.

```json
{
  "type": "blog",
  "locale": "nl-NL",
  "title": "Zo houd je de clubschermen actueel op wedstrijddag",
  "slug": "clubschermen-actueel-op-wedstrijddag",
  "excerpt": "Een draaiboek voor programma, uitslagen en sponsorcontent in de kantine.",
  "content": {
    "format": "markdown",
    "body": "## Begin met de wedstrijddag\nControleer de teams, aanvangstijden en het thuisprogramma."
  },
  "seo": {
    "title": "Clubschermen actueel houden op wedstrijddag | VeyoCast",
    "description": "Richt een draaiboek in voor actuele wedstrijden, uitslagen en sponsorcontent op de schermen van je vereniging."
  },
  "authorId": "redactie",
  "categoryId": "narrowcasting",
  "tags": ["clubschermen", "wedstrijddag", "narrowcasting"],
  "hero": {
    "assetId": "asset-hero-voorbeeld",
    "alt": "Een clubscherm met het wedstrijdprogramma boven de bar.",
    "focalPoint": {"x": 0.55, "y": 0.4}
  },
  "ogImageAssetId": "asset-deelbeeld-voorbeeld"
}
```

Het focuspunt ligt van 0 tot 1 vanaf links en boven. De server verwerkt en controleert asset-ID's binnen de site en omgeving. De mediahost bepaalt de publieke absolute URL. Autoriseer publieke media op het moment dat de content live gaat volgens de bestaande opslagconventies. Gebruik tijdens concept en preview afgeschermde bestanden of tijdgebonden, door de server uitgegeven URLs waar de gekozen opslag dit ondersteunt.

## Idempotentie en consistentie

Bewaar per website, omgeving, operatie en sleutel een duurzaam resultaat en fingerprint. Neem methode, identiteit van het target, inhoud en relevante precondities op. Fingerprint uploads op gecontroleerde bestandsinhoud en relevante semantische velden. Reserveer of lock de sleutel atomair vóór de mutatie. Herhaal de opgeslagen respons voor een geldig verzoek met dezelfde fingerprint, ook als de actuele revisie sindsdien veranderde. Een andere fingerprint met dezelfde sleutel geeft een conflict. Schrijf mutatie en resultaat samen transactioneel waar mogelijk. Gebruik bij externe side effects een hervatbare taak of outbox die de effectstatus duurzaam bijhoudt en een deterministisch asset-ID of opslagpad gebruikt. Kies de bewaartermijn in relatie tot de maximale job- en retryduur.

Borg externe ID en slug in de database met unieke constraints binnen de werkelijke scope. Een route zonder taalprefix heeft een gedeelde slugruimte over talen. Neem oude slugs mee bij routeconflicten. Een wisseling naar de actuele slug is één publicatieactie met redirecthistorie en versie-update. Laat een tijdstip, publicatiekenmerk of contentversie de verwachte publicatie via de openbare respons verifieerbaar maken. Een standaard `200` is daarvoor onvoldoende. Laat een herstart cacheverversing, statusverificatie en eventuele publicatiehervatting terugvinden zonder dezelfde side effects te dupliceren.

| HTTP | Foutcode | Voorbeeld |
|---|---|---|
| 400 | `INVALID_REQUEST` | Ongeldige velden, documentnodes, locale of focuspunt. |
| 401 | `INVALID_CREDENTIAL` | Ontbrekend, ingetrokken of verlopen token. |
| 403 | `PERMISSION_DENIED` | Credential heeft geen scope of hoort bij een andere bestemming. |
| 404 | `NOT_FOUND` | Stabiel extern ID ontbreekt binnen de toegestane site. |
| 409 | `SLUG_CONFLICT` | De actuele of gereserveerde slug hoort bij een ander artikel. |
| 409 | `IDEMPOTENCY_CONFLICT` | De sleutel hoort bij een ander verzoek. |
| 409 of 412 | `REVISION_CONFLICT` | Conceptrevisie wijkt af van de verwachte revisie. Gebruik 412 voor een niet-gehaalde HTTP-preconditie. |
| 413, 415 of 422 | `INVALID_MEDIA` | Bestand is te groot, MIME is niet toegestaan of decoder weigert de inhoud. |
| 428 | `REVISION_REQUIRED` | Conceptupdate mist de benodigde revisiepreconditie. |
| 429 | `RATE_LIMITED` | Tijdelijke grens bereikt. Geef `Retry-After` wanneer beschikbaar. |

Retourneer een machineleesbare `error.code` en bruikbare `error.message`. Voeg veilige veldmeldingen en een request-ID toe waar die helpen. Log site, bewerking, resultaat en request-ID zonder token, handtekening of interne details.

## Uitvoering en herstel in SocialHero

| Status | Gedrag |
|---|---|
| Concept | Redacteur kan wijzigen vóór goedkeuring. |
| Ingepland | Bestemming, goedgekeurde revisie en geplande UTC-tijd liggen vast. |
| Bezig | Uitvoering controleert verbinding en versie en verwerkt media, concept of publicatie. |
| Wacht op website | Publicatie verwerkt nog, verificatie is tijdelijk onbereikbaar of de verbinding staat gepauzeerd. Afhankelijke socialposts wachten. |
| Live | Openbare URL is succesvol geverifieerd en toont de verwachte revisie. |
| Aandacht nodig | Ongeldige configuratie, content, autorisatie, revisie- of slugconflict of uitgeputte retries vraagt een concrete vervolgactie. |

Controleer vlak voor elke geplande actie project, verbinding, websitekanaal en goedgekeurde revisie. Na een time-out van concept of publicatie lees je status op extern ID en vergelijk je de verwachte revisie. Is de uitkomst nog onbekend, hervat de operatie met de oorspronkelijke sleutel. Na een time-out bij media hervat je de originele upload met dezelfde sleutel en bytes. Herhaal alleen tijdelijke netwerkfouten, 429 en herstelbare 5xx met begrensde back-off, jitter en `Retry-After` waar aanwezig. Bewaar extern ID, website-ID, revisie, operatie, sleutel, poging, foutcode, canonieke URL en tijden duurzaam. Nieuwe inhoud of nieuwe publicatierevisie krijgt een nieuwe operatie en sleutel.

Verifieer de openbare respons zonder redactiesessie. Controleer de geconfigureerde HTTPS-host, iedere redirect, uiteindelijke URL, status, canonical en verwachte revisie of expliciete publicatiekenmerk. Gebruik een veilige server-fetch met DNS/IP-controles tegen interne, loopback-, link-local- en gereserveerde bestemmingen. Stuur het API-token uitsluitend naar de geverifieerde API-origin, voer de publieke verificatie uit zonder authenticatie en volg alleen toegestane redirects. Geef afhankelijke socialposts daarna de schone URL en voeg per kanaal eigen meetparameters toe.

## Beveiliging en media

Valideer redactierechten en servercredentials per actie. Bewaar credentials uitsluitend server-side en bied rotatie en intrekking. Houd site- en omgevingbinding los van de meetpixel. Pas request- en rate-limits toe vóór dure verwerking. Detecteer mediatype uit bytes, decodeer veilig, controleer dimensies en limieten en gebruik veilige bestandsnamen en opslagpaden. Publiceer alleen gecontroleerde uitvoer en gebruik waar passend de bestaande transcoder. Pas toegestane linkprotocollen toe en ontsmet of verwerp ongeldige opmaak bij import, opslag en render. Houd de OpenAI-sleutel in de AI-configuratie van SocialHero.
