# S210 — Database load guardrails and clean Supabase cutover

## Objective

Remove the proven no-op write and full-scan paths that saturated the pilot
database, then prepare a clean, reversible Supabase project cutover without
copying historical test churn.

## Owned paths

- `apps/media-worker/src/ledscores-connector-runner.ts`
- `apps/media-worker/src/worker-config.ts`
- matching media-worker tests
- one new forward-only migration and the directly related pgTAP tests
- publication runtime index allowlist
- S210 plan, ledger and deployment evidence

## Requirements

- Keep periodic Player heartbeats and last-known-good playback behavior.
- Store sync transition history only when phase, release or stable detail
  changes; volatile acknowledgement and current-item fields are not events.
- An open LED Scores websocket is renewed, never reclaimed on every poll.
- Add the exact tenant/screen/latest sync-event index used by Control.
- Configure bounded autovacuum/analyze response for pruned telemetry tables.
- Preserve v1 RPC compatibility and add a service-role-only v2 claim boundary.
- Do not rewrite an existing migration, restore a full production dump, copy
  device credentials, or delete the old project.
- Build the new project from migrations; import only reviewed pilot state and
  currently referenced media.

## Gates

```bash
pnpm db:reset
pnpm test:rls
pnpm lint
pnpm typecheck
pnpm test
```

Before cutover, also prove Auth, RLS, Storage, Sportlink, LED Scores
WebSocket→database→slide, publication/manifest, heartbeat and Player LKG against
the new project. Project creation requires explicit cost confirmation. The final
production switch requires reviewed data scope and an environment rollback.

