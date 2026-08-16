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
11. Een actieve tenantcontext wordt expliciet gekozen en bij iedere request
    opnieuw tegen membership en status gevalideerd.
12. Gevoelige platformmutaties vereisen Supabase Auth AAL2 in de applicatie én
    database.
13. Paused tenants blijven leesbaar en afspeelbaar, maar menselijke mutaties,
    publicatie en pairing falen ook aan de databasegrens.
14. Archived tenants zijn geen normale Control-context; last-known-good
    playerplayback wordt niet zwart gemaakt.
15. Memberships en invitations worden niet rechtstreeks door browserrollen
    gemuteerd; guarded command-RPC's bewaken hierarchy, laatste owner en
    self-lockout.
16. Invitation-tokens staan alleen gehasht in PostgreSQL, roteren bij resend en
    zijn gebonden aan tenant, invitation, e-mail, expiry en pendingstatus.
17. Schermlimietfouten worden alleen aan bevoegde actors onthuld; RLS blijft de
    eerste zichtbare foutgrens voor onbevoegde of cross-tenant inserts.
18. `SECURITY DEFINER`-functies in een exposed schema geven `PUBLIC` nooit
    `EXECUTE`. Anonieme uitvoering is beperkt tot een expliciet geteste
    allowlist van Player-RPC's die hun eigen revocable devicecredential
    valideren; menselijke command-RPC's vereisen minimaal `authenticated`.

## Helper functions

Use a private schema:

- `private.current_user_id()`
- `private.is_platform_member(role[])`
- `private.is_tenant_member(tenant_id)`
- `private.has_tenant_role(tenant_id, role[])`
- `private.audit_event(...)`
- `private.current_aal()`

Any `SECURITY DEFINER` function must set `search_path = ''` and be narrowly
granted. Iedere nieuwe of gewijzigde functie moet de grants voor `PUBLIC`,
`anon`, `authenticated` en `service_role` expliciet beoordelen; vertrouwen op
Supabase- of PostgreSQL-defaultprivileges is verboden.

## Required tests

- Anonymous sees no tenant data.
- Tenant A cannot read tenant B.
- Tenant A cannot write tenant B.
- Tenant editor cannot invite users.
- Tenant viewer cannot upload/publish.
- Platform viewer cannot mutate.
- AAL1 cannot create tenants, change lifecycle state or mutate platform roles.
- Paused/archived tenants cannot mutate or pair through SECURITY DEFINER RPCs.
- Paused/archived player bootstrap remains available voor bestaande playback.
- Provisioning is transactioneel en idempotent bij gelijke en afwijkende replay.
- Invitation wrong-email, wrong-tenant, expiry en replay falen.
- De laatste tenant/platform owner en de eigen toegang kunnen niet worden
  verwijderd of gedegradeerd via normale beheerroutes.
- Een scherm boven de tenantlimiet en een limiet onder actueel gebruik falen.
- Player device cannot access another screen.
- Storage path spoofing fails.
- Service role is not used for normal user queries.
- De volledige set anoniem uitvoerbare `SECURITY DEFINER`-functies komt exact
  overeen met de credential-beveiligde Player-allowlist.
