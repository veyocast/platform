# S133 — Sportlink providerasset-sync hotfix

## Doel

Herstel de productie-Sportlink-sync die geldige content-addressed club- en
teamlogo's eerst op de padregex afwijst en daarna op een ambigue
`cache_id`-referentie faalt, zonder bestaande providerassets, genormaliseerde
data, immutable releases of last-known-good playback te muteren.

## Ownership

- `supabase/migrations/20260830133913_s133_sportlink_provider_asset_completion_hotfix.sql`;
- `supabase/tests/rls_s133_sportlink_sync_completion.sql`;
- S133-taakdocumentatie en production-readback;
- uitsluitend wanneer production-evidence dit vereist: veilige foutclassificatie
  in het bestaande Sportlink-workerpad en de bijbehorende tests/UI-copy.

## Implementatiegrenzen

- forward-only; wijzig S111 of andere toegepaste migraties niet;
- behoud `SECURITY DEFINER`, lege `search_path` en service-role-only `EXECUTE`;
- geen providercredentials, URLs, payloads of persoonsgegevens in logs;
- geen wijziging aan Player-, release- of offlinecontracten;
- deployment gebruikt de bestaande immutable VPS-releaseflow, niet GitHub Actions.

## Gates

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:reset`, `pnpm test:rls`,
VPS-deploymentvalidatie, staging Sportlink-readback en production-readback.
