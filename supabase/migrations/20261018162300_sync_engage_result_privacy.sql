-- Enforce the campaign policy at the shared payload boundary, including vote
-- receipts and identity reads. A caller cannot reveal after_close results early.
-- CREATE OR REPLACE preserves the existing OID, signature and private ACL.
create or replace function private.engage_public_payload_v1(
  p_campaign_id uuid,
  p_include_results boolean
) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', campaign.public_id,
    'kind', campaign.kind,
    'status', case when campaign.status = 'closed' then 'closed' else 'live' end,
    'title', campaign.title,
    'question', campaign.question,
    'resultVisibility', campaign.result_visibility,
    'privacyNotice', campaign.privacy_notice,
    'closesAt', campaign.ends_at,
    'tenantName', tenant.name,
    'resultsVisible', visibility.include_results,
    'totalVotes', case when visibility.include_results then (
      select count(*) from public.engage_votes vote
      where vote.tenant_id = campaign.tenant_id and vote.campaign_id = campaign.id
    ) else 0 end,
    'options', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', option.id,
        'label', option.label,
        'sortOrder', option.sort_order,
        'voteCount', case when visibility.include_results then (
          select count(*) from public.engage_votes vote
          where vote.tenant_id = option.tenant_id
            and vote.campaign_id = option.campaign_id
            and vote.option_id = option.id
        ) else null end
      )) order by option.sort_order)
      from public.engage_options option
      where option.tenant_id = campaign.tenant_id and option.campaign_id = campaign.id
    ), '[]'::jsonb)
  )
  from public.engage_campaigns campaign
  join public.tenants tenant on tenant.id = campaign.tenant_id
  cross join lateral (
    select coalesce(p_include_results, false)
      and (campaign.result_visibility <> 'after_close' or campaign.status = 'closed') as include_results
  ) visibility
  where campaign.id = p_campaign_id;
$$;
