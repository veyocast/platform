# S184 — Preserve the complete goal intro

The user has uploaded the correct 9:16 creative and reports clipping. S182's
shared `object-fit: cover` crops any source whose ratio differs from the actual
viewport. Restore one no-crop presentation policy in the shared decoder for
React and Static LG: `contain`, centered, within the full celebration bounds.
Matching 16:9/landscape and 9:16/portrait fill the canvas. Never stretch, zoom or
rotate a creative to hide a mismatch.

Production readback additionally proves a publication mismatch: the new
1080×1920 `Goal916` is ready and saved in draft revisions 14–15, while published
version 4 still references the old 1920×1080 `Goal` in the portrait slot.
Test events use the immutable published version, not the draft. Do not alter
historical versions or bypass Studio publication authorization. Follow the
ordinary publisher path and verify the resulting version where access permits.

Ownership: shared goal-video decoder, its unit tests, existing goal browser
matrix, the existing pairing cooldown regression test, this sprint prompt and
TASK_LEDGER.md. No schema, worker, dependency,
service-worker, tenant theme or playlist changes. Preserve orientation selection,
checksum cache, native HTTPS recovery, natural ended, queue, watchdogs and cleanup.

Verify both runtimes, both source and screen orientations, real decoded media,
viewport resize, matching-ratio fullscreen and complete framing with mismatched
ratios. Run lint/typecheck/unit/build and Player/offline/a11y gates. Commit,
push, PR/CI and deploy through the existing exact-SHA production flow. Report
publication status separately from the application deployment.

Validation: lint/typecheck/unit (30 tasks each), Player unit 308/308 and build
(18 tasks) passed. Combined Player/offline/a11y Chromium run: 204 passed, two
optional external-reference skips, two unrelated failures. One Chromium process
crashed before the sport-list test created its context; that case subsequently
passed 3/3. The pairing refresh test consumed its real five-second cooldown during
a slow reload. It now pauses the test clock and verifies zero requests at 4,999 ms
and one at 5,000 ms; 3/3 runs pass. Production pairing code is unchanged.
All 26 goal browser cases passed, including both runtimes, real decoded assets,
natural ended, recovery, queue and playlist resume. Matching and resized portrait
captures were visually checked for complete framing in React and Static LG.
