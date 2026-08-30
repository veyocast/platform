# S134 — Sportlink verjaardag-teamfilter hotfix

## Doel

Herstel de dagelijkse Sportlink-verjaardagssync die na een geslaagde
`verjaardagen`- en `teams`-aanvraag bij `team-indeling` stopt met providercode
4002, zonder de privacy-, last-known-good-, release- of Playergrenzen te
versoepelen.

## Ownership

- `packages/integrations/src/sportlink-registry.ts` en gerichte tests;
- `apps/media-worker/src/sportlink-sync-runner.ts` en gerichte tests;
- S134-taakdocumentatie en staging/production-readback.

## Implementatiegrenzen

- volg het officiële providercontract: verstuur `teamcode` én
  `lokaleteamcode` uit hetzelfde `teams`-record;
- accepteer uitsluitend de provider-sentinel `-1` of een niet-negatieve
  cijfercode; geen vrije tekst in queryparameters;
- providercredentials, URLs en persoonsgegevens worden niet gelogd;
- geen database-, Player-, release- of offlinewijziging;
- deployment gebruikt de bestaande immutable VPS-releaseflow, niet GitHub
  Actions.

## Gates

Gerichte integrations- en media-worker-tests, `pnpm lint`, `pnpm typecheck`,
`pnpm test`, VPS-deploymentvalidatie en staging/production Sportlink-readback.
