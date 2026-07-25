# VeyoCast incidentprocedure

Deze pagina is de operationele route tijdens een storing. Zij is geen bewijs
dat een privacy- of beveiligingsincident juridisch is afgehandeld.

## Rollen

| Verantwoordelijkheid | Primaire rol | Back-up |
| --- | --- | --- |
| Incident leiden en technische acties autoriseren | Platform owner | Platform admin met releasebevoegdheid |
| Diagnose, mitigatie en rollback | Dienstdoende platform engineer | Tweede platform engineer |
| Klanten informeren | Product support | Platform owner |
| Privacy-impact beoordelen | Privacyverantwoordelijke | Externe privacy-/juridische adviseur |

De concrete namen, telefoonnummers en het buiten-kantoorurenrooster staan alleen
in het afgeschermde Slack-kanaal en de interne contactlijst; nooit in Git.

## Eerste vijftien minuten

1. Reageer in het Slack-alarm en benoem één incidentleider.
2. Noteer starttijd, getroffen omgeving, diensten en klantimpact. Plaats geen
   tokens, klantinhoud, signed URL's of persoonsgegevens in Slack.
3. Controleer publiek: Control `/api/health`, Player `/healthz` en Marketing
   `/api/health`.
4. Bekijk op de juiste VPS met de `deploy`-gebruiker uitsluitend begrensde logs:
   `docker compose logs --since 15m --tail 200 <service>`.
5. Controleer Supabase-status, media-worker readiness en de laatste deployment.
6. Mitigeer eerst. Voer geen databasereparatie uit zonder tweede controle.

## Rollback

1. Bepaal de laatste aantoonbaar gezonde SHA uit deploymentmetadata.
2. Start de bestaande production-workflow met deployment mode `rollback`, of
   voer onder de geautoriseerde runner uit:
   `RELEASE_SHA=<gezonde-sha> bash scripts/deploy-vps.sh production rollback`.
3. De rollback gebruikt alleen al gebouwde immutable images en controleert daarna
   alle health endpoints.
4. Databasewijzigingen worden niet automatisch teruggedraaid. Gebruik alleen
   forward fixes of een geoefend herstelpunt volgens `docs/runbooks/recovery.md`.

## Communicatie

- Product support geeft bij merkbare klantimpact binnen 30 minuten een korte,
  feitelijke update: impact, workaround en volgend tijdstip.
- Deel geen vermoedelijke oorzaak als feit.
- Sluit pas na bevestigde health, een Player-syncproef en akkoord van de
  incidentleider.

## Privacy- of beveiligingsincident

Escaleren naar de privacyverantwoordelijke zodra vertrouwelijkheid,
beschikbaarheid of integriteit van persoonsgegevens mogelijk is geraakt.
Bevries relevante logs en auditinformatie, beperk toegang en registreer tijdlijn,
gegevenscategorieën, betrokkenen, maatregelen en mogelijke gevolgen. De
privacyverantwoordelijke beslist met juridisch advies of melding aan de
Autoriteit Persoonsgegevens binnen 72 uur en/of communicatie aan betrokkenen
vereist is. Engineers doen die juridische beoordeling niet zelfstandig.

## Na herstel

Binnen twee werkdagen: tijdlijn, oorzaak, detectiegat, herstelactie, eigenaar en
deadline vastleggen. Test elke structurele maatregel en werk runbook en alerts bij.

