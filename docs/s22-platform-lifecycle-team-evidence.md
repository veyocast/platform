# S22 platform lifecycle en teambeheer — evidence

## Uitkomst

S22 maakt tenant- en platformtoegang bedienbaar zonder dagelijkse SQL- of
Supabase Dashboard-acties. De lokale live slice bewijst twee persoonlijke
accountjourneys via Mailpit en vervolgt daarna met de bestaande media-,
playlist-, pairing- en LG-playerketen.

## Geleverde beheerflows

- Transactionele en idempotente tenantprovisioning met naam, slug, eerste
  eigenaar, schermlimiet, locale, tijdzone, defaults en audit.
- Tenantdetail met provisioningstatus, lifecycle-impact, schermgebruik,
  storagegebruik, leden, invitations en recente audit-events.
- Pause, reactivate en archive achter platformcapability, AAL2 en expliciete
  impactbevestiging; bestaande last-known-good playback blijft behouden.
- Schermlimiet bij wijziging én schermaanmaak, inclusief serialisatie op de
  tenantrow en bescherming tegen informatielekken vóór RLS.
- Tenantinvites met send, resend/tokenrotatie, revoke, effectieve expiry,
  preview en eenmalige e-mailgebonden acceptatie.
- Tenantrolwijziging en toegang intrekken met hierarchy-, laatste-owner- en
  self-lockoutbescherming.
- Afzonderlijk platformuserbeheer: nieuwe accounts worden uitgenodigd, rollen
  vereisen platform owner + AAL2, MFA toont alleen aanwezig/ontbreekt en
  self-/laatste-ownerbescherming blijft server-side.

## Security- en datamodelbewijs

De migratie `20260720120000_platform_lifecycle_team_management.sql` is additive
voor tenantmetadata, invitation delivery state en idempotencycommands. Directe
browser-DML op platformmemberships, tenantmemberships en tenantinvitations is
ingetrokken. Guarded `SECURITY DEFINER`-RPC's hebben een lege `search_path` en
nauw verleende execute grants.

Invitation-tokens worden alleen als SHA-256 opgeslagen en nooit in auditdata of
providerfouten opgenomen. Acceptatie controleert invitation-ID, tenant-ID,
token, pendingstatus, expiry en het Auth-e-mailadres. Een resend trekt de oude
row in en genereert een nieuwe token. Provisioning en iedere role-, lifecycle-,
limit- en deliverymutatie schrijven privacyveilige audit-events.
Tenantteam-mutaties worden op de tenantrow geserialiseerd; platform-ownerchecks
delen een transactionele advisory lock. Daardoor kan gelijktijdige degradatie
of verwijdering de laatste-ownerregel niet omzeilen.

## Verificatie

- `pnpm db:reset && pnpm test:rls`: 12 bestanden, 190 assertions groen.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`: groen.
- `pnpm test:a11y`: 15 tests groen.
- `pnpm test:e2e -- --project=chromium`: 43 groen, live slice bewust opt-in.
- `pnpm test:player`: 19 groen.
- `pnpm test:player:offline`: 7 groen.
- Live Supabase/Mailpit/Chromium: platformaccount uitnodigen en accepteren,
  tenant provisionen, owner uitnodigen en accepteren, PNG uploaden, settings,
  immutable playlist publiceren, LG-player pairen en playback starten: groen.
- Productnaam-audit: geen voormalige productnaam in getrackte bronbestanden.

## Forward-, rollback- en environmentimpact

Forward deployment past eerst de migratie toe en rolt daarna Control uit. De
nieuwe Control gebruikt de guarded RPC's; de oude tenant-create-RPC blijft
bestaan maar is niet meer uitvoerbaar voor `authenticated`. Een applicatierollback
naar code vóór S22 is daarom geen veilige functionele rollback. Herstel gebeurt
met een forward-fix die grants/contracts expliciet behoudt; verwijder geen
invitation- of commandhistorie.

Hosted staging en production vereisen:

- correcte `NEXT_PUBLIC_APP_URL` per Control-environment;
- `/auth/confirm` in de Supabase Auth redirect-allowlist;
- de inhoud van `supabase/templates/invite.html` als hosted invite-template;
- een echte SMTP-provider zonder linktracking/prefetch die de token consumeert;
- TOTP ingeschakeld en minimaal twee platform owners als operationele
  herstelmaatregel na de trust-rootbootstrap.

## Open externe gates

Mailpit bewijst generatie en acceptatie lokaal, maar niet deliverability bij de
echte provider. Voer daarom per hosted environment een geautoriseerde SMTP-smoke
uit. De fysieke LG webOS-validatie, definitieve merkmasters en 24-uurs
mixed-media soak blijven ongewijzigde launchgates; S22 maakt daar geen
supportclaim over.
