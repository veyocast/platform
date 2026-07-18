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
- Verwijderd

## Rules

- No SVG upload in MVP unless sanitized and explicitly enabled.
- No executable files.
- No arbitrary HTML.
- No iframe player content.
- Assets in published releases are immutable references.
- Replacing media creates a new asset/variant and requires republish.

## S14 processing core

`apps/media-worker/src/video-normalization.ts` is the executable processing
boundary for video jobs. It:

- invokes `ffprobe` and `ffmpeg` with `spawn(..., { shell: false })`;
- rejects malformed probes, non-MP4 input and video longer than five minutes;
- maps exactly the first video stream and an optional first audio stream;
- generates MP4/H.264 Main, yuv420p, maximum 1920×1080 at 30 fps;
- normalizes optional audio to AAC, 48 kHz, stereo;
- writes fast-start MP4 and probes the output again before accepting it;
- bounds command duration and captured process output.

The command adapter and output contract are fixture-tested without requiring
production credentials. This is not yet the complete worker daemon: claiming
`media_processing_jobs`, downloading and uploading private Storage objects,
persisting variant metadata/checksums and retry/failure transitions still need
to be connected. A real FFmpeg binary was not available in the S14 execution
environment, so a generated-file transcode remains a launch gate.
