# Media Pipeline Canon

## Upload flow

```text
1. User requests upload session.
2. Server checks tenant role and limits.
3. Browser uploads to tenant-scoped Storage path.
4. `media_assets` row becomes `uploading`/`processing`.
5. Worker validates MIME, extension, metadata and safety.
6. Worker creates thumbnail and player variant.
7. Worker stores checksum and dimensions/duration.
8. Asset becomes `ready`.
```

## MVP limits

- Images: JPEG, PNG, WebP.
- Video: MP4, H.264, AAC.
- Default max video upload: 500 MB.
- Default max video duration: 5 minutes.
- Default generated variant: 1080p max.

## Statuses

- Uploaden
- Verwerken
- Gereed
- Validatie mislukt
- In quarantaine
- Verwijderd

## Rules

- No SVG upload in MVP unless sanitized and explicitly enabled.
- No executable files.
- No arbitrary HTML.
- No iframe player content.
- Assets in published releases are immutable references.
- Replacing media creates a new asset/variant and requires republish.

## S14 processing worker

`apps/media-worker/src/video-normalization.ts` is the executable processing
boundary for video jobs. It:

- invokes `ffprobe` and `ffmpeg` with `spawn(..., { shell: false })`;
- rejects malformed probes, non-MP4 input and video longer than five minutes;
- maps exactly the first video stream and an optional first audio stream;
- generates MP4/H.264 Main, yuv420p, maximum 1920×1080 at 30 fps;
- normalizes optional audio to AAC, 48 kHz, stereo;
- writes fast-start MP4 and probes the output again before accepting it;
- bounds command duration and captured process output.

De production worker gebruikt voor reeds conforme H.264/yuv420p/AAC-video een
nieuwe, geverifieerde remux in plaats van een kwaliteitsverlagende volledige
transcode. Afwijkende invoer gebruikt `veryfast`, een harde FFmpeg-grens van
40 seconden en acht-secondenlimieten voor beide Storage-overdrachten. Queuepolling staat in de gedeployde stack op 500 ms; Control
ververst zolang er actieve uploads zijn iedere twee seconden.

Control maakt voor MP4 transactioneel een tenantgebonden asset en TUS-intent,
na capability-, tenantstatus-, bestands- en quotacontrole onder lock. De browser
uploadt in vaste delen rechtstreeks naar private Storage met zijn kortlevende
authenticated sessie. Storage RLS accepteert alleen het exacte pad van de
actieve intent. `finalize_media_video_upload_v2` controleert opnieuw tenantrecht,
exact pad, MIME-type en bytegrootte en retourneert bij replay dezelfde job.

De browser bewaart voor reloadherstel alleen niet-geheime bestandsmetadata, een
idempotency-ID en uploadsession-ID. TUS bewaart zijn hervatlocator; access tokens,
signed URLs en signed uploadtokens worden niet in VeyoCast-state of Postgres
opgeslagen. Zie [`media-upload-threat-model.md`](media-upload-threat-model.md).

De daemon:

- claimt met `FOR UPDATE SKIP LOCKED` en een stale-locktimeout;
- is voor claim/complete/fail uitsluitend toegankelijk als `service_role`;
- streamt bron en variant zonder een bestand van maximaal 500 MB in geheugen te laden;
- controleert bron- en variant-SHA-256 en verwachte bronlengte;
- schrijft original en `player_1080p` plus de ready-transitie in één transactie;
- zet alleen tijdelijke fouten opnieuw klaar en stopt na een begrensd aantal pogingen;
- verwijdert ieder eigen tijdelijk werkpad in een `finally`-pad.

De RPC-contracten, tenantgrenzen, storage-adapter, runner en live signed-upload
tot queue zijn getest zonder productiecredentials. FFmpeg/ffprobe waren niet
geïnstalleerd in de S14-B-uitvoeringsomgeving; de echte daemon smoke bewees
daarom claim/download/retry, maar nog geen gegenereerde playervariant. Een
synthetische transcode met geïnstalleerde binaries blijft een launch gate.
