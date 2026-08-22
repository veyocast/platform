# S115 — Sponsor Hub

## Doel

Bouw de tenantveilige Sponsor Hub uit de product- en technische specificatie
v1.1 als een afzonderlijke operationele werkplek. Een sponsor is geen los
mediabestand: relatie, overeenkomst, campagne, creative family/rendition,
semantische positie, contextbinding, immutable plan en Proof of Play blijven
afzonderlijke domeinobjecten.

## Invarianten

- Vier-ogen-goedkeuring is standaard; de indiener keurt de eigen revisie niet goed.
- Sponsorweging gebeurt per campagne, nooit per aantal creatives.
- Playlist en dynamische content verwijzen semantisch naar een positie/pool.
- De Player selecteert deterministisch lokaal, zonder API- of databaseroundtrip per play.
- Contentrelease en sponsorrevisie worden als één delivery-envelope voorbereid.
- Sponsorassets zijn checksum-gepind, volledig gedownload en geverifieerd vóór activatie.
- Een onvolledig/verlopen sponsorplan breekt de playlist en last-known-good nooit.
- Proof of Play is devicegebonden, gebatcht, UUID-idempotent en geen publieksclaim.
- Multi-tenant RLS, server-side capabilities en immutable publicaties zijn verplicht.

## Op te leveren

Sponsorrelaties, campagnes, creatives, zes MVP-posities, contextmodel,
schermtargeting, rapportage/actiecentrum, audit, plancompiler, playercache,
semantische overlays, offline expiry en Proof-of-Play-wachtrij. Extern
sponsorportaal, platformmarktplaats, revenue share en interval-ad-injectie vallen
buiten S115.
