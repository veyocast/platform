# GitHub environments

## Environmentbeleid

De repository gebruikt exact twee deployment-Environments: `staging` en
`production`. Beide accepteren alleen deployments vanuit `main`.

- `staging` heeft geen reviewer nodig en rolt na een groene main-release
  automatisch uit.
- `production` heeft `TIXOCEO` als required reviewer en start pas na een
  volledig gezonde stagingdeployment. Admin bypass is uitgeschakeld.
- Environment secrets blijven environment-scoped; gebruik geen gedeelde
  repositorysecrets voor Supabase- of Device Lab-credentials.
- De workflow heeft uitsluitend `contents: read` en deployt nooit vanuit
  `pull_request`.

De GitHub API-audit van 19 juli 2026 bevestigde voor beide Environments een
custom branch policy voor exact `main`. Daarna is `TIXOCEO` als concrete
required reviewer ingesteld en is admin bypass uitgeschakeld. Self-review blijft
toegestaan zolang er geen tweede bevoegde reviewer bekend is; voeg voor een
vier-ogenprincipe eerst een tweede reviewer toe en schakel self-review dan uit.

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

Beide Environments vereisen exact deze namen:

| Secret | Gebruik | Validatie zonder waarde te loggen |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase-browserclient | JWT met rol `anon` en eigen project-ref |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only Control en Player-API | JWT met rol `service_role` en eigen project-ref |
| `SUPABASE_DB_URL` | migration dry-run en apply | `postgres://` of `postgresql://`, Supabase-host en eigen ref |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | eenmaal gebouwde Next.js-release | geldige base64-key van 16, 24 of bij voorkeur 32 bytes |
| `DEVICE_LAB_ACCESS_TOKEN` | afgeschermde Device Lab-toegang | minimaal 24 tekens |
| `DEVICE_LAB_SESSION_SECRET` | ondertekening Device Lab-sessie | minimaal 32 tekens |

Alle zes namen waren op 19 juli 2026 in zowel staging als production aanwezig.
Er zijn daarom geen ontbrekende-secretcommando's. GitHub toont de waarden niet;
de runtimepreflight valideert vorm en projectsamenhang zonder ze te printen.

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
3. Controleer dat `TIXOCEO` required reviewer is.
4. Voeg voor vier-ogenapproval een tweede reviewer toe en schakel daarna
   self-review uit.
5. Controleer dat admin bypass uitgeschakeld blijft.
6. Sla op en start een handmatige releasetest.

Na een gezonde stagingdeployment verschijnt `deploy-production` als wachtende
job. De reviewer controleert commit-SHA, staginghealth en releasemodus en kiest
pas daarna `Review deployments` → `Approve and deploy`.

## Workflow dispatch

Normale handmatige redeploy van actuele `main`:

- kies workflow `Deploy VeyoCast`;
- kies branch `main`;
- kies `mode=release`;
- laat `release_sha` leeg of vul de actuele volledige main-SHA in;
- laat `rollback_confirmation` leeg.

Gecontroleerde rollback:

- kies `mode=rollback`;
- vul een volledige, reeds gebouwde SHA uit `main` in;
- vul exact `ROLLBACK` in als bevestiging.

Ook rollback doorloopt staging en production approval. Een normale release
weigert een SHA zodra `main` verder is gegaan.
