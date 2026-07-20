# S27 — Schermvloot en onboarding evidence

## Opgeleverd

- `/dashboard/screens` is een filterbare vloot met echte status, Player,
  immutable content, syncstatus, laatste heartbeat en named detailactie;
- `/dashboard/screens/new` begeleidt details → optionele content → pairing →
  eerste heartbeat → afronding en kan na een verlopen code veilig worden
  heropend;
- `/dashboard/screens/[screenId]` bevat de canonieke tabs Overzicht, Content,
  Player, Synchronisatie en Gebeurtenissen;
- create en update lopen via tenantgebonden databasecommands; create en de
  bestaande limiettrigger vergrendelen dezelfde tenantrij;
- maintenance bewaart device-identiteit en last-known-good, disable trekt de
  gekoppelde Player atomair in;
- Player rename, revoke, re-pair en retry zijn capability- en tenantstatus-
  gecontroleerde commands met append-only audit;
- pairing v3 kent duurzame creation- en claimrate limiting, expiry/replay-
  uitkomsten en row-locking tegen double claim;
- de Player-API retourneert geen raw databasefout meer en bewaart alleen een
  gehashte rate-limitfingerprint;
- eerste heartbeat, runtime, appversie, platform, storage, active/desired
  release, veilige foutcode en synctijdlijn zijn zichtbaar zonder secrets.

## Security- en offlinegedrag

- pairingtoken en device secret verschijnen niet in Control, redirects, URL's,
  auditmetadata of zichtbare fouten;
- wrong-tenant en viewerclaims falen in de database;
- revoked devices krijgen geen bootstrap of heartbeat meer;
- Control legt uit dat een offline device pas bij de eerstvolgende verbinding
  van de intrekking weet en cached last-known-good content tot dan kan blijven
  tonen;
- maintenance en retry maken een actieve release nooit mutable en verwijderen
  geen lokale fallback.

Zie `docs/player-device-threat-model.md` voor dreigingen, controls en
rest-risico's.

## Designcanoncontrole

- één primaire actie op de vloot (`Scherm toevoegen`);
- operationele tabel op desktop en gelabelde cardrows op mobiel;
- status heeft steeds tekst en semantische kleur;
- detail staat op een eigen route met 44 px tabs en touch controls;
- onboarding is onder 768 px sequentieel en heeft geen horizontale overflow;
- foutcopy noemt gevolg en herstel en toont geen raw stack/databasegegevens;
- destructieve deviceactie benoemt het offline gevolg en vereist bevestiging;
- alle nieuwe kleuren, radii en spacing komen uit tokens;
- de bestaande fixed sidebar en onafhankelijk scrollende main/sidebar blijven
  ongewijzigd.

## Verificatie

- `pnpm db:reset`: geslaagd met alle migraties en seed;
- `pnpm test:rls`: 16 pgTAP-bestanden, 279 assertions geslaagd, waaronder
  33 specifieke S27-assertions voor limiet, tenantisolatie, replay,
  rate limiting, lifecycle, revoke en heartbeat;
- `pnpm exec supabase db lint --local`: geen schemafouten;
- `pnpm lint`, `pnpm typecheck`, `pnpm test` en `pnpm build`: geslaagd;
- `pnpm test:a11y -- --project=chromium`: 18 tests geslaagd, inclusief 390 px
  onboarding zonder horizontale overflow;
- `pnpm test:e2e -- --project=chromium`: 47 tests geslaagd en de twee bewust
  opt-in live-tests overgeslagen;
- `pnpm test:player`: 19 tests geslaagd;
- `pnpm test:player:offline`: 7 tests geslaagd;
- opt-in live-pilot: create → pairing → immutable release → verified playback
  → heartbeat → vloot → Player/sync/events geslaagd;
- opt-in live Playlist Studio: lost-updatebescherming en multi-screen guided
  publish geslaagd;
- vloot en onboarding zijn visueel gecontroleerd op 1440 px desktop en 390 px
  mobiel; de mobiele flow blijft sequentieel en de primaire actie blijft
  eenduidig.

## Open launchgates

- fysieke LG-model-/firmwarevalidatie;
- QR- en pairingleesbaarheid op het fysieke doelmodel;
- power recovery en opslagpersistentie op hardware;
- 24-uurs mixed-media soak;
- productionpromotie blijft een afzonderlijke goedkeuring.
