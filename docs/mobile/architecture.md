# VeyoCast Control Mobile — architectuur

## Productgrens

`apps/control-mobile` is een zelfstandige React Native-app met Expo Router,
Hermes en de React Native New Architecture. Het package is
`nl.veyocast.control`; het gebruikt geen WebView als applicatieshell.

```text
React Native app
  ├─ Expo SecureStore: authsessie, tenantkeuze, app-lock en device-id
  ├─ SQLite: tenantgebonden leescache en afbeelding-uploadqueue
  ├─ native camera/picker/biometrie/notificaties
  └─ bearer HTTPS
       └─ Control /api/mobile/v1
            ├─ Supabase Auth tokenvalidatie
            ├─ tenant + capabilitycontrole
            ├─ RLS
            └─ bestaande guarded RPC's en immutable releases
```

## Routes

| Route | Doel |
|---|---|
| `/` | auth/config/tenant-router |
| `/(auth)/login` | beveiligd inloggen |
| `/(auth)/forgot-password` | wachtwoordreset |
| `/(auth)/configuration-error` | fail-closed runtimeconfig |
| `/(tabs)/vandaag` | operationele cockpit |
| `/(tabs)/schermen` | zoeken/filteren en schermvloot |
| `/(tabs)/maken` | foto kiezen/maken en duurzame uploadqueue |
| `/(tabs)/content` | media- en playlistbibliotheek met geneste authoringstack |
| `/(tabs)/meer` | account, security en organisatie |
| `/screens/[screenId]` | schermstatus en remote herstelcommando's |
| `/screens/pair` | code/QR, schermcreate en pairing |
| `/content/playlists/new` | compact playlistconcept binnen de Content-tab |
| `/content/playlists/[playlistId]` | lichte authoring, targets en publiceren binnen de Content-tab |
| `/more/organizations` | tenantwisseling |
| `/more/security` | biometrische app-lock |
| `/more/notifications` | push opt-in en categorievoorkeuren |
| `/more/account` | account en verwijderingsverzoek |

Telefoons gebruiken vijf tabs; bredere vensters gebruiken een adaptieve rail.
Playlistcreatie en -detail zijn genest onder de Content-tab, waardoor dock of
rail tijdens authoring zichtbaar blijft. Alle inhoud blijft native scrollbaar
en houdt rekening met safe areas.

## Design-systeminventaris

`packages/mobile-design-system` bevat uitsluitend React Native-primitives:

- themaprovider met light/dark systeemmodus;
- `AppShell`, `ScreenScrollView`, `SurfaceCard`, `SectionHeader`;
- `AppText` met semantische typografierollen;
- `Button`, `IconButton`, `PressableSurface`, chips en segmented control;
- `TextField` en search;
- badges, alerts, skeletons en lege/fouttoestanden.

Statussen combineren altijd tekst met kleur/icoon. Touch targets zijn minimaal
44 dp. Spacing volgt de 4/8-dp-grid en gebruikt canonieke tokens.

## Mobiele API en contracts

De API-versie is `2026-07-28`. Iedere respons bevat een request-id en versie;
fouten bevatten oorzaak, gevolg en herstelactie zonder stacktrace.

- `GET /session`
- `GET /cockpit`
- `GET|POST /screens`
- `POST /screens/commands`
- `POST /pairing/claim`
- `GET /content`
- `POST /media/images`
- `POST /playlists`
- `GET|POST /playlists/:id`
- `POST /playlists/:id/publish`
- `GET|POST /account/deletion`
- `GET|PUT /notifications/preferences`
- `POST|DELETE /notifications/device`

Contracts staan in `packages/contracts/src/mobile-control.ts`. De app parseert
ook succesvolle reacties; een server/app-versiemismatch wordt veilig als
contractfout getoond.

## Offline- en uploadarchitectuur

- Cockpit, schermen en content worden per tenant met timestamp in SQLite
  gecachet.
- Cachefalen blokkeert live beheer niet.
- Een gecachte toestand wordt expliciet als offline getoond en verleent geen
  extra rechten.
- Gekozen afbeeldingen worden eerst naar app-private opslag gekopieerd en met
  tenant, type en status in SQLite gezet.
- De queue herneemt na netwerkherstel; voltooiing verwijdert rij en tijdelijk
  bestand.
- Tenantwisseling en logout verwijderen tenantgebonden lokale data.
- Publiceren, pairing en remote commands worden nooit lokaal als geslaagd
  beschouwd zonder serverbevestiging.

## Belangrijke productbeslissingen

De launchkern bevat geen gefingeerde directe-berichten- of approvalflow.
Daarvoor zijn eerst tenantveilige backendmodellen, auditsemantiek en een
productbesluit over overlays/goedkeuring nodig. “Openen in Control” is de
veilige vervolgrichting totdat die domeinen formeel bestaan.
