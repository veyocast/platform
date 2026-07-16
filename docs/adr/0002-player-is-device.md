# ADR 0002 — Player is a Device, Not a User

## Status

Accepted.

## Decision

Players are registered devices with revocable sessions, not Supabase Auth users.

## Consequences

- Human roles remain clean.
- Device access is scoped to assigned screen and releases.
- Pairing flow is required.
- Device sessions must be revocable and audited.
