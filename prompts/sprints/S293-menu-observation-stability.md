# S293 — Menu-observatie tijdens de S292-stagingcanary

Vervolg op de geautoriseerde bronherstel-/DOM-opdracht. Basis is de normale
S292-merge `4d3fa168f75e115687ca2a1de38a393ee07256fc`; productiepromotie is
aangehouden wegens werkelijk gereproduceerde metadatachurn.

Root is enige writer. Ownership: de nieuwe forwardmigratie voor
`private.sync_dom_semantic_data_v2`, de gerichte uploadguard in `apps/media-worker/src/dynamic-render-backend.ts`
en eigen backend-/SQL-/cross-transactionele RPC-regressies, bewijs/doc/prompt en de gerichte PLANS-/TASK_LEDGER-regels.
De gemengde canary vereist daarnaast dat de bestaande backend een begrensde,
gevalideerde Menu-PNG accepteert zonder Source-poster; alle Source-budgetten en
lease-/bytes-/padcontroles blijven gelden. Geen bestaande migratie, renderer, productdata, locked asset, dependency,
lockfile, workflow of historische release wijzigen.

Publicatie-observatietijd hoort niet bij v2-inhoudsidentiteit; echte
product-/prijs-/asset-/documentwijzigingen wel. V1 blijft strikt. Test met
afzonderlijke transacties: `now()` binnen één rollbacktransactie is constant.
Verifieer workspace lint/typecheck/test, verse eigen reset/RLS, db-lint en de
echte Menu-RPC-keten. Commit/push pas bij groene gates; volg normale PR/CI,
main→staging, echte canary en expliciete productiepromotie. Behoud de bestaande
GitHub-environmentreview; de oorspronkelijke gebruikerstoestemming voor
deployment blijft gelden.
