# VeyoCast dynamic slides canon

Status: implemented MVP contract (S51)
Scope: fixed menu boards, RSS news, Publisher integration and all Players

## Product boundary

A dynamic slide is not a live web page and is not a new Player item type.
VeyoCast resolves provider data on the server, freezes a canonical data
snapshot and renders that snapshot to a normal immutable PNG media asset.
Playlist publication then uses the existing schema-v1 release manifest,
checksums, atomic activation and last-known-good cache.

```text
Provider/file/manual input
  → server-only adapter and validation
  → canonical tenant data
  → immutable slide snapshot
  → bounded render job
  → ready PNG media asset
  → playlist draft
  → immutable release
  → existing browser/LG/Android offline cache
```

Players never receive provider credentials, template source or untrusted HTML.
They never call RSS, Twelve or another provider.

## Concepts

- `dynamic_templates`: platform-owned identity and lifecycle.
- `dynamic_template_versions`: source, CSS, manifest and test data. Published
  source is immutable.
- `dynamic_data_sources`: tenant-owned source configuration. Secrets may only
  be referred to by `secret_reference`; configuration rejects common secret
  keys.
- `tenant_products` and `dynamic_news_articles`: normalized canonical data.
- `dynamic_slides`: tenant authoring configuration and latest/pinned policy.
- `dynamic_slide_snapshots`: immutable source data plus template version.
- `dynamic_render_jobs`: bounded worker lease and retry state.
- `media_assets`/`media_variants`: the normal generated PNG output.

## Safe template engine

Engine identifier: `veyocast-safe-template-v1`.

Allowed:

- escaped field interpolation;
- bounded `each` and `if` blocks;
- `currency`, `date`, `default` and `truncate` helpers;
- a restricted SVG element allowlist;
- local CSS without imports;
- base64 PNG/JPEG/WebP data images when VeyoCast materializes an approved
  media asset.

Rejected:

- triple-brace/unescaped interpolation;
- script, `foreignObject`, iframe, object, embed, audio and video;
- event handlers, `srcdoc`, prototype traversal and parent traversal;
- arbitrary helpers, JavaScript, `eval`, external asset URLs, CSS imports,
  CSS expressions and unbounded nesting or collections.

The Control preview and media worker use the same parser and renderer.

## Canonical data

Products use stable tenant UUIDs, provider external identity, name,
description, category, integer `priceMinor` (`price_cents` in the current
database), ISO-4217 currency, availability, active state, image media ID,
sort order and source timestamps.

News articles use a stable source external ID, title, intro, author, source
name, public HTTP(S) link, publication timestamp and optional tenant media ID.
Raw XML/HTML is not exposed to templates.

The existing Twelve Excel parser and staging/apply transaction remain the
supported Twelve path. The official API is explicitly `not_connected` until
official endpoint, field and authentication documentation is approved. No
endpoint or credential format is inferred.

## RSS/Atom network boundary

RSS is fetched only by Control or the media worker. Each request and redirect:

- permits HTTP(S) on standard ports only;
- rejects credentials, localhost and `.local`;
- resolves all DNS answers and rejects the host if any answer is private,
  loopback, link-local, carrier-grade NAT, multicast or reserved;
- pins the checked address in the actual socket lookup;
- bounds redirects, response time and response bytes;
- may discover one declared RSS/Atom-alternate from a bounded public HTML page,
  waarna de ontdekte URL opnieuw door exact dezelfde SSRF-grens gaat;
- strips an external legacy feed `DOCTYPE` as inert metadata without ever
  resolving it, while rejecting internal DTD subsets and entity declarations;
- rejects HTML without a declared feed and all other non-feed content;
- normalizes at most 50 articles.

A failed sync records a stable error code and schedules a bounded retry. It
does not delete the previous normalized dataset, snapshot, media output or
release.

## Refresh and publication semantics

RSS sources receive a worker lease and default to a 15-minute refresh (bounded
to 5–1440 minutes). A successful source refresh queues a new snapshot only for
slides in `latest` mode. `pinned` slides remain on their selected snapshot.

The new output becomes the slide's current snapshot only after upload,
checksum creation and transactionally registering a ready PNG. Existing
playlist rows and releases are not silently mutated. An editor deliberately
adds the current snapshot to a playlist; publication creates the usual
immutable release. This keeps change impact visible and preserves rollback.

## Reference templates

The migration seeds four platform templates:

- Atelier menubord — liggend (1920×1080);
- Atelier menubord — staand (1080×1920);
- Editorial nieuws — liggend (1920×1080);
- Editorial nieuws — staand (1080×1920).

They use the tenant brand kit's primary color with conservative fallbacks.
The normal Player lock-up remains the only permanent playback watermark.

## Security and authorization

Platform capabilities:

- `platform.dynamic_template.read`;
- `platform.dynamic_template.write`;
- `platform.dynamic_template.publish` (AAL2 for publish/withdraw).

Tenant capabilities:

- `tenant.dynamic_slide.read`;
- `tenant.dynamic_slide.write`;
- `tenant.data_source.read`;
- `tenant.data_source.manage`.

All tenant tables contain `tenant_id`, indexes, forced RLS and default-denied
writes. User changes go through capability-checked commands with audit events.
Worker claim/complete/fail commands are service-role-only, lease-bound and
idempotent at the snapshot/job uniqueness boundaries.

## Operations

Structured events:

- `dynamic.render.queue_polled`;
- `dynamic.render.completed`;
- `dynamic.render.failed`;
- `dynamic.rss.queue_polled`;
- `dynamic.rss.completed`;
- `dynamic.rss.failed`.

Audit events cover datasource creation/sync/failure, manual product creation,
slide/snapshot creation, playlist insertion, template create/update/version/
publish/withdraw and worker completion.

Operational recovery is retrying the failed source or render. The last good
snapshot stays available throughout. Generated asset deletion must continue to
honour normal media usage and immutable release retention.

## Verification evidence

- A clean Supabase reset applies both S51 migrations.
- The complete database suite passes 39 files and 742 RLS assertions; the
  dynamic suite contains 18 assertions including tenant isolation, one render
  lease, a normal ready PNG, playlist insertion and automatic snapshot creation
  after a manual RSS refresh.
- All 25 workspace lint, typecheck and unit-test tasks pass. This includes 28
  integration tests, 61 media-worker tests, 103 Control tests and 85 Player
  tests after the independently deployed pairing hotfix was merged back.
- The Control production build contains all template, data-source and slide
  routes.
- The dedicated dynamic workspace browser test passes at 320, 390, 768 and
  1280 pixels without horizontal overflow. The complete accessibility matrix
  passes 29 of 30 scenarios in one serial run; the single unrelated
  navigation-focus race passes immediately in isolation.
- The complete Chromium matrix passes 101 scenarios with nine explicitly
  environment-dependent skips. Three unrelated parallel Next.js development
  navigation races all pass in the serial or isolated reruns.
- Desktop and mobile visual review evidence was captured for the slide list,
  creation flow and platform template workspace. No production deployment was
  performed for S51.

## Explicit non-goals

- No arbitrary tenant-authored JavaScript or HTML.
- No provider call from a Player.
- No invented Twelve API.
- No silent mutation of a published release.
- No production deployment as part of S51.
- Physical LG validation remains a release acceptance step, not a local
  implementation claim.
