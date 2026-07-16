# Security and RLS Canon

## Rules

1. RLS enabled on every public application table.
2. Default deny all.
3. Separate policies for select/insert/update/delete.
4. Use `USING` and `WITH CHECK`.
5. Tenant data always scoped by membership.
6. Platform roles are separate from tenant roles.
7. Service-role only in server-only code.
8. Storage is private.
9. Storage path format: `tenants/{tenant_id}/assets/{asset_id}/...`.
10. Player devices only access their assigned release and assets.

## Helper functions

Use a private schema:

- `private.current_user_id()`
- `private.is_platform_member(role[])`
- `private.is_tenant_member(tenant_id)`
- `private.has_tenant_role(tenant_id, role[])`
- `private.audit_event(...)`

Any `SECURITY DEFINER` function must set `search_path = ''` and be narrowly granted.

## Required tests

- Anonymous sees no tenant data.
- Tenant A cannot read tenant B.
- Tenant A cannot write tenant B.
- Tenant editor cannot invite users.
- Tenant viewer cannot upload/publish.
- Platform viewer cannot mutate.
- Player device cannot access another screen.
- Storage path spoofing fails.
- Service role is not used for normal user queries.
