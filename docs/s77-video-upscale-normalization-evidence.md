# S77 — Video-upscale-normalisatie

## Probleem

De worker begrensde video tot maximaal 1080p, maar schaalde nooit omhoog. Een
reeds decodeerbare H.264-video van `1280×720` of `720×1280` nam bovendien de
remux-fast-path en bleef daardoor 720p.

## Vast contract

- `1280×720` wordt `1920×1080`.
- `720×1280` wordt `1080×1920`.
- Andere verhoudingen vullen het grootste passende raster binnen dezelfde
  landscape- of portraitgrens; `640×480` wordt bijvoorbeeld `1440×1080`.
- Schalen gebruikt Lanczos, verandert de verhouding niet en cropt niet.
- Reeds maximaal passende H.264/AAC/yuv420p-output mag veilig worden geremuxed.
- De outputprobe weigert een kleinere variant wanneer uniforme opschaling binnen
  de 1080p-grens nog mogelijk is.
- Rotatiemetadata blijft uitgesloten van de Player-output.

Opschalen vergroot het pixelraster voor consistente Playerweergave, maar kan
geen detail reconstrueren dat niet in het bronbestand aanwezig is.

## Bewijs

De unitmatrix dekt landscape, portrait, 4:3, staand 4:3, ultrawide, remux en
eindvalidatie. Een production-containerproef genereert synthetische
landscape- en portrait-720p-video, normaliseert die met exact de workerketen en
controleert vervolgens via `ffprobe` de afmetingen, codec, pixelindeling,
framerate en afwezigheid van rotatiemetadata.

De production-imageproef van 1 augustus 2026 is groen:

| Input | Output | Codec | Pixelindeling | FPS | Rotatie |
| --- | --- | --- | --- | --- | --- |
| `1280×720` | `1920×1080` | H.264 | yuv420p | 30 | 0 |
| `720×1280` | `1080×1920` | H.264 | yuv420p | 30 | 0 |

Ook groen:

- media-worker: 67 unitchecks, lint, typecheck en build;
- volledige workspace: lint, typecheck en unitchecks;
- Player: 66 browserchecks;
- Player offline: 7 browserchecks.
