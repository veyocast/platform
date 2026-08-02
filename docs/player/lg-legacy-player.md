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

## Veilige ingebruikname

1. Open `https://player.veyocast.nl/lg/probe` en noteer de diagnosecode.
2. Open daarna handmatig `https://player.veyocast.nl/lg/legacy`, koppel het
   scherm en publiceer een release.
3. Controleer dat de eerste release eerst downloadt/verifieert en daarna pas
   start.
4. Controleer afbeeldingen, H.264-video, minstens drie loopwissels,
   heartbeat in Control en een herstart van de televisie.
5. Onderbreek het netwerk terwijl een eerder geverifieerde release bestaat.
   De lokale release moet blijven spelen of een expliciet statusvlak tonen;
   nooit een leeg wit/zwart vlak.
6. Test `Player opnieuw laden` en `Koppeling herstellen` vanuit Control.
7. Pas na fysieke acceptatie mag de ingestelde LG-URL van `/lg` naar
   `/lg/legacy` wijzigen. De generieke, Android- en IPK-players blijven op hun
   bestaande route.

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
