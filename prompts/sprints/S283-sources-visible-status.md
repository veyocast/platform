# S283 — Bronstatus zichtbaar bij cosmetische advertentiefilters

De gebruiker ziet op Bronnen wel drie verbonden bronnen, maar geen bronkaarten,
filters of bronstatus. EasyList bevat de drie door deze onderdelen gebruikte
selectors `.ad-source`, `.ad-tabs` en `.ad-notice`. De browserconfiguratie van de
gebruiker is onbekend; reproduceer deze concrete filterbotsing zonder te claimen
dat zijn Chrome-profiel onderzocht is.

## Ownership

- apps/control/app/(shell)/dashboard/sources/sites-sources-overview.tsx
- apps/control/app/(shell)/dashboard/sources/sync-source-dialogs.module.css
- tests/control/sync-sources-dialogs.spec.ts
- tests/control/sync-source-geometry-comparison.spec.ts (uitsluitend dezelfde filtermetingen via semantische selector)
- tests/a11y/control-shell.spec.ts (uitsluitend bestaande lege-bronkaartenassertie)
- tests/e2e/dynamic-content-recovery.spec.ts (uitsluitend bestaande lege-bronkaartenassertie)
- docs/s283-sources-visible-status.md
- deze prompt en alleen de eigen nieuwe TASK_LEDGER.md-regel

## Uitvoering en grenzen

Vervang uitsluitend de drie botsende presentatienamen door lokale CSS-module-
klassen met dezelfde bestaande vormgeving, responsive waarden en reduced motion.
Behoud de oorspronkelijke globale Sync-stijlen bytegelijk. Geen database,
permissions, bronacties, credentials, providerconfiguratie, Player, merkassets,
dependencies of lockfile wijzigen. Geen advertenties of tracking verbergen:
dit zijn operationele beheerknoppen en eigen verenigingsgegevens.

Voeg een echte Chromium-regressie toe die de drie gepubliceerde cosmetische
filterregels toepast. Bewaar de rode baseline, controleer zichtbare kaartstatus,
filters, keyboard, detailtabs, fout-/viewerstatus, ongewijzigde geometrie en aXe
op 390 en 1440px. Voer foundationgates en de bestaande volledige CI-gates uit.
Werk via één branch/worktree/PR en de bestaande staging/productieketen; dezelfde
immutable images en normale productiereview. Bestaande uitgestelde provider- en
fysieke acceptatie blijven afzonderlijk.
