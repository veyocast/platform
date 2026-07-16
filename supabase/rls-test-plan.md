# RLS Test Plan

Use pgTAP/Supabase DB tests to prove:

1. Anonymous cannot select tenants.
2. Tenant member can select own tenant.
3. Tenant member cannot select other tenant.
4. Tenant editor can create media in own tenant.
5. Tenant editor cannot create media in another tenant by spoofing `tenant_id`.
6. Tenant viewer cannot create media.
7. Tenant admin can invite member.
8. Tenant editor cannot invite member.
9. Platform admin can list tenants.
10. Platform viewer cannot mutate tenants.
11. Player device can fetch only assigned screen release.
12. Storage object path outside own tenant is denied.

## S02 coverage

S02 implements and tests the identity, tenancy, membership, invitation and audit
event boundary for items 1, 2, 3, 7, 8, 9 and 10. Media/upload, player-device
and storage path policies are intentionally deferred to their domain migrations
so their tables and storage buckets exist before policies are written.

## S04 coverage

S04 implements and tests media assets, upload sessions, processing jobs and the
private `tenant-media` storage bucket for items 4, 5, 6 and 12. The test proves
tenant viewers stay read-only, tenant editors can create upload work for their
own tenant, cross-tenant storage path spoofing fails, and platform viewers do
not gain media mutation rights.

## S05 coverage

S05 implements and tests playlist drafts, playlist items, publish review and
immutable releases. The test proves tenant editors can publish only valid ready
media, tenant viewers cannot publish or mutate, cross-tenant playlist spoofing
fails, direct release writes are denied, and release rows reject mutation after
publication.

## S06 coverage

S06 implements and tests screens, player devices and pairing sessions for item
11. The test proves tenant admins can manage their own screens, viewers stay
read-only, anonymous players can only create hashed pairing sessions, direct
device writes are denied, tenant B cannot claim or read tenant A pairing state,
and player bootstrap returns only the screen assigned to the matching device
token.
