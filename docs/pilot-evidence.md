# S12 Lokale Pilot Evidence

Uitgevoerd op 2026-07-17 vanuit `castivo/s12-pilot-ready`.

## Geslaagde gates

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` - 11 package-taken geslaagd
- `pnpm build` - Control, Marketing, Player en packages geslaagd
- `playwright test tests/e2e/pilot-readiness.spec.ts --project=chromium` - 1
  cross-app pilottrace geslaagd
- `playwright test tests/a11y tests/player tests/player-offline --project=chromium`
  - 14 accessibility-, online-, pairing- en offline-hersteltests geslaagd

## Open omgevingsgate

De lokale Supabase/RLS-run is in deze uitvoering niet gevalideerd. `supabase
status` gaf na ruim anderhalve minuut geen Docker-status terug en is afgebroken
zonder databasewijzigingen te doen. Herhaal op een gezonde Docker Desktop-stack:

```powershell
pnpm db:start
pnpm db:reset
pnpm test:rls
```

De open databasegate blokkeert een echte klantpilot. De lokale demo-trace blijft
daarnaast begrensd door de in `docs/pilot-runbook.md` vastgelegde read-only
auth-, upload-, publish- en pairingflows.
