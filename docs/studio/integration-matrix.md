# VeyoCast Studio — integratiematrix

## Productgrens

| Verantwoordelijkheid | Eigenaar | Studio-integratie |
|---|---|---|
| Visueel bronontwerp | Studio | Versioned document, draft en immutable revisies |
| Canvaspreview | Control Studio | Deelt contract en motionmath met de renderer |
| Rendering | Media-worker | Rendert uitsluitend een bevroren revisie |
| Mediabeheer | Bestaand mediadomein | PNG/MP4, thumbnail, metadata en private storage |
| Playlistbewerking | Publisher | Bestaande flow; Studio linkt alleen naar het resultaat |
| Publicatie | Publisher | Bestaande immutable releases |
| Playback en offlinecache | Player | Ongewijzigd; ziet alleen gewone media-assets |

## Bestaande repositorycontracten

| Gebied | Bestaande implementatie | Besluit voor S40 |
|---|---|---|
| Werkruimte | pnpm `apps/*` en `packages/*` | Nieuw framework-onafhankelijk `@veyocast/studio` |
| UI | `@veyocast/ui`, Control shell en design tokens | Hergebruik; editor-specifieke controls blijven in de Studio-route |
| Rechten | `@veyocast/auth` + database `private.has_tenant_capability` | Expliciete Studio-capabilities in beide lagen |
| Custom rollen | `tenant_custom_roles.capabilities` | Studio-rechten worden afzonderlijk configureerbaar |
| Media | `media_assets`, `media_variants`, private bucket `tenant-media` | Export wordt een nieuw normaal media-item |
| Storage | `tenants/{tenant_id}/assets/{asset_id}/...` | Exact dezelfde tenantgescheiden conventie |
| Worker | Service-role queueclaim, FFmpeg en begrensde retries | Tweede jobloop voor Studio, zonder bestaande videojobs te wijzigen |
| Audit | `audit_events` | Alleen actie en veilige metadata; nooit documentpayload of signed URL |
| Player | Manifest, LKG-release en offlinecache | Geen Studio-import of speciaal runtimepad |

## Gegevensstromen

1. Control valideert een document met het gedeelde schema.
2. Een servercommand controleert capability, tenantstatus en revisienummer.
3. De server bewaart de draft en een immutable revisiesnapshot.
4. Export maakt atomair een job, bronrevisie en gereserveerd media-item.
5. De worker claimt de job, resolveert uitsluitend tenant-eigen assets, rendert
   PNG of 30 fps H.264/yuv420p-MP4 en uploadt varianten.
6. Voltooiing zet het media-item op `ready`, koppelt exportbewijs en schrijft audit.
7. Publisher gebruikt het resultaat via het bestaande mediadomein.

## Niet doen

- Geen tweede playlisteditor of publicatiepad.
- Geen Canvas-library-JSON als publiek opslagcontract.
- Geen mutable renderinput.
- Geen arbitrary HTML, JavaScript, externe fonts of externe SVG-import.
- Geen automatische vervanging van media in bestaande releases.
- Geen Studio-code in Player.
