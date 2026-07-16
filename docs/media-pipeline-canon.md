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
