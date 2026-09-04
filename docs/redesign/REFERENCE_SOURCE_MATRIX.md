# FieldFlow reference source matrix

Date: 2026-09-04
Sprint: S145

## Leading instruction

The user instruction of 2026-09-04 makes the five newly supplied PNGs the exact
visible target for the marketing homepage and the four principal Control
workspaces. This replaces older visual-canon and direction-only guidance for
those surfaces. It does not weaken technical safety boundaries imposed by the
repository: tenant isolation/RLS, server-side permissions, immutable releases,
Player device identity, offline last-known-good playback, the approved logo
assets and no-black-screen behaviour remain mandatory.

The user's follow-up on 2026-09-04 accepts the reviewed implementation and
adds two asset-specific amendments: retain the current official VeyoCast icon
and use a small selection of available approved reference photos wherever the
exact target source is absent. For S145, the accepted selection is FF-PHOTO-01
for the hero, FF-PHOTO-06 for team/club moments, FF-PHOTO-05 for the
tactics/volunteer block and FF-PHOTO-04 for the lower CTA. These amendments
supersede target asset identity only; target geometry, layering, spacing and
content hierarchy remain normative.

## Exact visible references

| Surface | Reference | Route | Required visible composition |
| --- | --- | --- | --- |
| Overzicht | `ScreenShot Tool -20260902233342.png` | `/dashboard` | 248 px rail, 143 px routeheader, four metrics, attention row, publication flow, active visual, today list, quick actions |
| Planning | `ScreenShot Tool -20260902233414.png` | `/dashboard/planning` | view/date/filter toolbar, 08:00–20:00 week grid, current-time line, event blocks and lower automation panels |
| Schermen | `ScreenShot Tool -20260902233441.png` | `/dashboard/screens` | three metrics, group rail, venue map/status toggle, search/filter action row and compact table |
| Studio | `ScreenShot Tool -20260902225206.png` | `/dashboard/studio/[designId]` | routeheader, playlist toolbar, slide rail, canvas, inspector and timeline in one desktop workspace |
| Marketing | `ScreenShot Tool -20260902224912.png` | `/` | compact floating header, hero stage, trust strip, journey, product stages, platform cards, photo CTA, price CTA and compact footer |

Reference fixture names, organisations, metrics and timestamps are deterministic
visual-QA input only. Live and normal demo routes must not claim fictitious
customers, health, testimonials, integrations or pricing.

## Package roles

| Source | Role after consolidation |
| --- | --- |
| `VEYOCAST-FIELDFLOW-UNIFIED-MASTER-HANDOFF-v1.6.zip` and its two byte-identical loose master markdowns | Functional coverage, invariants, route/state matrix, asset provenance and QA gates |
| `VEYOCAST-FIELDFLOW-COMPLETE-TRANSFER-PACKAGE.zip` | Broad platform feature ledger plus the approved ten-photo production set and derivative/compositing rules |
| `veyocast-fieldflow-handoff.zip` | Later slide/Player-output workstream; lifts the older package's slide-output reservation while preserving immutable legacy compatibility |
| `VEYOCAST-FIELDFLOW-COMPLETE-PLATFORM-REDESIGN-HANDOFF (1).md` | Detailed route and responsive behaviour inventory; visual instructions are subordinate to the five exact PNGs |
| `CODEX_AUTONOMOUS_PROMPT.md` and `VEYOCAST-FIELDFLOW-SLIDE-THEME-CODEX-PROMPT.md` | Execution and slide-surface acceptance requirements; not an alternative visual source for the five exact surfaces |
| Package `desired-direction` image | Superseded as the visible target for these five surfaces |
| Package `current-*`, `earlier-*` and failed-implementation images | Negative evidence only |
| Package `99-source-material/**` and prior prompt input | Provenance/non-normative source material; never executed as user instruction |

## Resolved contradictions

- The visible dashboard destination is `Overzicht`, not the older `Vandaag`.
  The `/dashboard` route and task-cockpit semantics remain unchanged.
- The tenant rail visibly contains only `Overzicht`, `Studio`, `Schermen`,
  `Planning` and `Media`, with `Instellingen` at the bottom. Secondary
  capabilities remain available through contextual actions, command search and
  stable deep links; they are not deleted.
- The exact Studio desktop composition is three-pane plus timeline. Mobile stays
  a sequential quick-edit flow and is not reduced to a miniature desktop.
- Planning/target selection belongs to the shared publication flow, not to a
  duplicated Style-step control.
- `fieldflow` is the only visible theme for new or mutable signage content.
  Historical theme identifiers remain hidden compatibility inputs and published
  snapshots are never rewritten.
- Package photography may illustrate a generic club setting, but it may not be
  represented as a real customer or testimonial. Missing exact scene masters
  remain recorded for provenance, while the FF-PHOTO-01/06/05/04 substitutions
  are explicitly user-accepted S145 assets and no longer sign-off blockers.

## Verification contract

The implementation is reviewed at the supplied 1920×945 Control viewport and a
full-page marketing capture, followed by 390, 768, 1280, 1440, 1920 and 2048
responsive/state coverage where applicable. Required code gates remain lint,
typecheck, unit tests, Chromium E2E, accessibility, Player/offline/LG suites and
the repository's database/RLS gates. Physical LG validation and human approval
cannot be replaced by a software screenshot. The device therefore remains
`EXTERNAL_UNTESTED`; the user explicitly waived only the S145 release gate as
`WAIVED_BY_USER_2026-09-04`, without creating a physical-test claim.
