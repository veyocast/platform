# Codex Execution Plan

## Master pattern

1. Orchestrator reads canon.
2. Orchestrator creates/updates task ledger.
3. Orchestrator assigns one isolated task per branch/worktree.
4. Writer agent implements.
5. Reviewer agent checks diff.
6. Gates run.
7. PR opened.

## Allowed autonomy

Codex may:

- split large tasks;
- propose parallel tracks;
- choose implementation order within a sprint;
- create ADRs for decisions;
- add tests needed to prove behavior.

Codex may not:

- defer RLS;
- make player a user account;
- make playlist releases mutable;
- bypass tokens;
- invent logo assets as final;
- replace server authorization with frontend checks;
- skip offline-player gates.

## Local run order

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm db:start
pnpm db:reset
pnpm test:rls
pnpm dev
```
