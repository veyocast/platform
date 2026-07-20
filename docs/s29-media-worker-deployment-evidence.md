# S29-A media-worker deployment evidence

## Oorzaak en resultaat

De MP4-pipeline maakte wel queuejobs en de repository bevatte een werkende
worker, maar de immutable VPS-release bouwde noch startte die image. Assets
bleven daardoor onbeperkt op `processing`. S29-A voegt de worker toe als een
afzonderlijk, niet-publiek Compose-project voor staging en production en neemt
zijn image-ID op in dezelfde release/promotie/rollbackcontrole als de webapps.

Control ververst een actieve queue iedere twee seconden. De gedeployde worker
pollt iedere 500 ms, meldt pas readiness na werkelijk queuecontact en stopt bij
SIGTERM met claimen terwijl een reeds geclaimde job mag afronden.

## Verwerkingstijd

Op 21 juli 2026 is de echte production worker-image lokaal met Debian FFmpeg
7.1.5 getest op synthetische media:

| Bron | Route | Gemeten normalisatietijd | Resultaat |
|---|---|---:|---|
| 30 s, 1920×1080, H.264/yuv420p/AAC, 56 MB | veilige remux + herprobe | 2,144 s | geldige 1080p30 H.264/AAC-variant |
| 30 s, 1280×720, MPEG-4/MP3, 20 MB | `veryfast` transcode + herprobe | 3,731 s | geldige 720p30 H.264/AAC-variant |

De FFmpeg-stap stopt na 40 seconden met `processing_timeout`; download en upload
stoppen elk na acht seconden met een specifieke time-out. Daardoor kan één
afwijkende bron niet minutenlang als actieve transcode blijft staan. De
operationele minuutdoelstelling omvat daarnaast 500 ms queuepolling en de
Storage-download/upload; de hosted staging-smoke moet na deployment de volledige
upload→ready-tijd bewijzen.

## Security en rollout

- worker zonder hostpoort, met read-only rootfilesystem, `cap_drop: ALL`,
  `no-new-privileges`, PID/CPU/geheugengrenzen en eigen netwerk;
- alleen `SUPABASE_URL`, service-role, revision/environment en begrensde
  workerinstellingen worden geïnjecteerd;
- bron en variant gebruiken een eigen Docker-volume onder `/tmp` en worden in
  het bestaande `finally`-pad verwijderd;
- workerlogs lopen door dezelfde JWT-/secretredactie;
- pre-worker releases blijven als webrollback bruikbaar; de worker wordt dan
  bewust gestopt.

## Gates

- worker lint, typecheck en 24 unit/integratietests: groen;
- staging- en production-Compose/securityvalidator: groen;
- shellsyntax en migratiesafety in de VPS-validator: groen;
- echte remux- en transcodebenchmark in production image: groen.
- production image start zonder package-managerbootstrap, bereikt de queue,
  meldt `ready` en sluit gecontroleerd na `SIGTERM`: groen.
