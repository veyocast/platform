# S190 — LED Scores en Sportlink betrouwbaar verversen

Gebruikersopdracht 11 oktober 2026: herstel LED Scores en Sportlink end-to-end,
toon actuele databasegegevens op schermen en voorkom nieuwe contentversies bij
bronverversing. Verwijder superseded slide- en playlistversies zodra geen
publicatie, concept, planning, device, sponsorbewijs of retrybare uitrol ze gebruikt.

## Scope en ownership

- LED-agent: integrations LED-parser en eigen tests; worker LED-connector en tests.
- Sportlink-agent: birthday-normalisatie en tests; sync-runner en tests; Control
  Sportlink-pagina, lokale statushelper en tests.
- Queue-agent: nieuwe `published-data-refresh-runner.ts` en eigen tests.
- Retentie-agent: uitsluitend `20261011110000_s190_superseded_version_retention.sql`
  en `s190_superseded_version_retention.sql`.
- Diagnose-agent: `20261011130000_s190_live_integration_diagnostics.sql`, eigen pgTAP, `ops-probe-live-integrations.ts` en `probe-live-integrations.yml`.
- Root: `20261011100000_s190_published_data_refresh_queue.sql`, eigen pgTAP,
  worker-index, begrensde configured worker-client/tests, lifecycle/tests, RSS sync-runner/tests, gedeelde queue-wakeup/tests, `20261011120000_s190_worker_queue_hint.sql`, bestaande `rls_dynamic_slides.sql` en `rls_s145_supabase_lint_recovery.sql` contractregressies, sprintprompt, ledger, S190-runbook
  en expliciet scoped operationele diagnosehelpers/workflow indien nodig.

## Contract

Provider → serverworker → genormaliseerde tenantdatabase → gepubliceerde
databinding → Player. Geen providerfetch in slides. Een brontransactie zet alleen
duurzaam werk klaar; het opbouwen van één databinding gebeurt na commit onder
een service-only lease met begrensde retries en last-known-good. Identieke data
verhogen geen contentrevisie. Presentatie blijft exact de gepubliceerde versie.

LED accepteert lege/null-opstellingen en aanvullende providermetadata zonder
score-/goalautoriteit te versoepelen. Connected betekent geldige opgeslagen data.
Sportlink onderscheidt een geldig leeg datumvenster van ongeldige records en
laat een renderfout de bronopslag niet terugdraaien. Control toont laatste fouten
en freshness per dataset, ook wanneer andere datasets nog succesvol waren.

Retentie verwijdert uitsluitend onbereikbare eerdere versies in begrensde
transacties. Immutable payloads, actieve/pending/LKG-releases en alle pins blijven
beschermd. Gedeelde uploads en Storagebytes vallen buiten deze versieopruiming.

## Gates

Workspace lint/typecheck/test; geïsoleerde verse DB-reset en volledige RLS;
Control a11y + Chromium E2E; Player/offline als integratiebewijs. Regressies:
actuele geanonimiseerde LED-vorm, invalid→valid herstel, birthday-vensters,
synchrone fanout afwezig, queue-coalescing/lease/retry/tenantgrens, onveranderlijke
configuratie bij gewijzigde databindingen, veilige versieprune met referenties.
Staging vóór productie, exact-SHA health en privacyveilige bron→DB→bindingreadback.
