# S289 — Producten en beheertabellen zichtbaar houden

De gebruiker ziet de producttotalen en paginateller, maar geen productrijen.
Read-only productiecontrole bevestigt 204 productrecords. De paginateller
51–100 bewijst dat de werkruimte 50 productmodellen heeft ontvangen.
De bestaande beheer-CSS-klasse `ad-table` staat letterlijk in EasyList;
deze moet geen product-, team- of sponsorbeheer verbergen.

Baseline: `87b30fa654d1361a80356e2f961b93f728af3560`.
Root is de enige writer op `veyocast/s289-visible-product-catalog` in
`/home/codex/repos/castivo-s289`. Commit, push en normale staging-/
productiepromotie zijn reeds geautoriseerd. S287 en S288 lopen afzonderlijk.

## Ownership

- De gedeelde tabelklassenaam in `apps/control/app/sync-source.css` en
  `sync-adapter.css`, plus alle bijbehorende runtimeverwijzingen in de
  productwerkruimte, de product-CSS-module, `dashboard/team/page.tsx` en
  `dashboard/sponsors/page.tsx`. Geen ontwerpwijziging.
- `tests/control/sync-products-workflows.spec.ts`: echte productcomponent,
  oorspronkelijke filterregel, zichtbaarheid, paginering, zoekopdracht,
  beschikbaarheidsactie en a11y op desktop/mobiel.
- Dit prompt, eigen PLANS-/TASK_LEDGER-aanvulling en
  `docs/s289-visible-product-catalog.md`.

## Acceptatie

Reproduceer het verdwijnen met de bestaande `.ad-table`-filterregel vóór
het herstel. Producten blijven na herstel zichtbaar met dezelfde actieve
filterregel, inclusief pagina twee, prijzen en bedienbare rijacties.
Geen browserinstelling hoeft te wijzigen. Behoud vormgeving, tenantqueries,
rechten, data, bevestigde prijzen en immutable publicaties. Geen database-,
dependency-, lockfile-, Player- of offlinewijziging. Lint/typecheck/unit en
relevante browser/a11y-gates moeten groen zijn; daarna normale CI en uitrol.
