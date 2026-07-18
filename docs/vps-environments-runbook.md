# VPS staging- en productierunbook

## Topologie en afbakening

De bestaande ontwikkelomgeving blijft op de huidige VPS en valt volledig buiten
deze workflow. Een tweede VPS host:

- `castivo-staging`: Control, Player en mediaworker;
- `castivo-production`: Control, Player en mediaworker;
- `duindorpteneu`: eigen Compose-project, configuratie en deploymentflow;
- één reeds aanwezige, gedeelde reverse proxy voor publiek HTTPS-verkeer.

Castivo claimt op deze gedeelde VPS nooit zelf poort 80 of 443. De webcontainers
binden uitsluitend aan unieke localhostpoorten en zijn daarnaast bereikbaar via
unieke aliases op het externe Docker-netwerk `castivo-proxy`. Daardoor kan een
reverse proxy op de host de localhostpoorten gebruiken, of een containerproxy de
netwerkaliases. De interne worker- en backendnetwerken blijven per omgeving
gescheiden.

Staging en productie gebruiken verplicht twee verschillende Supabase-projecten.
De workflow accepteert geen devcredentials en voert geen actie uit op de huidige
dev-VPS.

## Eenmalige voorbereiding van de nieuwe VPS

Installeer op een actuele Linux-VPS:

- Docker Engine met Compose v2;
- `git`, `curl`, `tar` en `sha256sum`;
- minimaal 4 GB RAM voor gelijktijdige Next.js-imagebuilds en FFmpeg;
- voldoende Docker-schijfruimte voor twee releases en buildcache;
- een gedeelde reverse proxy en geldige DNS/TLS-configuratie.

Maak geen algemene organization runner. Registreer twee repository-runners,
zodat GitHub de juiste Environment en labelcombinatie kiest:

```bash
sudo infra/vps/install-github-runner.sh \
  staging \
  https://github.com/<organisatie>/<repository> \
  <kortlevend-registratietoken> \
  <runner-versie> \
  <sha256-uit-GitHub>

sudo infra/vps/install-github-runner.sh \
  production \
  https://github.com/<organisatie>/<repository> \
  <kortlevend-registratietoken> \
  <runner-versie> \
  <sha256-uit-GitHub>
```

Gebruik voor versie, checksum en token altijd de waarden onder **Settings →
Actions → Runners → New self-hosted runner**. Het script verifieert de download,
maakt afzonderlijke Linux-users en installeert beide runners als service. De
labels worden:

- `self-hosted`, `linux`, `x64`, `castivo-vps`, `staging`;
- `self-hosted`, `linux`, `x64`, `castivo-vps`, `production`.

De runners krijgen Docker-toegang. Op één gedeelde Docker-host is dat geen harde
securitygrens: een gecompromitteerde repository of runner kan in beginsel ook
andere containers op de VPS beïnvloeden. Beperk dit risico met repository-runners,
branch protection, environment approvals, OS- en Docker-updates en externe
back-ups. Voor een echte securitygrens zijn afzonderlijke VPS'en of afzonderlijke
rootless containerdaemons nodig.

## Reverse proxy

Kies vier unieke publieke hosts en vier unieke localhostpoorten. Een veilige
standaard is:

| Omgeving | Service | Publieke host | Localhostpoort | Docker-alias |
|---|---|---|---:|---|
| staging | Control | `staging-control.example.nl` | `13000` | `castivo-staging-control:3000` |
| staging | Player | `staging-player.example.nl` | `13001` | `castivo-staging-player:3001` |
| production | Control | `control.example.nl` | `23000` | `castivo-production-control:3000` |
| production | Player | `player.example.nl` | `23001` | `castivo-production-player:3001` |

Voor Caddy op de host is de minimale configuratie:

```caddyfile
staging-control.example.nl {
  reverse_proxy 127.0.0.1:13000
}

staging-player.example.nl {
  reverse_proxy 127.0.0.1:13001
}

control.example.nl {
  reverse_proxy 127.0.0.1:23000
}

player.example.nl {
  reverse_proxy 127.0.0.1:23001
}
```

Een containerized proxy moet op het externe netwerk `castivo-proxy` zitten en
kan de Docker-aliases uit de tabel gebruiken. Houd de proxyconfiguratie voor
`duindorpteneu` buiten deze repository. Laat DNS eerst naar de nieuwe VPS wijzen
en controleer certificaatuitgifte vóór de eerste deployment; de workflow eist na
activatie een geldige publieke HTTPS-healthcheck.

## GitHub Environments

Maak in de repository exact twee Environments: `staging` en `production`.

Voor `staging`:

- beperk deployment branches tot `main`;
- geen reviewer nodig, zodat een groene `main` automatisch kan uitrollen;
- gebruik uitsluitend het staging-Supabase-project.

Voor `production`:

- beperk deployment branches tot `main`;
- configureer minimaal één required reviewer;
- schakel waar beschikbaar self-review uit;
- gebruik uitsluitend het productie-Supabase-project.

### Variables per Environment

Plaats deze zeven waarden onder **Environment variables**. De voorbeeldwaarden
voor hosts moeten worden vervangen door de echte DNS-namen.

| Variable | staging | production | Betekenis |
|---|---|---|---|
| `CONTROL_HOST` | `staging-control.example.nl` | `control.example.nl` | Publieke Control-host zonder protocol |
| `PLAYER_HOST` | `staging-player.example.nl` | `player.example.nl` | Publieke Player-host zonder protocol |
| `CONTROL_BIND_PORT` | `13000` | `23000` | Unieke localhostpoort op de gedeelde VPS |
| `PLAYER_BIND_PORT` | `13001` | `23001` | Unieke localhostpoort op de gedeelde VPS |
| `REVERSE_PROXY_NETWORK` | `castivo-proxy` | `castivo-proxy` | Extern Docker-netwerk voor de gedeelde proxy |
| `SUPABASE_PROJECT_REF` | staging project-ref | productie project-ref | Guard tegen migratie naar het verkeerde project |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<staging-ref>.supabase.co` | `https://<productie-ref>.supabase.co` | Publieke Supabase API-URL |

### Secrets per Environment

Plaats deze zes waarden onder **Environment secrets**. Geen van deze waarden mag
als repositorysecret worden gedeeld tussen staging en productie.

| Secret | Bron / generatie | Gebruik |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project API keys | Publieke browserclient; als secret opgeslagen om configuratiefouten en logging te beperken |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project API keys | Alleen server-side Control, Player API en mediaworker |
| `SUPABASE_DB_URL` | Supabase **Connect** → session pooler of directe database-URL | Alleen de migratiestap; wachtwoord moet URL-encoded zijn |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | `openssl rand -base64 32 \| tr -d '\n'` | Dezelfde key tijdens Control-build en runtime |
| `DEVICE_LAB_ACCESS_TOKEN` | `openssl rand -hex 32` | Tijdelijk afgeschermde Device Lab-toegang |
| `DEVICE_LAB_SESSION_SECRET` | `openssl rand -base64 32 \| tr -d '\n'` | Ondertekening van de HttpOnly Device Lab-sessie |

`SUPABASE_DB_URL` moet de project-ref bevatten. De workflow controleert zowel de
database-URL als de publieke API-URL tegen `SUPABASE_PROJECT_REF` voordat een
migratie kan starten. Een Supabase access token of databasepassword als los
GitHub-secret is niet nodig.

## Deployment- en migratiegedrag

`.github/workflows/deploy-vps.yml` kent twee routes en gebruikt het herbruikbare
`scripts/migrate-supabase.sh` voor de database:

1. Na een succesvolle **PR Gates**-run op `main` wordt automatisch `staging`
   gekozen en de exacte groene commit uitgerold.
2. Via **Actions → Deploy VPS → Run workflow** kan `staging` of `production`
   handmatig worden gekozen. Productie wacht op de required reviewer van het
   GitHub Environment.

De workflow:

1. controleert dat de gekozen commit onderdeel is van `main`;
2. valideert alle environmentconfiguratie en Supabase-projectguards;
3. bouwt SHA-getagde Control-, Player- en mediaworkerimages;
4. voert `supabase db push --dry-run --include-all` uit;
5. past daarna dezelfde forward-only migraties toe;
6. activeert alleen het gekozen Compose-project;
7. wacht op containerhealth en controleert beide publieke HTTPS-routes op de
   exacte deployment-SHA;
8. verwijdert tijdelijke env-bestanden ook bij fouten.

De database wordt dus pas gemigreerd nadat alle images succesvol zijn gebouwd.
Een mislukte migratie activeert geen nieuwe applicatiecontainers. Migraties
moeten desondanks backward-compatible zijn met de vorige release, omdat de oude
containers tijdens de migratiestap blijven spelen en bedienen.

## Eerste uitrol

1. Maak twee lege Supabase-projecten en noteer per project alle variables en
   secrets uit de tabellen.
2. Configureer DNS en de gedeelde reverse proxy.
3. Maak het Docker-netwerk eenmalig of laat de workflow dit doen:
   `docker network create castivo-proxy`.
4. Installeer beide repository-runners op de nieuwe VPS.
5. Maak en beveilig de GitHub Environments.
6. Start handmatig een stagingdeployment vanaf `main`.
7. Bewijs login, upload, echte FFmpeg-verwerking, playlistpublicatie, pairing en
   Player-playback op staging.
8. Start daarna handmatig production en keur de Environment-deployment goed.

## Rollback en herstel

Start de workflow handmatig voor dezelfde omgeving en geef bij `ref` een eerdere
groene commit-SHA uit `main` op. De images worden reproduceerbaar met die SHA
gebouwd en opnieuw geactiveerd. De workflow migreert nooit omlaag. Een oude app
mag daarom alleen worden teruggezet wanneer die compatibel is met het reeds
gemigreerde schema.

Maak vóór productiemigraties externe databaseback-ups volgens het Supabase-plan.
Een databaseherstel is een bewuste incidentactie en geen automatische workflowstap.
Verwijder bij incidenten geen Player-cache of immutable releases: last-known-good
playback blijft leidend.
