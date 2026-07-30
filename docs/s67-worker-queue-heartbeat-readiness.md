# S67 — releasegebonden workerheartbeat

## Aanleiding

De productie-mediaworker pollde aantoonbaar zijn queues op de juiste immutable
release, maar de lokale TCP-verbinding naar `127.0.0.1:3100/readyz` werd in de
productiecontainer geweigerd. Daardoor bleef ook de Docker-healthcheck op
`starting` staan en rolde een verder gezonde release veilig terug.

## Herstel

- Een echte queuepoll schrijft maximaal eenmaal per vijf seconden een atomisch
  heartbeatbestand op het schrijfbare `/tmp`-volume.
- De heartbeat bevat uitsluitend servicenaam, omgeving, volledige release-SHA
  en polltijd. Er staan geen secrets, URL's of queuegegevens in.
- Bij iedere workerstart wordt een achtergebleven heartbeat eerst verwijderd.
- Bij drain wordt de heartbeat verwijderd.
- De deployment en Docker-healthcheck accepteren de heartbeat alleen wanneer:
  - de servicenaam exact `VeyoCast Media Worker` is;
  - omgeving en volledige SHA exact bij de geautoriseerde release horen;
  - de poll niet uit de toekomst komt en maximaal 75 seconden oud is.
- De bestaande directe `/readyz`-probe blijft als eerste controle bestaan.
  Alleen de defecte lokale TCP-route wordt omzeild; business-readiness wordt
  niet versoepeld.

## Validatie

- `bash -n scripts/deploy-vps.sh`
- `shellcheck scripts/deploy-vps.sh`
- `node scripts/validate-deploy-workflow-security.mjs`
- `pnpm --filter @veyocast/media-worker lint`
- `pnpm --filter @veyocast/media-worker typecheck`
- `pnpm --filter @veyocast/media-worker test`
- volledige workspace lint-, typecheck- en unitgates
- hosted staging- en productiondeployment met exacte revision-healthchecks
