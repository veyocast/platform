# Fase 5 — Media en Unified Resource Picker

Datum: 24 augustus 2026  
Status: `DONE`

## Opgeleverd

- Media-collecties met tenant-aware relaties, default-deny RLS, expliciete
  grants, actieve-tenantguard en geaudite idempotente mutaties.
- Bulkorganisatie voor maximaal 100 user-media-items: map, tag, favoriet en
  collectie, met per-item partial-result zonder provider/generated assets.
- Eén Media-workspace voor grid/list, selectie, page-select, sticky bulkbar,
  collectiefilter, saved views en inspector-readback.
- Gedeelde Resource Picker met single/multiple selectie, zoekterm, kind-, bron-
  en categoriefacets, disabled-reasons en expliciete bevestiging.
- Venue Twin kiest een echte gereedstaande tenantafbeelding uit dezelfde picker;
  signed preview-URL's blijven server-side kortlevend en providerassets blijven
  buiten de gewone Media Library.
- Upload- en overlaynavigatie gebruikt een betrouwbare documentgrens; de
  server blijft autorisatie, idempotency, mutatie, audit en revalidation leiden.

## Security en database

- Migratie: `supabase/migrations/20260824145414_s123_media_collections_bulk_commands.sql`.
- RLS-regressie: `supabase/tests/rls_s123_media_collections.sql` — 26/26.
- Verse `pnpm db:reset`: groen.
- Volledige `pnpm test:rls`: 57 bestanden, 1.154 assertions, alles groen.
- Cross-tenant collection/item writes, user-media-only bulkmutaties, revision-
  en idempotencyconflicten en auditresultaten zijn bewezen.

## Gates

| Gate | Resultaat |
|---|---|
| `pnpm lint` | 30/30 taken groen |
| `pnpm typecheck` | 30/30 taken groen |
| `pnpm test` | 30/30 taken groen; Control 181 en UI 18 tests |
| `pnpm build` | 18/18 taken groen; auth- en secretbundleguards groen |
| Media production E2E | 1/1 in 10,3 s; echte 2/2 upload, collectie, bulk, filter, desktop/mobile Axe |
| Venue production E2E | 1/1 in 32,2 s; AAL2 rollout, upload, picker, floorplan, zone, placement en Axe |

De production-E2E draaide tegen de officiële standalone Control-build. De
lokale Supabase-reset herstartte GoTrue met een nieuw containeradres; alleen de
lokale Kong-upstreamcache is herstart. Dit was testinfrastructuur en geen bron-
of productiewijziging.

## Visueel bewijs

- `docs/screenshots/vector-v2/media/media-collections-1440x900.png`
- `docs/screenshots/vector-v2/media/media-collections-390x844.png`
- `docs/screenshots/vector-v2/media/resource-picker-1440x900.png`
- `docs/screenshots/vector-v2/control/venue-twin-1440x900.png`
- `docs/screenshots/vector-v2/control/venue-twin-390x844.png`

De screenshots zijn handmatig gelezen: geen gebroken assets, pseudo-copy,
privacygevoelige waarden, horizontale mobiele overflow of afgesneden primaire
actie. Axe rapporteert nul violations; het Resource Picker-metadacontrast is
op de semantische muted-textrol gebracht.

## Bewust resterend

De gedeelde pickercomponent is volledig inzetbaar; Publisher, Menu Studio en
overige dynamic datasets migreren in hun eigen fases 6–8. Dit voorkomt een
routebrede wijziging zonder de bijbehorende domein- en releasegates.
