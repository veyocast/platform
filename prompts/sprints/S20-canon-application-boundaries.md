# S20 - Canon en application boundaries

## Doel

Maak één actuele VeyoCast-doelcanon en introduceer de minimale contracts-,
domain- en authgrenzen waarop S21-S30 veilig kunnen voortbouwen.

## Verplicht lezen

- `AGENTS.md`, `README.md`, `PLANS.md`, `TASK_LEDGER.md`
- `docs/canon-alignment-product-roadmap.md`, sectie S20
- alle technische, design-, RLS- en playercanons uit de AGENTS-leesvolgorde
- `docs/architecture.md`

## Scope

- harmoniseer canon en ADR's;
- introduceer `packages/contracts`, `packages/domain` en `packages/auth`;
- voeg typed errors, capabilitycontracts en dependency-boundarytests toe;
- leg service/action/repositorypatronen en idempotencyregels vast;
- migreer alleen actief gewijzigde code, geen big-bang rewrite.

## Acceptatie

- geen conflicterende VeyoCast/NXTCast-normatieve regels;
- contracts/domain importeren geen React, Next of Supabase;
- browser- en server-only boundaries zijn automatisch getest;
- lint, typecheck, unit, build en boundarytests zijn groen;
- ADR, roadmap en ledger zijn bijgewerkt.

## Stop en rapporteer

- wanneer packagegrenzen alleen haalbaar lijken via circulaire imports;
- wanneer een securityboundary moet worden verzwakt;
- wanneer root dependencies/lockfile zonder expliciete dependencytaak wijzigen.
