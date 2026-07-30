# S64 uploadtransport en LG media-accessvernieuwing

## Aanleiding

Na S63 bleef een geldige 8K-PNG op een mobiele Control-client vóór de
inhoudsvalidatie steken met een afgebroken Server Action. De gekoppelde LG
bereikte ondertussen normale playback, maar toonde na de foutkaart alleen de
zwarte VeyoCast-stage en locked mark.

## Oorzaak

1. De afbeelding werd nog als multipartbestand door React/Next Server Actions
   getransporteerd. De aangepaste bodylimiet nam niet alle browser-, proxy- en
   action-parsergrenzen weg, waardoor de action promise zonder applicatieantwoord
   kon afbreken.
2. Signed Storage-URLs in Playermanifests zijn één uur geldig. Een opgeslagen
   last-known-good release bevat noodzakelijk de URL die tijdens activatie gold.
   De periodieke manifest-API leverde voor dezelfde immutable release wel een
   nieuwe URL, maar de runtime nam alleen device- en fetchmetadata over. De
   mediasource bleef daardoor na een herstart de verlopen URL proberen en viel
   op LG terug naar een object-URL die de native decoder niet betrouwbaar kan
   streamen.

## Implementatie

### Control

- `POST /api/media/images` ontvangt maximaal één afbeelding per request.
- Een multipartbudget van 21 MiB begrenst een bestand van maximaal 20 MiB plus
  overhead voordat `request.formData()` wordt aangeroepen.
- `Origin` moet overeenkomen met de effectieve host achter de trusted proxy.
- De route controleert live sessie, actieve tenantcontext en
  `tenant.media.write` opnieuw op de server.
- De bestaande signature-, MIME-, grootte-, private-storage-, checksum- en
  ready-transitie blijft de enige inhoudelijke uploadgrens.
- De client valideert vooraf, verstuurt ieder bestand afzonderlijk en toont bij
  iedere serverfout een hersteltekst plus veilig request-ID.
- De ongebruikte grote Server Action-upload en zijn verruimde globale bodylimiet
  zijn verwijderd.

### Player

- Een online manifest voor dezelfde release vervangt de tijdelijke
  video-access-URL door de actuele signed URL.
- De checksum-gevalideerde blob- of serviceworkerbron blijft als lokale
  fallback gekoppeld.
- Cachebytes, actieve release, devicecredential en schermbinding worden niet
  gewijzigd.
- Wanneer de bronmetadata minimaal 45 minuten oud of ongeldig is, initialiseert
  de actieve mediasource eenmaal opnieuw. Lopende geldige playback wordt bij
  normale manifestsync niet iedere minuut onderbroken.

## Lokaal bewijs

- Volledige workspace lint, typecheck en unit-tests groen.
- Control lint, typecheck en 119 unit-tests groen.
- Player lint, typecheck en 105 unit-tests groen.
- Control en Player production builds groen.
- Playerbuild inclusief client-secret-scan en Chromium 79/webOS 6 syntaxguard
  groen.
- De volledige Playerbrowsermatrix telt 57 groene scenario's; de
  offlinebrowsermatrix telt 7 groene scenario's.
- Gerichte Playwright-regressie gebruikt een echte MP4, activeert een release
  met een oude tijdelijke URL, herlaadt dezelfde gecachete release en bewijst
  dat de video-elementbron naar de nieuwe URL wisselt.
- De brede toegankelijkheidsmatrix leverde 28 directe groene scenario's. Twee
  Control-shellscenario's liepen bij vier parallelle workers tegen een gedeelde
  devserver vast; exact die twee scenario's zijn daarna afzonderlijk met één
  worker herhaald en beide groen. Geen van beide paden is door S64 gewijzigd.

## Externe acceptatie

Staging- en productiehealth/smoke worden na merge op de exacte release-SHA
uitgevoerd. De uiteindelijke beelddecode en de concrete 8K-upload blijven
fysieke acceptatiestappen op respectievelijk de LG 43UL3J-EP en de mobiele
Control-client; lokale en browserautomatisering mogen die hardwarebewijzen niet
claimen.
