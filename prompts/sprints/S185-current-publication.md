# S185 — Actuele publicatie, schermopdracht en live data

Voer de gebruikersopdracht van 19–20 september 2026 uit: onderzoek de volledige
publicatie- en bronketen, vervang achterhaald publicatiewerk door één actuele
configuratie en één nieuwste kandidaat per scherm, scheid actuele gegevens van
gepubliceerd ontwerp en bevestig zichtbaarheid pas na de werkelijke eerste render.

Ownership: publicatie- en schermfuncties, relevante Supabase-migraties/RLS-tests,
Control-status, Player-API, React/Static LG-runtime, gedeelde dynamische renderer,
cache/telemetrie, operationele workflow/scripts, regressietests en documentatie.
Geen dependency-, merkasset- of ongerelateerde tenantwijzigingen. Eén writer,
branch en worktree. Alle checks vóór commit; bestaande PR/CI/deployflow volgen.

Bewaar immutable historie, last-known-good, serverautorisatie en doelprovenance.
Behoud actieve planningen, sponsorvolgorde, echte goal-events, premium layouts,
Amsterdamse daggrenzen, toegankelijkheid en fixed light. Nieuwe data mogen geen
conceptdesign zichtbaar maken. Offline/reconnect haalt uitsluitend het huidige doel.

Concrete oorzaken, implementatiekeuzes, migratievolgorde, operationele gates en
rollback staan in `docs/s185-current-publication.md`. De beschermde beheeractie
ondersteunt inventarisatie, officiële bronverversing en een canary per gebruikte
playlist. Tenantidentiteit en effectieve doelen moeten in de juiste omgeving
bevestigd zijn voordat een cutover wordt uitgevoerd. Nooit actieve velden vervalsen.

Rapporteer geïmplementeerd, lokaal getest, CI, gedeployed, toegewezen en werkelijk
zichtbaar afzonderlijk. Een Chromium Static LG-fixture is geen fysieke LG-test.
Retentie begint met een referentie-inventaris en herstelbewijs; verwijder niets
alleen omdat een record oud is.
