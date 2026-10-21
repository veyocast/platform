# S250 — Control SSR-parser vóór schedulerwerk

Status: formele dependency-taak geautoriseerd door root; geen commit/push vóór
review. Branch `veyocast/s250-control-stream-hydration`, sparse worktree
`/home/codex/repos/castivo-s250`, basis
`bf458beeeab68f066d7ce5eaf6aa7101a93205b8`.

## Definitieve ownership

Uitsluitend `apps/control/app/layout.tsx`,
`patches/next@15.5.20.patch`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
`tests/control/control-document-ready.spec.ts`,
`docs/s250-control-stream-hydration.md`, deze prompt en alleen eigen
S250-ledgerregel. Geen ander source/config/packageversie/private Reactcursor,
$RB, errorfilter, DB/auth/release/player- of serviceworkerpad veranderen.
De formele dependency-uitbreiding autoriseert de genoemde drie patch/lockpaden;
geen lockfilemutatie buiten deze noodzakelijke taak.

## Opdracht en afgegrensde oplossing

RootLayout krijgt uitsluitend `data-veyocast-document-ready="1"` op het
bestaande html-element. Gepind Next 15.5.20 blijft dezelfde packageversie en
integrity. Een pnpm patchedDependencies-patch wijzigt alleen diens vendored
Scheduler `cjs/scheduler.production.js` en `cjs/scheduler.development.js`:
voor performWorkUntilDeadline, uitsluitend bij looprunning + echte document-
SSRoptin1 + readyState loading, bestaande localSetTimeout(performWorkUntilDeadline,
8) herplannen en return; verder originele body bytegelijk. Geen $RB/private
Reactcursor/suppressie en geen fail-open timeout. De gate laat vrij zodra de
parser interactive wordt; niet claimen dat alles pas na DOMContentLoaded werkt.

Een geïsoleerde volledige Nextpackagecopy in RAM dient als echte fixturebron;
alle next/react/react-dom imports moeten diezelfde copy gebruiken. Gedeelde
rootnode_modules blijven bytegelijk. Test ongewijzigde scheduler als baseline
rood, daarna dezelfde vier cases op de gepatchte copy groen: hele document-
headhold/bodyhold met originele SSRnode/meta/linkidentiteit en knop; echte
streamed Suspense/Fizz; post-parser hydrate plus unmarked-document bypass;
opzettelijke structurele mismatch blijft gerapporteerd. NodeSSR zonder document
en echte prod/dev Scheduler parsercontract vormen aanvullende subasserties.
Expliciete events/2RAF/serverholds, geen fixed sleeps/randomloops/toleranties.

## Dependencygrens

Root reviewde patchSHA77cfedc4… en gaf expliciet de lock-only opdracht:
`pnpm install --lockfile-only --offline --ignore-scripts`, eigen TMPDIRSHM,
Nodeheap1024MiB, CPU4,5, alle20 manifests bytegelijk aan basis. Geen daadwerkelijke
install/download/node_modules- of symlinkwijziging. Alleen Nextpatchhash en
patchmetadata mogen de lockgraph wijzigen; alle overige versies/integrities/
peerrefs moeten na uitsluitend patchhashnormalisatie exact gelijk blijven.
Root voert later de gepatchte echte install, volledige foundation/build en
actuele route-/visuele cohort uit. Docker/workflowwijzigingen zijn niet nodig.

## Uitvoering en bewijs

Checkout maximaal20MiB en vrije reserve minimaal100MiB; geen fullcheckout/install.
Bestaande dependencylinks met readlink/cleanupguards zijn toegestaan.
Eén exclusieve browserworker, nul retries, geen deadlinewijziging, CPU4,5,
Nodeheap1024MiB en eigen TMPDIR/output in RAM. Geen Nextserver/build/QA-DB/auth.
Browserlaunch uitsluitend na rootGO. De laatste expliciete GO betrof exact
4baseline+4candidatecases; deze zijn werkelijk gesloten (92862exit1/11626exit0).
Bodyloze headreadiness gebruikt2nativeMessageChannelturns/Nodeconsole-event
met portsclose; alleen bodyfase gebruikt2RAF. Geen intervalpoll of deadlinewijziging.
Toon patch/redgreen/hashbewijs en echte runnerexit/Chromeclosure vóór commit.

## Historische kandidaten blijven bewaard

De oorspronkelijke body-streambaseline gaf echte HTML418 en SSRnodeverlies;
public-use/DCL-component hield die bodyrace tegen maar niet HostRootwerk vóór
body. Die sterkere headfase bleef rood. De daaropvolgende publieke
beforeInteractive-classicscript-eigenonloadroute is verworpen: daadwerkelijke
Fizzserialization zet zijn descriptor na de asyncboottag. Niet synthetisch
herschikken of groen promoveren. Alle oude component/scriptblobs en runs
blijven uitsluitend RAMhistorie; niet committen. Onjuiste nieuwe inline-
quote-fixturefout is apart vastgelegd, geen productredclaim.

## Finale readonly-reviewaanpassingen en uitslag

Root autoriseerde uitsluitend native-event outsideControl-readiness en unieke
mkdtemp-map per worker. Geen product-/lock-/deadlinedelta; dezelfde vier finale
cases herhaald zonder baselineherhaling. Sessies90585exit0/4PASS/0skip/0retry,
54199lint exit0 en61457strict specTSC exit0 zijn daadwerkelijk afgewacht.
Bewijs gebruikt verse worker-*/frameworkmanifest, niet de oude parentmap.
Beide eigen dependencylinks moeten vóór finalfreeze exact worden verwijderd;
Chromequeue blijft leeg/vrij. Rootreview vóór commit blijft verplicht.
