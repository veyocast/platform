# LG Legacy Player

## Doel

`/lg/legacy` is een afzonderlijke, opt-in runtime voor oude webOS
Signage-browsers. De route vervangt `/lg` niet automatisch. Eerst bepaalt
`/lg/probe` op echte hardware welk transport- of mediapad faalt.

De Legacy Player:

- rendert zelfstandige HTML zonder React-hydration of Next-clientchunks;
- gebruikt conservatief inline JavaScript zonder modules, `async`/`await`,
  optional chaining of Fetch;
- hergebruikt de bestaande installatie-ID, installatiecredential,
  devicecredential en pairing-API;
- vraagt en vernieuwt idempotent een koppelcode;
- leest bij startup eerst de geverifieerde lokale actieve of vorige release;
- controleert daarna conditioneel via de release-ETag of een nieuw immutable
  manifest beschikbaar is;
- downloadt alleen voor een nieuwe of beschadigde release alle media-,
  poster- en dynamische-templateassets;
- controleert bestandsgrootte en SHA-256 vóór opslag in Cache Storage;
- bewaart actieve en vorige release atomisch in IndexedDB en verwijdert alleen
  assets die door geen van beide releases worden gebruikt;
- speelt afbeeldingen én video altijd af vanuit lokale, geverifieerde bytes;
- houdt het huidige media-element zichtbaar totdat de volgende afbeelding
  gedecodeerd of de volgende video werkelijk gestart is;
- zet video expliciet op muted, roept `load()`/`play()` aan en bewaakt start,
  voortgang en einde;
- stuurt dezelfde heartbeat en verwerkt dezelfde remote herstelcommando's;
- toont bij fouten een VeyoCast-statusvlak in plaats van een wit of zwart
  scherm.

## Release- en cacheketen

Een ongewijzigde release levert `304 Not Modified`. Legacy wijzigt dan geen
playbacktimer, playlistindex, media-URL of DOM-element. Ook na een herstart
komt de bekende release-ID uit IndexedDB, waardoor geen volledig manifest of
signed media-URL nodig is zolang de toewijzing gelijk blijft.

Een gewijzigde release doorloopt achtereenvolgens:

1. manifest ontvangen en alle cachebare assets inventariseren;
2. bestaande cachebytes opnieuw op grootte en SHA-256 controleren;
3. vrije opslag controleren met dezelfde reservegrens als de hoofdplayer;
4. uitsluitend ontbrekende assets sequentieel downloaden;
5. iedere download vóór `cache.put` verifiëren;
6. de complete release als `switch_pending` vasthouden;
7. op de eerstvolgende loopgrens active en previous atomisch bijwerken;
8. pas daarna de nieuwe lokale release afspelen en verouderde bytes opruimen.

Tijdens alle stappen blijft de huidige last-known-good release spelen. Een
ontbrekende lokale asset forceert één volledige manifestvernieuwing zodat de
actieve release gecontroleerd kan worden hersteld; Legacy valt nooit stilzwijgend
terug op de externe media-URL.

Afbeeldingen worden op een verborgen tweede laag geladen en waar ondersteund
met `HTMLImageElement.decode()` voorbereid. Lokale video start muted op die
tweede laag. De lagen wisselen pas nadat beeld of video gereed is, waarna de
oude Blob-URL wordt ingetrokken. Daardoor komt de zwarte Playerachtergrond
niet tussen twee geldige items in beeld.

## Logisch canvas en viewportfit

Alle dynamische HTML/CSS-slides behouden hun vaste ontwerpcanvas:

- landscape: `1920 × 1080`;
- portrait: `1080 × 1920`.

De gewone en Legacy Player schalen dat volledige canvas proportioneel met
`min(viewportbreedte / canvasbreedte, viewporthoogte / canvashoogte)` en
centreren het resultaat. Een LG die door firmware, rotatie of browsermodus een
afwijkende viewport rapporteert, rekt een portraitslide daardoor niet meer uit
tot landscape en snijdt geen titel, standrij of footer af. Vrije ruimte buiten
het canvas blijft de neutrale Playerachtergrond. Een resize herberekent de fit
direct zonder release-, cache- of playlistwissel.

Nieuwsbeelden staan binnen beide oriëntaties in een vaste 16:9-container en
bewaren met `object-fit: contain` het volledige bronbeeld zonder vergroting.
Kop en grotere intro starten bovenaan; middellange en lange titels gebruiken
dezelfde begrensde maat. Datum en auteur staan naast elkaar onder de
scheidingslijn linksonder in het tekstpaneel.

## Heartbeat- en credentialbehoud

Een fysieke LG-test op 1 augustus 2026 bewees dat de eerste Legacy-runtime de
actieve releaseafbeelding kon tonen, maar niet online verscheen in Control. De
runtime stuurde de niet-canonieke synchronisatiefase `lg-legacy`; de
database accepteert uitsluitend `manifest_received`, `downloading`,
`verifying`, `switch_pending`, `active` en `failed`. De heartbeattransactie
werd daardoor teruggedraaid. De API classificeerde de nog gekoppelde
devicecredential vervolgens ten onrechte als `INVALID_DEVICE_TOKEN`, waarna de
client hem lokaal verwijderde en een nieuwe pairing probeerde te maken.

De herstelde keten bewaakt drie grenzen:

- Legacy rapporteert uitsluitend de canonieke fasen `downloading`,
  `verifying`, `switch_pending`, `active` en `failed`; tijdens pairing is de
  synchronisatiefase leeg;
- de heartbeat-API normaliseert onbekende fasen naar `null` en vertaalt een
  databasefout bij een aantoonbaar `PAIRED` credential naar de tijdelijke fout
  `PLAYER_API_UNAVAILABLE`;
- wanneer alleen de lokale devicecredential ontbreekt, zoeken `/lg` en
  `/lg/legacy` de nieuwste geldige credential in de reeds geverifieerde
  actieve of vorige IndexedDB-release. De installatie-ID, schermbinding,
  immutable release en cache blijven ongewijzigd.

Een werkelijk ingetrokken of onbekende credential blijft definitief afgewezen.
De cachefallback kan dus geen server-side revoke ongedaan maken.

Een pending koppelcode wordt eveneens uitsluitend door de server als geldig of
verlopen beoordeeld. Legacy bewaart de code, pending devicecredential en
idempotentiesleutel tijdens herladen en blijft heartbeat gebruiken zolang de
server `PAIRING_PENDING` teruggeeft. De lokale TV-klok mag de code niet wissen
of roteren: oudere LG-schermen kunnen uren voor- of achterlopen. Alleen een
definitieve serverresponse maakt de tijdelijke pairing ongeldig en vraagt één
nieuwe code aan.

## Veilige ingebruikname

1. Open eerst `https://player.veyocast.nl/lg/html-debug`. Wacht op
   `LG-HTML-CSS-READY` en controleer dat de volledige Editorial Arena-proefslide
   zichtbaar is. Deze route verandert geen koppeling, release of mediacache.
2. Open `https://player.veyocast.nl/lg/probe` en noteer de diagnosecode.
3. Open daarna handmatig `https://player.veyocast.nl/lg/legacy`, koppel het
   scherm en publiceer een release.
4. Controleer dat de eerste release eerst downloadt/verifieert en daarna pas
   start.
5. Controleer afbeeldingen, H.264-video, minstens drie loopwissels,
   heartbeat in Control en een herstart van de televisie.
6. Onderbreek het netwerk terwijl een eerder geverifieerde release bestaat.
   De lokale release moet blijven spelen of een expliciet statusvlak tonen;
   nooit een leeg wit/zwart vlak.
7. Test `Player opnieuw laden` en `Koppeling herstellen` vanuit Control.
8. Pas na fysieke acceptatie mag de ingestelde LG-URL van `/lg` naar
   `/lg/legacy` wijzigen. De generieke, Android- en IPK-players blijven op hun
   bestaande route.

## HTML/CSS-renderdiagnose

`/lg/html-debug` is uitsluitend voor de LG web player en bevat geen React-
hydration of Next.js-clientchunks. De route toont altijd eerst
`LG-HTML-CSS-NO-SCRIPT`. Zodra de conservatieve inline runtime start, meet hij
de viewport, CSS Grid, CSS-variabelen, fullscreenpositionering, een
same-origin asset en een zichtbare fixture met exact dezelfde legacy-
stylesheet als normale dynamische slides.

De legacy Player gebruikt voor fullscreenlagen expliciet `top`, `right`,
`bottom` en `left`. Daardoor blijft de renderlaag bruikbaar wanneer de TV de
kortere `inset`-notatie niet begrijpt. De debugpagina rapporteert dat als
`INSET_FALLBACK_ACTIVE`; dit is informatief zolang het eindresultaat
`LG-HTML-CSS-READY` is.

- `LG-HTML-CSS-NO-SCRIPT`: de browser heeft de inline runtime niet uitgevoerd;
  noteer het schermbeeld en controleer CSP/browserfouten.
- `LG-HTML-CSS-VIEWPORT`: de browser meldt geen bruikbare viewport.
- `LG-HTML-CSS-FEATURES`: Grid of CSS-variabelen werkt niet zoals vereist.
- `LG-HTML-CSS-LAYOUT`: de echte productiefixture vult het testvlak niet.
- `LG-HTML-CSS-ASSET`: de ingebouwde same-origin afbeelding decodeert niet.
- `LG-HTML-CSS-READY`: DOM, vereiste CSS, fullscreenfallback en assetrendering
  zijn op dit apparaat gereed.

Open in de technische details het lokaal begrensde rapport en deel de code met
Support. Het rapport staat alleen onder
`veyocast.player.lgHtmlDebug.v1`; installatie-ID, credentials, immutable
releases, IndexedDB en Cache Storage worden niet gelezen of gewijzigd.

## Probe-uitkomsten

- `LG-PLAYBACK-READY`: decoder, directe media en bestaande cache werken. Zoek
  het defect in de React/runtime-overgang; de Legacy Player is een geschikte
  geïsoleerde workaround.
- `LG-IMAGE-PLAYBACK-READY`: de ingebouwde same-origin H.264
  Baseline/AAC-LC-video, de actieve releaseafbeelding, Blob-route en bestaande
  Player-cache werken. De Legacy Player mag opt-in worden getest, maar
  publiceer eerst een release met een echte VeyoCast-video voordat
  `/lg/legacy` als vaste start-URL wordt ingesteld.
- `LG-CACHE-RANGE`: de serviceworker-rangeroute is voor Legacy niet de primaire
  videobron; controleer dat dezelfde cachebytes als Blob wel stabiel afspelen.
- `LG-BLOB-MEMORY`: gebruik `/lg/legacy` niet als vaste route zolang de lokale
  videoblob op het scherm onvoldoende geheugen heeft. Direct-online playback
  is geen toegestane data- of offlinefallback.
- `LG-DIRECT-FETCH`: media-elementen kunnen rechtstreeks afspelen, terwijl
  XHR of CORS hapert. Herstel eerst Storage-CORS of de apparaatgrens; Legacy
  activeert geen release die het niet volledig lokaal kan verifiëren.
- `LG-ACTIVE-ASSET`: normaliseer de video naar een LG-veilig H.264/AAC-profiel
  of herstel de signed URL voordat de route wordt omgezet.
- `LG-VIDEO-REFERENCE`: stop met Playerwijzigingen en controleer eerst de
  firmware/decoder of gebruik een externe Chromecast.
