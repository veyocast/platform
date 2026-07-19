# S31 - Productiviteit, bulkacties, templates en views

## Entry gate

S30 heeft GO. Start niet wanneer kernjourneys of production operations nog rood
zijn.

## Doel

Versnel herhaald beheer zonder impactchecks, permissions of audit te omzeilen.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S31
- Design Canon en de S24-S28 resourcecontracts

## Scope

- bulk upload/archive/tag met per-itemresultaat en retry;
- saved personal/shared views met RLS;
- playlist dupliceren naar nieuwe draft zonder releasehistorie;
- goedgekeurde 16:9/9:16 contenttemplates;
- veilige command palette actions en contextuele starters;
- performance, idempotency en audit voor batches.

## Acceptatie

- partial failures zijn herstelbaar en verliezen geen itemstatus;
- shared views en bulkselectie blijven tenant-scoped;
- templates blijven preview/player-compatible;
- bulk archive behoudt immutable releases en toont impact;
- database-, performance-, E2E-, a11y- en foundationgates zijn groen.

## Non-goals

- Canva-achtige editor;
- arbitrary HTML/CSS templates.
