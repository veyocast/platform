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
- haalt hetzelfde immutable release-manifest op;
- toont steeds exact één `img` of `video`;
- gebruikt online media rechtstreeks vanaf de gesigneerde HTTPS-URL;
- zet video expliciet op muted, roept `load()`/`play()` aan en bewaakt start,
  voortgang en einde;
- leest offline uitsluitend een reeds door de gewone Player geverifieerde
  last-known-good release en cache;
- stuurt dezelfde heartbeat en verwerkt dezelfde remote herstelcommando's;
- toont bij fouten een VeyoCast-statusvlak in plaats van een wit of zwart
  scherm.

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

- Legacy rapporteert tijdens playback uitsluitend `active` en tijdens pairing
  geen synchronisatiefase;
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

1. Pair en publiceer op de gewone `/lg`-route.
2. Open `https://player.veyocast.nl/lg/probe` en noteer de diagnosecode.
3. Open daarna handmatig `https://player.veyocast.nl/lg/legacy`.
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
- `LG-CACHE-RANGE`: gebruik online direct; laat cached video alleen als
  gecontroleerde fallback dienen.
- `LG-BLOB-MEMORY`: vermijd Blob als primaire videobron. De Legacy Player doet
  dat al.
- `LG-DIRECT-FETCH`: media-elementen kunnen rechtstreeks afspelen, terwijl
  XHR/range/CORS hapert. De Legacy Player downloadt de actieve media niet via
  XHR.
- `LG-ACTIVE-ASSET`: normaliseer de video naar een LG-veilig H.264/AAC-profiel
  of herstel de signed URL voordat de route wordt omgezet.
- `LG-VIDEO-REFERENCE`: stop met Playerwijzigingen en controleer eerst de
  firmware/decoder of gebruik een externe Chromecast.
