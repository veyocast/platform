# VeyoCast dynamic slides canon

Status: versioned DOM-ready Source protocol (S292); historical contracts retained
Scope: fixed menu boards, RSS news, Publisher integration and all Players

## Independent Source DOM protocol 2 (S292)

This section governs newly opted-in Sync/Sportlink, RSS, Sync Menu and current
MenuDocument/widget preparations. Version 1 and previously prepared
MenuDocument/Sites publications retain their original contracts below. No historical release is rewritten.

A tenant producer is disabled by default. A service-only audited command records
the verified consumer release SHA before enabling protocol 2. Immutable Source
configuration, canonical facts and their `dataRevision` remain separate.

A ready protocol-2 snapshot registers one generated `composition` original with
MIME `application/vnd.veyocast.sync-dom+json` (maximum 550,000 bytes). This is a
code-free immutable descriptor. It contains the known renderer/presentation and
checksum-bound resource metadata, never provider HTML, credentials, scripts or
signed URLs. No poster, PNG or MP4 is a readiness prerequisite. Control previews
use the same existing `SyncSlideStaticView` or Menu Studio
`SitesMenuWidgets`/`SitesApprovedMenu` as the Player and explicit export.
Menu keeps its real widgets, stored document, provider identities and approved
prices. New Menu transport has distinct strict `menuDom` metadata and the same
manifest version 2; it never masquerades as the old Sync presentation.
A source price proposal does not change approved published prices.

Only explicit `sync-dynamic-v2` negotiation plus the actual renderer capabilities
receives a version-2 manifest and strict version-2 metadata. The legacy strict
version-1 decoder is unchanged. Older profiles receive the bounded existing
binary cache, requested on actual demand. A preparing legacy target preserves
its current complete release independently from ready DOM targets. Explicit
file downloads use the same deduplicated binary cache and human permissions;
requesting an export never publishes a draft. Failed exports do not invalidate
DOM readiness. DOM descriptors have a separate fenced worker lane, so capture
and encoding cannot occupy that lane. All lanes share one compact queue hint.

Unchanged observations (including generatedAt/fetchedAt) do not advance the
semantic data identity. Amsterdam's birthday selection day remains semantic.
Live facts do not create new configuration snapshots or releases. Original
photographs, logos and fonts are still prepared and verified. For protocol 2,
a complete cached app shell and actual visible frame are required before the
new local recovery point is committed. Menu/data clocks restart for the accepted
dataset, and every timed DOM zone reaches its own natural boundary before the
composed update. Explicit Menu PNG uses the existing renderer and bounded
three-slot cache, independently from DOM readiness. See the Player Offline Canon.

## Historical version-1 product boundary

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

`tenant_settings.theme_color_overrides` is de centrale tenant-owned
kleurauthority voor authorable themes. De actuele vorm bevat één volledige,
server-side gevalideerde 26-token light/dark-map onder `fieldflow`; het
per-theme objectcontract kan later alleen via een versioned schema worden
uitgebreid. Alleen Instellingen schrijft deze map. Slidewizards bieden geen
lokale kleuroverride en preview/create-actions laden dezelfde authority
server-side. Een wijziging zet uitsluitend nieuwe `latest`-snapshots klaar;
bestaande snapshots, pinned historie en gepubliceerde releases blijven
ongewijzigd. `tenant_settings.primary_color` blijft alleen compatibele
merkmetadata voor oudere templates. De Control-productskin erft geen
tenantbranding.

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

### Bezoekerswelkomstkaart

`sport_visitor_arrivals` is een vaste uitzondering op vrij instelbare
kaartdichtheid. Een pagina bevat maximaal twee thuiswedstrijdgebonden
bezoekers: links/rechts op landscape en boven/onder op portrait. Met één
bezoeker blijft uitsluitend het eerste halve slot gevuld. De eerstvolgende
wedstrijd staat vooraan; latere wedstrijden volgen oplopend en nog renderbare
recente wedstrijden pas daarna.

Iedere kaart toont exact drie inhoudsregels: `[clubnaam] [team]`,
`Aanvang: [tijd] | Veld [nummer]` en `Kleedkamer: [nummer]`. De laatste twee
regels zijn exact 80% van regel één en hebben regulier gewicht. Aankomsttijd,
welkomstkicker, competitie, duty-desktekst en sponsor zijn niet zichtbaar. Het
checksumgebonden uitteamlogo vult de kaart als 30%-achtergrond en staat tevens
groot op een witte rechterplaat; ontbrekende logo-assets worden nooit extern
opgehaald of gereconstrueerd. De moderne en Static LG-renderers normaliseren
ook oudere veilige snapshots naar dit contract. Nieuwe `latest`-snapshots
worden via de bestaande queue gepubliceerd zonder een snapshot, fallback of
release mutable te maken.

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
cascade is platformdefault → centrale tenant-theme-map. Er bestaat geen
slidekleurlaag. Publicatie bevriest de opgeloste maps, zodat een latere
brandingwijziging geen bestaande release verandert. Component-CSS mag alleen
semantische `--vc-*`-variabelen gebruiken; een broncodeguard bewaakt hex-, rgb-,
hsl- en oklch-drift. Control blokkeert ongeldige kleuren,
tekst/paneelcontrast onder 4,5:1, onvoldoende contrast op de foto-overlay en
onvoldoende QR-contrast zowel client- als server-side. Instellingen biedt voor
FieldFlow één centrale light/dark-editor waarin ieder semantisch kleurtoken
afzonderlijk instelbaar is. Moderne en Static LG-playback gebruiken exact de in
het snapshot opgeslagen tokenkaart.

Prijslijsten renderen twee kolommen, tellen categorieën als volledige rijen en
houden het vierkante mediavak leeg én maatvast wanneer een foto ontbreekt of is
uitgeschakeld. Nieuws ondersteunt `hero_split`, `fullscreen_gradient`,
`news_grid` en `text_only`. Stand, programma en uitslagen gebruiken één kolom
tot tien regels, exact twee landschapkolommen vanaf elf en één portretkolom tot
twintig; boven twintig ontstaat deterministisch een volgende pagina.

`fullscreen_gradient` houdt de foto over het volledige canvas. In landscape
blijft de linkerhelft achter titel en intro circa twintig procent zichtbaar en
loopt de verduistering naar rechts weg. In portrait blijft de bovenste helft
beeldgedragen; vanaf het midden loopt de afbeelding naar een circa tachtig
procent donkere ondergrond onder titel en intro. De intro is in deze variant
groter dan in de overige nieuwsvarianten, zonder de immutable thematokens of
tenantkleurcascade te omzeilen. De FieldFlow-standaard gebruikt hiervoor een
neutrale Ink-overlay van circa 84% aan de tekstzijde, 58% in het midden en 8%
aan het beelduiteinde; iedere waarde blijft centraal als semantisch
tenant-themetoken aanpasbaar.

Producttitels in prijslijsten gebruiken een leesbare standaardgrootte van 34 px
op landscape en 32 px op portrait. Alleen op basis van de genormaliseerde
titellengte kiest de gedeelde renderer deterministisch een begrensde
`compact`- of `dense`-grootte. Browser en LG Legacy gebruiken dezelfde
drempels; portrait pagineert eerder en verkleint nooit de volledige scène om
meer producten in beeld te persen. Tenants kiezen letterfamilies uitsluitend
via de gecureerde themacatalogus, niet via vrije fontuploads of onbegrensde
typografie-instellingen.

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

## Menu Studio authoringinteractie (S117)

Productgroepbewerking is tijdelijke editorcontext, geen aparte navigatielaag.
Zolang een groep actief is tonen inspector en productbibliotheek dat expliciet;
de beheerder kan die context met een zichtbare `Klaar`-actie sluiten zonder de
opslag- of publicatiestatus te wijzigen. Het selecteren van een ander canvasblok
sluit de groepscontext eveneens.

De menunaam is een zichtbaar tekstveld en de canonieke identiteit van zowel het
`MenuDocument.v2` als de corresponderende Slides-resource. Een `set-title`-
command bewaart beide waarden in dezelfde revision-checked, idempotente en
tenantbeveiligde transactie. Portraitmenu's verankeren categorieën en artikelen
altijd bovenaan het contentvlak; ondervulling mag nooit opnieuw tot verticale
centrering leiden. Preview, browser-Player en primaire thumbnail gebruiken
hiervoor dezelfde `MenuScene`-CSS. Bestaande snapshots en releases blijven
immutable totdat de beheerder opnieuw publiceert.
