# S239 — Echte auth en behouden acties in Sync

Branch: `veyocast/s239-source-auth-actions`. Writer voert geen commit, push,
deployment, database- of dependencywijziging uit. Root beheert de releaseketen.

## Bron en nulmeting

De immutable `App.tsx`-login gebruikt de gedeelde Source Modal met maximaal
540 px breedte, 22 px radius en 26 px bodypadding. De `login-card` heeft
18 px gap en een merkasset van 210 px; mobiel gebruikt de modal 18 px padding.
De demo-eenmaligecode en fictieve demoaanmelding zijn geen productcontract.

De echte authkaart gebruikte nog 480 px breedte, 17 px radius, 30 px padding
en 22 px gap uit de oudere globals/FieldFlow-laag. De titel was 31 px en de
authactie erfde Orange. De PWA-melding gebruikte Ink/Orange, 12–13 px copy en
36 px actieknoppen. De metadata-opslagactie was een raw `demo-button primary`.

De eerste gerichte rode scopeassertie is bewaard in
`/tmp/veyocast-s239-baseline/first-red.txt`; oorspronkelijke product- en
Sourcebestanden plus SHA-256 staan naast die assertie. De latere eerste
SSR-harnessfout betrof synchrone rendering van de echte async
`OrganizationClaim`; die fixture gebruikt nu React streaming-SSR.

## Wijziging

`sync-auth.css` staat na Source/adapter en geeft de echte accountpagina's
uitsluitend lokaal `.sync-control.sync-auth`. Kaarten volgen 540/26/22/18;
de 960 px MFA-flow, volledige onboarding en verenigingselectie behouden hun
brede taken. Mobiel heeft een kaart 20 px viewportmarge en 18 px binnenruimte.
Onboarding houdt de primaire taak vóór secundaire context. Authcopy, labels,
helpertekst en statuses zijn minimaal 14 px; acties blijven minimaal 44 px.
Een donker Sync-accent geeft zichtbare focus op wit: de lichte Source-mint
zou hier onvoldoende focuscontrast geven.

Auth- en behouden primaire links gebruiken het lokale Sync-accent. De
PWA-toast buiten de shell gebruikt de Source-toastkleuren en 44 px knoppen.
Een wachtende service worker meldt nu `Nieuwe versie beschikbaar`; pas de
bestaande expliciete herlaadactie activeert die versie.
De metadata-save gebruikt de bestaande semantische `Button variant="primary"`;
zijn Radixportal krijgt een lokale Sync-scope zodat primary ook buiten de
shell groen blijft. Het opgeslagen metadata-command en diens permission/CAS-
en idempotencybindingen zijn behouden.

Na het terugdraaien van uitsluitend de expliciete classdelta en één
loginzin zijn de negen auth/context/onboardingpagina's bytegelijk aan de
nulmeting. `ControlPwaRuntime.tsx` is bytegelijk na terugdraaien van alleen de
genoemde statuszin; `sync-source.css` is volledig bytegelijk.
Dit is vastgelegd in `/tmp/veyocast-s239-baseline/invariance-proof.json`.
Geen action-, sessie-, MFA-, fragmentbridge-, token-, lockedasset-,
service-worker- of backendbestand is gewijzigd.

## Uitgevoerd bewijs

- Scoped ESLint en `git diff --check`: PASS.
- `pnpm --filter @veyocast/control typecheck`: PASS.
- Negen bestaande auth/securityunitbestanden: 71 PASS, 0 SKIP. Dit omvat de
  native Auth-/rollen-deadlines, middlewarecookies, callback, beschermde
  routeboundary, tenantcontext, onboarding, herstel en uitnodiging.
- Twee bestaande metadata-/mediacontractunitbestanden: 13 PASS, 0 SKIP.
- Volledige foundation met concurrency 2: 68/68 taken PASS, waarvan 64 uit
  gedeelde worktreecache. Exacte taakverdeling: 19 lint, 19 typecheck, 19 test
  plus 11 benodigde builds. De werkelijk opnieuw gedraaide Control-suite heeft
  1.272 PASS en 34 bestaande SKIP; gecachte suites tellen niet als nieuwe runs.
- Nieuwe browserfixture compileert dertien echte serverviews. De echte
  `requireControlSession` en beschermde pagina's gebruiken gecontroleerde
  backendtransportantwoorden; zonder actor redirecten reset, MFA, context
  en onboarding vóór beschermde formulieren worden gerenderd. Er is geen
  guardstub en geen echte aanmeld-, mail- of metadatawrite.
- Nieuwe `sync-auth-surface.spec.ts` staat klaar voor 390/1440 px:
  Sourcegeometrie, geen horizontale overflow, keyboardfocus, veldbindingen,
  alle echte authstatussen, brede flows, gehele-pagina-aXe, PWA offline/
  update/dismiss/skip-waiting en de read-only metadata-Radixportal.

De eerste volledige browserrun gaf5PASS/2FAIL: de metadata-status en
playlistgebruikstekst hadden te weinig contrast, en één hitboxmeting viel
midden in de bestaande enteranimatie. De lokale metadataregels gebruiken nu
leesbare Source-teksttokens en14px; statuscopy/iconen blijven behouden. De
detailslink heeft ook op desktop14px/44px. De proef wacht op werkelijk gestopte
animaties vóór de onveranderde44px-assertie.

De actuele volledige run heeft7/7PASS,0SKIP/0retry,1worker (27,8s): alle
dertien authviews op390/1440, PWA-update/offline en beide retainedmedia-dialogen.
Alle aXe-asserties blijven nul vereisen. Werkelijke accountguards blijven
gebruikt. Eerste rode rapport blijft `/tmp/veyocast-s239-browser-root-first.json`;
actueel rapport `/tmp/veyocast-s239-browser-root-current.json`. Actuele volledige
foundation68/68PASS,64cached; werkelijk opnieuw Control1272PASS/34bestaandeSKIP.
Log `/tmp/veyocast-s239-current-foundation.log`. Normale integratie/release
volgen afzonderlijk.

## Grenzen

SSR-/componentfixtures zijn visueel en lokaal guardbewijs; zij zijn geen
hosted-auth-, maildelivery-, pixelpariteit-, fysieke-device- of volledige
V1-acceptatie. Volledige workspace-/releasegates en deploybewijs volgen bij
rootintegratie. Player, immutable publicaties en offline-LKG zijn niet geraakt.

Actuele bron- en producthashes staan in
`/tmp/veyocast-s239-baseline/current-hashes.json`.

Na de normale S234/S232/S236-dependencymerge is de volledige foundation
opnieuwgroen:68/68taken,64cached; werkelijk Control1.401PASS/34bestaandeSKIP.
Log `/tmp/veyocast-s239-integrated-foundation.log`. Eigen productclass-/CSS-/
commandgrenzen blijven behouden. Exact-head hosted browser/CI en normale
staging/productie volgen afzonderlijk.
