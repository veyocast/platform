# S250 — Control documentstream vóór React Scheduler

Control krijgt één SSR-optin `data-veyocast-document-ready="1"`. Een kleine
pnpm-patch op de vastgezette Next15.5.20 vendored Scheduler houdt alleen voor
dat document werk tegen zolang `document.readyState === "loading"`.
Zodra de parser interactive of complete is, volgt de bestaande schedulerbody.
Geen Next/Reactversie-upgrade, componentwrapper, extra scriptrequest,
Reactcursor-/Fizzpatch of foutonderdrukking.

Status: lokale fixturegates groen en reviewklaar. Werkelijke
NextAppRouter-productiebuild, actuele routes en gecombineerde acceptatie zijn
nog niet hiermee bewezen. Geen commit/push vóór rootreview.

## Product- en dependencygrens

RootLayout verschilt uitsluitend door het SSRattribuut. Metadata, CSS-imports,
html/bodyprops, children en PWA-child blijven gelijk. Alleen de productie- en
development-`performWorkUntilDeadline` in Nexts vendored Scheduler krijgen
dezelfde guard: looprunning + document + SSRoptin1 + readyState loading leidt
tot de bestaande `localSetTimeout(performWorkUntilDeadline, 8)` en return.
Verwijdering van die tien regels per bestand geeft de oorspronkelijke bytes.
Geen $RB, private hydrationcursor of catch/suppressie. Andere apps/documenten
zonder optin en NodeSSR zonder document volgen de oorspronkelijke body.

HTMLparser, netwerk en native Fizz-reveals blijven onafhankelijk lopen.
Alle initiële ControlSchedulerwerk wacht op parsercompletion. Een permanent
open response kan initiële interactie blijven uitstellen; achtergrondtimers
kunnen extra latency geven. Er is geen fail-open deadline of algemene
performanceclaim. Vrijgave bij interactive kan vóór DOMContentLoaded zijn;
alleen de oudere afgewezen component wachtte op dat event.

`patches/next@15.5.20.patch` SHA
`77cfedc4d8b99c4f5431736c3f1428fda52b6f6eac2aa89025834c20f3168420`
wordt expliciet geregistreerd in pnpm-workspace. De noodzakelijke lockupdate
is door root als dependency-taak geautoriseerd. Exact20 basis-identieke
manifests, pnpm11.5.2, `install --lockfile-only --offline --ignore-scripts`:
sessie71851 echte exit0, downloaded0/added0. Alle overige versies, integrities,
peerrefs en velden zijn na uitsluitend patchmetadata/patch_hashnormalisatie
exact gelijk:20importers/1387packages/1409snapshots, canonicalSHA
`8b98a15a622471efae53891c2555a1d1c67c85fd6b3c0a8aace166c9006e89a7`.
Nieuwe lockSHA `a200fddf363823553772498d711c2e55e36d8665d71b3263f176846697214c18`.
Gedeelde modules, eigen symlinkidentiteiten en alle manifests bleven gelijk.
Docker kopieert de patch al vóór install; geen workflow/Dockerwijziging nodig.

## Werkelijke frameworkfixture

De spec compileert de echte RootLayout met productie-Next-vendored React
`19.2.0-canary-0bdb9206-20250818`, concurrente
`startTransition(() => hydrateRoot(document, ...))` en een echte GET-only
HTTP-stream. Baseline gebruikt aantoonbaar de ongewijzigde scheduler; kandidaat
gebruikt een eigen volledige Nextpackagecopy in RAM. Alle next/react/react-dom
imports verwijzen naar dezelfde copy. Een volledige bytevergelijking over7271
bestanden bewijst dat uitsluitend de twee Schedulerbestanden verschillen.
`git apply` en Node-syntaxchecks reproduceren dezelfde twee gepatchte SHA's.

Dezelfde vier cases toetsen:

1. Head nog open/body afwezig; daarna bodyheader/SSRknop aanwezig/tail vast.
   Twee native MessageChannel-turns signaleren de bodyloze fase via Node-event;
   ports sluiten. De bodyfase behoudt twee RAF-events. Na parsercompletion
   blijven oorspronkelijke SSRmain/knop en precies één meta/stylesheet gelijk,
   en de knop werkt.
2. Echte gestreamde Suspense/Fizz-inhoud, met nog een verborgen reveal en fallback
   bij DCL, voltooit zonder vervangen van de server-shell.
3. Reeds geparseerd document hydrateert en reageert; een apart ongemarkeerd
   document voert dezelfde publieke Schedulercallback al tijdens loading/bodyloos
   uit. Dit is guard-bypassbewijs, geen volledige Marketing/Playeracceptatie.
4. Opzettelijke structurele section→article-mismatch ná parsercompletion blijft
   React418 melden; bestaande foutmelding is niet weggefilterd.

Aanvullend bewijzen echte NodeScheduler-exportcalls productie én development:
zonder document normale uitvoering; met optin/loading nog0calls bij de volgende
FIFOsetImmediate-release, daarna exact1call bij interactive. Geen timer-/React-
patch in de proef. Alleen CSS-loading en het losse PWA-registereffect zijn
expliciete fixturegrenzen. Geen Nextserver/build, QA-DB, auth, echte tenantdata,
netwerkprovider, sleeps, retries, timeoutverruiming of tolerantie.

## Bewijs en nog open grenzen

Alles staat onder `/dev/shm/veyocast-s250-stream-hydration/`. Rawreport/logs,
framework-SHAmanifest, telemetry en closurebestanden blijven bewaard; de actuele
runner-SHA's en echte exits staan in `final-freeze.json`.

| Bewijs | Uitslag en grens |
|---|---|
| `worker-final-*`, sessie90585 exit0 | Definitieve spec517ed2f1…/4PASS/3.46s/0skip/0retry. ReportSHA3ca53df1…; fresh worker-0-fklUrK/frameworkmanifest7aa7a9fc… met twee gepatchte SchedulerSHA's. Observationscf92fa23…; buitenControlwacht native-event en workerfiles uniek. |
| `event-baseline-*`, sessie92862 exit1 | Finale spec3f522aea…/ongewijzigde Scheduler:2PASS/2FAIL/0skip, echte headfatal en vroege Suspensecommit. ReportSHA613594f7…. |
| `event-candidate-*`, sessie11626 exit0 | Dezelfde4cases4PASS/3.1s/0skip/0retry. ReportSHA7c5f68b7…; observationscf92fa23…. Headloading/bodyfalse/hydrationCalls1/attempts0/commit0/fatal[]; bodyheader zichtbaar/tail afwezig/commit0. Na parse SSRmain/button/meta/link behouden, precies1, knop werkt. |
| `baseline-*`, sessie24227 exit1 | Ongewijzigde body-stream2PASS/2FAIL: echte HTML418/SSRmain+knopverlies. |
| `candidate-*`, sessie53772 exit0 | Publieke use/DCL-component4PASS voor body-stream; geen algemene headbescherming. |
| `head-baseline-*`, sessie39109 exit1 | Nieuwe inlinequote-fixturefout4FAIL; geen productredclaim. |
| `two-phase-baseline-*`, sessie2186 exit1 | Bodyloze ReactHostRoot `body.firstChild` vóór enige component; eerste case wachtte30s op nooit bereikte Witness. |
| `two-phase-candidate-*`, sessie78336 exit1 | Component3PASS/1FAIL, bodyloze head niet afgevangen; component verworpen. |
| `loader-candidate-*`/`loader-handler-unit.json` | Own-onload-classicscript alleen voorbereid/VMgetoetst. Echte Script/Fizz zette descriptor na asyncboottag; verworpen, geen browserpromotie. |
| `scheduler-baseline-*`, sessie12560 exit1 | Gepinde ongewijzigde scheduler2PASS/2FAIL met SSRmarker. |
| `scheduler-candidate-*`, sessie1214 exit1 | 3PASS/1FAIL: bodyloze headwacht gebruikte ten onrechte RAF-liveness; geen pageerror, wel30stimeout en finally-contextclosed. Rawfailure bewaard. |

Oude component/scriptbronnen staan uitsluitend in
`component-candidate-frozen/` en `loader-candidate-frozen/`, niet in de commit.
De actuele schedulerfixture corrigeert alleen de bodyloze liveness-wacht naar
een native Node-event; alle oudere assertions/body2RAF/30sdeadlines blijven.

De echte V4-React418 blijft van deze synthetische repro onderscheiden. Eerdere
beschermde SSRbytes tonen body vóór Flight, maar dat is geen bewijs van de
originele mismatchnode of een algemene Nextgarantie. Root moet de gepatchte
werkelijke install, volledige foundation, Nextbuild en actuele routecohort
nog uitvoeren. Er is geen volledige visuele ronde of productie-uitrol geclaimd.

Primaire context: [React issue37321](https://github.com/react/react/issues/37321)
en de nog niet als gepubliceerde fix aangetoonde
[PR37835](https://github.com/react/react/pull/37835). De waargenomen overeenkomst
is geen bewezen oorspronkelijke lokale Fiberdiagnose.
[pnpm lock-only](https://pnpm.io/cli/install#--lockfile-only) wijzigt de lockfile
zonder node_modulesinstallatie; de lokale hashguards bevestigen dat hier.

Scoped ESLint layout/spec: sessie54199 echte exit0 (bestaande sparsecheckout-
waarschuwing over afwezige Pages-directory). Strict specTSC:
sessie61457 echte exit0. Layout is daadwerkelijk in beide frameworkbundles
gecompileerd; volledige ControlTSC/foundation blijft rootgate. Patchtoepassing,
Node-syntaxchecks en git diffcheck zijn groen. Geen eigen Nextserver/build of
appinstall gestart. Na laatste browserrun Chrome[]; beide eigen tijdelijke
dependencylinks zijn met exact readlinkguard verwijderd. Geen commit/push.

De laatste fixtureverfijning wijzigt uitsluitend outsideControl-readiness naar
het native console-event uit de daadwerkelijke publieke Schedulercallback,
met Nodewaiter vóór goto; geen defaultRAFpoll in bodyloze documenten. Iedere
worker heeft een atomair unieke mkdtemp-map/modulecache, ook bij gedeelde
outputparent. Alle product-/lockhashes bleven gelijk. De eerdere4PASSepoch en
alle oudere rode proeven blijven bewaard; deze laatste4caseherhaling had
expliciete rootGO en vormt de definitieve fixtureuitslag.
