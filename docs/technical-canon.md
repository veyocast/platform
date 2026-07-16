# Castivo Technical Canon v1

## 1. Productdefinitie

Castivo is een multi-tenant narrowcasting- en ClubTV-platform voor sportverenigingen en organisaties met beheerde schermen. De MVP bestaat uit drie planes:

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
- native Android/iOS;
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
