# Sub-agent Orchestration

## Preferred strategy

Do not run one giant writer. Use waves.

## Wave 0 — Repo and canon

- `repo-agent`: monorepo, pnpm, scripts, env validation.
- `canon-agent`: docs, ADRs, task ledger, design canon imports.
- `ci-agent`: GitHub Actions, baseline gates.

No two agents edit root package files simultaneously.

## Wave 1 — Foundation

- `design-system-agent`: tokens, Tailwind preset, CSS variables.
- `ui-agent`: primitives and controls.
- `db-agent`: tenancy schema and RLS.
- `shell-agent`: app shells for marketing/control/player.

Parallel allowed with path ownership.

## Wave 2 — Domain

- `media-agent`: media assets, storage, upload sessions.
- `playlist-agent`: drafts, items, releases.
- `device-agent`: screens, player devices, pairing.
- `control-ux-agent`: dashboard patterns.

Migrations are serialized by db-agent.

## Wave 3 — Player

- `online-player-agent`: manifest fetch and loop playback.
- `offline-agent`: cache adapter and IndexedDB.
- `atomic-update-agent`: pending release verification/switch.
- `diagnostics-agent`: heartbeat and diagnostics.

Service-worker and cache-version files are single-owner files.

## Wave 4 — Hardening

- `security-reviewer`: RLS, service role, permissions.
- `design-reviewer`: design canon, a11y, responsive.
- `player-reliability-reviewer`: offline/restart/corruption tests.
- `docs-agent`: setup, admin guide, pilot checklist.

## Agent prompt template

```text
You are the {role} for Castivo.
Read AGENTS.md, PLANS.md, TASK_LEDGER.md and relevant canon docs first.
Work only on {paths}.
Implement {scope}.
Run {gates}.
Stop and report if ownership, RLS, service-role, player-offline, or design-canon rules are at risk.
Finish with changed files, tests run, remaining risks and next suggested task.
```
