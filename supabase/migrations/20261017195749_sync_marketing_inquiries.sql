-- Pre-tenant enquiries are platform records, never tenant-visible data.
create table public.marketing_inquiries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('demo', 'contact')),
  name text not null check (length(name) between 2 and 100),
  email text not null check (length(email) between 3 and 254),
  organization text not null check (length(organization) <= 140),
  organization_type text not null check (length(organization_type) <= 80),
  screens text not null check (length(screens) <= 40),
  subject text not null check (length(subject) <= 120),
  message text not null check (length(message) <= 2000),
  setup_intent jsonb,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  revision integer not null default 1,
  notes text not null default '' check (length(notes) <= 4000),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index marketing_inquiries_status_received_idx on public.marketing_inquiries(status, received_at desc);
create index marketing_inquiries_email_received_idx on public.marketing_inquiries(email, received_at desc);
create index marketing_inquiries_received_idx on public.marketing_inquiries(received_at desc);
alter table public.marketing_inquiries enable row level security;
alter table public.marketing_inquiries force row level security;
revoke all on public.marketing_inquiries from public, anon, authenticated;
grant select on public.marketing_inquiries to authenticated;
grant select, insert, update on public.marketing_inquiries to service_role;
create policy marketing_inquiries_platform_read on public.marketing_inquiries
  for select to authenticated using ((select private.has_platform_ticket_capability('platform.ticket.read')));

-- Transactional outbox. Delivery is explicitly separate from receipt.
create table public.marketing_inquiry_delivery (
  inquiry_id uuid primary key references public.marketing_inquiries(id),
  status text not null default 'pending' check (status in ('pending', 'sending', 'accepted', 'unknown', 'failed', 'unconfigured')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  last_error_code text check (last_error_code in ('mail_unconfigured', 'mail_provider_unavailable', 'mail_rejected')),
  sent_at timestamptz
  , provider_message_id text check (length(provider_message_id) <= 200)
);
create index marketing_inquiry_delivery_due_idx on public.marketing_inquiry_delivery(next_attempt_at, inquiry_id)
  where status in ('pending', 'failed') and attempts < 5
    and (last_error_code is null or last_error_code = 'mail_provider_unavailable');
create index marketing_inquiry_delivery_lease_idx on public.marketing_inquiry_delivery(lease_until, inquiry_id)
  where status = 'sending';
alter table public.marketing_inquiry_delivery enable row level security;
alter table public.marketing_inquiry_delivery force row level security;
revoke all on public.marketing_inquiry_delivery from public, anon, authenticated;
grant select on public.marketing_inquiry_delivery to authenticated;
grant select, insert, update on public.marketing_inquiry_delivery to service_role;
create policy marketing_delivery_platform_read on public.marketing_inquiry_delivery
  for select to authenticated using ((select private.has_platform_ticket_capability('platform.ticket.read')));

create function public.submit_marketing_inquiry_v1(p_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  previous public.marketing_inquiries;
  inquiry_id uuid;
  payload_hash text := encode(extensions.digest(p_payload::text, 'sha256'), 'hex');
  normalized_email text := lower(btrim(p_payload->>'email'));
begin
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or length(p_payload::text) > 20000
    or coalesce(p_payload->>'consent', '') <> 'yes'
    or normalized_email is null or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then raise exception using errcode = '22023', message = 'invalid_inquiry'; end if;
  -- Same request and same email serialize both replay and rate-limit checks.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('marketing-request:' || p_request_id::text, 0));
  select * into previous from public.marketing_inquiries where request_id = p_request_id;
  if found then
    if previous.payload_hash <> payload_hash then
      raise exception using errcode = '22023', message = 'inquiry_request_conflict';
    end if;
    return jsonb_build_object('id', previous.id, 'received', true);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('marketing-email:' || normalized_email, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('marketing-intake-budget', 0));
  if (select count(*) from (select 1 from public.marketing_inquiries where received_at > now() - interval '1 minute' limit 30) recent) >= 30 then
    raise exception using errcode = 'P0001', message = 'inquiry_rate_limited';
  end if;
  if (select count(*) from public.marketing_inquiries where email = normalized_email and received_at > now() - interval '1 hour') >= 5 then
    raise exception using errcode = 'P0001', message = 'inquiry_rate_limited';
  end if;
  insert into public.marketing_inquiries(request_id, payload_hash, kind, name, email, organization, organization_type, screens, subject, message, setup_intent)
    values (p_request_id, payload_hash, p_payload->>'kind', btrim(p_payload->>'name'), normalized_email,
      coalesce(p_payload->>'organization',''), coalesce(p_payload->>'organizationType',''), coalesce(p_payload->>'screens',''),
      coalesce(p_payload->>'subject',''), coalesce(p_payload->>'message',''), nullif(p_payload->'setupIntent', 'null'::jsonb))
    returning id into inquiry_id;
  insert into public.marketing_inquiry_delivery(inquiry_id) values (inquiry_id);
  return jsonb_build_object('id', inquiry_id, 'received', true);
end;
$$;
revoke all on function public.submit_marketing_inquiry_v1(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.submit_marketing_inquiry_v1(uuid,jsonb) to service_role;

create function public.update_marketing_inquiry_v1(p_id uuid, p_revision integer, p_status text, p_notes text)
returns integer language plpgsql security definer set search_path = '' as $$
declare new_revision integer;
begin
  if not private.has_platform_ticket_capability('platform.ticket.write') or private.current_aal() <> 'aal2' then
    raise exception using errcode = '42501', message = 'inquiry_update_denied';
  end if;
  if p_status not in ('new', 'contacted', 'closed') or p_status is null or length(p_notes) > 4000 or p_notes is null then
    raise exception using errcode = '22023', message = 'invalid_inquiry_update';
  end if;
  update public.marketing_inquiries set status = p_status, notes = p_notes, revision = revision + 1, updated_at = now()
    where id = p_id and revision = p_revision returning revision into new_revision;
  if not found then raise exception using errcode = '40001', message = 'inquiry_revision_conflict'; end if;
  perform private.audit_event(null, 'marketing.inquiry.updated', 'marketing_inquiry', p_id, 'success', jsonb_build_object('revision', new_revision, 'status', p_status));
  return new_revision;
end;
$$;
revoke all on function public.update_marketing_inquiry_v1(uuid,integer,text,text) from public, anon, authenticated, service_role;
grant execute on function public.update_marketing_inquiry_v1(uuid,integer,text,text) to authenticated;

create function public.claim_marketing_inquiry_mail_v1()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare delivery public.marketing_inquiry_delivery; inquiry public.marketing_inquiries;
begin
  -- An expired sender might already have reached SendGrid. Never resend it
  -- automatically: that would turn an uncertain network response into duplicates.
  update public.marketing_inquiry_delivery set status = 'unknown', lease_id = null, lease_until = null
    where inquiry_id in (select inquiry_id from public.marketing_inquiry_delivery where status = 'sending' and lease_until < now() order by lease_until, inquiry_id limit 20 for update skip locked);
  select * into delivery from public.marketing_inquiry_delivery
    where status in ('pending','failed') and attempts < 5 and next_attempt_at <= now()
      and (last_error_code is null or last_error_code = 'mail_provider_unavailable')
    order by next_attempt_at, inquiry_id for update skip locked limit 1;
  if not found then return null; end if;
  select * into strict inquiry from public.marketing_inquiries where id = delivery.inquiry_id;
  update public.marketing_inquiry_delivery set status = 'sending', attempts = attempts + 1,
    lease_id = gen_random_uuid(), lease_until = now() + interval '1 minute'
    where inquiry_id = delivery.inquiry_id returning * into delivery;
  return jsonb_build_object('id', inquiry.id, 'leaseId', delivery.lease_id,
    'name', inquiry.name, 'email', inquiry.email, 'organization', inquiry.organization,
    'message', inquiry.message, 'screens', inquiry.screens);
end;
$$;
revoke all on function public.claim_marketing_inquiry_mail_v1() from public, anon, authenticated;
grant execute on function public.claim_marketing_inquiry_mail_v1() to service_role;

create function public.complete_marketing_inquiry_mail_v1(p_id uuid, p_lease_id uuid, p_status text, p_provider_id text default null, p_retry_seconds integer default 60)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_status not in ('accepted','unknown','failed','unconfigured') or p_status is null
    or length(p_provider_id) > 200 or p_retry_seconds is null or p_retry_seconds not between 60 and 86400 then
    raise exception using errcode = '22023', message = 'invalid_mail_completion';
  end if;
  update public.marketing_inquiry_delivery set status = p_status,
    provider_message_id = case when p_status = 'accepted' then p_provider_id else null end,
    sent_at = case when p_status = 'accepted' then now() else null end,
    last_error_code = case p_status when 'unconfigured' then 'mail_unconfigured' when 'failed' then 'mail_provider_unavailable' else null end,
    next_attempt_at = now() + make_interval(secs => greatest(p_retry_seconds, least(86400, (60 * power(2, attempts))::integer))),
    lease_id = null, lease_until = null
    where inquiry_id = p_id and lease_id = p_lease_id and status = 'sending';
  return found;
end;
$$;
revoke all on function public.complete_marketing_inquiry_mail_v1(uuid,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.complete_marketing_inquiry_mail_v1(uuid,uuid,text,text,integer) to service_role;

create function public.retry_marketing_inquiry_mail_v1(p_id uuid, p_revision integer, p_confirm_uncertain boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare delivery public.marketing_inquiry_delivery; current_revision integer;
begin
  if not private.has_platform_ticket_capability('platform.ticket.write') or private.current_aal() <> 'aal2' then
    raise exception using errcode = '42501', message = 'inquiry_retry_denied';
  end if;
  select revision into current_revision from public.marketing_inquiries where id = p_id for update;
  if current_revision is distinct from p_revision then raise exception using errcode = '40001', message = 'inquiry_revision_conflict'; end if;
  select * into strict delivery from public.marketing_inquiry_delivery where inquiry_id = p_id for update;
  if delivery.status in ('accepted','sending','pending') or (delivery.status = 'unknown' and p_confirm_uncertain is distinct from true) then
    raise exception using errcode = '22023', message = 'inquiry_retry_not_safe';
  end if;
  update public.marketing_inquiry_delivery set status = 'pending', attempts = 0, last_error_code = null, next_attempt_at = now()
    where inquiry_id = p_id;
  update public.marketing_inquiries set revision = revision + 1, updated_at = now() where id = p_id returning revision into current_revision;
  perform private.audit_event(null, 'marketing.inquiry.mail_retry', 'marketing_inquiry', p_id, 'success', jsonb_build_object('previousStatus', delivery.status, 'revision', current_revision));
  return current_revision;
end;
$$;
revoke all on function public.retry_marketing_inquiry_mail_v1(uuid,integer,boolean) from public, anon, authenticated, service_role;
grant execute on function public.retry_marketing_inquiry_mail_v1(uuid,integer,boolean) to authenticated;
