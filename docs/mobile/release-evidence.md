# VeyoCast Control Mobile — release-evidence

Datum: 29 juli 2026

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
- Engage livebediening gebruikt een begrensde bearer-endpoint, read-only
  metricsprojectie en duurzame idempotency receipts; 58 pgTAP-bestanden met
  1.188 assertions zijn na een verse reset groen.
- de Android Hermes-export bevat de native Engage-route en is opnieuw op
  clientsecrets gecontroleerd.

## Dichtheids- en viewport-evidence

- Roboto 400/500/600/700 wordt vóór het verbergen van het splashscreen geladen;
- telefoonkaarten, paginakoppen, knoppen en de 58-dp bottom dock gebruiken één
  compacte semantische schaal;
- de cockpit toont de herstelactie vóór cijfers en bundelt vier statussen in
  één 2×2-summary-surface op telefoon en één rij naast de tablet-rail;
- playlistitems groeperen de twee verplaatsacties, weergavemodus en rustige
  critical-actie zonder het zichtbare 44-dp touch target te verkleinen;
- de playlistbedieningsrail is op 320, 390 en 430 dp geometrisch gemeten:
  `Vullen`/`Passend` is steeds 68 dp breed, `Verwijder` steeds 90 dp breed en
  alle rijen blijven 44 dp hoog en zonder horizontale documentoverflow;
- playlistcreatie en -detail blijven in de Content-tab, zodat dock of rail
  beschikbaar blijft;
- herhaalde instellingen gebruiken gegroepeerde lijsten met interne dividers
  in plaats van een verzameling losse cards;
- 320, 390, 430, 768 en 1024 zijn zonder horizontale documentoverflow
  gecontroleerd.
- light, dark, playlist-top, playlist-bottom, gegroepeerde instellingen en de
  donkere tablet-rail zijn als echte lokale render beoordeeld; de laatste
  publicatieknop eindigt op 390×844 op y=734 en blijft daarmee boven de dock.

## Accessibility-evidence in code

- 44-dp minimale bediening volgens WCAG 2.2;
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
| Expo SDK 57 patches gepubliceerd op 24-08-2026 | tijdelijk geblokkeerd | supply-chain policy; de release valideert reproduceerbaar de frozen SDK-bundel met `EXPO_OFFLINE=1`; review de nieuwere patches pas na de minimum release age |

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
