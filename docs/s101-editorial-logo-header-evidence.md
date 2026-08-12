# S101 — Editorial logo- en headerafwerking

## Oorzaak

Sportlink leverde bij een standrij een `teamlogo`, maar de normalisatiemapper
liet dit veld vallen. Alleen het afzonderlijke `clublogo`-artikel werd lokaal
opgeslagen. Daardoor konden browser en LG Legacy uitsluitend het initialenschild
tonen en stond het officiële clublogo niet op slides met een andere databron.

## Herstel

- De standingsmapper behoudt de providerlogo-URL uitsluitend tot aan de
  server-side mediaworker.
- De worker gebruikt de bestaande DNS-pinning, publieke-IP-, redirect-,
  content-signature-, timeout- en bytegrenzen voor afbeeldingen, normaliseert
  naar maximaal 512×512 WebP en maakt een tenantgebonden content-addressed
  asset.
- `complete_sportlink_sync_v3` registreert asset en variant, vervangt de URL in
  iedere standrij door `logoMediaAssetId` en verwijdert de provider-URL vóór de
  genormaliseerde dataset wordt opgeslagen.
- De snapshotbuilder neemt rijlogo's op en gebruikt de prioriteit
  tenantoverride → officieel Sportlink-clublogo → geselecteerd teamlogo →
  initialenschild.
- De immutable Playerrelease neemt alle rijlogo's op in zijn geverifieerde
  assetset. Browser en LG Legacy lezen dus uitsluitend lokale release-URL's.
- De migratie plant bestaande actieve clubprofiel- en competitiesynchronisaties
  direct opnieuw in; content-addressing voorkomt dubbele opslag voor een
  ongewijzigd logo.

## Visuele wijzigingen

- Theme-kicker en subtitel zijn verwijderd uit alle Editorial Arena-mastheads,
  inclusief de LG Legacy-standrenderer.
- De nieuws-QR is van 220/230 px naar 110/115 px gegaan.
- De metadata-divider heeft een vaste eindruimte vóór de QR.
- Standrijen tonen een echt lokaal teamlogo en vallen alleen bij ontbrekende of
  ongeldige providerdata terug op initialen.

## Bewijs

- `pnpm db:reset`: groen.
- RLS: 45 bestanden en 912 assertions groen; `rls_sportlink.sql` is 52/52.
  Browserrollen kunnen de media-RPC niet uitvoeren; tenantasset en
  URL-verwijdering zijn bewezen.
- `pnpm lint`: 30/30 taken groen.
- `pnpm typecheck`: 30/30 taken groen.
- `pnpm test`: 30/30 taken groen; onder meer contracts 29/29, integrations
  45/45, media-worker 76/76 en Player 145/145.
- `pnpm build`: 18/18 taken groen.
- Playwright: nieuws portrait 2/2, standen portrait/landscape 2/2 en LG Legacy
  10/10 groen.
- Volledige Player: 79/80 onder parallelle videotimingdruk; het enige
  ongerelateerde watchdoggeval direct geïsoleerd 1/1 groen. Offline 7/7.
- A11y: 34/35 onder parallelle startupdruk; het enige ongerelateerde
  Player-startupgeval direct geïsoleerd 1/1 groen.
- Visueel bewijs is bijgewerkt in `docs/screenshots/` voor nieuws portrait en
  standen portrait/landscape.
