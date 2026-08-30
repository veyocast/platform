# S135 — LED Scores service-role-boundary hotfix

## Doel

Herstel de fail-closed releasegate die de nieuwe, uitsluitend server-side
LED Scores-connector terecht nog niet in de expliciete media-workerallowlist
herkent.

## Ownership

- `packages/config/test/service-role-boundary.test.ts`;
- S135-taakdocumentatie en VPS-releasebewijs.

## Implementatiegrenzen

- allowlist uitsluitend het concrete LED Scores-workerbackend;
- geen versoepeling van service-role-patronen, clientbundel- of
  importgraafcontroles;
- geen secrets, database-, Player-, release- of offlinewijziging;
- een rode schone VPS-build blijft een harde stop vóór deployment.

## Gates

Gerichte configtest, `pnpm lint`, `pnpm typecheck`, `pnpm test`, daarna de
volledige immutable VPS `build-release` en staging/production-readback.
