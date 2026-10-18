# GitHub environments

## Environmentbeleid

De repository gebruikt exact twee deployment-Environments: `staging` en
`production`. Beide accepteren alleen deployments vanuit `main`.

- `staging` heeft geen reviewer nodig en rolt na een groene main-release
  automatisch uit.
- `production` start uitsluitend na `workflow_dispatch` met
  `deploy_target=production` en pas na een volledig gezonde stagingdeployment.
  Environment-reviewers zijn een aanvullende vier-ogenbeveiliging.
- Environment secrets blijven environment-scoped; gebruik geen gedeelde
  repositorysecrets voor Supabase- of Device Lab-credentials.
- De workflow heeft uitsluitend `contents: read` en deployt nooit vanuit
  `pull_request`.
- GitHub levert per job automatisch `${{ github.token }}`. Alleen de twee
  remote `main`-fetches gebruiken dit token via een tijdelijke command-scoped
  HTTP-header; het is geen repositorysecret en wordt niet opgeslagen.

De GitHub API-audit van 27 juli 2026 bevestigde voor beide Environments een
custom branch policy voor exact `main`, maar geen actieve required reviewer op
`production`. Daarom is productionautorisatie niet afhankelijk van die
instelling: de workflowconditie weigert iedere gewone `main`-push. Voeg waar het
GitHub-plan dit ondersteunt reviewers toe als extra vier-ogenbeveiliging.

## Variables

### Staging

```text
CONTROL_HOST=staging-control.veyocast.nl
PLAYER_HOST=staging-player.veyocast.nl
CONTROL_BIND_PORT=13000
PLAYER_BIND_PORT=13001
SUPABASE_PROJECT_REF=<staging-project-ref>
NEXT_PUBLIC_SUPABASE_URL=https://<staging-project-ref>.supabase.co
```

Staging mag geen `MARKETING_HOST` of `MARKETING_BIND_PORT` bevatten.

### Production

```text
MARKETING_HOST=veyocast.nl
MARKETING_BIND_PORT=23002
CONTROL_HOST=control.veyocast.nl
PLAYER_HOST=player.veyocast.nl
CONTROL_BIND_PORT=23000
PLAYER_BIND_PORT=23001
SUPABASE_PROJECT_REF=<production-project-ref>
NEXT_PUBLIC_SUPABASE_URL=https://<production-project-ref>.supabase.co
```

De project-refs moeten verschillend zijn en iedere URL moet exact
`https://<eigen-ref>.supabase.co` zijn.

`REVERSE_PROXY_NETWORK` was aanwezig met
`veyocast-staging-internal` respectievelijk
`veyocast-production-internal`, maar is in het host-Caddymodel overbodig. Beide
variables zijn op 19 juli 2026 verwijderd:

```bash
gh variable delete REVERSE_PROXY_NETWORK --repo veyocast/platform --env staging
gh variable delete REVERSE_PROXY_NETWORK --repo veyocast/platform --env production
```

## Secrets

Beide Environments vereisen deze zes gedeelde namen:

| Secret | Gebruik | Validatie zonder waarde te loggen |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase-browserclient | JWT met rol `anon` en eigen project-ref |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only Control/Player-API en afzonderlijke mediaworker | JWT met rol `service_role` en eigen project-ref |
| `SUPABASE_DB_URL` | migration dry-run en apply | `postgres://` of `postgresql://`, Supabase-host en eigen ref |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | eenmaal gebouwde Next.js-release | geldige base64-key van 16, 24 of bij voorkeur 32 bytes |
| `DEVICE_LAB_ACCESS_TOKEN` | afgeschermde Device Lab-toegang | minimaal 24 tekens |
| `DEVICE_LAB_SESSION_SECRET` | ondertekening Device Lab-sessie | minimaal 32 tekens |

Alleen `staging` krijgt daarnaast:

| Secret | Gebruik | Validatie zonder waarde te loggen |
|---|---|---|
| `SUPABASE_RESTORE_DRILL_DB_URL` | handmatige recoverydrill naar een disposable database | PostgreSQL-URL; databasenaam eindigt verplicht op `_restore_drill`, wijkt af van `SUPABASE_DB_URL` en bevat geen productionachtige host-/databasenaam |

Alle zes namen waren op 19 juli 2026 in zowel staging als production aanwezig.
Er zijn daarom geen ontbrekende-secretcommando's. GitHub toont de waarden niet;
de runtimepreflight valideert vorm en projectsamenhang zonder ze te printen.
S29-A voegt voor de worker geen nieuw secret of nieuwe GitHub-variable toe.
S29-D voegt uitsluitend het stagingsecret `SUPABASE_RESTORE_DRILL_DB_URL` toe;
production krijgt dit secret nadrukkelijk niet.

Omdat dezelfde immutable Next.js-image wordt gepromoveerd, moet
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` voor deze release in beide Environments
exact dezelfde waarde hebben. De productiondeployment vergelijkt daarvoor een
fingerprint met de tijdens `build-release` vastgelegde fingerprint.

De repository gebruikt momenteel geen `SUPABASE_ACCESS_TOKEN`,
`RESEND_API_KEY`, `EMAIL_FROM`, Mollie-, cron- of Sentry-secret. Voeg zulke
secrets pas toe wanneer code en workflow ze aantoonbaar nodig hebben.

## Auditcommando's

Variabelewaarden en alleen secretnamen controleren:

```bash
gh variable list --repo veyocast/platform --env staging
gh variable list --repo veyocast/platform --env production
gh secret list --repo veyocast/platform --env staging
gh secret list --repo veyocast/platform --env production
```

De workflowpreflight kan per omgeving opnieuw worden uitgevoerd zonder te
deployen:

```bash
bash scripts/deploy-vps.sh staging preflight
bash scripts/deploy-vps.sh production preflight
```

Voer die commando's alleen uit in een shell waarin de betreffende
Environmentwaarden veilig als environmentvariabelen zijn geïnjecteerd.

## Runnercontrole

Vereiste labels:

```text
staging:    self-hosted, linux, x64, veyocast, staging
production: self-hosted, linux, x64, veyocast, production
```

De repository-API zag tijdens de audit twee online runners:

- `veyocast-staging-01`;
- `veyocast-production-01`.

De infrastructuurbeschrijving noemt vier repositoryspecifieke runners. Verifieer
de twee ontbrekende registraties of leg vast dat de uiteindelijke capaciteit
bewust twee is. Extra label `deploy` is onschadelijk; oud label `veyocast-vps`
wordt niet gebruikt. Alle deploymentrunners moeten dezelfde Rootless Docker-
daemon onder gebruiker `deploy` bereiken.

## Production approval configureren

1. Open `Settings` → `Environments` → `production`.
2. Laat deployment branches uitsluitend `main` toe.
3. Controleer dat admin bypass uitgeschakeld blijft.
4. Voeg waar het GitHub-plan dit ondersteunt required reviewers toe als extra
   vier-ogenbeveiliging.
5. Sla op en start een handmatige releasetest.

Een gewone push naar `main` stopt altijd na een gezonde stagingdeployment.
Production start uitsluitend vanuit `workflow_dispatch` met
`deploy_target=production`; de operator controleert vooraf commit-SHA,
staginghealth en releasemodus. Environment-reviewers zijn een aanvullende
beveiliging en niet de enige productiongrens.

## Workflow dispatch

Normale handmatige redeploy van actuele `main`:

- kies workflow `Deploy VeyoCast`;
- kies branch `main`;
- kies `deploy_target=staging`, of uitsluitend bij expliciete
  productieautorisatie `deploy_target=production`;
- kies `mode=release`;
- laat `release_sha` leeg of vul de actuele volledige main-SHA in;
- laat `rollback_confirmation` leeg.

Gecontroleerde rollback:

- kies het gewenste `deploy_target`;
- kies `mode=rollback`;
- vul een volledige, reeds gebouwde SHA uit `main` in;
- vul exact `ROLLBACK` in als bevestiging.

Iedere rollback doorloopt staging. Alleen `deploy_target=production` vervolgt
naar production. Een normale release weigert een SHA zodra `main` verder is
gegaan.
# Operationele secrets en variabelen

Voor `production` is daarnaast nodig:

- secret `SLACK_ALERT_WEBHOOK_URL`: inkomende webhook van het besloten
  monitoringkanaal;
- variable `RETENTION_ENFORCEMENT_ENABLED`: begin met `false`; pas na juridisch
  goedgekeurde policies op `true`;
- bestaande secret `SUPABASE_SERVICE_ROLE_KEY` en variable
  `NEXT_PUBLIC_SUPABASE_URL` worden door de retentionjob hergebruikt.

## Slack-alarm testen

Voeg `SLACK_ALERT_WEBHOOK_URL` als **Environment secret** toe aan zowel
`staging` als `production`. Er is geen aanvullende gewone variabele nodig:
Control-, Player- en Marketinghealth-URL's worden uit de bestaande hostvariabelen
afgeleid.

Na merge naar `main`:

1. open GitHub Actions;
2. kies `Test Slack alert delivery`;
3. kies eerst `staging`;
4. typ exact `TEST SLACK`;
5. start de workflow en controleer de melding met `Dit is geen storing` in het
   besloten Slack-kanaal;
6. herhaal pas daarna voor `production`.

Deze workflow controleert de Environment-koppeling, het secret en aflevering
door Slack zonder een echte service uit te schakelen. De media-worker bewaakt
de echte endpoints iedere minuut, alarmeert na drie mislukte controles en
stuurt één herstelmelding zodra het endpoint weer gezond is.
