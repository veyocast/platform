# Sponsor Hub

De Sponsor Hub staat voor tenantgebruikers met `tenant.sponsor.read` op
`/dashboard/sponsors`. Een custom sponsorcommissie kan uitsluitend deze
capabilities krijgen: `read`, `write`, `approve`, `publish` en `report`.

## Operationele keten

1. Leg een sponsor vast en maak een campagne met start/einde, gewicht, cap en cooldown.
2. Koppel een ready media-asset. De creative bewaart storagepad, variant, bytes en SHA-256; een wijziging wordt een nieuwe creative.
3. Plaats de campagne in een semantische positie: `fullscreen`, `presented_by`, `footer`, `corner`, `match_sponsor` of `match_ball_sponsor`.
4. Dien de campagne in. Een andere bevoegde gebruiker keurt haar goed.
5. Publiceer een immutable sponsorplan naar actieve schermen. Campagnewijzigingen vereisen geen playlistbewerking.
6. De manifest-API combineert release- en sponsorrevisie in één delivery-ETag. De Player downloadt en verifieert beide volledig en wisselt op de bestaande loopgrens.
7. De Player kiest lokaal en deterministisch per positie/orientatie. Na hard expiry wordt geen verlopen sponsoruiting getoond; normale content en last-known-good blijven spelen.
8. Vertoningen komen in een duurzame lokale queue en gaan in batches van maximaal 100 naar de devicegebonden Proof-of-Play-RPC. UUID's maken retries idempotent.

## Security en privacy

Alle sponsortabellen hebben `tenant_id`, composite foreign keys, indices, forced
RLS en default-deny mutaties. Menselijke writes lopen via capability-gated
`SECURITY DEFINER`-commands met een lege `search_path`. De player kan alleen de
credentialgebonden PoP-command uitvoeren. Rapportage bewijst technische
vertoningen en speeltijd, niet publiek, bereik of impressies door personen.

## Rollback

Applicatierollback laat bestaande planrevisies en PoP-events intact. De Player
blijft de reeds geactiveerde release gebruiken. De migratie voegt uitsluitend
nieuwe sponsortabellen/capabilities toe; destructieve down-migratie is bewust
niet geautomatiseerd. Een operationele rollback publiceert een nieuw leeg of
gecorrigeerd sponsorplan, nooit een mutatie van een bestaande revisie.
