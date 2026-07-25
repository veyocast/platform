-- S41-C: tenant-safe support desk, departments and bounded platform work roles.

alter table public.tenant_custom_roles
  drop constraint tenant_custom_roles_capabilities_check,
  add constraint tenant_custom_roles_capabilities_check check (
    capabilities <@ array[
      'tenant.media.write', 'tenant.product.write',
      'tenant.playlist.write', 'tenant.playlist.publish',
      'tenant.screen.manage', 'tenant.settings.manage', 'tenant.audit.read',
      'tenant.support.export', 'tenant.ticket.write',
      'tenant.studio.read', 'tenant.studio.create', 'tenant.studio.edit_own',
      'tenant.studio.edit_all', 'tenant.studio.archive',
      'tenant.studio.template.manage', 'tenant.studio.motion.edit',
      'tenant.studio.render', 'tenant.studio.job.manage'
    ]::text[]
    and (
      ('tenant.media.write' = any(capabilities))
      = ('tenant.playlist.write' = any(capabilities))
    )
  );

alter function private.builtin_tenant_capabilities(public.tenant_role)
  rename to builtin_tenant_capabilities_before_tickets;
create function private.builtin_tenant_capabilities(p_role public.tenant_role)
returns text[]
language sql immutable set search_path = ''
as $$
  select private.builtin_tenant_capabilities_before_tickets(p_role)
    || array['tenant.ticket.read', 'tenant.ticket.write']::text[];
$$;

alter function private.tenant_baseline_capabilities()
  rename to tenant_baseline_capabilities_before_tickets;
create function private.tenant_baseline_capabilities()
returns text[]
language sql immutable set search_path = ''
as $$
  select private.tenant_baseline_capabilities_before_tickets()
    || array['tenant.ticket.read']::text[];
$$;

alter function private.normalize_custom_role_capabilities(text[])
  rename to normalize_custom_role_capabilities_before_tickets;
create function private.normalize_custom_role_capabilities(p_capabilities text[])
returns text[]
language sql immutable set search_path = ''
as $$
  select private.normalize_custom_role_capabilities_before_tickets(
    coalesce(p_capabilities, '{}'::text[])
  ) || case
    when 'tenant.ticket.write' = any(coalesce(p_capabilities, '{}'::text[]))
    then array['tenant.ticket.write']::text[]
    else '{}'::text[]
  end;
$$;

create table public.platform_custom_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 2 and 80),
  description text check (description is null or length(description) <= 500),
  capabilities text[] not null default '{}'::text[] check (
    capabilities <@ array[
      'platform.ticket.read',
      'platform.ticket.write',
      'platform.ticket.sensitive',
      'platform.ticket.admin'
    ]::text[]
  ),
  active boolean not null default true,
  revision bigint not null default 0 check (revision >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.platform_custom_role_assignments (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role_id uuid not null references public.platform_custom_roles(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now()
);
create trigger platform_custom_roles_set_updated_at
before update on public.platform_custom_roles
for each row execute function private.set_updated_at();

create or replace function private.builtin_platform_ticket_capabilities()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select case
    when private.is_platform_member(array[
      'platform_owner'::public.platform_role,
      'platform_admin'::public.platform_role
    ])
    then array[
      'platform.ticket.read', 'platform.ticket.write',
      'platform.ticket.sensitive', 'platform.ticket.admin'
    ]::text[]
    when private.is_platform_member(array['platform_support'::public.platform_role])
    then array[
      'platform.ticket.read', 'platform.ticket.write',
      'platform.ticket.sensitive'
    ]::text[]
    when private.is_platform_member(array['platform_viewer'::public.platform_role])
    then array['platform.ticket.read']::text[]
    else '{}'::text[]
  end;
$$;

create or replace function public.get_my_platform_ticket_capabilities_v1()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select array(
    select distinct capability
    from unnest(
      private.builtin_platform_ticket_capabilities()
      || coalesce((
        select role.capabilities
        from public.platform_custom_role_assignments assignment
        join public.platform_custom_roles role on role.id = assignment.role_id
        where assignment.user_id = private.current_user_id()
          and role.active
      ), '{}'::text[])
    ) capability
    order by capability
  );
$$;

create or replace function private.has_platform_ticket_capability(p_capability text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_capability = any(public.get_my_platform_ticket_capabilities_v1());
$$;

create table public.support_departments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  name text not null unique check (length(btrim(name)) between 2 and 80),
  description text check (description is null or length(description) <= 500),
  active boolean not null default true,
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.support_departments (slug, name, description, sort_order)
values
  ('support', 'Support', 'Technische en functionele vragen.', 10),
  ('financieel', 'Financieel', 'Facturen, abonnementen en administratieve vragen.', 20);
create trigger support_departments_set_updated_at
before update on public.support_departments
for each row execute function private.set_updated_at();

create table public.support_department_roles (
  department_id uuid not null references public.support_departments(id) on delete cascade,
  role_id uuid not null references public.platform_custom_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (department_id, role_id)
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  department_id uuid not null references public.support_departments(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  subject text not null check (length(btrim(subject)) between 3 and 160),
  status text not null default 'open' check (status in (
    'open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'
  )),
  priority text not null default 'normal' check (priority in (
    'low', 'normal', 'high', 'urgent'
  )),
  sensitive boolean not null default false,
  last_message_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create index support_tickets_tenant_status_idx
  on public.support_tickets(tenant_id, status, last_message_at desc);
create index support_tickets_department_status_idx
  on public.support_tickets(department_id, status, last_message_at desc);
create trigger support_tickets_set_updated_at
before update on public.support_tickets
for each row execute function private.set_updated_at();

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  ticket_id uuid not null,
  author_user_id uuid references public.profiles(id) on delete set null,
  author_scope text not null check (author_scope in ('tenant', 'platform', 'system')),
  body text not null check (length(btrim(body)) between 1 and 10000),
  sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  foreign key (tenant_id, ticket_id)
    references public.support_tickets(tenant_id, id) on delete cascade
);
create index support_ticket_messages_ticket_idx
  on public.support_ticket_messages(tenant_id, ticket_id, created_at);

create table public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  ticket_id uuid not null,
  message_id uuid references public.support_ticket_messages(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name text not null check (length(btrim(file_name)) between 1 and 180),
  mime_type text not null check (mime_type in (
    'image/jpeg', 'image/png', 'application/pdf', 'text/plain'
  )),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 10485760),
  storage_bucket text not null default 'ticket-attachments'
    check (storage_bucket = 'ticket-attachments'),
  storage_path text not null,
  sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (tenant_id, ticket_id)
    references public.support_tickets(tenant_id, id) on delete cascade,
  check (
    storage_path like (
      'tenants/' || tenant_id::text || '/tickets/' || ticket_id::text || '/%'
    )
  )
);

create table public.support_ticket_notifications (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  event text not null check (event in (
    'created', 'message_added', 'status_changed', 'deleted'
  )),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index support_ticket_notifications_user_idx
  on public.support_ticket_notifications(recipient_user_id, read_at, created_at desc);

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'ticket-attachments', 'ticket-attachments', false, 10485760,
  array['image/jpeg', 'image/png', 'application/pdf', 'text/plain']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_read_support_ticket(p_ticket_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.support_tickets ticket
    where ticket.id = p_ticket_id
      and ticket.deleted_at is null
      and (
        private.has_tenant_capability(ticket.tenant_id, 'tenant.ticket.read')
        or private.has_platform_ticket_capability('platform.ticket.read')
      )
      and (
        not ticket.sensitive
        or ticket.created_by = private.current_user_id()
        or private.has_tenant_capability(ticket.tenant_id, 'tenant.settings.manage')
        or private.has_platform_ticket_capability('platform.ticket.sensitive')
      )
  );
$$;

alter table public.platform_custom_roles enable row level security;
alter table public.platform_custom_roles force row level security;
alter table public.platform_custom_role_assignments enable row level security;
alter table public.platform_custom_role_assignments force row level security;
alter table public.support_departments enable row level security;
alter table public.support_departments force row level security;
alter table public.support_department_roles enable row level security;
alter table public.support_department_roles force row level security;
alter table public.support_tickets enable row level security;
alter table public.support_tickets force row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_messages force row level security;
alter table public.support_ticket_attachments enable row level security;
alter table public.support_ticket_attachments force row level security;
alter table public.support_ticket_notifications enable row level security;
alter table public.support_ticket_notifications force row level security;

revoke all on
  public.platform_custom_roles, public.platform_custom_role_assignments,
  public.support_departments, public.support_department_roles,
  public.support_tickets, public.support_ticket_messages,
  public.support_ticket_attachments, public.support_ticket_notifications
from public, anon, authenticated;
grant select on
  public.platform_custom_roles, public.platform_custom_role_assignments,
  public.support_departments, public.support_department_roles,
  public.support_tickets, public.support_ticket_messages,
  public.support_ticket_attachments, public.support_ticket_notifications
to authenticated;

create policy "platform_custom_roles_admin_read" on public.platform_custom_roles
for select to authenticated using (
  private.has_platform_ticket_capability('platform.ticket.admin')
);
create policy "platform_custom_role_assignments_admin_read"
on public.platform_custom_role_assignments for select to authenticated using (
  private.has_platform_ticket_capability('platform.ticket.admin')
  or user_id = private.current_user_id()
);
create policy "support_departments_authenticated_read"
on public.support_departments for select to authenticated using (active or
  private.has_platform_ticket_capability('platform.ticket.admin'));
create policy "support_department_roles_admin_read"
on public.support_department_roles for select to authenticated using (
  private.has_platform_ticket_capability('platform.ticket.admin')
);
create policy "support_tickets_scoped_read" on public.support_tickets
for select to authenticated using (private.can_read_support_ticket(id));
create policy "support_messages_scoped_read" on public.support_ticket_messages
for select to authenticated using (
  private.can_read_support_ticket(ticket_id)
  and (
    not sensitive
    or author_user_id = private.current_user_id()
    or private.has_platform_ticket_capability('platform.ticket.sensitive')
    or private.has_tenant_capability(tenant_id, 'tenant.settings.manage')
  )
);
create policy "support_attachments_scoped_read" on public.support_ticket_attachments
for select to authenticated using (
  deleted_at is null and private.can_read_support_ticket(ticket_id)
);
create policy "support_notifications_recipient_read"
on public.support_ticket_notifications for select to authenticated
using (recipient_user_id = private.current_user_id());

create or replace function private.ticket_id_from_storage_path(p_name text)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_name !~* '^tenants/[0-9a-f-]{36}/tickets/[0-9a-f-]{36}/[^/]+$'
  then return null; end if;
  return split_part(p_name, '/', 4)::uuid;
exception when invalid_text_representation then return null;
end;
$$;

create or replace function private.can_write_support_ticket(p_ticket_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.support_tickets ticket
    where ticket.id = p_ticket_id and ticket.deleted_at is null
      and (
        private.has_tenant_capability(ticket.tenant_id, 'tenant.ticket.write')
        or private.has_platform_ticket_capability('platform.ticket.write')
      )
  );
$$;

create policy "ticket_attachments_storage_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'ticket-attachments'
  and private.can_write_support_ticket(
    private.ticket_id_from_storage_path(name)
  )
);
create policy "ticket_attachments_storage_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ticket-attachments'
  and private.can_read_support_ticket(
    private.ticket_id_from_storage_path(name)
  )
);
create policy "ticket_attachments_storage_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ticket-attachments'
  and private.can_write_support_ticket(
    private.ticket_id_from_storage_path(name)
  )
);

create or replace function public.create_support_ticket_v1(
  p_tenant_id uuid,
  p_department_id uuid,
  p_subject text,
  p_body text,
  p_sensitive boolean default false,
  p_priority text default 'normal'
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  ticket_id uuid;
  ticket_number bigint;
begin
  if actor_id is null
    or not private.has_tenant_capability(p_tenant_id, 'tenant.ticket.write')
  then raise exception 'ticket write capability required' using errcode = '42501'; end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if not exists (
    select 1 from public.support_departments
    where id = p_department_id and active
  ) or length(btrim(coalesce(p_subject, ''))) not between 3 and 160
    or length(btrim(coalesce(p_body, ''))) not between 1 and 10000
    or p_priority not in ('low', 'normal', 'high', 'urgent')
  then raise exception 'ticket input is invalid' using errcode = '23514'; end if;
  insert into public.support_tickets (
    tenant_id, department_id, created_by, subject, priority, sensitive
  ) values (
    p_tenant_id, p_department_id, actor_id, btrim(p_subject),
    p_priority, coalesce(p_sensitive, false)
  ) returning id, support_tickets.ticket_number into ticket_id, ticket_number;
  insert into public.support_ticket_messages (
    tenant_id, ticket_id, author_user_id, author_scope, body, sensitive
  ) values (
    p_tenant_id, ticket_id, actor_id, 'tenant', btrim(p_body),
    coalesce(p_sensitive, false)
  );
  insert into public.support_ticket_notifications (
    ticket_id, recipient_user_id, event
  )
  select ticket_id, assignment.user_id, 'created'
  from public.support_department_roles department_role
  join public.platform_custom_role_assignments assignment
    on assignment.role_id = department_role.role_id
  where department_role.department_id = p_department_id;
  perform private.audit_event(
    p_tenant_id, 'support.ticket.created', 'support_tickets', ticket_id,
    'success', jsonb_build_object('ticketNumber', ticket_number)
  );
  return jsonb_build_object(
    'outcome', 'created', 'ticketId', ticket_id,
    'ticketNumber', ticket_number
  );
end;
$$;

create or replace function public.add_support_ticket_message_v1(
  p_ticket_id uuid,
  p_body text,
  p_sensitive boolean default false
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  ticket_record public.support_tickets%rowtype;
  message_id uuid;
  platform_actor boolean;
begin
  select ticket.* into ticket_record from public.support_tickets ticket
  where ticket.id = p_ticket_id and ticket.deleted_at is null for update;
  if not found then raise exception 'ticket not found' using errcode = 'P0002'; end if;
  platform_actor := private.has_platform_ticket_capability('platform.ticket.write');
  if actor_id is null or not (
    platform_actor or private.has_tenant_capability(
      ticket_record.tenant_id, 'tenant.ticket.write'
    )
  ) then raise exception 'ticket write capability required' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_body, ''))) not between 1 and 10000
  then raise exception 'message is invalid' using errcode = '23514'; end if;
  if coalesce(p_sensitive, false) and not (
    platform_actor
    or ticket_record.created_by = actor_id
    or private.has_tenant_capability(
      ticket_record.tenant_id, 'tenant.settings.manage'
    )
  ) then raise exception 'sensitive message denied' using errcode = '42501'; end if;
  insert into public.support_ticket_messages (
    tenant_id, ticket_id, author_user_id, author_scope, body, sensitive
  ) values (
    ticket_record.tenant_id, ticket_record.id, actor_id,
    case when platform_actor then 'platform' else 'tenant' end,
    btrim(p_body), coalesce(p_sensitive, false)
  ) returning id into message_id;
  update public.support_tickets set
    last_message_at = now(),
    status = case when platform_actor then 'waiting_for_customer' else 'open' end,
    revision = revision + 1
  where id = ticket_record.id;
  insert into public.support_ticket_notifications (
    ticket_id, recipient_user_id, event
  )
  select ticket_record.id, recipient, 'message_added'
  from (
    select ticket_record.created_by as recipient
    where platform_actor
    union
    select assignment.user_id
    from public.support_department_roles department_role
    join public.platform_custom_role_assignments assignment
      on assignment.role_id = department_role.role_id
    where not platform_actor
      and department_role.department_id = ticket_record.department_id
  ) recipients
  where recipient is not null and recipient <> actor_id;
  return message_id;
end;
$$;

create or replace function public.update_support_ticket_v1(
  p_ticket_id uuid,
  p_status text,
  p_assigned_to uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  ticket_record public.support_tickets%rowtype;
begin
  if actor_id is null
    or not private.has_platform_ticket_capability('platform.ticket.write')
  then raise exception 'platform ticket write required' using errcode = '42501'; end if;
  select ticket.* into ticket_record from public.support_tickets ticket
  where ticket.id = p_ticket_id and ticket.deleted_at is null for update;
  if not found then raise exception 'ticket not found' using errcode = 'P0002'; end if;
  if p_status not in (
    'open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'
  ) then raise exception 'unsupported ticket status' using errcode = '23514'; end if;
  if p_assigned_to is not null and not exists (
    select 1 from public.platform_memberships where user_id = p_assigned_to
  ) then raise exception 'assignee is not a platform member' using errcode = '23514'; end if;
  update public.support_tickets set
    assigned_to = p_assigned_to,
    status = p_status,
    resolved_at = case when p_status = 'resolved' then now() else resolved_at end,
    closed_at = case when p_status = 'closed' then now() else null end,
    revision = revision + 1
  where id = ticket_record.id;
  insert into public.support_ticket_notifications (
    ticket_id, recipient_user_id, event
  ) values (ticket_record.id, ticket_record.created_by, 'status_changed');
  return jsonb_build_object('outcome', 'updated');
end;
$$;

create or replace function public.delete_support_ticket_v1(p_ticket_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  ticket_record public.support_tickets%rowtype;
begin
  select ticket.* into ticket_record from public.support_tickets ticket
  where ticket.id = p_ticket_id and ticket.deleted_at is null for update;
  if not found then raise exception 'ticket not found' using errcode = 'P0002'; end if;
  if actor_id is null or not (
    private.has_platform_ticket_capability('platform.ticket.admin')
    or (
      ticket_record.created_by = actor_id
      and private.has_tenant_capability(ticket_record.tenant_id, 'tenant.ticket.write')
    )
  ) then raise exception 'ticket deletion denied' using errcode = '42501'; end if;
  update public.support_tickets set
    deleted_at = now(), deleted_by = actor_id, revision = revision + 1
  where id = ticket_record.id;
  insert into public.support_ticket_notifications (
    ticket_id, recipient_user_id, event
  )
  select ticket_record.id, recipient, 'deleted'
  from (
    values (ticket_record.created_by), (ticket_record.assigned_to)
  ) recipients(recipient)
  where recipient is not null and recipient <> actor_id;
  perform private.audit_event(
    ticket_record.tenant_id, 'support.ticket.deleted',
    'support_tickets', ticket_record.id
  );
  return jsonb_build_object('outcome', 'deleted');
end;
$$;

create or replace function public.register_support_attachment_v1(
  p_ticket_id uuid,
  p_message_id uuid,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_storage_path text,
  p_sensitive boolean default false
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  ticket_record public.support_tickets%rowtype;
  attachment_id uuid;
begin
  select ticket.* into ticket_record from public.support_tickets ticket
  where ticket.id = p_ticket_id and ticket.deleted_at is null;
  if not found or actor_id is null or not private.can_write_support_ticket(p_ticket_id)
  then raise exception 'ticket attachment denied' using errcode = '42501'; end if;
  if p_message_id is not null and not exists (
    select 1 from public.support_ticket_messages message
    where message.id = p_message_id and message.ticket_id = p_ticket_id
  ) then raise exception 'message does not belong to ticket' using errcode = '23514'; end if;
  insert into public.support_ticket_attachments (
    tenant_id, ticket_id, message_id, uploaded_by, file_name, mime_type,
    file_size_bytes, storage_path, sensitive
  ) values (
    ticket_record.tenant_id, ticket_record.id, p_message_id, actor_id,
    btrim(p_file_name), p_mime_type, p_file_size_bytes, p_storage_path,
    coalesce(p_sensitive, false)
  ) returning id into attachment_id;
  return attachment_id;
end;
$$;

create or replace function public.create_platform_support_role_v1(
  p_name text, p_description text, p_capabilities text[]
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare role_id uuid;
begin
  perform private.require_platform_roles(array['platform_owner'::public.platform_role]);
  perform private.require_aal2_command();
  if length(btrim(coalesce(p_name, ''))) not between 2 and 80
    or not coalesce(p_capabilities, '{}'::text[]) <@ array[
      'platform.ticket.read', 'platform.ticket.write',
      'platform.ticket.sensitive', 'platform.ticket.admin'
    ]::text[]
  then raise exception 'platform support role is invalid' using errcode = '23514'; end if;
  insert into public.platform_custom_roles (
    name, description, capabilities, created_by
  ) values (
    btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
    array(select distinct unnest(coalesce(p_capabilities, '{}'::text[]))),
    private.current_user_id()
  ) returning id into role_id;
  return role_id;
end;
$$;

create or replace function public.create_support_department_v1(
  p_name text, p_description text, p_role_ids uuid[]
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare department_id uuid; normalized_slug text;
begin
  if not private.has_platform_ticket_capability('platform.ticket.admin')
  then raise exception 'platform ticket admin required' using errcode = '42501'; end if;
  perform private.require_aal2_command();
  normalized_slug := trim(both '-' from regexp_replace(
    lower(btrim(coalesce(p_name, ''))), '[^a-z0-9]+', '-', 'g'
  ));
  if length(btrim(coalesce(p_name, ''))) not between 2 and 80
    or length(normalized_slug) not between 3 and 64
  then raise exception 'department is invalid' using errcode = '23514'; end if;
  insert into public.support_departments (
    slug, name, description, created_by
  ) values (
    normalized_slug, btrim(p_name),
    nullif(btrim(coalesce(p_description, '')), ''), private.current_user_id()
  ) returning id into department_id;
  insert into public.support_department_roles (department_id, role_id)
  select department_id, role.id
  from public.platform_custom_roles role
  where role.id = any(coalesce(p_role_ids, '{}'::uuid[])) and role.active;
  return department_id;
end;
$$;

create or replace function public.assign_platform_support_role_v1(
  p_user_id uuid,
  p_role_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_platform_roles(array['platform_owner'::public.platform_role]);
  perform private.require_aal2_command();
  if not exists (select 1 from public.platform_memberships where user_id = p_user_id)
    or not exists (
      select 1 from public.platform_custom_roles
      where id = p_role_id and active
    )
  then raise exception 'support role assignment is invalid' using errcode = '23514'; end if;
  insert into public.platform_custom_role_assignments (
    user_id, role_id, assigned_by
  ) values (p_user_id, p_role_id, private.current_user_id())
  on conflict (user_id) do update set
    role_id = excluded.role_id,
    assigned_by = excluded.assigned_by,
    assigned_at = now();
end;
$$;

revoke all on function public.get_my_platform_ticket_capabilities_v1()
  from public, anon;
revoke all on function public.create_support_ticket_v1(
  uuid, uuid, text, text, boolean, text
) from public, anon;
revoke all on function public.add_support_ticket_message_v1(uuid, text, boolean)
  from public, anon;
revoke all on function public.update_support_ticket_v1(uuid, text, uuid)
  from public, anon;
revoke all on function public.delete_support_ticket_v1(uuid) from public, anon;
revoke all on function public.register_support_attachment_v1(
  uuid, uuid, text, text, bigint, text, boolean
) from public, anon;
revoke all on function public.create_platform_support_role_v1(
  text, text, text[]
) from public, anon;
revoke all on function public.create_support_department_v1(
  text, text, uuid[]
) from public, anon;
revoke all on function public.assign_platform_support_role_v1(uuid, uuid)
  from public, anon;
grant execute on function public.get_my_platform_ticket_capabilities_v1()
  to authenticated;
grant execute on function public.create_support_ticket_v1(
  uuid, uuid, text, text, boolean, text
) to authenticated;
grant execute on function public.add_support_ticket_message_v1(uuid, text, boolean)
  to authenticated;
grant execute on function public.update_support_ticket_v1(uuid, text, uuid)
  to authenticated;
grant execute on function public.delete_support_ticket_v1(uuid) to authenticated;
grant execute on function public.register_support_attachment_v1(
  uuid, uuid, text, text, bigint, text, boolean
) to authenticated;
grant execute on function public.create_platform_support_role_v1(
  text, text, text[]
) to authenticated;
grant execute on function public.create_support_department_v1(
  text, text, uuid[]
) to authenticated;
grant execute on function public.assign_platform_support_role_v1(uuid, uuid)
  to authenticated;
