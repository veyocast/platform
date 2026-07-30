# S65 portrait-afbeeldingsoriëntatie

## Aanleiding

Een staande afbeelding werd in Control als liggend geopend. De upload was
inhoudelijk geldig, maar de in S64 toegevoegde directe afbeeldingsroute schreef
geen breedte en hoogte naar `media_assets` en `media_variants`. Playlist Studio
viel bij ontbrekende dimensies terug op zijn 16:9-preview. De Media-inspector
legde daarnaast voor ieder beeld expliciet `aspect-ratio: 16 / 9` vast.

## Implementatie

### Betrouwbare uploadmetadata

- PNG gebruikt uitsluitend de begrensde IHDR-breedte en -hoogte.
- JPEG leest een geldige SOF-marker en past EXIF-orientatie 5 tot en met 8 toe,
  zodat een telefoonfoto met liggende pixelmatrix als staand wordt geregistreerd.
- WebP ondersteunt VP8X, VP8L en VP8 canvasmetadata.
- Onvolledige of onrealistische headers worden vóór Storage en database
  geweigerd. De grens is 32.768 pixels per zijde en 268.435.456 pixels totaal;
  8K portrait en landscape blijven daar ruim binnen.
- De gevonden dimensies worden op zowel het asset als de immutable originele
  variant opgeslagen.

### Control en bestaande uploads

- De Media-inspector gebruikt voor afbeeldingen de natuurlijke verhouding in
  plaats van een vaste 16:9-verhouding. Rasterkaarten blijven bewust compacte
  16:9-crops.
- Playlist Studio gebruikt opgeslagen variantafmetingen. Bij oude assets zonder
  metadata leest de client na laden `naturalWidth` en `naturalHeight`, zodat
  opnieuw uploaden niet nodig is om het portraitvoorbeeld goed te tonen.
- Video-afmetingen hebben dezelfde defensieve clientfallback via
  `videoWidth`/`videoHeight`.

### Player

De normale `contain`/`cover`-presentatie blijft leidend. Afbeeldingen krijgen
expliciet `image-orientation: from-image`; video, schermbinding, releasekeuze,
signed media-access en last-known-good cache veranderen niet.

## Lokaal bewijs

- Workspace lint, typecheck en unit-tests groen.
- Control lint/typecheck en 125 unit-tests groen.
- Control en Player production builds groen.
- Playerbuild inclusief secretscan en webOS 6-syntaxguard groen.
- De volledige Player/offline-browsermatrix telt 57 groene scenario's.
- De a11y-matrix leverde 28 directe groene scenario's en twee gedeelde
  devserverflakes; beide waren aansluitend seriëel groen.
- De gecombineerde brede browserrun leverde 107 directe groene scenario's,
  acht verwachte environment-skips en negen gedeelde runner/devserverflakes.
  Alle negen uitvallers zijn zonder parallelle belasting seriëel groen
  bevestigd.
- Zes unitproeven bewijzen portrait PNG, portrait JPEG, EXIF-geroteerde JPEG,
  portrait WebP en veilige afwijzing van corrupte of onrealistische headers.

## Externe acceptatie

Staging en production moeten na merge op dezelfde exacte release-SHA slagen.
Daarna blijft alleen de fysieke bevestiging open dat een bestaande portrait-PNG
en een EXIF-geroteerde telefoon-JPEG in Control én op de LG staand verschijnen.
