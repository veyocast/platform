# S137 — Sportlink verjaardagsnormalisatie hotfix

## Doel

Herstel de productie-Sportlink-verjaardagssync die providerrecords met
drieletterige Nederlandse maandnamen stil overslaat, zonder privacy-, RLS-,
immutable release-, Player- of offlinegrenzen te versoepelen.

## Ownership

- `packages/integrations/src/sportlink-birthdays.ts` en gerichte tests;
- `apps/media-worker/src/sportlink-sync-runner.ts` en gerichte tests;
- S137-taakdocumentatie en privacyveilige staging/production-readback.

## Implementatiegrenzen

- accepteer de vaste Nederlandse drielettermaanden naast de bestaande volledige
  maandnamen en numerieke datumvormen;
- wanneer `recordCount > 0` maar geen enkele verjaardag veilig normaliseert,
  faalt de worker vóór databasecompletion en blijft de bestaande snapshot staan;
- een echte lege providerrespons blijft geldig en mag als lege snapshot worden
  voltooid;
- providercredentials, URLs, datums, namen en andere persoonsgegevens worden
  niet gelogd of als deploybewijs opgeslagen;
- geen database-, migratie-, RLS-, Control-, Player-, release- of
  offlinewijziging;
- deployment gebruikt de bestaande immutable VPS-releaseflow via Tailscale,
  eerst staging en daarna production met exact dezelfde actuele `main`-SHA.

## Gates

Gerichte integrations- en media-worker-tests, geaggregeerde live providercheck,
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:reset`, `pnpm test:rls`,
VPS-deploymentvalidatie en staging/production health- en workerreadback.
