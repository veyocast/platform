# VeyoCast Studio — render validation

## Doel

Deze runbook bewijst afzonderlijk:

1. document-, SVG-, PNG- en queuecontracten in unit tests;
2. aanwezigheid en codecgedrag van FFmpeg/ffprobe in de echte workerimage;
3. atomaire Storage/media-integratie met één stagingjob;
4. afspeelbaarheid op de beoogde clients.

Sla geen klantmedia, document-JSON, signed URL of service-role key op als
testartifact.

## Contract dat de worker afdwingt

Een MP4 slaagt alleen bij:

- één videostream en nul audiostreams;
- H.264;
- exact 1920×1080 of 1080×1920 volgens het immutable artboard;
- exact 30 fps;
- `yuv420p`;
- het verwachte frameaantal en een duur binnen één frame;
- MP4/MOV-container;
- `moov` vóór `mdat` (`faststart`).

Een PNG slaagt alleen bij:

- correcte PNG-signatuur en chunkgrenzen;
- geldige CRC per chunk en geen trailing data na `IEND`;
- exact artboardformaat;
- 8-bit RGB of RGBA;
- geen interlace;
- expliciet sRGB- of ICC-profiel.

Output die een van deze controles niet haalt, wordt niet als `ready`
geregistreerd.

## Reproduceerbare codechecks

```bash
pnpm --filter @veyocast/studio test
pnpm --filter @veyocast/media-worker typecheck
pnpm --filter @veyocast/media-worker lint
pnpm --filter @veyocast/media-worker build
pnpm --filter @veyocast/media-worker test
```

De geïmplementeerde testset bewijst onder meer:

- bytegelijke SVG bij hetzelfde document/tijdstip;
- gedeelde text wrapping/autofit en motioninterpolatie;
- bytegelijke sRGB PNG-output van Resvg/Sharp;
- lokale QR-generatie zonder netwerk;
- exacte 1920×1080 probe met H.264, 30 fps, `yuv420p`, 300 frames
  voor 10 seconden en nul audio;
- afwijzing van audio, afwijkende dimensies/fps/pixelformat/duur/frameaantal;
- detectie van `moov` vóór en na `mdat`;
- canonical PNG-, MP4- en posterpaden;
- monotone status, cancellation, leaseverlies, SQL-back-off en tempcleanup.

Dit zijn echte parser-, rasterizer- en state-machinechecks. De videoprobe in de
unit test is een gecontroleerde ffprobe-fixture; hij is geen vervanging voor
een echte containercodec-run.

## Containercodec-smoke

Voer dit uit tegen de daadwerkelijk te promoten workercontainer op staging. Het
maakt één seconde synthetische zwarte video in `/tmp`, encodeert met het
productionprofiel en valideert de resulterende container. Het gebruikt geen
tenantdata of netwerk.

```bash
docker compose \
  --project-name "$WORKER_COMPOSE_PROJECT_NAME" \
  --file infra/vps/worker.compose.yaml \
  exec -T media-worker sh -ceu '
output=/tmp/veyocast-studio-codec-smoke.mp4
probe=/tmp/veyocast-studio-codec-smoke.json
trap "rm -f \"$output\" \"$probe\"" EXIT

ffmpeg \
  -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=black:s=1920x1080:r=30:d=1" \
  -frames:v 30 -map 0:v:0 -an \
  -c:v libx264 -profile:v main -level:v 4.0 \
  -preset veryfast -crf 21 -maxrate 6M -bufsize 12M \
  -pix_fmt yuv420p -g 30 -keyint_min 30 -sc_threshold 0 \
  -map_metadata -1 -movflags +faststart -f mp4 "$output"

ffprobe \
  -v error -count_frames \
  -show_entries \
  "format=format_name,duration:stream=codec_type,codec_name,width,height,avg_frame_rate,pix_fmt,nb_read_frames" \
  -of json "$output" > "$probe"

node - "$probe" "$output" <<'"'"'NODE'"'"'
const fs = require("node:fs");
const probe = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const streams = Array.isArray(probe.streams) ? probe.streams : [];
const videos = streams.filter((stream) => stream.codec_type === "video");
const audios = streams.filter((stream) => stream.codec_type === "audio");
const video = videos[0] ?? {};
const names = String(probe.format?.format_name ?? "").split(",");
const assertions = [
  [videos.length === 1, "precies één videostream"],
  [audios.length === 0, "geen audiostream"],
  [video.codec_name === "h264", "H.264"],
  [video.width === 1920 && video.height === 1080, "1920×1080"],
  [video.avg_frame_rate === "30/1", "30 fps"],
  [video.pix_fmt === "yuv420p", "yuv420p"],
  [Number(video.nb_read_frames) === 30, "30 frames"],
  [names.includes("mp4") || names.includes("mov"), "MP4/MOV-container"]
];
for (const [ok, label] of assertions) {
  if (!ok) throw new Error(`Codecsmoke faalt: ${label}`);
}

const bytes = fs.readFileSync(process.argv[3]);
let offset = 0;
let faststart = false;
while (offset + 8 <= bytes.length) {
  let size = bytes.readUInt32BE(offset);
  const type = bytes.toString("ascii", offset + 4, offset + 8);
  let header = 8;
  if (size === 1) {
    size = Number(bytes.readBigUInt64BE(offset + 8));
    header = 16;
  } else if (size === 0) {
    size = bytes.length - offset;
  }
  if (!Number.isSafeInteger(size) || size < header || offset + size > bytes.length) {
    throw new Error("Codecsmoke faalt: ongeldige MP4-atom");
  }
  if (type === "moov") {
    faststart = true;
    break;
  }
  if (type === "mdat") break;
  offset += size;
}
if (!faststart) throw new Error("Codecsmoke faalt: moov staat niet vóór mdat");

console.log(JSON.stringify({
  audioStreams: 0,
  codec: "h264",
  faststart: true,
  fps: 30,
  height: 1080,
  pixelFormat: "yuv420p",
  verified: true,
  width: 1920
}));
NODE
'
```

Een geslaagde run eindigt exact met een payload in deze vorm:

```json
{
  "audioStreams": 0,
  "codec": "h264",
  "faststart": true,
  "fps": 30,
  "height": 1080,
  "pixelFormat": "yuv420p",
  "verified": true,
  "width": 1920
}
```

Herhaal voor portret door zowel de lavfi-size als de assertions om te draaien
naar 1080×1920. De smoke bewijst de containercodec; hij bewijst nog niet de
snelheid van Resvg/Sharp-frameproductie.

## End-to-end staging-smoke

1. Controleer dat staging exact de te promoten worker-image-digest draait.
2. Maak een tenanttestproject zonder persoonsgegevens, met tekst, shape, lokale
   image en QR.
3. Render eerst statische PNG en daarna een motion-MP4 van 5 seconden.
4. Controleer dat de job voorwaarts door de statussen loopt en `completed`
   wordt zonder handmatige databasewijziging.
5. Controleer private Storage:

```text
.../original/studio-output.png
.../variants/player-1080p.mp4
.../variants/studio-poster.png
```

6. Controleer voor PNG een `original` en `thumbnail`; controleer voor MP4
   `original`, `player_1080p` en `thumbnail`.
7. Controleer dat `studio_exports` dezelfde revision-, job-, media- en checksum
   koppeling bevat.
8. Voeg beide assets via Publisher toe, publiceer een nieuwe immutable release
   en speel die af op de stagingwebplayer.
9. Start een render en annuleer tijdens rendering; verwacht terminal
   `cancelled`, geen ready media en geen geactiveerde release.
10. Forceer één retrybare fout, herstel de oorzaak en bewijs dat dezelfde job en
    gereserveerde media-ID na SQL-back-off voltooien.

## Bewijsstatus op 24 juli 2026

| Controle | Status |
|---|---|
| Studio-contract-, motion- en text-layouttests | bewezen in repositorytests |
| Deterministische Resvg/Sharp sRGB PNG | bewezen in media-workertest |
| MP4 parser/validator en faststartdetectie | bewezen met technische fixtures |
| RPC/state-machine, poster, cancel, lease en retry | bewezen in worker- en RLS-tests |
| 1920×1080/H.264/30 fps/yuv420p/geen audio contract | bewezen als validatoracceptatie; container-smoke hierboven nog per image uitvoeren |
| Echte FFmpeg-run op Codex-host | niet uitgevoerd: host had geen `ffmpeg` op `PATH` |
| Echte FFmpeg-run in staging workerimage | open releasegate |
| 1080×1920 containercodec-smoke | open releasegate |
| 5/10/15/30 seconden productionbenchmark | open |
| Fysieke clientmatrix | open; zie [operations.md](operations.md) |

Claim geen productionrender-SLO of brede devicecompatibiliteit voordat de open
releasegates en hardwarematrix met de exacte productionimage zijn vastgelegd.
