# S87 — LG Legacy lokale releaseketen

## Aanleiding

De fysieke `/lg/legacy`-runtime haalde iedere dertig seconden het volledige
manifest op, startte dezelfde release daarna onvoorwaardelijk opnieuw en koos
zolang hij online was de signed media-URL. `clearMedia()` verwijderde de
zichtbare afbeelding vóór de vervanger geladen was. Dat verklaarde zowel de
zichtbare opbouw van een JPG als het zwarte vlak waarna dezelfde afbeelding
terugkwam.

De route kon bestaande Playercache lezen, maar vulde Cache Storage en IndexedDB
niet zelf. Na een nieuwe publicatie of uitsluitend Legacy-gebruik bestond er
daarom geen volledige lokale last-known-goodketen.

## Herstel

- Het manifest ondersteunt een release-ETag. Een bekende gewenste release
  eindigt na devicevalidatie direct als lege `304`, vóór signed URLs worden
  gemaakt.
- Legacy leest en verifieert bij startup eerst active of previous uit
  IndexedDB en gebruikt die release-ID voor de eerste conditionele controle.
- Media, videobestanden, posters en dynamische-templateassets worden
  sequentieel als bytes opgehaald.
- Bestaande én nieuwe bytes moeten exact de gepubliceerde grootte en SHA-256
  hebben. Alleen geverifieerde responses komen in Cache Storage.
- Een nieuwe release blijft pending tot de loopgrens. IndexedDB verplaatst de
  vorige active release transactioneel naar previous en bewaart daarna de
  nieuwe active release.
- Garbage collection behoudt alle cachekeys van active en previous.
- Afbeeldingen en video krijgen uitsluitend een lokale Blob-URL; er bestaat
  geen direct-online mediafallback meer.
- De huidige laag blijft staan terwijl een tweede laag de afbeelding decodeert
  of de video werkelijk start. Pas daarna vindt de korte overgang plaats en
  wordt de oude Blob-URL ingetrokken.
- Een ontbrekende cacheasset vraagt een volledig manifest op en repareert
  dezelfde immutable release; normale ongewijzigde polls blijven data-arm.

## Geautomatiseerd bewijs

De Legacy-browserproeven controleren:

- één assetdownload en daarna uitsluitend lokale afbeeldingsplayback;
- lokale muted MP4-playback via `blob:`;
- een lege conditionele `304` die hetzelfde DOM-element laat staan;
- een herstart die de lokale release gebruikt en meteen conditioneel
  synchroniseert;
- een vertraagde nieuwe download waarbij op geen enkel gemeten frame alle
  medialagen onzichtbaar zijn;
- offline herstel uit een volledig geverifieerde actieve release;
- credential- en commandherstel zonder regressie.

Daarnaast bewaken unittests de ETag-respons, cache/download/checksumgrenzen en
oude webOS-syntax. De lokale releasegates eindigden als volgt:

- workspace lint, typecheck en unit: telkens 28 van 28 taken groen;
- Player unit: 35 bestanden en 135 tests groen;
- Player productionbuild inclusief secret- en Chromium 79-guard: groen;
- Player plus offline browsermatrix: 71 van 71 groen;
- toegankelijkheid: 34 van 34 groen;
- brede E2E: 27 groen en 2 bewuste live skips; twee Marketingtests faalden
  onder vier workers door een navigatietime-out en browsercrash en waren
  daarna met het volledige bestand geïsoleerd 6 van 6 groen.

## Open acceptatie

Na deployment blijft een fysieke duurproef op het bedoelde LG-scherm nodig:

1. publiceer een release met meerdere JPG’s en minstens één genormaliseerde
   H.264/AAC-video;
2. meet één eerste download per checksum;
3. laat minstens tien ongewijzigde manifestintervallen en drie loops lopen;
4. herstart het scherm en bevestig directe lokale playback;
5. onderbreek het netwerk en controleer volledige playback;
6. publiceer een nieuwe release en bevestig wisseling op de loopgrens zonder
   zwart frame.
