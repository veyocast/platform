# S219 — Menukaartcopy en vaste hoekfooter

Gebruikersopdracht: verwijder “Actuele clubinformatie” en “Bestellen en
afrekenen aan de bar” uit de Menu Studio-slide. Zet “ONZE CLUB. ONZE TROTS.”
vast in de uiterste linkeronderhoek van het slidecanvas. Commit en push de hotfix.

Ownership: `packages/content-templates/src/sites-menu-widgets-markup.tsx`,
`sites-menu-widgets-styles.ts`, `sites-unified-v17-markup.tsx`;
`tests/control/sites-menu-studio-parity.spec.ts`; dit promptbestand,
`docs/s219-menu-copy-footer-hotfix.md`, `PLANS.md` en `TASK_LEDGER.md`.

Gebruik de gedeelde browser-/serverrenderer en bestaande presentatiekleuren en
fonts. De vaste slogan valt buiten de productencontainer en diens autoschaling.
De bestaande Studio-templates, officiële merkassets, Player-system mark,
database-eerst bronupdates, immutable publicaties en offlineverificatie blijven
behouden. Geen dependencies, migraties of workflowwijzigingen.
