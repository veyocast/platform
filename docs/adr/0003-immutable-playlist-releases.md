# ADR 0003 — Immutable Playlist Releases

## Status

Accepted.

## Decision

Editable playlist drafts are separate from immutable published releases.

## Consequences

- Players always consume a fixed manifest.
- Rollback/restoration creates a new release.
- Assets in releases are not silently mutated.
- Proof-of-play and support become reliable.
