# Eerste production-platformeigenaar

## Waarom dit een aparte stap is

Een Supabase Auth-user is uitsluitend een identiteit. Toegang tot VeyoCast
Control ontstaat pas door een expliciete `platform_memberships`- of
`tenant_memberships`-rij. Een recovery-link mag daarom nooit automatisch een
platformrol toekennen.

Deze bootstrap is alleen bedoeld voor een productiondatabase waarin nog geen
enkele platformmembership bestaat. Daarna worden alle platformgebruikers via
Control beheerd.

## Vooraf

1. Selecteer in Supabase production project `uuyelumptrfwuqwzkwsd`.
2. Open **Authentication → Users**.
3. Controleer dat het persoonlijke beheeraccount bestaat en het juiste
   e-mailadres heeft.
4. Trek alle sessies in wanneer een recovery-URL of token ooit in chat,
   screenshots, logs of tickets is gedeeld.
5. Stel via de VeyoCast-recoveryflow een nieuw, uniek wachtwoord in.

## Fail-closed bootstrap

Open daarna **SQL Editor** in hetzelfde productionproject. Vervang uitsluitend
de twee waarden tussen punthaken en voer de volledige transactie één keer uit.

```sql
begin;

do $bootstrap$
declare
  target_user_id uuid;
  existing_platform_memberships bigint;
begin
  select count(*)
  into existing_platform_memberships
  from public.platform_memberships;

  if existing_platform_memberships <> 0 then
    raise exception
      'Bootstrap geweigerd: er bestaat al een platformmembership';
  end if;

  select auth_user.id
  into target_user_id
  from auth.users auth_user
  where lower(auth_user.email) = lower('<persoonlijk beheeradres>')
    and auth_user.deleted_at is null;

  if target_user_id is null then
    raise exception 'Bootstrap geweigerd: Auth-user ontbreekt';
  end if;

  insert into public.profiles (id, display_name)
  values (target_user_id, '<zichtbare beheernaam>')
  on conflict (id) do update
  set display_name = excluded.display_name;

  insert into public.platform_memberships (user_id, role, created_by)
  values (
    target_user_id,
    'platform_owner'::public.platform_role,
    null
  );
end
$bootstrap$;

commit;
```

Verwachte uitkomst: `Success. No rows returned`.

Controleer daarna zonder persoonsgegevens te exporteren:

```sql
select role, count(*) as aantal
from public.platform_memberships
group by role;
```

Er moet exact één `platform_owner` staan.

## Eerste login

1. Open `https://control.veyocast.nl/login`.
2. Log in met het persoonlijke beheeraccount.
3. Registreer direct TOTP/tweestapsverificatie voordat je gevoelige
   platformacties uitvoert.
4. Maak volgende platformbeheerders uitsluitend via
   **Platform → Platformgebruikers** aan.
5. Houd minimaal twee gecontroleerde platformeigenaren aan voordat het product
   live gaat, zodat herstel niet van één persoon afhangt.
