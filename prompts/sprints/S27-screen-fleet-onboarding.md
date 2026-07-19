# S27 - Schermvloot en onboarding

## Doel

Maak scherm lifecycle, veilige pairing, devicebeheer en operationele diagnose
één begrijpelijke journey.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S27
- device threat model, LG runbooks en playercanons

## Scope

- transactionele create/update/maintenance/disable met schermlimiet;
- guided onboarding: details -> content -> pairing -> heartbeat -> afronding;
- screen detailtabs Overzicht/Content/Player/Sync/Events;
- desired/active release, storage, runtime, appversie en veilige errors;
- rename/revoke/re-pair en offline revocationuitleg;
- pairing rate/replay/expiry/concurrencytests.

## Acceptatie

- gelijktijdige creates kunnen schermlimiet niet overschrijden;
- pairingtoken/device secret verschijnt nooit in Control, logs of URL;
- eerste heartbeat en active release zijn zichtbaar;
- revoked/wrong-tenant device faalt veilig;
- player-, RLS-, E2E-, a11y- en foundationgates zijn groen.

## Non-goals

- schermgroepen/scheduling uit S32;
- generieke smart-TV-supportclaim.
