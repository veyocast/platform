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
