# S21 - Identity, tenantcontext, capabilities en MFA

## Doel

Vervang impliciete tenantselectie en verspreide rolchecks door expliciete,
server-side gevalideerde context, centrale capabilities en AAL2 voor gevoelige
platformmutaties.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S21
- `docs/auth-rls.md`, `docs/security-rls-canon.md`

## Scope

- exhaustieve rol-naar-capabilitymatrix en `requireCapability()`;
- expliciete tenant-slug/contextnavigatie met membershipvalidatie;
- werkende tenant-switcher en veilige cache/formreset;
- Supabase MFA enrollment/challenge/recovery en AAL2-gates;
- active/paused/archived enforcement in server/databaseboundaries.

## Acceptatie

- geen `memberships[0]` als actieve-contextbesluit;
- hostile slug/ID, cross-tenant cache en membership revocation getest;
- AAL1 kan geen gevoelige platformmutatie uitvoeren;
- paused/archived gedrag is aantoonbaar en playerveilig;
- DB reset/RLS, unit, E2E, a11y, lint, typecheck en build zijn groen.

## Non-goals

- team/invitation UI uit S22;
- algemene Control-redesign uit S23.
