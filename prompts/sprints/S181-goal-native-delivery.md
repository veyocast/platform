# S181 — Native goal video recovery after production evidence

Continuation of the authorized S180 incident, based on deployed
`6623844de58f75a168cc90280dbafada946b8d8b` (PR #205).
Ownership: shared goal decoder, React/Static LG invocation, bounded heartbeat
diagnostics, their unit/browser tests and task documentation. No database,
immutable media/version, dependency or service-worker change.

The protected production probe verified both published assets: MP4, H.264 High
Level 4.0, yuv420p, 24 fps, 15.041667 s, no audio, fast-start, rotation 0,
correct SHA-256. Both are 1920×1080, including the portrait slot. A real 9:16
source is absent; do not invent or destructively crop one.

Two synthetic goals on the online 1080×1920 Static LG / Chromium 79 device
selected the correct portrait asset but immediately emitted
`GOAL_VIDEO_LOAD_ERROR`. Overlay fallback and playlist playback continued.
Normal LG video already permits HTTPS/Range because native decoders can reject
Blob video (see `docs/audits/media-playlist-navigation-audit.md`). Goal intro
had retained a Blob-only path.

Keep verified local bytes as the first source. Before playback starts, a
native refusal may try the same published HTTPS source once while online.
Keep one decoder, bounded watchdogs, natural `ended`, cleanup and queued events.
Ignore the old source's rejected play promise; never replay a started video.
Both failures still show the overlay. Record source kind and numeric native
error, never URLs, tokens or member data. Native HTTPS recovery has a network
dependency on devices that cannot decode local Blob media; this is not native
filesystem caching. Measure real startup/completion before claiming recovery.

Unit tests cover refusal, one attempt, stale promises, offline/non-HTTPS
rejection, failures after start and cleanup. Browser tests force native Blob
refusal then exercise HTTPS through natural ended in both renderers. Run
lint/typecheck/unit, Player/offline/browser and build, then normal PR/CI and
exact-SHA staging→production. Read actual device diagnostics after deployment.

S180 recovery completed 178 snapshots (143 current slides plus 35 release
references). Four recovery releases were created; Scherm Hal was concurrently
advanced by the normal publisher to v32, so its obsolete branch was superseded.
The online portrait device activated Prijslijst Final v3. Both existing draft
versions and fixed-light theme remain part of final readback.

Local verification: lint/typecheck/unit each 30 tasks pass (the unit suite also
ran without cache); 308 Player unit tests, 18 goal browser tests, 190 full
Player/offline tests pass with only two absent optional reference corpora,
eight Player accessibility tests pass, and all 18 production build tasks pass,
including Chrome-79/webOS and browser credential-boundary checks.
