# S238 — OnzeTrots-achtergronden in de echte ontwerpketen

De gekozen editor bood de bestaande OnzeTrots-fotoachtergronden niet aan.
De gedeelde kiezer toont nu Houtrust, De wijk en Aan zee, met de oorspronkelijke
liggende en staande bestanden. De vijf bestaande presets en eigen tenantfoto's
blijven beschikbaar. Alleen een expliciete keuze of oriëntatiewissel wijzigt
het ontwerp; bestaande opgeslagen inhoud en pending-opdrachten blijven exact.

## Assets en compatibiliteit

De nieuwe catalogus bevat zes goedgekeurde scenevarianten met exacte paden,
SHA-256, bytes, MIME en dimensies. Er zijn geen beelden of logo's gereconstrueerd.
De volledige historische `sites-system-assets` registry heeft88 records en
blijft bytegelijk; de eerdere verwijzing naar41 betrof de afzonderlijke
OnzeTrots-assetset, niet de hele registry. De vaste elf kernassets blijven
bytegelijk. De finale audit doet210 byte-readbacks:11core+88historisch+6gallery,
ieder in beide apps (overlappende sets, geen claim van210unieke bestanden).
Nul ontbrekende of afwijkende bestanden. Bewijs:
`/dev/shm/veyocast-s238-final-assets-readback.json`, SHA
`b00e1f62e3d032cdad1d33690a85cf3d2d31bf0320320f05ee83114a5c852a53`.

De bestaande v1-documentvorm blijft behouden. Alleen de achtergrondrol mag de
zes extra systeemreferenties gebruiken; logo-, club- en sponsorrollen niet.
De additieve migratie `20261019020000_sync_approved_backgrounds.sql` vervangt
uitsluitend twee bestaande private validators. De latere Engage-/YouTube-
wrappers, andere guards, grants en search_path blijven behouden. Geen nieuwe
RPC/tabel/policy, datamigratie of mutable release wordt geïntroduceerd.

Nieuwe Players onderhandelen expliciet `X-VeyoCast-Sync-Backgrounds:
sync-backgrounds-v1`; alleen gebruikte beelden worden naast de core11 geleverd.
ETag/Vary/304 en compositionrequests nemen deze capability mee. Oude clients
ontvangen de bestaande volledige geverifieerde binaire fallback. Andere moderne
DOM/live-inhoud wordt niet algemeen naar video gedegradeerd.

## Werkelijke offline readiness

De Player verifieert de gecachte foto en decodeert de juiste dimensies vóór
activatie. Fouten of de bestaande vijfsecondenlimiet laten de actieve release
spelen; alleen eigen ongeactiveerde URLs worden opgeruimd. De eerste echte
coldstartproef vond een aparte fontfout: globale network-FontFaceSet.load nam
ook overlappende offline-onbereikbare CSS-fontfaces mee. Gallery gebruikt nu
expliciet eigen FontFace-objecten uit geverifieerde lokale fonts, met begrensde
load/add en cleanup. De elf-assetroute en algemene offline-state-machine
blijven behouden. De extra capability vereist ook deze browserfuncties.

## Uitgevoerd bewijs

- Voor de laatste fontcorrectie: volledige foundation groen; Player510PASS,
  Control1274PASS/34bestaandeSKIP. De fontcorrectie heeft25gerichte units groen,
  plus Playerproductiebuild, webOS6- en secret-freebundleguards. Dit is geen
  claim dat de volledige postintegratiesuite daarmee al is uitgevoerd.
- De eerste23Controlbrowsercases zijn groen: elf bestaande wizardcases,
  zes nieuwe gallerywizardcases en zes saved-editorcases;44px/aXe/focus,
  expliciete oriëntatie en herstel blijven getoetst.
- Verse disposable database57721/57722:197migraties,132files,4.009assertions,
  waaronder235nieuw. Publieke/private db-lint nul errors.25waarschuwingen
  betreffen16ongewijzigde functies, geen van de twee gewijzigde helpers.
  EchteQA57621/57622 werd niet geraakt. Eerste fixturefout blijft bewaard.
- Echte workerproef:18/18PASS (4policy+14Chromiumcaptures),1worker/0skip.
  Alle zes scènevarianten worden op beide pagina's echt weergegeven;
  ontbrekende/beschadigde assets en de kernasset-/fontguards blijven weigeren.
- De bestaande productworker heeft vervolgens zes volledige H.264-MP4's en
  twaalf PNG-pagina's gegenereerd en met de echte encoder/probe geverifieerd.
  SHA/MIME/dimensies/presentationhash staan in de registry, SHA
  `adb737803caf95ec5c5742fcaeeebb68469e6ae93c0e32990aec4b874aee1e61`.
  Dit vervangt de eerdere ongeschikte SVG-dummyfixture; die oude proef blijft
  expliciet onderscheiden van dit volledige binaire bewijs.
- Finale Playerproef op gebouwdeV4 `7JnjB24k3bZFjZvzTRBKQ`:9/9PASS,1worker,
  0retry/0skip,1,8minuten. Alle zes varianten spelen online, op pagina2 en na
  koude volledig offline start als DOM. Corrupt pending behoudt de actieve
  release/cachehash; echte image-decode wordt vóór activatie afgewacht. Een
  browser zonder image.decode ontvangt geen gallerycap en speelt de echte
  complete MP4 met beide pagina's en gecontroleerde achtergrondpixels.
- Run2had8PASS/1FAIL door een fixture die een vijfsecondenpoll willekeurig
  binnen een zessecondelus startte. De trace bewijst correcte activering op de
  natuurlijke grens103ms na de outerpoll. Run3 wacht eerst op de oude zichtbare
  tweede pagina terwijl decode wordt vastgehouden. Alle oude assertions,
  vijfsecondenpoll,30scasedeadline en product5sdeadline blijven gelijk.
  Originele run1/run2 en het aparte tracebewijs zijn behouden.

Worker/Player-/binarysummaries staan onder `/dev/shm/veyocast-s238-*summary.json`;
traceanalyse `/dev/shm/veyocast-s238-player-run2-boundary-diagnosis.json`.
De eigen workerbrowsers/toolingcontainers en PlayerV4-runtime zijn afgesloten.

## Integratie en releasegrenzen

De gehoste Playergate krijgt vóór de ongewijzigde runner één Player-only stap
die dezelfde echte fixtures maakt met pinned PlaywrightChrome en ffmpeg/probe.
De unieke output staat onder de bestaande artifactdirectory; het pad komt pas
na geslaagde generatie in GITHUB_ENV. Actionlint/ShellCheck/structuurchecks zijn
groen; er is hiermee nog geen gehoste uitvoering geclaimd.

Een onafhankelijke UI-audit vond ook12px-labels in de nieuwe wizard. Beide
viewportproeven bevestigden dit werkelijk. Root corrigeert uitsluitend lokale
formlabel-/uitlegselectors naar14px; previewpixels blijven behouden. De
gecombineerde S235-defaults/gallerywizard, actuele volledige foundation en
samengevoegde databasegates worden na normale integratie apart gerapporteerd.

De echte QA heeft de gallery-forward nog niet ontvangen. Echte tenant-save/
publicatie en exact-head hosted CI/staging/productie zijn afzonderlijke gates.
Fysieke Android/TV/LG/24u blijven volgens de gebruiker voor later. Dit document
claimt geen algemene pixelpariteit, vijf volledige auditronden of V1-oplevering.

De twee nieuwe labelasserties zijn na de lokale CSS-correctie2/2PASS in6,8s,
1worker/0retry/0skip. Eerste2FAIL met werkelijk12px blijven bewaard in
`/tmp/veyocast-s238-wizard-label-first-red.json`; actueel
`/tmp/veyocast-s238-wizard-label-current.json`. Dit is vóór de dependencymerge.
