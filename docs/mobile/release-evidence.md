# VeyoCast Control Mobile — release-evidence

Datum: 28 juli 2026

## Lokaal bewezen

- native Expo-config valideert package, versionCode-range, SDK 36,
  cleartextblokkade en beperkte permissies;
- Expo dependency check is groen;
- TypeScript strict, ESLint en unit/contracttests zijn groen;
- Supabase reset inclusief mobiele migraties is groen;
- RLS-suite bewijst deviceprivacy, tenantgrenzen en idempotente
  playlistmutaties;
- guarded publicatie gebruikt dezelfde immutable `publish_playlist_to_targets_v3`
  als Control;
- Expo prebuild genereert release signingconfig uitsluitend uit protected
  environmentvariabelen;
- GitHub Action-syntax en pinned actions zijn lokaal gevalideerd;
- globale native crashfallback voorkomt een generiek leeg Expo-scherm.

## Accessibility-evidence in code

- 48-dp minimale bediening;
- semantische rollen voor headings, buttons, tabs, radio/checkbox en alerts;
- statuslabel naast kleur;
- light/dark systeemthema;
- adaptieve tab/railnavigatie;
- safe-area- en scrollcontainer op alle schermen;
- expliciete denied-permissionstate;
- bevestiging bij unpair, verwijderen en publiceren.

TalkBack, maximale fontscale, reduced motion, tablettoetsenbord en
focusvolgorde moeten nog op releasehardware worden afgetekend.

## Performance-evidence in code

- TanStack Query dedupliceert serverstate;
- SQLite levert last-known cached reads;
- FlashList is beschikbaar voor vlootgroei;
- uploadbestanden worden app-private gekopieerd en na voltooiing verwijderd;
- release minification en resource shrinking staan aan;
- Hermes/New Architecture zijn de standaard Expo SDK 57-releaseconfig.

Cold start, scroll met honderden items, memory pressure, background/foreground,
grote uploads en dataverbruik vereisen profiler- en hardwaremetingen.

## Releasegates die extern openstaan

| Gate | Status | Benodigde eigenaar/omgeving |
|---|---|---|
| Control Play-app bestaat | open | Play Console-eigenaar |
| Play App Signing/uploadkey/fingerprints | open | releasebeheerder |
| FCM production config | open | Google/Firebase-beheerder |
| Signed AAB uit protected CI | open | GitHub environment |
| 16-KB Play Bundle Explorer | open | Play internal |
| Internal-publicatie/installatie | open | Play Console/testers |
| Pre-launch report | open | Play Console |
| Fysieke Android 13–16 matrix | open | device lab |
| Phone/tablet light/dark visuele review | open | product/design |
| Echte store screenshots/feature graphic | open | reviewtenant + design |
| Notification icon | open | expliciete brandgoedkeuring |
| Reviewaccount | open | tenant-/identitybeheer |
| Definitieve privacy/Data Safety/legal retention | open | privacy/legal |
| Accountdeletion execution worker | open | privacy/legal + operations |
| Push provider delivery/incident producer | open | backend operations |

Daarom is de app nog niet als “Play Store-ready” of “gepubliceerd” aan te
merken, ondanks de aanwezige releaseketen.

## Bewust uitgestelde productdomeinen

Directe berichten, approvals en volledige mobiele schermplanning zouden nieuwe
security-, audit- en UX-contracten introduceren. Ze zijn niet als nepflow
toegevoegd. Een vervolgbesluit moet scope, rollen, overlaygedrag, expiratie en
immutable publicatie eerst vastleggen.

## Aanbevolen deploymentvolgorde

1. Merge naar `main` na volledige workspace- en RLS-gates.
2. Deploy backend/API en migraties naar staging via bestaande workflow.
3. Valideer staging bearer API met echte testtenant.
4. Configureer protected Android internal environment.
5. Bouw en publiceer signed AAB naar Play internal.
6. Voer hardware-, accessibility-, performance-, privacy- en pre-launchgates
   uit.
7. Promoveer exact hetzelfde artifact handmatig en gefaseerd naar production.
