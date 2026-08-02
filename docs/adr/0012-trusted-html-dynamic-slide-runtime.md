# ADR 0012 — Trusted HTML/CSS runtime for dynamic slides

Status: accepted  
Date: 2026-08-02

## Context

Menu, RSS news and Sportlink data change more frequently than ordinary media.
Rendering every data refresh only as a PNG is safe and deterministic, but it
makes multi-page content less fluid and delays visible updates until the media
worker has produced an image. The Players are already browser runtimes, and
pairing and recovery prove that conservative HTML/CSS works on the target LG.

Running arbitrary stored HTML or provider output would nevertheless violate the
tenant, security, offline and webOS compatibility boundaries.

## Decision

Dynamic releases may contain a `dynamicTemplate` payload when all of these
conditions hold:

1. the template is a published platform template with a known slide type and
   identity;
2. its source snapshot is immutable and belongs to the same tenant;
3. payload data passes the bounded contracts package schema;
4. the release also references the ready PNG generated for that snapshot.

The normal Player and LG Legacy Player map the known identity to locked product
code. They construct DOM nodes, assign user-visible values through React text
nodes or `textContent`, and never interpret stored markup, CSS or JavaScript.
Menu, news and Sportlink data are paginated deterministically. Playback duration
is increased when necessary so every page remains visible for at least five
seconds.

Latest-mode slides trigger a new immutable snapshot after a successful RSS,
Twelve, Sportlink or manual-product revision. Only mutable playlist concepts
that already contain that slide follow a completed snapshot and matching PNG.
Published releases and active Player releases are never mutated.

## Consequences

- Frequently changing slides use responsive type and layout at the Player's
  real viewport.
- Light/dark and portrait/landscape variants share one constrained runtime.
- Existing checksum, atomic activation and last-known-good behavior remain
  available through the required PNG.
- The Player release envelope grows by a bounded amount of normalized data.
- A new slide type needs an explicit contract, mapper, locked renderer,
  fallback template and tests; adding a database template row is insufficient.
- Physical LG verification remains necessary for typography and video-layer
  interaction even though the runtime uses conservative browser features.

## Rejected alternatives

- Provider pages in an iframe: rejected because it breaks SSRF, offline,
  privacy, availability and visual-control boundaries.
- Tenant-authored HTML/JavaScript: rejected because it creates an executable
  multi-tenant content channel.
- PNG-only forever: retained as fallback but rejected as the only presentation
  path because it makes paging and frequent source updates unnecessarily
  heavyweight.
- Mutating published releases after every import: rejected because releases
  are immutable and rollback/audit must stay trustworthy.
