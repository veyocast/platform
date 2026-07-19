# ADR 0006 — Application package- en serviceboundaries

## Status

Accepted.

## Context

Veel bestaande Control-functionaliteit is rechtstreeks in pages en server
actions opgebouwd. Nieuwe cross-resource journeys hebben stabiele contracts en
pure businessregels nodig zonder appcode of browser/servergrenzen te vermengen.

## Besluit

De dependencyrichting is:

```text
contracts <- domain <- auth
     ^          ^
     +---- database

apps -> services -> repositories/adapters
apps -> contracts/domain/auth
```

Concreet:

- `packages/contracts` bevat Zod transportschemas, veilige responses en
  commandmetadata. Geen React, Next, Supabase of environment access.
- `packages/domain` bevat pure, deterministische productregels. Het mag alleen
  contracts gebruiken wanneer schema-afgeleide types nodig zijn.
- `packages/auth` bevat pure capabilitybeslissingen en mag domain/contracts
  gebruiken. Het maakt geen sessie- of databaseverbinding.
- `packages/database` is infrastructuur en mag canonieke domain/contracts
  gebruiken. Het bevat geen UI of browsercode.
- Next pages/actions/handlers adapteren transport naar services.
- Services orkestreren permissions, transacties en businessregels.
- Repositories/adapters doen Supabase, Storage, provider of queue I/O.
- Alleen expliciete serverentries lezen secrets of importeren `server-only`.

## Automatische handhaving

`packages/testkit/test/package-boundaries.test.ts` scant source imports,
environment access en clientimports van serverentries. Bestaande service-role-
en clientbundletests blijven daarnaast verplicht.

## Migratiestrategie

Geen big-bang rewrite. Nieuwe flows gebruiken de boundaries direct; bestaande
flows migreren wanneer zij inhoudelijk worden gewijzigd in S21-S29.

## Gevolgen

- tijdelijk bestaan oude en nieuwe patronen naast elkaar;
- package APIs moeten klein en expliciet blijven;
- frameworkconvenience is geen reden om domain/contracts met Next te koppelen.
