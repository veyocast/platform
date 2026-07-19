# S33 - Integration framework en offline widgets

## Entry gate

S30 heeft GO. Providercredentials zijn niet nodig; deze sprint gebruikt een
deterministische fake provider.

## Doel

Maak een server-only provideradapter- en snapshotsysteem dat nooit een live
providerafhankelijkheid in playback introduceert.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S33
- `docs/integrations-canon.md`, security- en playercanons

## Scope

- adapter SDK, capabilities, sync/error/retrycontracten;
- tenant connections met secret references;
- idempotente jobs, rate limits, retention en audit;
- versioned immutable widget snapshots zonder arbitrary HTML;
- Control connection/sync/widget UX;
- fake provider -> release -> offline player.

## Acceptatie

- provider SDK/secret komt niet in clientbundles;
- SSRF, wrong tenant, retry storm en credential leakage zijn getest;
- stale snapshot heeft expliciete fallback;
- player doet geen live providercalls;
- database-, security-, offline-, E2E- en foundationgates zijn groen.
