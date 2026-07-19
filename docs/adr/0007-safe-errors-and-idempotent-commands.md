# ADR 0007 — Veilige errors en idempotente commands

## Status

Accepted.

## Context

Control-mutaties gebruiken nu verschillende redirectteksten en kunnen intern
database-errors loggen. Provisioning, invitations, publish en pairing hebben
door retries en dubbele submits een expliciet commandcontract nodig.

## Besluit

### Publieke errors

Een serialiseerbare fout gebruikt uitsluitend:

- een allowlisted code;
- een begrijpelijk bericht met gevolg;
- een concrete herstelactie;
- optionele veldfouten;
- een niet-gevoelige request-ID.

Raw database-errors, stacktraces, SQL, storage-URLs, secrets, fingerprints en
interne objecten zijn nooit onderdeel van de response. De eerste contracten
staan in `@veyocast/contracts`.

### Commands

Extern of door gebruikers herhaalbare commands krijgen:

- een begrensde idempotency key;
- een request/correlation ID;
- waar relevant een expected revision;
- een atomair server-/database-effect;
- een reproduceerbaar resultaat voor dezelfde key en payload;
- een conflict bij dezelfde key met afwijkende payload.

Provisioning, invitations, publish, pairing claim, billing webhooks en
bulkmutaties moeten dit patroon gebruiken zodra hun sprint ze wijzigt.

## Logging

Interne fouten worden via de observabilityboundary gelogd met stabiele eventcode
en request-ID. Logging van het volledige request, formdata of providerresponse
is niet toegestaan zonder een expliciete veldallowlist.

## Gevolgen

- UI kan errors consistent tonen;
- retries worden veilig;
- optimistic concurrency in S25 kan hetzelfde metadata-contract gebruiken;
- bestaande actions migreren incrementeel.
