# S284 — Chromiumconfiguratie in de afgeschermde renderworker

## Aanleiding en bewijs

De gebruiker meldt de mislukte slide `Bezoekende teams`. De exacte opgeslagen
snapshot faalt vóór de eerste framecapture: Chromium Crashpad kan geen database
openen onder het read-only `/home/node/.config`. Een geïsoleerde render met
uitsluitend XDG-config/cache onder `/tmp` slaagt met volledige MP4 en poster.

## Ownership

- `infra/vps/worker.compose.yaml`: twee vaste tijdelijke XDG-paden.
- `scripts/validate-worker-compose-config.mjs`: verplichte exacte XDG-config.
- `scripts/validate-vps-deployment.sh`: negatieve configuratieregressies.
- `apps/media-worker/scripts/chromium-smoke.ts`: echte browsercapture zonder
  database- of providertoegang, uitvoerbaar in de gedeployde workercontainer.
- Dit promptbestand, `docs/s284-worker-chromium-writable-config.md` en één rij
  in `TASK_LEDGER.md`.

Geen afhankelijkheden, lockfiles, UI, schema, RLS, renderpresentaties, Player,
immutable releases of bestaande voltooide snapshots wijzigen.

## Verificatie en herstel

Behoud foutbewijs. Lint/typecheck/test en bestaande deploymentvalidatie, normale
CI, normale staging/productie-uitrol. Bewijs echte capture in beide afgeschermde
containers. Herstart uitsluitend de exact geïdentificeerde mislukte renderpoging
na geslaagde uitrol en controleer job, snapshot, slide, poster en volledig bestand.
Gebruik begrensde tenant-/snapshot-/statusvoorwaarden en behoud opgeslagen
snapshotdata, versies, publicaties en reeds voltooide media.
