# S74 — Portrait-videonormalisatie

## Aanleiding

De fysieke LG 43UL3J-EP speelde een afbeelding correct schermvullend af, maar
de bijbehorende portraitvideo gebruikte niet de volledige staande renderzone.
De Legacy Player gaf beide elementen al exact dezelfde `100% × 100%`-geometrie.
De afwijking ontstond daarom vóór playback, in de Player-variant van de upload.

## Oorzaak

De mediaworker gebruikte voor iedere video een landscape-only maximum van
`1920×1080`:

- echte `1080×1920`-pixels werden teruggebracht tot ongeveer `608×1080`;
- een telefoonvideo met `1920×1080` opgeslagen pixels en 90° displayrotatie
  voldeed ten onrechte aan het remuxcontract;
- oude LG-decoders hoeven MP4-displayrotatie niet toe te passen en konden die
  variant daardoor liggend tonen.

## Herstelcontract

- de langste zijde is maximaal 1920 pixels;
- de kortste zijde is maximaal 1080 pixels;
- veilige fysieke `1080×1920`-pixels mogen zonder kwaliteitsverlies worden
  geremuxed;
- iedere niet-nul displayrotatie dwingt transcodering af;
- FFmpeg verwerkt de rotatie vóór de oriëntatiebewuste schaalfilter;
- de Player-variant heeft vierkante pixels, H.264 Main, yuv420p, maximaal
  30 fps en geen resterende rotatiemetadata.

De variant blijft onder hetzelfde tenantgescopeerde opslagpad en immutable
releases blijven ongewijzigd. Bestaande gepubliceerde varianten worden niet
stil overschreven; een getroffen bron moet opnieuw worden verwerkt en daarna
via een nieuwe immutable release worden gepubliceerd.

## Bewijs

Naast unitgrenzen voor fysiek portrait, landscape en displayrotatie is de
productie-FFmpeg-versie rechtstreeks beproefd. Een synthetische
`1920×1080`-MP4 met 90° displaymatrix leverde een rotatievrije
`1080×1920`, yuv420p Player-variant op.
