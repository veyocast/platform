# Sprint S40 — VeyoCast Studio

## Doel

Bouw VeyoCast Studio als tenantveilige, productiegeschikte authoringmodule voor
visuele PNG- en motion-MP4-content. Publisher blijft eigenaar van playlists,
planning en publicatie. Player blijft eigenaar van betrouwbare online/offline
playback.

## Verplichte grenzen

- Gebruik een eigen, versioned en gedeeld Studio-documentcontract.
- Bewaar bronontwerpen, revisies en renderjobs tenantgescheiden met default-deny RLS.
- Render uitsluitend immutable revisies.
- Maak iedere geslaagde export als normaal media-item in de bestaande private
  tenantstorage.
- Laat een herexport nooit stil een gepubliceerde release wijzigen.
- Importeer geen Studio-runtime in Player.
- Gebruik lokaal beschikbare, gelicenseerde fonts en assets.
- Ondersteun desktopauthoring en een taakgerichte mobiele quick-editflow.
- Gebruik server-side capabilities, optimistic concurrency, audit en
  idempotente renderjobs.

## Gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:reset
pnpm test:rls
pnpm test:a11y
pnpm test:e2e -- --project=chromium
```

Voeg daarnaast golden tests voor documentvalidatie, motioninterpolatie en
renderoutput toe, plus visuele controle op desktop en mobiel.
