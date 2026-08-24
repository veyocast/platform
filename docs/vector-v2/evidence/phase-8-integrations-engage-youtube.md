# Fase 8 — integraties, Engage en YouTube

Datum: 24 augustus 2026  
Branch: `veyocast/s123-vector-v2-living-venue-os`

## Audit en beslissingen

- Sportlink is reeds server-side, credential-afgeschermd en snapshotgedreven;
  de Player belt de provider nooit rechtstreeks. De negen actuele wizard-
  blueprints, team/competitie/fase/poule-context, providerassetcache en
  last-known-good semantiek blijven leidend.
- Twelve blijft uitsluitend een gecontroleerde normale XLSX-import met mapping,
  validatie, preview, broninformatie en re-import. Er wordt geen live API
  geclaimd.
- RSS/Atom gebruikt de bestaande begrensde fetch/parser, lokale media/QR,
  deduplicatie, stale/error-status en immutable snapshots.
- Sponsor Hub is reeds een afzonderlijk volwassen domein met sponsors,
  campagnes, vier-ogen-goedkeuring, zes semantische posities, immutable plannen
  en idempotente Proof of Play. Proof of Play heet expliciet technisch
  afgemelde speeltijd, niet een menselijke impressie.
- Engage en YouTube ontbraken als echte productgrens. Ze zijn daarom additive,
  tenant-scoped en default-off gebouwd; flags verlenen nooit autorisatie.

## Engage

Migratie `20260824200000_s123_engage_youtube_integrations.sql` introduceert
tenant-aware campaigns, options, pseudonieme votes en append-only audit. Alle
tabellen zijn default-deny en forced-RLS; menselijke mutaties lopen via guarded
commands. De statusmachine accepteert alleen voorwaartse overgangen en publieke
data is een begrensde `SECURITY DEFINER`-projectie.

De publieke route `/engage/[publicId]` is mobile-first, toetsenbordbedienbaar en
pollt begrensd voor actuele resultaten. De server maakt HMAC-identiteiten met
een afzonderlijk deploymentsecret; ruwe IP-adressen, user agents en namen
worden niet opgeslagen. Een campagne-identiteit is idempotent, terwijl een
afzonderlijke gehashte netwerkband misbruik over cookie-resets begrenst. Een
lokale QR-deeplink wordt in Control gegenereerd. Resultaten volgen `live`,
`after_vote` of `after_close`.

## YouTube

De adapter accepteert alleen een begrensde officiële video-ID of HTTPS-URL,
haalt uitsluitend `snippet,status` op via de officiële Data API en weigert
private/niet-insluitbare video's. De embedbuilder gebruikt de officiële IFrame
Player, `enablejsapi=1` en een expliciete `origin`. Opslag bevat alleen metadata
en een verplichte tenantgebonden lokale fallback; `online_only=true` is een
databaseconstraint. Er bestaat geen download-, transcode- of cachepad voor
YouTube-audiovisuele content.

Officiële bronnen die de implementatie begrenzen:

- https://developers.google.com/youtube/iframe_api_reference
- https://developers.google.com/youtube/v3/getting-started
- https://developers.google.com/youtube/terms/developer-policies

`YOUTUBE_DATA_API_KEY` en `ENGAGE_ABUSE_SIGNING_SECRET` zijn uitsluitend
server-side. Zonder configuratie faalt authoring/stemmen gesloten. De
`youtube_integration`-flag blijft standaard uit. De daadwerkelijke immutable
playlistbinding, Player-IFrame-capabilitycheck en fallback-switch worden in de
Playerfase afgerond; Control claimt vóór die gate geen production-playback.

## Bewijs

- verse `pnpm db:reset`: groen;
- gerichte pgTAP: 21/21;
- volledige RLS: 58 bestanden en 1.181 assertions groen; de bewust nieuwe
  publieke Engage-readfunctie staat in de expliciete anon-allowlist;
- `@veyocast/domain`: 44/44;
- `@veyocast/integrations`: 53/53;
- Control: 185/185 unit;
- Control lint/typecheck/build: groen;
- echte lokale Supabase browseracceptatie: 2/2, inclusief mobile vote,
  resultaatprivacy, tenantbeheer, QR, integratiecatalogus en Axe zonder
  violations;
- productiebuild bevat de nieuwe beheer-, API- en publieke routes en slaagt voor
  auth- en client-secret-boundarycontrole.

## Nog te sluiten binnen deze opdracht

- Engage schermslide/final-result Playerweergave;
- immutable YouTube playlistitem + online capability/preflight/fallback;
- browser/Axe screenshots voor beheer en publieke stemroute;
- retentiejob/readback en production-cohortbewijs.
