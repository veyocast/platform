# VeyoCast dynamic slides canon

Status: implemented HTML/CSS-first runtime with immutable PNG fallback (S84)
Scope: fixed menu boards, RSS news, Publisher integration and all Players

## Product boundary

A dynamic slide is not a remote provider page and never contains tenant-authored
JavaScript. VeyoCast resolves provider data server-side and freezes a canonical
tenant snapshot. Publication includes two representations of that exact
snapshot:

- a small, validated Player payload rendered by a locked VeyoCast HTML/CSS
  component;
- a generated immutable PNG used as verified offline and legacy fallback.

```text
Provider/file/manual input
  → server-only adapter and validation
  → canonical tenant data
  → immutable slide snapshot
  ├→ trusted template identity + normalized Player payload
  └→ bounded render job → ready PNG media asset
  → playlist draft → immutable release
  → browser/LG/Android checksum cache
  → locked HTML/CSS runtime, or verified PNG fallback
```

Players never receive provider credentials, provider URLs, raw feed/provider
responses, editable template source, arbitrary HTML or executable script. They
never call RSS, Twelve or Sportlink. Only a known template identity, bounded
normalized data and the already approved fallback asset are added to the
immutable release envelope.

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

The Control preview and media worker use the same parser and renderer for the
fallback. Player HTML/CSS is implemented as locked product code and does not
interpret the stored SVG/CSS template source.

## Canonical data

Products use stable tenant UUIDs, provider external identity, name,
description, category, integer `priceMinor` (`price_cents` in the current
database), ISO-4217 currency, availability, active state, image media ID,
sort order and source timestamps.

News articles use a stable source external ID, title, intro, author, source
name, public HTTP(S) link, publication timestamp and optional tenant media ID.
Raw XML/HTML is not exposed to templates.

The canonical public article URL is the article identity across provider
updates. Tracking parameters, fragments and a trailing slash do not create a
second article. When a feed contains multiple entries for that identity, only
the newest publication is normalized. A successful sync mirrors the current
bounded feed and removes older normalized duplicates; immutable historical
snapshots remain unchanged and are deduplicated by the renderer at playback.

Each current article receives a QR code generated inside the media worker from
its canonical HTTP(S) URL. The QR is a content-addressed, checksum-verified
tenant media asset included in the immutable Player release. Preview and both
Player runtimes use those same local bytes; neither Player contacts the RSS
provider or an external QR service.

RSS article images retain their intrinsic aspect ratio and are never enlarged
during normalization. Images larger than the Player budget are reduced
proportionally within 1920×1080. The locked news renderer places the complete
verified image with `contain` inside its 16:9 media zone, so a provider image is
not first forced into portrait and then cropped a second time on the Player.
Existing immutable releases retain their original bytes; a subsequent
successful source sync creates new content-addressed media for the next
snapshot and publication.

Portrait templates keep a fixed 1080×1920 logical canvas. A portrait physical
viewport uses proportional cover-fit so narrow or extra-tall screens have no
letterbox bands. The renderer calculates the horizontal crop and adds it to
the logical safe zones for header, content and footer. Landscape or mismatched
orientation still uses contain-fit. Standings use one shared grid definition
for header and every row; a selected team is marked with an inset highlight
that never changes column geometry.

Active RSS sources are checked server-side every five minutes. A normalized
article and media hash decides whether the provider content actually changed.
An unchanged check only advances the next sync time and creates no snapshot,
render job, release or Player download.

When a changed `latest` snapshot becomes ready, the system creates a new
immutable release from the previous live release. It replaces only dynamic
release items; unrelated unpublished draft edits are never included. Screens
using that playlist as their default receive the release as `desired`. An
active schedule remains authoritative and falls back to the refreshed default
after its window ends. The Player still downloads and verifies the complete
release and switches only at a loop boundary.

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

RSS sources receive a worker lease and default to a five-minute refresh (bounded
to 5–1440 minutes). Twelve apply, a successful Sportlink dataset sync and
manual product changes increment the same source revision boundary. A provider
check and a content change are deliberately separate events: one successful
Sportlink sync advances the source revision exactly once, while the canonical
snapshot hash excludes observation-only timestamps such as `generatedAt`.
Only changed Player content queues one new snapshot per affected slide in
`latest` mode; `pinned` slides remain on their selected snapshot. An unchanged
manual refresh explicitly reports that no version was made.

Fallback image identities are content-addressed by tenant, template version
and canonical snapshot hash. Equal outputs therefore reuse the same registered
asset instead of allocating a new storage path. The release remains immutable:
when real content changes, the system still creates and verifies a complete new
release and the Player activates it only at a safe boundary. When content is
unchanged, no snapshot, render job, fallback object, release, desired-release
change or Player download is created.

`tenant_settings.primary_color` is the single tenant-owned accent for news
templates. It is normalized to an uppercase six-digit hex value and frozen
into `snapshot_data_json.brand.primaryColor`. Changing it increments only the
relevant active RSS source revisions, so mutable latest-mode slides receive a
new immutable snapshot while existing releases and pinned history remain
unchanged. Control previews use that same value; the Control product skin does
not inherit tenant branding.

The new output becomes current only after upload, checksum creation and
transactionally registering a ready PNG. A latest-mode item in a mutable
playlist concept then follows that completed snapshot and matching fallback
asset atomically; the concept revision is incremented and audited. Published
releases remain immutable and only change through the existing explicit
publication flow. Active Players therefore never receive an unreviewed mutable
release.

The playlist editor lists ready dynamic slides as a separate
`Dynamische slides` content type. Generated fallback assets are not offered as
ordinary images. Adding or dragging a dynamic slide records
`dynamic_slide_id`, `dynamic_snapshot_id` and its selection mode through a
revision-checked, idempotent command. A database provenance trigger also
promotes any generated fallback selected through a legacy media path back to
its HTML/CSS identity. Playlist and release thumbnails may still show the
immutable PNG, but Player playback prefers the trusted HTML/CSS payload.

The author chooses the bounded item count. Menu products, news articles and
Sportlink rows are split into deterministic pages by the trusted runtime.
Single-match templates stay limited to one match. Each page receives enough
playback time to remain readable before the next item or page.

## Reference templates

The original light menu/news templates remain available. S84 adds responsive
portrait and landscape variants for:

- Clubhouse menu, including a dark variant;
- Newsroom, including a dark variant;
- every supported Sportlink slide type in light and dark Match Centre
  treatments.

The five-step Control wizard shows a real visual variant preview before the
author selects source, item count and review. Templates use only locked
VeyoCast themes and normalized content. The normal Player lock-up remains the
only permanent playback watermark.

S98 replaces the decorative wizard example with a tenant-authorized,
non-persisted preview from the canonical snapshot builder. Control and Player
import the same Editorial Arena view model and DOM/CSS renderer. The preview
therefore never calls Sportlink from the browser, never creates a draft slide,
snapshot or render job, and cannot mutate an immutable release. Sportlink
team, competition and season choices are indexed from normalized rows and are
shown by default only when the selected slide type has renderable content.
Authors can reveal empty historical/context options for diagnosis, but cannot
publish an empty selection. The wizard also exposes last successful sync,
last safe provider state, item/page count and missing-asset fallback before
creation.

S85 makes the dark portrait RSS template the single canonical portrait news
composition. S86 gives its existing dark landscape companion a separately
designed 16:9 composition with the same bounded supplier logo, white shadowed
section header, full-bleed verified article image and per-article timing. The
light landscape news template remains available and unchanged. Landscape is
not a crop or scaled copy of portrait: its headline and metadata occupy a
dedicated left reading zone while the image retains the wider visual field.

Every editorial news page restarts the same bounded entrance sequence:
background image, headline, accent, intro and finally supplier, metadata and
progress context. The sequence completes early within the configured page
duration and never changes the five-second default timing. Browser and LG
Legacy runtimes use equivalent CSS keyframes. `prefers-reduced-motion: reduce`
removes all entrance motion and exposes the complete content immediately.
News copy starts at the top of its panel. Medium and long multi-line headlines
share one bounded display size, the larger intro follows directly below and
the date/author pair remains anchored side by side beneath a divider at the
lower-left edge of the panel.

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
publish/withdraw, worker completion and automatic immutable publication through
`dynamic.release.auto_published`.

Operational recovery is retrying the failed source or render. The last good
snapshot stays available throughout. Generated asset deletion must continue to
honour normal media usage and immutable release retention.

## Verification evidence

- Contract tests reject unknown template identities and unbounded snapshot
  payloads.
- Player tests cover menu, news, Sportlink, pagination, direct DOM rendering,
  fallback and the conservative LG Legacy source.
- Database tests cover non-RSS source revisioning, snapshot creation,
  completion and atomic latest-draft following without mutating a release.
- The final S84 local evidence includes a clean reset, 840 RLS assertions,
  28/28 workspace lint/typecheck/test tasks, 17/17 production builds including
  the webOS guard, 66 Player checks, seven offline checks, 32 accessibility
  checks and 127 active serial Chromium scenarios.
- A database-backed renderer smoke test rendered all 76 relevant published
  fallback versions, including the four new menu/news variants.
- Deployment evidence is recorded separately from these local gates so a
  successful rollout is never mistaken for physical LG acceptance.

## Explicit non-goals

- No arbitrary tenant-authored JavaScript or HTML.
- No provider call from a Player.
- No invented Twelve API.
- No silent mutation of a published release.
- No browser-side evaluation of SVG template source.
- Physical LG rendering remains a release acceptance step; a successful
  automated deployment is not itself a hardware claim.

## Editorial Arena v2 (S101)

S101 materialiseert de bestaande Editorial Arena-identiteit als één gedeeld
contract voor de actuele prijs-, nieuws-, stand-, programma- en
uitslagenfamilies. Iedere browserrender start op exact 1920×1080 of 1080×1920;
alle viewportaanpassing gebeurt met één uniforme contain-schaal buiten het
canvas. Header, contentvlak, footer, paginapositie en verticale index gebruiken
de vaste metrics uit `@veyocast/content-templates`.

Het `editorial`-snapshotdeel heeft `schemaVersion: 2`, vier nieuwsvarianten,
een prijslijst-fotomodus en volledige expliciete light- én dark-tokenmaps. De
cascade is platformdefault → tenantaccent → slideoverride. Publicatie bevriest
de opgeloste maps, zodat een latere brandingwijziging geen bestaande release
verandert. Component-CSS mag alleen semantische `--vc-*`-variabelen gebruiken;
een broncodeguard bewaakt hex-, rgb-, hsl- en oklch-drift. Control blokkeert
ongeldige kleuren, tekst/paneelcontrast onder 4,5:1 en onvoldoende QR-contrast
ook server-side.

Prijslijsten renderen twee kolommen, tellen categorieën als volledige rijen en
houden het vierkante mediavak leeg én maatvast wanneer een foto ontbreekt of is
uitgeschakeld. Nieuws ondersteunt `hero_split`, `fullscreen_gradient`,
`news_grid` en `text_only`. Stand, programma en uitslagen gebruiken één kolom
tot tien regels, exact twee landschapkolommen vanaf elf en één portretkolom tot
twintig; boven twintig ontstaat deterministisch een volgende pagina.

De migratie verrijkt nieuwe en mutable legacy snapshots met veilige volledige
defaults zonder oude content te verwijderen. Reeds gepubliceerde releases
worden niet herschreven. De bestaande RSS-, Sportlink- en Twelve/Excel-
normalisatie blijft server-side; Player en renderer doen geen providercalls.
De normale locked VeyoCast-Playerlock-up op 40% opacity blijft vanwege het
hoger geldende playercanon de enige permanente softwarewatermark.

Control biedt snelle én geavanceerde authoring voor alle semantische tokens,
met onafhankelijke light/darkmaps, reset/kopieeracties, dubbel georiënteerde
preview en contrastvalidatie. De prijseditor bewaart categorieën en producten
exact in de gekozen kolomvolgorde, ondersteunt toegankelijke drag-and-drop,
categoriegebonden foto-overrides en focal points. De immutable snapshotbuilder
resolveert ieder product opnieuw tenant- en brongebonden voordat het wordt
bevroren.

De primaire thumbnailcapture opent een speciale Playerroute en voert daarin
letterlijk dezelfde React-DOM-renderer uit. Snapshotdata wordt base64url in het
URL-fragment aangeboden, niet aan de server; fonts en beelden moeten gereed zijn
voor capture. Chromium of assetresolution mag de bestaande publicatieketen niet
breken: de reeds bestaande immutable worker-PNG blijft daarom de automatische
compatibiliteits- en offlinefallback. Een ingecheckte 48-cellenpixelmatrix
dekt twaalf families/varianten in beide oriëntaties en beide thema's.

Hosted uitrol en fysieke LG-acceptatie blijven afzonderlijke releasegates. Een
gezonde stagingresponse of Chromiumtest mag nooit als fysieke hardwarepass
worden beschreven.
