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

## Production deployment

The repository now provides `infra/production/compose.yaml` with:

- standalone Control and Player images tagged by Git SHA;
- an FFmpeg-enabled mediaworker;
- a Caddy reverse proxy with separate HTTPS app/player hostnames;
- secret-free healthchecks and fail-closed required environment variables.

Use `docs/lg-pairing-deployment-runbook.md`. GitHub Actions gates and a
least-privilege deployment runner publish/promote the green images volgens
`docs/vps-environments-runbook.md`. Dev blijft op de bestaande VPS; staging en
production zijn geïsoleerde Compose-projecten op de gedeelde deployment-VPS en
gebruiken afzonderlijke Supabase-projecten.
Never use production `git pull && npm install && npm run build` on the VPS.
