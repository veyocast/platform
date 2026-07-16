# ADR 0001 — Local Codex First

## Status

Accepted for MVP.

## Decision

Castivo MVP is built locally with Codex in WSL2 and Git worktrees. GitHub remains source of truth and PR gates remain mandatory.

## Consequences

- No production secrets locally.
- Supabase local is used for development.
- Production deployment is prepared but not required for MVP construction.
