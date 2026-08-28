# S128 — Dynamische Sportlink-verjaardagen

## Doel

Lever één productiegeschikte `Sportlink — Verjaardagen`-flow via de bestaande
Sportlink-worker, tenant-RLS, immutable dynamische snapshots, gedeelde
Control/Player-renderer en Last Known Good-cache.

## Ownership

- contracts, integrations en content-templates;
- media-worker Sportlinkpad;
- Control Sportlink-beheer, birthdaywizard en playlistduur;
- browser- en LG-Player;
- S128 Supabase-migratie/RLS-test;
- S128-tests, documentatie en screenshots.

## Gates

Verse database-reset en RLS, workspace lint/typecheck/test/build, Control a11y
en Chromium E2E, Player/offline, browser- en LG-regressie, visuele 16:9/9:16-
goldens, Supabase database-lint/advisors en hosted staging/production-readback.

## Productgrenzen

Geen scraping, member-OAuth, volledig ledenregister of Ambient-scheduler.
Client ID blijft encrypted server-side. Leeftijd komt uitsluitend uit bewezen
geboortejaarprovenance; dubbele namen worden nooit automatisch verrijkt.
Immutable releases en offline Last Known Good blijven ongewijzigd.

