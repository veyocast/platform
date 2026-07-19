# VPS-deployment

## Doel en grenzen

Deze runbook beschrijft de definitieve VeyoCast-releaseflow naar de aparte
staging- en productieomgeving. De bestaande development-VPS valt buiten deze
workflow. Caddy, UFW, SSH, DNS en de GitHub runners zijn hostinfrastructuur en
worden niet door de applicatieworkflow gewijzigd.

De deployment gebruikt:

- Ubuntu 24.04;
- Caddy rechtstreeks op de host;
- Rootless Docker onder gebruiker `deploy`;
- repositoryspecifieke self-hosted runners;
- twee geïsoleerde Compose-projecten;
- twee verschillende Supabase-projecten;
- één lokaal gebouwde, immutable release per volledige Git-SHA.

De centrale bestanden zijn:

- `.github/workflows/deploy.yml`;
- `scripts/deploy-vps.sh`;
- `scripts/migrate-supabase.sh`;
- `infra/vps/compose.yaml`.

Zie ook [GitHub environments](./github-environments.md),
[rollback](./rollback.md) en het [deploymentaudit](./deployment-audit.md).

## Vaste omgevingstopologie

| Omgeving | Service | Publieke URL | Localhostbinding |
|---|---|---|---|
| staging | Control | `https://staging-control.veyocast.nl` | `127.0.0.1:13000` |
| staging | Player | `https://staging-player.veyocast.nl` | `127.0.0.1:13001` |
| production | Marketing | `https://veyocast.nl` | `127.0.0.1:23002` |
| production | Control | `https://control.veyocast.nl` | `127.0.0.1:23000` |
| production | Player | `https://player.veyocast.nl` | `127.0.0.1:23001` |

Staging start exact `control` en `player`. Production start exact `marketing`,
`control` en `player`. Marketing wordt wel tijdens `build-release` gebouwd en
met een tijdelijke lokale container gecontroleerd, maar niet in de stagingstack
opgenomen.

| Instelling | staging | production |
|---|---|---|
| Runtime directory | `/srv/apps/veyocast/staging` | `/srv/apps/veyocast/production` |
| Compose project | `veyocast-staging` | `veyocast-production` |
| Runnerlabels | `self-hosted, linux, x64, veyocast, staging` | `self-hosted, linux, x64, veyocast, production` |
| Supabase | eigen stagingproject | eigen productieproject |

`infra/vps/compose.yaml` bevat geen Caddyservice, publiek gebonden poort,
buildinstructie of gedeeld named volume. Compose maakt per project een eigen
bridge-netwerk. De oude `REVERSE_PROXY_NETWORK`-route is niet meer nodig omdat
Caddy de localhostpoorten gebruikt.

## Host-Caddy

Caddy blijft buiten Docker en routeert uitsluitend naar de vaste
localhostpoorten:

```caddyfile
staging-control.veyocast.nl {
  reverse_proxy 127.0.0.1:13000
}

staging-player.veyocast.nl {
  reverse_proxy 127.0.0.1:13001
}

veyocast.nl {
  reverse_proxy 127.0.0.1:23002
}

control.veyocast.nl {
  reverse_proxy 127.0.0.1:23000
}

player.veyocast.nl {
  reverse_proxy 127.0.0.1:23001
}
```

De applicatieworkflow gebruikt geen `sudo` en wijzigt deze configuratie niet.

## Releaseflow

Een push of merge naar `main` start `.github/workflows/deploy.yml`. De workflow
heeft globale concurrency `deploy-veyocast-main` met
`cancel-in-progress: false`, zodat releases elkaar niet kunnen passeren.

Alle checkouts gebruiken volledige historie met `persist-credentials: false`.
De checkoutactie gebruikt het automatisch gegenereerde jobtoken alleen tijdens
de checkout en laat geen credentialhelper of extraheader achter. De twee latere
remote `main`-controles authenticeren uitsluitend hun eigen `git fetch` met
`${{ github.token }}` en een tijdelijke command-scoped HTTP-extraheader. De
header wordt niet opgeslagen of gelogd en direct na de fetch uit de shell
gewist. De runners vereisen dus geen `gh auth login`, PAT, deploy key,
machinebrede Gitconfig of interactieve credentialinvoer.

1. `preflight` controleert de main-SHA, environmentconfiguratie, secretvormen en
   de Rootless Docker-daemon.
2. `build-release` installeert de frozen lockfile, voert lint, typecheck, tests
   en build uit en bouwt eenmaal drie images:
   - `veyocast-control:${GITHUB_SHA}`;
   - `veyocast-player:${GITHUB_SHA}`;
   - `veyocast-marketing:${GITHUB_SHA}`.
3. De lokale Docker image-ID's worden vastgelegd in releasemetadata. Marketing
   wordt vóór enige productieapproval in een tijdelijke container gezond
   bevonden.
4. `deploy-staging` voert een migration dry-run en forward migration uit,
   activeert alleen Control en Player en controleert lokale en publieke health.
5. `deploy-production` heeft `needs: deploy-staging` en gebruikt GitHub
   Environment `production`. De job wacht op required reviewer `TIXOCEO`.
6. Na approval controleert de job opnieuw dat `origin/main` nog exact dezelfde
   SHA heeft, vergelijkt alle drie lokale image-ID's met de geteste release en
   deployt zonder build.

Alle runners moeten dezelfde Rootless Docker-daemon en lokale imagestore van de
gebruiker `deploy` gebruiken. Zonder die eigenschap kan production de op staging
geteste lokale images niet veilig promoveren; gebruik dan eerst een immutable
containerregistry in plaats van dit lokale model.

### Server Actions-key

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` wordt door Next.js tijdens de eenmalige
imagebuild in de release ingebed. Daarom moet deze key voor dezelfde release in
staging en production exact gelijk zijn. De waarde blijft een Environment
secret en wordt nooit gelogd. `build-release` bewaart alleen een SHA-256-
fingerprint; production weigert de deployment wanneer de fingerprint afwijkt.

## Centraal deploymentscript

Gebruik het script altijd met omgeving gevolgd door actie:

```bash
bash scripts/deploy-vps.sh staging preflight
bash scripts/deploy-vps.sh staging build-release
bash scripts/deploy-vps.sh staging deploy
bash scripts/deploy-vps.sh staging verify
bash scripts/deploy-vps.sh staging rollback

bash scripts/deploy-vps.sh production preflight
bash scripts/deploy-vps.sh production deploy
bash scripts/deploy-vps.sh production verify
bash scripts/deploy-vps.sh production rollback
```

`build-release` is uitsluitend toegestaan op staging. Een normale production-
deployment bouwt nooit. Het script gebruikt steeds expliciet:

```bash
docker compose -p veyocast-staging --env-file ... -f infra/vps/compose.yaml up -d --no-build --remove-orphans
docker compose -p veyocast-production --env-file ... -f infra/vps/compose.yaml --profile production up -d --no-build --remove-orphans
```

De preflight weigert onder meer:

- een andere environment, host, poort, project-ref of Supabase-URL;
- een ongeldige volledige Git-SHA;
- staging-Marketingvariabelen;
- niet-passende anon- of service-role-JWT's;
- een ongeldige Server Actions-key;
- te korte Device Lab-secrets;
- een rootful, ontbrekende of door een andere gebruiker beheerde Docker-socket;
- een gerenderde Compose-stack met verkeerde services, builds, image-tags of
  een hostbinding anders dan `127.0.0.1`.

## Runtime- en releasestate

Het script gebruikt `umask 077`, runtime directories met mode `0700` en
statebestanden met mode `0600`:

```text
/srv/apps/veyocast/staging/.env.runtime
/srv/apps/veyocast/staging/REVISION
/srv/apps/veyocast/staging/PREVIOUS_REVISION
/srv/apps/veyocast/staging/RELEASE_MANIFEST

/srv/apps/veyocast/production/.env.runtime
/srv/apps/veyocast/production/REVISION
/srv/apps/veyocast/production/PREVIOUS_REVISION
/srv/apps/veyocast/production/RELEASE_MANIFEST
```

De kandidaat-runtimeconfiguratie en statebestanden worden via een tijdelijk
bestand en `mv` atomisch vervangen. `RELEASE_MANIFEST` bevat environment,
revision, deploymenttijd, SHA-tags, lokale image-ID's en serviceversies, maar
geen secrets.

Gedeelde, niet-geheime buildmetadata staat per immutable release in:

```text
/srv/apps/veyocast/releases/<git-sha>/RELEASE_METADATA
/srv/apps/veyocast/releases/<git-sha>/SERVER_ACTIONS_KEY_FINGERPRINT
```

## Migrations

Een normale release voert per environment eerst een remote migration-history-
en ordercontrole en daarna `supabase db push --dry-run` uit. Pas vervolgens
worden de forward migrations toegepast. De database-URL wordt niet gelogd.

De guard weigert:

- een URL zonder environmentproject-ref;
- een ongeldige migrationbestandsnaam of volgorde;
- remote-only of out-of-order historie die Supabase niet veilig kan verklaren;
- herkenbare destructieve statements zoals `DROP TABLE`, `DROP SCHEMA`,
  `TRUNCATE` of onbegrensde `DELETE FROM`.

Migrations blijven forward-only en moeten backward-compatible zijn met de
vorige applicatierelease. Een applicatierollback voert geen database-down-
migration uit. Zie [rollback](./rollback.md).

## Healthmatrix

| Omgeving | Service | Lokaal | Publiek |
|---|---|---|---|
| staging | Control | `http://127.0.0.1:13000/api/health` | `https://staging-control.veyocast.nl/api/health` |
| staging | Player | `http://127.0.0.1:13001/healthz` | `https://staging-player.veyocast.nl/healthz` |
| production | Marketing | `http://127.0.0.1:23002/api/health` | `https://veyocast.nl/api/health` |
| production | Control | `http://127.0.0.1:23000/api/health` | `https://control.veyocast.nl/api/health` |
| production | Player | `http://127.0.0.1:23001/healthz` | `https://player.veyocast.nl/healthz` |

Een gezonde response is exact compacte JSON:

```json
{
  "status": "ok",
  "service": "control",
  "environment": "staging",
  "revision": "<volledige-git-sha>"
}
```

De endpoints zijn unauthenticated, gebruiken `application/json`, tonen geen
credentials of gebruikersdata en geven `503` met een generieke veilige response
wanneer essentiële runtimeconfiguratie ongeldig is. De deployment probeert elke
check maximaal twintig keer met drie seconden interval, korte timeouts en toont
bij blijvend falen alleen geredigeerde containerlogs.

## Eerste deployment

1. Controleer de Environments volgens
   [github-environments.md](./github-environments.md), inclusief main-only
   branch policy en de ingestelde productionreviewer.
2. Bevestig dat alle runnerprocessen online zijn, de vereiste labels hebben en
   dezelfde Rootless Docker-daemon onder `deploy` gebruiken.
3. Bevestig dat staging en production verschillende Supabase-projecten hebben.
4. Zorg dat `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` in beide Environments exact
   dezelfde geldige waarde heeft.
5. Bevestig dat de obsolete deployrun geannuleerd blijft.
6. Merge de deploymentwijzigingen naar `main`, of start daarna handmatig de
   workflow in `release`-modus met de actuele volledige main-SHA.
7. Volg `preflight`, `build-release` en `deploy-staging` en test op staging:
   login, afbeeldingupload, playlistpublicatie, pairing en playback.
8. Open de wachtende `deploy-production`-job, controleer SHA en stagingbewijs en
   keur de GitHub Environment-deployment goed.
9. Controleer alle drie production-healthroutes en voer een functionele smoke
   uit.

## Troubleshooting

### Job blijft queued

Controleer dat een online runner alle vijf labels heeft. `veyocast-vps` is geen
label van het definitieve model. Controleer daarnaast of de runners als
repositoryrunners zichtbaar zijn en onder dezelfde `deploy`-gebruiker draaien.

### Production vraagt geen approval

Controleer of de protection rule met required reviewer `TIXOCEO` nog actief is.
Self-review is voorlopig toegestaan; voor verplicht vier-ogenapproval moet eerst
een tweede reviewer worden toegevoegd.

### Production meldt een stale release

`main` is na staging verder gegaan. Keur de oude job niet alsnog goed. Laat de
nieuwste main-run staging opnieuw doorlopen. Gebruik alleen de expliciete
rollbackmodus voor een bewust gekozen oudere release.

### Releaseautorisatie kan `origin/main` niet ophalen

Controleer dat de workflow nog `permissions: contents: read` heeft en dat de
betreffende fetchstap `GH_TOKEN: ${{ github.token }}` uitsluitend omzet naar een
command-scoped `http.https://github.com/.extraheader`. Voeg geen PAT,
repositorysecret, deploy key of machinebrede `gh`-login toe. De checkout hoort
`persist-credentials: false` te behouden; de statische workflowguard weigert
remote Git-commando's zonder expliciete jobtokenauthenticatie.

### Image-ID of Server Actions-key wijkt af

Controleer dat beide runners dezelfde Rootless daemon gebruiken, dat images niet
handmatig zijn hertagd of verwijderd en dat de Server Actions-key in beide
Environments gelijk is. Bouw production niet opnieuw.

### Healthcheck faalt

Controleer eerst de lokale URL, daarna Caddy/DNS/TLS. Inspecteer geredigeerde
Compose-logs en vergelijk `environment` en `revision` met `REVISION`. Wijzig
Caddy niet vanuit de workflow.

### Video blijft verwerken

De definitieve webstack start bewust geen `media-worker`. Daarmee is echte
asynchrone MP4-normalisatie niet actief in staging of production. Richt vóór een
video-pilot een afzonderlijk veilig workerdeploymentmodel in; voeg de worker
niet stilzwijgend aan deze exact gevalideerde serviceprofielen toe.
