# Local Development and Deployment Canon

## Local first

The full MVP is built locally before VPS deployment.

Required local stack:

- WSL2 Ubuntu
- Docker Desktop WSL integration
- Node 24 LTS
- pnpm 11
- Supabase local
- FFmpeg
- Playwright

## Ports

```text
control:   3000
player:    3001
marketing: 3002
supabase:  54321
postgres:  54322
studio:    54323
```

## Hosted deployment

De definitieve route staat in `docs/deployment/vps-deployment.md`. GitHub Actions
bouwt één immutable SHA-release, valideert staging en promoveert daarna dezelfde
image-IDs naar production. Host-Caddy routeert naar expliciete localhostbindings;
de repository start geen publieke reverse proxy. Dev blijft op de bestaande VPS
en staging/production gebruiken afzonderlijke Compose- en Supabase-projecten.

Gebruik nooit `git pull && npm install && npm run build` als productie-uitrol.
