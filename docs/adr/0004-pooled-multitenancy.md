# ADR 0004 — Pooled Multi-tenancy

## Status

Accepted for MVP.

## Decision

Use one Supabase project per environment with tenant-scoped rows, RLS and storage policies.

## Consequences

- Faster MVP.
- Strong RLS tests required.
- Tenant-aware foreign keys required where relevant.
- Per-tenant databases/schemas may be reconsidered later for enterprise needs.
