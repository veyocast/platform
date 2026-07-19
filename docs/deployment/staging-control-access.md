# Stagingtoegang voor VeyoCast Control

## Beveiligingsgrens

Staging gebruikt uitsluitend het eigen Supabase-project. Maak geen gebruikers
aan met `supabase/seed.sql`: die seed en het daarin genoemde wachtwoord zijn
alleen voor een lokale database. Voeg geen service-role key, gedeeld wachtwoord
of provisioningendpoint toe aan Control.

Een Control-account bestaat uit een Supabase Auth-user en een server-side
membership. Een Auth-user zonder membership krijgt geen toegang tot de shell.

## Een eerste stagingbeheerder uitnodigen

1. Open het Supabase Dashboard en controleer expliciet dat het stagingproject is
   geselecteerd. Vergelijk de project-ref met GitHub Environment `staging`.
2. Stel de Authentication Site URL in op
   `https://staging-control.veyocast.nl`.
3. Gebruik in de uitnodigingstemplate deze SSR-link:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">
     Uitnodiging accepteren
   </a>
   ```

4. Ga naar Authentication → Users → Add user → Send invitation en gebruik het
   persoonlijke zakelijke e-mailadres van de beheerder.
5. Voer daarna in de SQL Editor van hetzelfde stagingproject deze transactie
   uit. Vervang alleen het e-mailadres en de zichtbare naam.

   ```sql
   begin;

   do $$
   declare
     target_user_id uuid;
     target_role public.platform_role;
   begin
     select id into target_user_id
     from auth.users
     where lower(email) = lower('<persoonlijk e-mailadres>');

     if target_user_id is null then
       raise exception 'Staging Auth-user ontbreekt';
     end if;

     insert into public.profiles (id, display_name)
     values (target_user_id, '<zichtbare naam>')
     on conflict (id) do update
     set display_name = excluded.display_name;

     select case
       when exists (
         select 1 from public.platform_memberships
         where role = 'platform_owner'
       ) then 'platform_admin'::public.platform_role
       else 'platform_owner'::public.platform_role
     end into target_role;

     insert into public.platform_memberships (user_id, role, created_by)
     values (target_user_id, target_role, null)
     on conflict (user_id, role) do nothing;
   end
   $$;

   commit;
   ```

De eerste gebruiker wordt platformeigenaar, omdat alleen die rol volgens RLS
andere platformmemberships mag beheren. Volgende dagelijkse beheerders krijgen
`platform_admin`. Houd het aantal platformeigenaren minimaal.

De gebruiker opent de persoonlijke link, kiest een uniek wachtwoord van
minimaal 12 tekens en logt in. Deel of log het wachtwoord nooit.

## Tenanttoegang toevoegen

Een platformrol geeft niet automatisch toegang tot tenantinhoud:

```sql
insert into public.tenant_memberships (tenant_id, user_id, role, created_by)
select
  '<tenant-uuid>'::uuid,
  id,
  'tenant_admin'::public.tenant_role,
  null
from auth.users
where lower(email) = lower('<persoonlijk e-mailadres>')
on conflict (tenant_id, user_id) do update
set role = excluded.role;
```

## Verificatie

- Zonder cookies redirecten `/dashboard` en `/platform` naar `/login`.
- Een platformbeheerder zonder tenantmembership landt op `/platform`.
- Een tenantgebruiker landt op `/dashboard`.
- Een Auth-user zonder membership wordt uitgelogd en krijgt geen shell.
- Staging toont live RLS-data of een eerlijke lege/fouttoestand. Fixtures zijn
  uitsluitend beschikbaar op een lokale Next.js developmentserver.
