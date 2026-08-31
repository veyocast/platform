# S139 — LED Scores tenantvrijgave herstellen

## Doel

Herstel de tenantbeheeractie waarmee een bevoegde Platform Owner/Admin
`ledscores_realtime` gecontroleerd voor één tenant vrijgeeft. De normale
Control-route moet dezelfde canonieke featurecatalogus gebruiken als de UI en
de databasebeslissing moet atomair, herhaalbaar en volledig geaudit blijven.

## Ownership

- `apps/control/app/(shell)/platform/tenants/[tenantId]/**`;
- `apps/control/lib/platform-management.ts`;
- één forward-only S139-Supabasemigratie en gerichte pgTAP-test;
- relevante live E2E- en S139-documentatie.

## Implementatiegrenzen

- geen directe productie-update of tenantnaam-hardcode;
- Platform Owner/Admin, AAL2, tenantstatus en RLS blijven leidend;
- één gedeelde Control-catalogus levert presentatie én serverallowlist;
- revision en request-idempotency voorkomen stale of dubbele besluiten;
- een ontbrekende featuredefinitie en actieve globale noodstop falen gesloten;
- featuremutatie, audit en idempotency receipt zijn één transactie;
- foutmeldingen zijn Nederlands en herstelbaar; logs bevatten alleen veilige
  foutcode, featurekey en requestreferentie;
- Playerreleases, playlists, providerdata en last-known-good playback wijzigen
  niet.

## Gates

Gerichte Control-unit en pgTAP, verse `pnpm db:reset`, volledige RLS,
workspace lint/typecheck/test/build, a11y, Chromium-E2E, immutable VPS-build,
staging-/productiesmoke en tenantgebonden readback vóór pilotvrijgave.
