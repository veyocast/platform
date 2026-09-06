# VeyoCast Technical Canon v1

## 1. Productdefinitie

VeyoCast is een multi-tenant narrowcasting- en ClubTV-platform voor sportverenigingen en organisaties met beheerde schermen. De MVP bestaat uit vier planes:

1. **Marketing** — publieke website en conversie.
2. **Control** — platform- en tenantbeheer.
3. **Player** — offline-first PWA voor fullscreen playback.
4. **Media worker** — verwerking, validatie en normalisatie van media.

## 2. Niet-onderhandelbare stack

- Next.js App Router
- TypeScript
- pnpm workspace
- Tailwind CSS
- shadcn/ui als componentbasis
- Framer Motion alleen voor functionele micro-interacties
- Supabase Auth/Postgres/Storage
- PWA voor player en admin waar relevant
- GitHub als bron van waarheid
- Lokale bouw via Codex + WSL2
- Docker voor lokale Supabase en latere deployment

## 3. Monorepo

```text
apps/
  control/
  player/
  marketing/
  media-worker/
packages/
  ui/
  tokens/
  icons/
  content-templates/
  contracts/
  domain/
  auth/
  database/
  integrations/
  config/
  observability/
  testkit/
supabase/
  migrations/
  tests/
  seed.sql
infra/
  docker/
  compose/
  caddy/
  scripts/
docs/
prompts/
```

De package-structuur is een doelarchitectuur en wordt incrementeel ingevuld.
`contracts`, `domain` en `auth` vormen vanaf S20 de frameworkvrije kern. Nieuwe
code gebruikt deze boundaries; bestaande werkende flows worden alleen bij
inhoudelijke wijziging gemigreerd. Zie ADR 0006.

## 4. Control plane

Control bevat:

- platformadmin;
- tenantbeheer;
- gebruikers en rollen;
- media library;
- playlist editor;
- release publishing;
- schermen/devices;
- pairingflow;
- diagnostics;
- auditlog;
- integratieconfiguratie later.

Control gebruikt expliciete tenantcontext en capability-autorisatie. Een
tenant slug of zichtbare UI-state is nooit voldoende bewijs; iedere serveractie
valideert context, capability, tenantstatus en resource ownership opnieuw.

Publieke errors bevatten alleen een allowlisted code, begrijpelijk gevolg,
herstelactie en optionele request-ID. Raw database- of stackdetails zijn
verboden.

## 5. Playback plane

De player:

- is geen gebruiker;
- heeft geen normale Supabase Auth-account;
- krijgt een revocable device session;
- speelt fullscreen;
- bewaart media lokaal;
- blijft offline spelen;
- downloadt pending releases op de achtergrond;
- activeert pas na verificatie;
- rapporteert heartbeat en syncstatus.

Platformshells mogen de hosted Player als enige bron van waarheid in een
beperkte native host draaien. Zo'n shell mag lifecycle, fullscreen,
touch, toetsenbord, afstandsbediening en platformherstel toevoegen, maar
introduceert geen eigen pairing-, release-, cache-, planning- of playbackmodel.
De algemene Android-shell in `apps/android-tv/` — met historische mapnaam —
volgt deze grens op telefoon, tablet, signagehardware en TV.

## 6. Media plane

Media wordt nooit blind afgespeeld. Uploads worden:

- tenant-scoped opgeslagen;
- gevalideerd op type en grootte;
- verwerkt naar veilige player-variant;
- gehasht;
- voorzien van metadata;
- pas daarna als `ready` gebruikt.

## 7. Release model

Een playlist draft is bewerkbaar. Een release is immutable.

```text
playlist draft -> publish review -> playlist_release vN -> player manifest -> player cache -> active release
```

Een mediaasset dat in een release zit wordt niet stilzwijgend vervangen. Nieuwe content vereist nieuwe asset/variant en herpublicatie.

### Realtime eventoverlay

Een transient operationeel event mag buiten de playlisttijdlijn verschijnen
wanneer het ontwerp, de targetset en alle media als immutable versie zijn
gepubliceerd. Het event zelf is canoniek, idempotent, tenant- en schermgebonden.
De Player haalt nooit providerdata op en laat de last-known-good release onder
de overlay staan. Pauzeren bewaart de resterende itemtijd; een tijdelijk
netwerkprobleem of een verlopen event veroorzaakt geen zwart scherm. Het
contract en de eerste LED Scores-implementatie staan in
[`integrations/ledscores-realtime-goal-alert.md`](integrations/ledscores-realtime-goal-alert.md).

## 8. MVP-scope

In scope:

- platformadmin;
- tenantadmin;
- tenant editor/viewer;
- tenant creation;
- invitations;
- RLS;
- image/video upload;
- playlist editor;
- immutable releases;
- screens;
- pairing;
- online player;
- offline cache;
- atomic updates;
- basic marketing homepage;
- local test gates.

Out of scope voor kern-MVP:

- Mollie;
- advertentienetwerk;
- sponsorportaal;
- een tweede native Android/iOS-playerimplementatie; een dunne goedgekeurde
  algemene Android-hostshell met TV-ondersteuning rond de bestaande Player is
  wel toegestaan;
- webOS/Tizen;
- arbitrary HTML/iframe content;
- full Sportlink/Twelve production integration;
- AI content generation;
- multi-zone layout editor.

## 9. Canonieke MVP-flow

```text
Platformadmin maakt vereniging
Tenantadmin accepteert uitnodiging
Tenantadmin uploadt media
Worker verwerkt media
Tenantadmin maakt playlist
Tenantadmin publiceert release
Tenantadmin maakt scherm
Player toont pairingcode
Tenantadmin koppelt device
Player downloadt release
Player speelt fullscreen
Player blijft offline doorspelen
Nieuwe release wordt pending gedownload
Player switcht pas na volledige verificatie
```

## 10. FieldFlow outputcontract

Vanaf S144 is `fieldflow` de enige authoringkeuze voor nieuwe en muteerbare
dynamische content. De tien oudere theme-ID's blijven geldige input voor reeds
gepubliceerde immutable snapshots en releases; migraties herschrijven deze data
niet. De authoringgrens wordt zowel in serveracties als in PostgreSQL-triggers
afgedwongen.

De resolved presentatie in de immutable snapshot is de enige bron voor modern
Player, Static LG, preview, thumbnail en renderfallback. Live tenantdefaults of
providerdata worden na publicatie niet opnieuw geraadpleegd. Assetcollectors
nemen alle in die snapshot gerefereerde club-, tegenstander-, sponsor- en
contentmedia mee. Een ontbrekend of corrupt pending asset houdt de nieuwe
release in pending en laat de actieve last-known-good release spelen.

Render- en authoringvalidatie hebben verschillende tijdsgrenzen. Het opnieuw
opbouwen van een `latest`-snapshot mag een historisch legacy theme-ID blijven
lezen, ook wanneer dat gebeurt als neveneffect van een tenantbrede stijlwijziging.
Een insert of wijziging van `dynamic_slides.configuration_json` of
`dynamic_slide_versions.configuration_json` blijft daarentegen fail-closed en
accepteert uitsluitend `fieldflow`, inclusief Menu-documenten die hun
`themeId` rechtstreeks onder `theme` bewaren.
