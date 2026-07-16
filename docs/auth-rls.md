# Auth, Tenancy and RLS

S02 creates the first multi-tenant database boundary for Castivo.

## Tables

- `profiles`
- `tenants`
- `platform_memberships`
- `tenant_memberships`
- `tenant_invitations`
- `audit_events`

All application tables have RLS enabled. Tenant-owned tables include
`tenant_id NOT NULL` and tenant indexes. `audit_events.tenant_id` is nullable so
platform-level events can be recorded without inventing a tenant.

## Helpers

Private helper functions live in the `private` schema:

- `private.current_user_id()`
- `private.is_platform_member(role[])`
- `private.is_tenant_member(tenant_id)`
- `private.has_tenant_role(tenant_id, role[])`
- `private.audit_event(...)`

The private schema is not part of the Supabase API schema list. The helper
functions are granted narrowly to `authenticated` and are used by policies to
avoid duplicating role logic.

## Role Boundaries

- Platform owners/admins can create and update tenants.
- Platform viewers can read tenant lists but cannot mutate tenants.
- Tenant owners/admins can create invitations for their own tenant.
- Tenant editors/viewers cannot invite users.
- Tenant members can only read their own tenant data.
- Audit events are append-only.

Media, storage path policies, player-device access and release scoping land in
later domain migrations.
