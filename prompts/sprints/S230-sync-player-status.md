# S230 — Exacte Sync Player-statusschermen

## Bevestigde opdracht en basis

Root heeft de hieronder gescheiden writergrenzen expliciet bevestigd.
Worktree: `/home/codex/repos/castivo-s230`; branch:
`veyocast/s230-sync-player-status`; exacte basis:
`b6c894a466e1e74baf51c9f036145711f440d310` (S229).
S229 is normaal gemerged als `7b131c259fbb1bd90568cc4090a2006b82336d64`;
dezelfde getoetste basistree staat nu op main. Deze PR richt zich op main;
geen mainpush, amend, rebase,
force-push of eigen merge/deploy. Root beheert lopende web-/Playeruitrol.

## Opdracht en normatieve bron

De originele startprompt en `V1-REBUILD-CANON.md` vragen de volledige gekozen
Sync Player-ervaring, met behoud van de echte runtime. De Source is immutable:

- `docs/sync-v1-rebuild/handoff/reference/sites-sync/src/modules/Players.tsx`:
  `Stage`, `stageCopy` en de statusmarkup van `PlayerExperience`;
- de bijbehorende `modules/players.css`, met de uiteindelijke
  `.has-brand-art`- en portraitregels;
- Sourcecommit `8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a` en bestaande locked
  hero/woordmerk/iconen/fonts in `apps/player/public/assets/`.

Lees README, PLANS, TASK_LEDGER, technical-/design-implementationcanon,
officiële designcanon, security-/RLS- en Player-offlinecanon en het oorspronkelijke
S226-prompt. Source-geometrie heeft voorrang boven oudere generieke setupkaarten;
RLS, device-identiteit, locked assets, immutable releases, zichtbare eerste-frame-
ACK en LKG/offline-invarianten blijven bindend.

## Vastgestelde concrete afwijkingen

- De huidige `SetupPanel`, `PairingPanel`, `ProblemPanel` en
  `DefaultWaitingScreen` gebruiken andere indelingen; wachten gebruikt nog
  `royal-current-v8`/welkomkaart en voorbeeldfooter.
- Source-landscape reserveert 55% voor de hero en zet inhoud op left 57%,
  right 5%, top 50%, met H1 op 3.15cqw. Portrait gebruikt herohoogte 51%,
  inhoud left/right 10%, top 51%, met H1 op 6.3cqw. Originele fonts/assets zijn
  al aanwezig; geen nieuwe dependency of gereconstrueerd merkbeeld nodig.
- `updatePlaybackPhase` negeert nu alle callbacks zonder actieve release,
  waardoor echte eerste download/verificatie generiek `SYNCING` blijft.
- Cachecallbacks leveren echte `DOWNLOADING`/`VERIFYING`, maar geen
  byte-/bestandpercentages. Het Sourceprototype telt zelf percentages op;
  dat is geen productievoortgang en wordt niet overgenomen.
- Source toont bij herstel/error soms een overlay boven bestaande content.
  Deze overname geldt uitsluitend voor status zonder bruikbare actieve release;
  gezonde LKG blijft spelen met alleen de bestaande toegestane compacte
  offline-indicatie. Geen nieuwe statusoverlay over gewone playback.
- Echte LG-useragents worden door `/lg` naar `/lg/legacy` geleid. De zelfstandige
  legacy-HTML-runtime bevat eigen oude pairing-/wachtmarkup. Een moderne
  React-overname alleen bewijst daarom geen LG-statuspariteit; legacy-scope en
  Chrome79-veilige CSS moeten expliciet worden toegewezen, zonder de S228-
  video-/lokale bron-/offlineherstelpaden te wijzigen.

## Exclusieve ownership — bevestigd vóór productcode

`release_audit` schrijft uitsluitend:

1. `apps/player/app/_components/player-runtime.tsx`: de genoemde niet-playback-
   statusvertakkingen/adapters, echte code/expiry/QR/herstelbediening en
   zichtbare eerste voorbereidingsfase. De playbackengine, timers, commando's,
   pairing-/identityprotocol en cacheactivatie blijven behouden.
2. Nieuw `apps/player/app/_components/sync-player-status.tsx` en
   `sync-player-status.module.css`: letterlijke Source-statusstructuur,
   kleuren/font-/hero-/oriëntatiegeometrie en reduced motion, geïsoleerd van
   gewone contentrenderers. Bestaande assets/fonts worden hergebruikt.
3. Indien nodig een kleine pure presenter
   `apps/player/app/_lib/player-status-presentation.ts` plus gerichte
   `.test.ts`, voor controleerbare runtime→zichtbare statusmapping.
4. Alleen indien de werkelijke fasebediening dit vereist:
   `apps/player/app/_lib/player-cache.ts`, uitsluitend de bestaande optionele
   `onPhase`-rapportage vóór iedere feitelijke download/verificatie. Geen nieuwe
   cache-/hash-/download-/storage-/activatielogica. Dit optionele pad vereist
   rootbevestiging alleen voor bestaande fase-/voortgangrapportage. Als de
   bestaande callback volstaat, blijft dit bestand volledig ongewijzigd.
5. Gerichte bestaande browser-/regressiegevallen in
   `tests/player/pairing.spec.ts`, `tests/player/online-playback.spec.ts`,
   `tests/player-offline/startup.spec.ts`, `tests/a11y/player-runtime.spec.ts`;
   eventueel nieuw `tests/player/sync-player-status.spec.ts` voor dezelfde
   zeven toestanden/orientaties met passende echte transportfixtures.
6. Dit sprintprompt, eigen S230-entry in TASK_LEDGER en één afgebakend
   `docs/sync-v1-rebuild/PLAYER-STATUS.md`; geschoonde concrete
   `execution/evidence/s230-player-status-*`-bewijzen. CSV-ownership eerst
   concreet afstemmen als matrixbijwerking nodig is.

`binary_review` bezit exclusief `apps/player/app/_lib/lg-legacy-page.ts`,
`lg-legacy-page.test.ts` en `tests/a11y/player-lg-legacy.spec.ts`: uitsluitend
status-HTML/CSS en bestaande echte fase-/fout-/retryfeiten, met Chrome79-veilige
geometrie. Geen media-/timer-/cache-/decoderwijziging of JSmodernisering.
`release_audit` schrijft die drie bestanden niet.
Root heeft vóór wijziging tevens `tests/player/lg-legacy-player.spec.ts` aan
`binary_review` toegewezen, uitsluitend de twee oude setup-/wachtkoppen naar
dezelfde Sourcekoppen; overige fixtures/assertions blijven behouden.

Vóór schrijven heeft root ook deze minimale testownership aan `release_audit`
toegewezen: `tests/visual/google-tv-store.spec.ts` uitsluitend één setupkopliteral;
`tests/player/player-recovery-menu.spec.ts` uitsluitend twee setupcopyliterals;
`tests/player/sites-original-routes.spec.ts` uitsluitend de setupkop en de echte
QR-knop openen, dezelfde zichtbare QR controleren, daarna sluiten/focus terug
vóór de bestaande viewport-/screenshotmeting. Geen route-, auth-, opt-in-,
recovery-, screenshot- of tolerantiecriterium verandert. Storecaptures blijven
uitgeschakeld; geen storeassetregeneratie.

`root` bezit afzonderlijk de begrensde Control/content-presentatie en aansluiting
van reeds bestaande archive-/StudioDuplicateacties plus bijbehorende tests.
Geen impliciete archivering/duplicatie van rawmediaframes. Root legt eventuele
verdere concrete bronpaden vooraf vast; Playerwriters schrijven geen Control.
Aanvullend bevestigd vóór schrijven: root bezit uitsluitend import/filmstripclass
in `sync-studio-frame.tsx` en nieuw `sync-studio-frame.module.css` voor de echte
wrapperregressie bij portraitfilmstripitems (exacte Source62×35/16:9), zonder
andere Studio-aanpassing. Dit overlapt geen Player- of legacywriter.
Root mag de bestaande `media/media-overlays.tsx` alleen uitbreiden met
gecontroleerde Contenttrigger/open/close/returnTo-props en `media/actions.ts`
alleen met vaste allowlist `returnTo=/dashboard/content` na bestaande auth,
RPC en receipt, met behoud van de Media-default. Studioarchive/duplicate
gebruikt bestaande CAS+noncecommands. Previewreads alleen bij expliciet
geopende carddialog, geen extra reads per bibliotheekrij. Geen nieuwe
RPC/schema/securitypolicy of flag.
Na de echte 390px-aXecontrole bevestigt root tevens nieuw
`content/content-workspace.module.css` en de checkboxmarkup in de eigen
`content-workspace.tsx`: behoud het Source22px-glyph op dezelfde positie,
maar geef de echte knop een 44px-aanraakdoel volgens de hogere a11ycanon.
De gedeelde Source-CSS en kaartafmetingen blijven behouden.
Root/scenarioagent beheren onafhankelijke captures; geen productwrites door
de capturewriter. Eén gecombineerde S230-PR; commit/push pas na rootintegratie
van de deelgates en peerreview.

Geen package/lock/sharedtoken/database/native/service-worker-
wijzigingen, geen writes aan Source, bestaande Git/worktrees of andere
runtimeprocessen. Root/scenarioagent coördineren de onafhankelijke Source-/
productiecaptures; die writer schrijft geen productcode.

### Aanvullende rootownership: begrensd runnerherstel

Vóór wijziging bevestigt root uitsluitend `.github/workflows/runner-disk-maintenance.yml`
en `docs/sync-v1-rebuild/RUNNER-DISK.md`, plus eigen bewijs/ledger. De bestaande
25 release-/CIworkflows blijven bytegelijk. Inspectie39157743040 en de
geslaagde 24h-cacheprune39158022971 bewezen 98% gebruik, circa3.09GB vrij,
13.5GB ongebruikte buildcache en nul actieve builds. De 24h-operatie herstelde
de capaciteit niet. Een afzonderlijke expliciete keuze mag daarom dezelfde
ongebruikte buildcache met vaste `until=1h`-grens behandelen. Alle bestaande
identiteit/socket/builder/concurrencychecks blijven; geen `--all`, image-,
system- of volumeprune en geen directoryverwijdering. Image/container/volumesets
moeten gelijk blijven. Geen vrije input voor filters of remotecommando's.
De Player- en Controlwriters wijzigen deze operationele scope niet.

## Zichtbare toestanden en echte feiten

Boot → echte initialisatie/opslagcontrole; pairing → echte tijdelijke code,
expiry en QR; eerste downloaden/verifiëren → echte voorbereidingscallback;
gekoppeld zonder content → echte READY/waiting; fout en offline zonder bruikbare
cache → bestaande concrete oorzaak/gevolg/herstel en passende echte retry.
Een bronstate bestaat alleen wanneer de echte runtime dat feit ondersteunt.

Geen vast pairingcodefallback, automatische demopairing, gesimuleerde
verbinding/goedkeuring/publicatie, willekeurig percentage, verzonnen aantallen,
vervalste gereedmelding of apparaat-/certificeringsclaim. Als een echte metric
ontbreekt, behoud de Source-slot en toon onbepaalde activiteit met eerlijke
tekst/ARIA zonder `aria-valuenow`; bepaal een echte voortgangsuitbreiding alleen
na gerichte contractkeuze. Expiry en herstel gebruiken bestaande commands.

Demo-/onjuist geworden copy mag alleen feitelijk worden vervangen; layout,
typografie en hiërarchie blijven Source. Geen vrije algemene tekst-/UIherbouw.
Raw stacktraces/tokens blijven onzichtbaar. Gewone playback behoudt uitsluitend
de locked systeemmarkering linksonder op 40% en bestaande offlinechip.

## Voorgestelde acceptatie

- Onafhankelijke gelijke-state Source/candidatecaptures op 1920×1080 en
  1080×1920, reduced motion/fontload/beelduitsnede gelijk; parent coördineert
  capture-evidence. Democopy versus echte feiten apart vastleggen.
- Bestaande pairing/expiry/retry/cross-binding, eerste publicatie, afgebroken/
  corrupte kandidaat, LKG-updaten en cold-offlineproeven blijven behouden.
- Gerichte nieuwe bewijsgevallen: eerste echte download→verify zichtbaar;
  offline zonder cache geeft herstelbare splash; bruikbare actieve release
  krijgt tijdens voorbereiding/offline/fout géén nieuwe splashoverlay.
- Lint/type/unit en relevante Player/a11y/offlinecases, vervolgens bestaande
  volledige CI en productiebuild inclusief secret-/webOS-compatibiliteitsguards.
  Geen standaardbrowserresultaat als fysieke Android/TV/LG/24uacceptatie melden.

Root heeft één gefilterde frozen/offline installatie voltooid met pnpm11.5.2,
768 hergebruikte packages, nul downloads en ongewijzigde package/lock/workspace.
Root meldde circa1.1GiB vrije ruimte na uitsluitend eigen voltooide caches.
Geen eigen installatie of zware lokale volledige productiebuild. Gerichte
checks gebruiken uitsluitend eigen tijdelijke runtimes/poorten. Andere
QA-runtimes blijven staan; root beheert lopende S229/deployment.
