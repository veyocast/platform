begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(10);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000941', 'authenticated', 'authenticated', 'ticket-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000942', 'authenticated', 'authenticated', 'ticket-support@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000943', 'authenticated', 'authenticated', 'ticket-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);
insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000941', 'Ticket owner'),
  ('00000000-0000-4000-8000-000000000942', 'Sanne Support'),
  ('00000000-0000-4000-8000-000000000943', 'Other tenant');
insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000941', 'Ticket tenant', 'ticket-tenant'),
  ('10000000-0000-4000-8000-000000000943', 'Other ticket tenant', 'other-ticket-tenant');
insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000000941'),
  ('10000000-0000-4000-8000-000000000943');
insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000941', '00000000-0000-4000-8000-000000000941', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000000943', '00000000-0000-4000-8000-000000000943', 'tenant_owner');
insert into public.platform_memberships (user_id, role)
values ('00000000-0000-4000-8000-000000000942', 'platform_support');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000941', true);

select is(
  public.create_support_ticket_v1(
    '10000000-0000-4000-8000-000000000941',
    (select id from public.support_departments where slug = 'support'),
    'Player toont geen content',
    'Het scherm blijft op de herstelweergave staan.',
    true,
    'high'
  ) ->> 'outcome',
  'created',
  'tenant member can open a sensitive support ticket'
);
select matches(
  (
    select 'VYO-2026-' || lpad(ticket_number::text, 6, '0')
    from public.support_tickets
  ),
  '^VYO-2026-[0-9]{6}$',
  'ticket receives a stable human-readable identifier'
);
select is((select count(*) from public.support_ticket_messages), 1::bigint,
  'initial ticket body is stored as first message');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000943', true);
select is((select count(*) from public.support_tickets), 0::bigint,
  'another tenant cannot see the ticket');
select is((select count(*) from public.support_ticket_messages), 0::bigint,
  'another tenant cannot see sensitive messages');
select throws_ok(
  $$select public.add_support_ticket_message_v1(
    (select id from public.support_tickets limit 1), 'Cross tenant antwoord', false
  )$$,
  'P0002',
  'ticket not found',
  'RLS-hidden ticket cannot be guessed through the message command'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000942', true);
select is((select count(*) from public.support_tickets), 1::bigint,
  'platform support can read routed tenant tickets');
select lives_ok(
  $$select public.add_support_ticket_message_v1(
    (select id from public.support_tickets limit 1),
    'We onderzoeken de Playerstatus en komen terug met een herstelactie.',
    true
  )$$,
  'platform support can add a restricted response'
);
select is(
  public.update_support_ticket_v1(
    (select id from public.support_tickets limit 1),
    'in_progress',
    '00000000-0000-4000-8000-000000000942'
  ) ->> 'outcome',
  'updated',
  'platform support can assign and update ticket status'
);
select throws_ok(
  $$select public.delete_support_ticket_v1(
    (select id from public.support_tickets limit 1)
  )$$,
  '42501',
  'ticket deletion denied',
  'support cannot delete without ticket admin capability'
);

select * from finish();
rollback;
