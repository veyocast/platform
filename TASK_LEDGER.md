# Castivo Task Ledger

Gebruik dit bestand als single source of truth voor Codex-taken.

| ID | Status | Branch | Owner | Scope | Paths | Gates | Notes |
|---|---|---|---|---|---|---|---|
| S00-A | review | castivo/s00-foundation | repo-agent | monorepo + scripts | root, docs, .codex | lint/typecheck/test/build | Initial monorepo foundation complete; gates green locally. |
| S00-B | review | castivo/s00-ci | ci-agent | CI baseline | .github, package scripts | PR gates | GitHub Actions baseline and PR template complete; local gates green. |
| S01-A | review | castivo/s01-tokens | design-system-agent | tokens/tailwind/css | packages/tokens, tokens | tokens:build/lint/typecheck/test/build | Token package, generator and docs complete; local gates green. |
| S01-B | todo | castivo/s01-ui-primitives | ui-agent | primitives/controls | packages/ui | a11y/unit | |
| S02-A | todo | castivo/s02-db-rls | db-agent | tenancy/RLS | supabase, packages/database | db reset + rls | |
| S03-A | todo | castivo/s03-control-shell | control-agent | app shell | apps/control | e2e smoke | |
| S04-A | todo | castivo/s04-media-domain | media-agent | upload/storage | apps/control, worker, DB | rls + unit | |
| S05-A | todo | castivo/s05-playlists | playlist-agent | drafts/releases | DB, control | unit/e2e | |
| S06-A | todo | castivo/s06-pairing | device-agent | screens/player devices | DB, control, player | e2e | |
| S07-A | todo | castivo/s07-online-player | player-agent | online loop | apps/player | player tests | |
| S08-A | todo | castivo/s08-offline-player | offline-agent | cache/atomic updates | apps/player | offline tests | |
| S09-A | todo | castivo/s09-polish | ux-agent | dashboard polish | control/ui | a11y/e2e | |
| S10-A | todo | castivo/s10-marketing | marketing-agent | homepage | apps/marketing | lighthouse | |
| S11-A | todo | castivo/s11-hardening | review-agents | security/a11y/reliability | all touched | full gates | |
| S12-A | todo | castivo/s12-pilot-ready | orchestrator | end-to-end pilot | docs/tests | full gates | |

## Statuswaarden

`todo`, `in_progress`, `blocked`, `review`, `done`, `superseded`.
