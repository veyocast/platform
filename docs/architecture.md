# Architecture

## Context diagram

```text
Admin browser
  -> apps/control
  -> Supabase Auth/Postgres/Storage
  -> media-worker (media normalisatie + Studio rendering)

Player browser/PWA
  -> apps/player
  -> device session endpoints
  -> signed media URLs / release manifests
  -> local cache + IndexedDB
```

## App responsibilities

### `apps/marketing`

Publieke website, SEO, productcopy, demoaanvraag.

### `apps/control`

Authenticated app voor platform en tenants.

### `apps/player`

PWA voor schermen. Geen dashboardfeatures.

### `apps/media-worker`

Achtergrondverwerking voor checksums, video metadata, transcodering en
deterministische Studio PNG/MP4-renders. Studio-jobs gebruiken immutable
revisies en worden nooit in een Next.js-request gerenderd.

## Package responsibilities

- `packages/tokens`: design tokens, CSS variables, Tailwind preset.
- `packages/ui`: shadcn/ui primitives en VeyoCast components.
- `packages/icons`: locked brand assets en icon wrappers.
- `packages/content-templates`: player templates voor 16:9 en 9:16.
- `packages/contracts`: Zod schemas, typed domain contracts.
- `packages/auth`: role helpers, permission contracts.
- `packages/database`: Supabase clients, typed queries, generated types.
- `packages/integrations`: provider adapter interface.
- `packages/config`: env parsing.
- `packages/observability`: frameworkvrije eventcatalogus, redactie,
  correlation IDs, SLO/alert- en allowlisted supportbundlecontracts.
- `packages/studio`: frameworkvrije, versioned document-, template-, motion-,
  tekstlayout- en rendercontracten. React Konva en Supabase blijven adapters
  buiten dit package.
- `packages/testkit`: fixtures en test helpers.

De huidige incrementele foundation gebruikt daarnaast expliciet:

- `packages/contracts`: frameworkvrije Zod transportcontracts, veilige errors
  en commandmetadata;
- `packages/domain`: canonieke identitytypes en pure businessregels;
- `packages/auth`: pure rol-naar-capabilitybeslissingen zonder sessie- of I/O-
  afhankelijkheid.
- `packages/observability`: schrijft geen transport of storage voor en bevat
  geen environmentcredentials; apps kiezen writer, telemetryadapter en
  capabilityboundary.

## Dependency direction

```text
contracts <- domain <- auth
     ^          ^
     +---- database

apps -> services -> repositories/adapters
apps -> contracts/domain/auth
Control/worker -> studio
```

- Contracts en domain importeren geen React, Next, Supabase of environment.
- Auth beslist capabilities maar maakt geen sessie of databaseclient.
- Pages, server actions en route handlers vertalen transport naar services.
- Services orkestreren capabilities, domainregels en transacties.
- Repositories/adapters bezitten Supabase, Storage, queue en provider-I/O.
- Nieuwe code volgt dit model; bestaande flows migreren bij inhoudelijke
  wijziging, niet via een big-bang rewrite.
- Zie ADR 0006 en de geautomatiseerde packageboundarytest.

## Boundaries

- Player never imports dashboard code.
- Control never renders public playback code directly; preview uses safe template renderer.
- Service role never imports into client bundles.
- Design tokens are imported, not duplicated.
- Client modules importeren geen expliciete serverentries.
- Publieke errors volgen de allowlisted contracts uit ADR 0007.
- Control Studio en de worker delen hetzelfde deterministische motion- en
  tekstlayoutcontract. Alleen Control importeert de interactieve canvasadapter.
- Player ontvangt uitsluitend normale `ready` media-assets; Studio-documenten,
  revisies en rendercode overschrijden de Player-boundary niet.
