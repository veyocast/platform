# S132 — LED Scores realtime Goal Alert

Lever een default-off, tenantveilige realtime Goal Alert-pilot voor Duindorp sv.
Gebruik uitsluitend een server-only read-only websocketconnector met lease,
strikte schemavalidatie, veilige baseline/reconnect, expliciete own/opponent-
mapping en canonieke eventdeduplicatie.

Studio publiceert eigen- en tegenstandervarianten als immutable versies naar de
unie van meerdere schermgroepen. De Player ontvangt screen-scoped realtime
deliveries met zijn device credential, prefetcht media, plant op servertijd,
bevestigt de uitkomst en toont de overlay boven ongewijzigde last-known-good
playback. `pause` hervat exact; unknown volgt expliciet suppress/generic-beleid
en stale, duplicate of incomplete input speelt nooit af.

Bewijs minimaal database-reset/RLS, parser- en workertests, Playerunit/E2E,
multi-Player timing, a11y, offlinebehoud, secretvrije builds, gecontroleerde
rollout en niet-destructieve rollback. De uitvoeringsdetails staan in
[`../../docs/integrations/ledscores-realtime-goal-alert.md`](../../docs/integrations/ledscores-realtime-goal-alert.md).
