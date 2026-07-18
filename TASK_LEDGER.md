# Castivo Task Ledger

Gebruik dit bestand als single source of truth voor Codex-taken.

| ID | Status | Branch | Owner | Scope | Paths | Gates | Notes |
|---|---|---|---|---|---|---|---|
| S00-A | review | castivo/s00-foundation | repo-agent | monorepo + scripts | root, docs, .codex | lint/typecheck/test/build | Initial monorepo foundation complete; gates green locally. |
| S00-B | review | castivo/s00-ci | ci-agent | CI baseline | .github, package scripts | PR gates | GitHub Actions baseline and PR template complete; local gates green. |
| S01-A | review | castivo/s01-tokens | design-system-agent | tokens/tailwind/css | packages/tokens, tokens | tokens:build/lint/typecheck/test/build | Token package, generator and docs complete; local gates green. |
| S01-B | review | castivo/s01-ui-primitives | ui-agent | primitives/controls | packages/ui | lint/typecheck/test/build/storybook | UI primitives, Storybook skeleton and unit checks complete. |
| S02-A | review | castivo/s02-db-rls | db-agent | tenancy/RLS | supabase, packages/database | db reset + rls | Identity, tenancy, invitation and audit RLS complete; local gates green. |
| S03-A | review | castivo/s03-control-shell | control-agent | app shell | apps/control | e2e smoke | Control shell, auth callback routes and smoke/a11y tests complete; local gates green. |
| S04-A | review | castivo/s04-media-domain | media-agent | upload/storage | apps/control, worker, DB | rls + unit/e2e/a11y | Media upload schema, storage RLS, worker planning and control intake complete; local gates green. |
| S05-A | review | castivo/s05-playlists | playlist-agent | drafts/releases | DB, control | unit/rls/e2e/a11y | Playlist draft, publish review and immutable release model complete; local gates green. |
| S06-A | review | castivo/s06-pairing | device-agent | screens/player devices | DB, control, player | db reset + rls/e2e/a11y/player | Screens, player devices and pairing flow complete; local gates green. |
| S07-A | review | castivo/s07-online-player | player-agent | online loop | apps/player | lint/typecheck/test/build/e2e/a11y/player/offline | Online manifest fetch and playback loop complete; local gates green. |
| S08-A | review | castivo/s08-offline-player | offline-agent | cache/atomic updates | apps/player | lint/typecheck/test/build/e2e/a11y/player/offline | IndexedDB, Cache Storage, verified pending releases and last-known-good playback complete; local gates green. |
| S09-A | review | castivo/s09-polish | ux-agent | dashboard polish | control/ui | lint/typecheck/test/build/e2e/a11y | Control dashboard polish complete for media, playlists, screens, publish review and diagnostics; local gates green. |
| S10-A | review | castivo/s10-marketing | marketing-agent | homepage | apps/marketing | lint/typecheck/test/build/e2e/a11y | Marketing homepage shell, SEO metadata, hero, use cases and CTA complete; Lighthouse CLI blocked locally by Chrome cleanup EPERM. |
| S11-A | review | castivo/s11-hardening | review-agents | security/a11y/reliability | player/config/tests | lint/typecheck/test/build/e2e/a11y/player/offline/rls | Player cache cleanup, service-role boundary test and player a11y hardening complete; local gates green. |
| S11-B | review | castivo/s11b-enterprise-control-ux | ux-agent | enterprise Control UX | apps/control, docs/design-canon, docs, tests | lint/typecheck/test/build/e2e/a11y + headless visual QA | Canon v1.0.0 package and official icon hash verified; Control rebuilt as an operational SaaS shell with resource workflows, responsive states and green repo-wide gates. |
| S12-A | review | castivo/s12-pilot-ready | orchestrator | end-to-end pilot | docs/tests | full gates | pilot runbook, launch checklist, evidence and cross-app smoke test complete; local Supabase/RLS gate remains pending Docker recovery |
| S12-B | review | castivo/s12-live-vertical-slice | repo-agent | live pilot vertical slice | Control, Player, Supabase, docs, tests | db reset + rls + lint/typecheck/test/build/e2e/a11y/player/live e2e | Real auth, verified PNG upload, immutable publish, Player-owned pairing token, signed manifest, atomic offline activation and heartbeat work end to end; MP4 processing and 24-hour reliability validation remain outside this slice. |
| S13-A | review | castivo/s13-lg-webos-audit | player-agent | LG webOS Signage capability audit en Device Lab | Player, Supabase, docs, tests | db reset + rls + lint/typecheck/test/build/e2e/a11y/player/offline | Hosted-webbasis, PWA-shell, Range-pad, atomic active/previous releases en afgeschermd Device Lab zijn lokaal groen; watchdog volgt in S13-B, fysieke LG-tests, echte MP4-processing en 24-uurs soak blijven verplicht vóór een supportclaim. |
| S13-B | review | castivo/s13-player-watchdog | player-agent | productie-watchdog en begrensd playbackherstel | Player, heartbeat, docs, tests | lint/typecheck/test/build/e2e/a11y/player/offline | Media-events, start/progress/stallbewaking, retry/skip, last-known-goodherstel, reloadcooldown en geredigeerde heartbeatfouten zijn lokaal groen; fysieke LG-validatie blijft verplicht. |

## Statuswaarden

`todo`, `in_progress`, `blocked`, `review`, `done`, `superseded`.
