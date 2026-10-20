# S279 — Keuzevelden volgen het gekozen Sync-palet

De vierde geïntegreerde beeldreview op de werkelijke74eb-build toont een donker
MultiSelectDropdown-vlak in platform/support/settings, met een onleesbaar donker
label, ondanks de gekozen vaste lichte Sync-werkruimte. Oorspronkelijke beelden
blijven behouden. Deze taak is een begrensde noodzakelijke vervolgstap van S244.

Ownership: uitsluitend apps/control/app/sync-adapter.css,
tests/control/sync-platform-mobile-layout.spec.ts, dit sprintprompt,
docs/s279-sync-multiselect-palette.md en de eigen TASK_LEDGER-regel.

Gebruik alleen bestaande Source-kleurrollen binnen .sync-control .vc-multi-select;
geen root/shared-tokenwijziging of renderer-/handler-/optie-/selectielogica.
Verbind de door MultiSelect gebruikte vooraf opgeloste vc-vector-kleurrollen
expliciet op het component. Bestaande twee platformlayoutgevallen krijgen een
werkelijke lichte/donkere regressieassertie op dit bestaande veld; behoud alle
andere veertien beschermde bronhashes, layout-/keyboard-/aXe-asserties en budgets.
Werk uitsluitend de adapterhash bij. Verifieer echte AAL2-tegenproeven390/1440,
kleuren/tekst/geometrie/herstel/noPOST en alle bestaande gegevensguards. Geen
nieuwe algemene AA-, provider-, pixel-, hardware- of vijf-rondenclaim. Root blijft
integratiewriter; sluit eigen browsers en processen voor commit/push. Nieuwe
gecombineerde appbuild, exacteCI en uitrol blijven verplicht binnen S244.
