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
