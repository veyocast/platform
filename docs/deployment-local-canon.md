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

## Later deployment

Production later uses:

- Docker images tagged by Git SHA.
- Caddy reverse proxy.
- Separate app/player hostnames.
- GitHub Actions gates.
- Self-hosted deployment runner with minimal privileges.

No production `git pull && npm install && npm run build` on the VPS.
