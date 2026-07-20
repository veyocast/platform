# S21 identity, tenantcontext, capabilities en MFA

## Opgeleverd

- Exhaustieve role-to-capabilitymatrix in `@veyocast/auth`, inclusief één
  centrale `requireCapability()`-grens.
- Alle bestaande Control-mutaties gebruiken een centrale server-side
  capabilitycheck; navigatie en actievisibility gebruiken dezelfde beslislaag.
- Tenantcontext wordt bewust gekozen via een HttpOnly/SameSite-cookie en bij
  iedere request tegen slug, membership en status gevalideerd. Er bestaat geen
  impliciete eerste-membershipselectie.
- De toetsenbordbedienbare tenant-switcher forceert een nieuwe shell-instance,
  waardoor tenantgebonden client-, selectie- en formulierstate wordt gewist.
- Supabase TOTP MFA ondersteunt enrollment, QR/handmatige sleutel, challenge,
  meerdere factoren als herstelpad, unenrollment en zichtbare AAL-sessiestatus.
- Een extra factor registreren vereist AAL2 zodra al een geverifieerde factor
  bestaat; alleen de eerste enrollment is op AAL1 toegestaan.
- Tenant creation/lifecycle en platformrolmutaties vereisen AAL2 in Control én
  PostgreSQL.
- Paused tenants blijven leesbaar en bestaande players blijven afspelen, maar
  menselijke mutaties, publicatie en pairing falen ook via SECURITY DEFINER
  functies. Archived tenants kunnen niet als normale context worden geopend.

## Bewijs

- `pnpm db:reset`: groen.
- `pnpm test:rls`: 11 bestanden, 157 tests groen.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`: groen.
- `pnpm test:a11y`: 14 tests groen.
- `pnpm test:e2e -- --project=chromium`: 42 groen, alleen de opt-in live test
  in deze reguliere run overgeslagen.
- De opt-in live-pilot is apart groen en bewijst login, expliciete context,
  echte TOTP-enrollment/challenge, AAL2-tenantaanmaak, media, immutable release,
  pairing en geverifieerde playback.
- Naam-audit: geen oude productnaam in de repository (de GitHub-organisatienaam
  valt buiten de repository-inhoud).

## Operationele voorwaarde

TOTP moet in Supabase Auth voor staging en productie ingeschakeld zijn. Lokale
ontwikkeling borgt dit in `supabase/config.toml`. Supabase ondersteunt geen
recovery codes; registreer daarom minimaal twee factoren. Een volledig verloren
factorset vereist een gecontroleerde account recovery buiten de normale
Control-sessie.

Lifecycle- en teambeheer-UI vallen bewust onder S22. De S21-databasegrenzen en
capabilities staan daarvoor al klaar.
