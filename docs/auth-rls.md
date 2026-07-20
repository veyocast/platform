# Auth, Tenancy and RLS

S02 creates the first multi-tenant database boundary for VeyoCast.

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

S21 voegt hieraan toe:

- `private.current_aal()` voor de actuele Supabase Auth assurance level;
- een AAL2-trigger op tenant creation/lifecycle en platformrolmutaties;
- actieve-tenanttriggers op alle menselijke authoring- en pairingtabellen;
- service- en playerverkeer zonder Auth-user blijft buiten die menselijke
  statusguard, zodat last-known-good playback niet wordt onderbroken.

S22 voegt transactionele commandfuncties toe voor tenantprovisioning,
lifecycle, schermlimieten, tenantuitnodigingen en platform-/tenantrollen.
Rechtstreekse `authenticated` DML op memberships en invitations is ingetrokken;
mutaties lopen via nauw verleende RPC's met capability-, AAL2-, hierarchy-,
laatste-owner- en self-lockoutcontroles.

## Role Boundaries

- Platform owners/admins can create and update tenants.
- Platform viewers can read tenant lists but cannot mutate tenants.
- Tenant owners/admins can create invitations for their own tenant.
- Tenant editors/viewers cannot invite users.
- Tenant members can only read their own tenant data.
- Audit events are append-only.

## Provisioning en uitnodigingen

Tenantprovisioning schrijft tenant, veilige defaults, owner invitation en
audit-event in één transactie. Een idempotency key met payloadhash voorkomt
dubbele of afwijkende replay. Platformtoegang geeft niet automatisch
tenanttoegang; operationeel mede-eigenaarschap moet expliciet worden gekozen.

Tenantinvites slaan uitsluitend een SHA-256-tokenhash op. Acceptatie bindt de
persoonlijke link opnieuw aan invitation-ID, tenant-ID, ingelogd e-mailadres,
expiry en pendingstatus. Resend maakt een nieuwe invitation met een nieuw token
en trekt de oude link in. Wrong-email, wrong-tenant, expiry en replay falen
server-side. Platformaccounts gebruiken dezelfde Supabase Auth OTP-callback,
maar krijgen hun platformrol afzonderlijk en nooit een tenantmembership.

De Auth invite-template in `supabase/templates/invite.html` stuurt `TokenHash`
naar de server-side `/auth/confirm`-route. Hosted staging en production moeten
dezelfde template, Control-redirect en SMTP-config gebruiken; de standaard
implicit-flow is niet geschikt voor deze SSR-acceptatie.

## Expliciete context en capabilities

Control kiest nooit impliciet de eerste membership. De gekozen tenant-slug staat
in een HttpOnly, SameSite-cookie en wordt bij iedere serverrequest opnieuw tegen
membership en tenantstatus gevalideerd. Een ontbrekende, ingetrokken, vijandige
of gearchiveerde context laadt geen tenantdata en gaat naar de contextkiezer.

Rollen worden centraal naar capabilities vertaald in `@veyocast/auth`.
Navigatie en actievisibility gebruiken dezelfde read-only beslislaag; iedere
mutatie gebruikt server-side `requireControlCapability()` of
`requireTenantCapability()`. RLS en databasefuncties blijven de laatste grens.

## MFA en herstel

Control gebruikt Supabase TOTP MFA voor enrollment en challenge. Gevoelige
platformmutaties vereisen AAL2 zowel in de server action als in PostgreSQL.
Lokale Auth zet `auth.mfa.totp.enroll_enabled` en `verify_enabled` expliciet aan
in `supabase/config.toml`; ieder hosted staging- en productieproject moet TOTP
ook in Supabase Auth ingeschakeld houden.
Supabase levert geen recovery codes; daarom ondersteunt de UI meerdere
geverifieerde authenticators en adviseert zij een tweede factor als herstelpad.
Een factor verwijderen vereist een bestaande AAL2-sessie.

Tenantstatusbeleid:

- `active`: lezen, muteren, publiceren en pairen toegestaan volgens capability;
- `paused`: lezen en bestaande playerplayback blijven werken, nieuwe mutaties,
  publicatie en pairing worden geblokkeerd;
- `archived`: geen normale Control-context of tenantmutaties; bestaande lokale
  playback blijft beschikbaar en herstel loopt via een bevoegde platformactie.

Een database-trigger serialiseert schermaanmaak per tenant en weigert nieuwe
schermen zodra `screen_limit` is bereikt. De trigger controleert pas inhoudelijk
voor bevoegde actors, zodat onbevoegde inserts geen tenantbestaan of limiet via
een afwijkende fout kunnen afleiden.

Media, storage path policies, player-device access and release scoping land in
later domain migrations.
