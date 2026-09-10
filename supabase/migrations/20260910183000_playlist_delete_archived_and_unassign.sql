-- Allow tenant administrators to permanently remove drafts and archived
-- playlists. Published releases remain protected by their immutable FK's.
drop policy if exists "playlists_delete_draft_by_admin" on public.playlists;
create policy "playlists_delete_by_admin"
on public.playlists
for delete
to authenticated
using (
  (
    private.has_tenant_role(tenant_id, array[
      'tenant_owner',
      'tenant_admin'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  )
);
