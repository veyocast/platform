# S18 — VeyoCast-rebrand

## Doel

Zet het volledige product veilig over naar VeyoCast. De voorgaande productnaam mag niet meer voorkomen in zichtbare tekst, bronpaden, packages, runtime-namespaces, infrastructuuridentifiers, databasefixtures of merkassets. Alleen de ongewijzigde GitHub-organisatienaam is toegestaan.

## Verplicht

- Hernoem productcopy, package-scope, env-prefixen, caches, storagekeys, containers, runners, tests en documentatie.
- Migreer bestaande playeridentiteit, IndexedDB, Cache Storage en last-known-good metadata zonder herpairing of offline dataverlies.
- Voeg een voorwaartse Supabase-migratie toe voor bestaande zichtbare seed- en devicegegevens en functie-defaults.
- Verwijder binaire assets en referentiebeelden met de voorgaande identiteit.
- Markeer nieuwe SVG's expliciet als tijdelijke placeholders; reconstrueer geen officieel logo.
- Promoveer het designcanon naar versie 2.0.0 en leg goedgekeurde merkmasters vast als launchgate.
- Regenereer pnpm-workspacelinks, design-tokens en canonchecksums.
- Bewijs met een case-insensitive audit dat uitsluitend GitHub-organisatie-URL's de voorgaande naam bevatten.

## Gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:reset
pnpm test:rls
pnpm test:a11y -- --project=chromium
pnpm test:e2e -- --project=chromium
pnpm test:player
pnpm test:player:offline
```
