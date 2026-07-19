# S19 — VPS deployment finalization

## Doel

Finaliseer de repositoryzijde van de deployment naar de reeds ingerichte VPS:
een actuele `main`-SHA wordt eenmaal gebouwd, automatisch naar staging uitgerold
en pas na groene checks en GitHub Environment-approval met exact dezelfde
immutable images naar production gepromoveerd.

## Verplicht

- Eén deployworkflow op push naar `main` en gecontroleerde workflow dispatch.
- Rootless self-hosted runners met labels `veyocast` plus environmentlabel.
- Staging: Control en Player op `127.0.0.1:13000/13001`.
- Production: Marketing, Control en Player op `127.0.0.1:23002/23000/23001`.
- Caddy blijft buiten Docker op de host.
- Environment-neutrale SHA-images en digest-/image-ID-verificatie.
- Gescheiden Supabase-projecten en forward-only migration guard.
- Mode-600 runtimeconfig, revisionhistorie, release manifest en veilige approllback.
- Uniforme, secretvrije readinessroutes en lokale/publieke smokechecks.
- Geen rebuild in production en geen deployment vanuit pull requests.

## Gates

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
bash scripts/validate-github-actions.sh
bash scripts/validate-vps-deployment.sh
shellcheck scripts/deploy-vps.sh scripts/migrate-supabase.sh
```

De productionomgeving moet vóór de eerste echte release minimaal één required
reviewer hebben. Databaseherstel is een afzonderlijke incidentactie en nooit een
automatische applicatierollback.
