-- Product logos reuse validated tenant media and remain ordinary immutable
-- release assets. This command only changes the mutable catalogue reference;
-- existing snapshots and releases are intentionally untouched.

create or replace function public.set_tenant_product_logo_v1(
  p_product_id uuid,
  p_expected_revision bigint,
  p_media_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  product_record public.tenant_products%rowtype;
  asset_record public.media_assets%rowtype;
begin
  select product.* into product_record
  from public.tenant_products product
  where product.id = p_product_id
  for update;

  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  if actor_id is null
    or not private.has_tenant_capability(
      product_record.tenant_id,
      'tenant.product.write'
    )
  then
    raise exception 'actor cannot edit product logo' using errcode = '42501';
  end if;

  perform private.require_active_tenant_command(product_record.tenant_id);

  if p_expected_revision <> product_record.revision then
    return jsonb_build_object(
      'outcome', 'conflict',
      'actualRevision', product_record.revision
    );
  end if;

  if p_media_asset_id is not null then
    select asset.* into asset_record
    from public.media_assets asset
    where asset.id = p_media_asset_id
      and asset.tenant_id = product_record.tenant_id
      and asset.kind = 'image'
      and asset.status = 'ready'
      and asset.deleted_at is null;

    if not found then
      raise exception 'product logo asset is unavailable'
        using errcode = '23514';
    end if;
  end if;

  update public.tenant_products
  set
    image_media_asset_id = p_media_asset_id,
    revision = revision + 1,
    updated_by = actor_id
  where id = product_record.id;

  perform private.audit_event(
    product_record.tenant_id,
    case
      when p_media_asset_id is null then 'product.logo.removed'
      else 'product.logo.updated'
    end,
    'tenant_products',
    product_record.id,
    'success',
    jsonb_build_object(
      'previousMediaAssetId', product_record.image_media_asset_id,
      'mediaAssetId', p_media_asset_id
    )
  );

  return jsonb_build_object(
    'outcome', 'updated',
    'revision', product_record.revision + 1,
    'mediaAssetId', p_media_asset_id
  );
end;
$$;

revoke all on function public.set_tenant_product_logo_v1(
  uuid, bigint, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.set_tenant_product_logo_v1(
  uuid, bigint, uuid
) to authenticated;
