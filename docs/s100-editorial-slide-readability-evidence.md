# S100 — Editorial slide readability evidence

## Scope

This change improves the one active Editorial Arena news and standings
renderer in browser preview, browser Player and LG Legacy Player. Immutable
release semantics, provider boundaries and the fixed logical canvases remain
unchanged.

## Measured deltas

| Check | Before | After |
| --- | --- | --- |
| Portrait news headline | max 62 px; dense 47 px | max 72 px; dense 58 px |
| Portrait news intro | 26 px | 34 px |
| Landscape news headline | max 66 px | max 80 px |
| Landscape news intro | max 26 px | max 32 px |
| Portrait standings row | max 18 px | max 26 px |
| Landscape standings row | max 22 px | max 28–34 px, runtime-dependent |
| Selected standings row | 7 px left border changed row width | inset highlight; identical rank X-position |
| 945×2048 portrait viewport | 184 px total vertical letterboxing | 0 px vertical letterboxing |

The 945×2048 case needs a 1.0667 scale. Its 97 logical pixels of horizontal
crop per side are fed back into the header, content and footer safe zones, so
screen fill does not clip readable content.

## Data behavior

- RSS identity is the canonical article URL, not a changing provider GUID.
- Tracking parameters and fragments are excluded from identity.
- Within one feed the newest entry wins; the normalized current set removes
  earlier duplicates on successful sync.
- Existing immutable snapshots are not rewritten. Both renderers deduplicate
  those snapshots at view construction.
- Article QR codes are generated locally in the worker, stored once by content
  hash and shipped as verified release assets.

## Automated evidence

- Integration tests prove URL canonicalization and newest-entry selection.
- Worker tests prove local QR generation and the dedicated `article_qr` role.
- RLS tests prove canonical link persistence without widening tenant access.
- Browser tests assert the removed news labels, visible QR, shared standings
  grid, stable selected-row rank position and full extra-tall viewport cover.
- LG route and Player tests exercise the equivalent ES5-compatible runtime.

## Sportlink client scope and club logo

- The wizard builds team choices only from `sports_teams`, whose canonical
  source is the Client ID-bound Sportlink `teams` article. Match and standings
  opponents can no longer leak into the selector.
- Competition, season and availability records retain only own-team IDs. A
  normalized name match can bridge provider ID differences but can never add a
  new team option.
- The already verified official `clublogo` PNG is now normalized to at most
  512×512 WebP, stored content-addressed in `tenant-media`, registered through
  a service-role-only completion RPC and linked to the normalized club.
- Snapshot branding resolves in the order tenant Studio logo, local Sportlink
  club logo, then the existing initials shield. The Player receives the chosen
  asset through the normal immutable release and offline-cache path.
- Expo SDK 57 patch dependencies were aligned with the current official
  package catalog so the Android CI export gate no longer rejects the lockfile.

Final local gate results: database reset plus 45 RLS files/905 assertions;
workspace lint, typecheck and test 30/30; production builds 18/18; focused
slide/LG browser matrix 16/16; Expo dependency check green; a11y 35/35. The
broad Chromium run completed 138 scenarios with 8 intentional skips; two
serial Studio scenarios did not start after their parent failed. Four
resource-load failures (including one Chromium SIGSEGV) and both skipped Studio
scenarios then passed in a serial 6/6 rerun.
