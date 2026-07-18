# Architecture

## Context diagram

```text
Admin browser
  -> apps/control
  -> Supabase Auth/Postgres/Storage
  -> media-worker

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

Achtergrondverwerking voor thumbnails, checksums, video metadata en later transcodering.

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
- `packages/testkit`: fixtures en test helpers.

## Boundaries

- Player never imports dashboard code.
- Control never renders public playback code directly; preview uses safe template renderer.
- Service role never imports into client bundles.
- Design tokens are imported, not duplicated.
