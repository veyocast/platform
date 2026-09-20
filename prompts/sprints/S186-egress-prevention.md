# S186 — Egress onderzoeken en begrenzen

Gebruikersopdracht 20 september 2026: herstel eerst een actuele, schone main;
voer daarna het egress-onderzoek, de read-only diagnose en de preventieopdracht
uit de drie aangeleverde bestanden uit. Baseline: `7337592511f78aacc86274fdfb0fb131505658d4`.

Eén writer op `veyocast/s186-egress-prevention`, één geïsoleerde worktree/PR.
Ownership: Player-mediacache/delivery, Static LG, goalmedia, serviceworker,
heartbeattelemetrie; media-worker queue/pipeline/bronwerk; noodzakelijke
forward-only migratie en RLS-tests; bestaande observability; relevante
regressie-/soaktests en bestaande PR-testflow, operationele scripts,
worker-deploymentconfig en bewijsdocumentatie/task ledger.
Geen dependencies, locked assets, billingwijzigingen, cacheflush, bulkpublicatie
of verwijdering van historie. Native appcode alleen indien aantoonbaar nodig.

Behandel het vooronderzoek als te hercontroleren bewijs. Calls, opgeslagen bytes,
gemeten payloadbytes en billingbytes blijven afzonderlijke meetcategorieën.
Bewaar S185, tenant-/deviceautorisatie, immutable content, snelle publicatie,
volledig geverifieerde activering en last-known-good/offlinegedrag.

Gates: lint, typecheck, unit, Player/offline, relevante Chromium/a11y; bij
databasewijzigingen reset en volledige RLS. Alleen groene reviewbare wijzigingen
committen/pushen. Uitrol via bestaande beschermde exact-SHA-flow. Een lokale
Static LG-fixture is geen fysieke LG-acceptatie. Ontbrekende billing/logs of
hardwaretoegang expliciet rapporteren; geen productiecredential exporteren.
