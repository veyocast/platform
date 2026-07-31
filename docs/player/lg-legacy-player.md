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
