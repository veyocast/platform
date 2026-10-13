# S211 — Schone productiedatabase en contentvrije cutover

## Doel

Voer de door de eigenaar goedgekeurde schone Supabase-cutover uit zonder oude
playlists, releases, dynamische slides, Studio-ontwerpen, media of
Storage-objecten. Behoud uitsluitend de minimale tenant-, beheer-, scherm- en
integratieconfiguratie die nodig is om Duindorp SV opnieuw op te bouwen. Koppel
de fysieke Players na de cutover opnieuw.

## Ownership

- `docs/deployment/s210-clean-database-cutover.md`
- `prompts/sprints/S211-clean-database-cutover.md`
- `PLANS.md`
- `TASK_LEDGER.md`
- uitsluitend wanneer een aantoonbaar retentiegat bestaat: één nieuwe
  forward-only migratie, de bijbehorende pgTAP-test en de direct betrokken
  mediaworkerretentiecode/test

## Invarianten

- Geen fysieke clone, volledige dump of Storage-restore.
- Geen playlist, playlistitem, release, planning, dynamische slide,
  slideversie/snapshot, Studio-ontwerp, mediarecord of mediaobject importeren.
- Geen devicecredential kopiëren; Players worden opnieuw gekoppeld.
- Sportlink- en LED Scores-data worden opnieuw vanaf de providers gevuld.
- Een bronupdate maakt geen playlistrelease of dynamische authoringversie.
- Superseded serverversies worden alleen verwijderd wanneer geen scherm,
  device, planning, publicatie, fallback of lopend werk ze nog gebruikt.
- Het oude project blijft minimaal zeven dagen read-only als terugvalpunt.

## Gates

```bash
pnpm db:reset
pnpm test:rls
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Maak het betaalde project pas na Supabase-kostenreadback en de door de connector
vereiste kostenbevestiging. Voer stagingacceptatie uit vóór de atomische
productie-omzetting. Stop bij een rode RLS-, Auth-, provider-, manifest-,
heartbeat- of last-known-good-gate.
