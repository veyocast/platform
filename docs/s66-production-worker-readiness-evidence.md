# S66 — productie-workerreadiness

## Aanleiding

De immutable portrait-release was volledig gezond op staging, maar twee
productiepogingen stopten bij de media-workerreadiness. De workerlog bewees
tegelijk dat dezelfde geautoriseerde revisie de media-, Studio- en dynamische
queues actief pollde. Control, Player en Marketing werden daardoor terecht
teruggezet, maar de directe `docker compose exec`-probe gaf geen veilige
oorzaak terug.

## Herstel

- De directe `/readyz`-probe blijft de primaire en strengste controle:
  HTTP-status, `ready`, servicenaam, omgeving en volledige release-SHA moeten
  exact kloppen.
- De probe bewaart uitsluitend een gesaneerde allowlist met status, service,
  omgeving, revisie en foutcategorie. Tokens, URL-bodies en container-env
  worden niet gelogd.
- Als rootless Docker tijdelijk geen aanvullend `compose exec`-proces kan
  starten, mag de reeds ingebouwde container-healthcheck readiness bevestigen.
  Dat is alleen geldig wanneer ook:
  - de actieve image-ID exact gelijk is aan de immutable release-metadata;
  - `DEPLOYMENT_SHA` exact gelijk is aan de geautoriseerde release;
  - `VEYOCAST_ENVIRONMENT` exact gelijk is aan de doelomgeving.
- Een mislukking meldt voortaan de laatste veilige probe en Docker-healthstatus
  in plaats van alleen een generieke readinessfout.

## Grenzen

De fallback versoepelt de business-readiness niet. De Docker-healthcheck
bevraagt hetzelfde lokale `/readyz`-endpoint, dat alleen HTTP 200 retourneert
na een recente queuepoll en buiten drainmodus. De bestaande image-digestguard,
stale-releaseguard, healthmatrix en automatische rollback blijven intact.

## Validatie

- `bash -n scripts/deploy-vps.sh`
- `node scripts/validate-deploy-workflow-security.mjs`
- `pnpm --filter @veyocast/media-worker lint`
- `pnpm --filter @veyocast/media-worker typecheck`
- `pnpm --filter @veyocast/media-worker test` — 63 tests groen
- Hosted staging- en productiondeployment met publieke revision-healthchecks
  volgen na merge.
