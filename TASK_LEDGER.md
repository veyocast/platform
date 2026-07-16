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
| S06-A | todo | castivo/s06-pairing | device-agent | screens/player devices | DB, control, player | e2e | |
| S07-A | todo | castivo/s07-online-player | player-agent | online loop | apps/player | player tests | |
| S08-A | todo | castivo/s08-offline-player | offline-agent | cache/atomic updates | apps/player | offline tests | |
| S09-A | todo | castivo/s09-polish | ux-agent | dashboard polish | control/ui | a11y/e2e | |
| S10-A | todo | castivo/s10-marketing | marketing-agent | homepage | apps/marketing | lighthouse | |
| S11-A | todo | castivo/s11-hardening | review-agents | security/a11y/reliability | all touched | full gates | |
| S12-A | todo | castivo/s12-pilot-ready | orchestrator | end-to-end pilot | docs/tests | full gates | |

## Statuswaarden

`todo`, `in_progress`, `blocked`, `review`, `done`, `superseded`.
